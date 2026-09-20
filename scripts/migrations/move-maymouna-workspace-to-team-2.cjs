const fs = require("node:fs");
const path = require("node:path");

const {
  initializeApp,
  cert,
  deleteApp,
} = require("firebase-admin/app");

const {
  getAuth,
} = require("firebase-admin/auth");

const {
  getFirestore,
} = require("firebase-admin/firestore");

/*
 * ============================================================
 * Configuration
 * ============================================================
 */

const SERVICE_ACCOUNT_PATH = path.resolve(
  __dirname,
  "../../service-account.json",
);

const APPLY =
  process.env.APPLY_MAYMOUNA_TEAM_MOVE === "1";

const MEMBER_EMAIL = "m.alfaraj@qz.org.sa";

const OLD_TEAM_ID = "executive-management-takween";
const NEW_TEAM_ID = "executive-management-2-takween";

const COLLECTIONS = [
  "taskGroups",
  "tasks",
  "roadmapGoals",
];

/*
 * ============================================================
 * Helpers
 * ============================================================
 */

let firebaseApp = null;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

async function getUserByEmail(auth, email) {
  try {
    return await auth.getUserByEmail(
      normalizeEmail(email),
    );
  } catch (error) {
    if (error?.code === "auth/user-not-found") {
      return null;
    }

    throw error;
  }
}

async function loadMemberDocs(db, collectionName, memberId) {
  const snapshot = await db
    .collection(collectionName)
    .where("memberId", "==", memberId)
    .get();

  const all = snapshot.docs.map((doc) => ({
    id: doc.id,
    ref: doc.ref,
    data: doc.data(),
  }));

  return {
    oldTeam: all.filter(
      (row) => row.data.teamId === OLD_TEAM_ID,
    ),
    newTeam: all.filter(
      (row) => row.data.teamId === NEW_TEAM_ID,
    ),
    otherTeams: all.filter(
      (row) =>
        row.data.teamId !== OLD_TEAM_ID &&
        row.data.teamId !== NEW_TEAM_ID,
    ),
  };
}

async function applyUpdates(db, rows) {
  const CHUNK_SIZE = 400;

  for (
    let offset = 0;
    offset < rows.length;
    offset += CHUNK_SIZE
  ) {
    const chunk = rows.slice(
      offset,
      offset + CHUNK_SIZE,
    );

    const batch = db.batch();

    for (const row of chunk) {
      /*
       * Intentionally update ONLY teamId.
       *
       * Do not touch:
       * - createdAt
       * - updatedAt
       * - originalDate
       * - workDate
       * - status
       * - startedAt
       * - completedAt
       * - order
       * - groupId
       * - roadmapGoalId
       */
      batch.update(row.ref, {
        teamId: NEW_TEAM_ID,
      });
    }

    await batch.commit();
  }
}

/*
 * ============================================================
 * Main
 * ============================================================
 */

async function main() {
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    throw new Error(
      `Service account not found:\n${SERVICE_ACCOUNT_PATH}`,
    );
  }

  const serviceAccount = require(SERVICE_ACCOUNT_PATH);

  firebaseApp = initializeApp({
    credential: cert(serviceAccount),
  });

  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp);

  console.log("");
  console.log("================================================");
  console.log("MOVE MAYMOUNA WORKSPACE TO EXECUTIVE TEAM 2");
  console.log("================================================");
  console.log(`Mode: ${APPLY ? "APPLY" : "PREVIEW"}`);
  console.log(`Member: ${MEMBER_EMAIL}`);
  console.log(`From: ${OLD_TEAM_ID}`);
  console.log(`To:   ${NEW_TEAM_ID}`);
  console.log("");

  /*
   * ----------------------------------------------------------
   * Resolve member
   * ----------------------------------------------------------
   */

  const user = await getUserByEmail(
    auth,
    MEMBER_EMAIL,
  );

  if (!user) {
    throw new Error(
      `Firebase Auth user not found: ${MEMBER_EMAIL}`,
    );
  }

  console.log({
    uid: user.uid,
    email: user.email,
    displayName: user.displayName ?? null,
  });

  /*
   * ----------------------------------------------------------
   * Verify teams
   * ----------------------------------------------------------
   */

  const [oldTeamSnap, newTeamSnap] =
    await Promise.all([
      db.collection("teams")
        .doc(OLD_TEAM_ID)
        .get(),

      db.collection("teams")
        .doc(NEW_TEAM_ID)
        .get(),
    ]);

  if (!oldTeamSnap.exists) {
    throw new Error(
      `Old team does not exist: ${OLD_TEAM_ID}`,
    );
  }

  if (!newTeamSnap.exists) {
    throw new Error(
      `New team does not exist: ${NEW_TEAM_ID}`,
    );
  }

  /*
   * ----------------------------------------------------------
   * Verify memberships
   * ----------------------------------------------------------
   */

  const oldMembershipId =
    `${OLD_TEAM_ID}__${user.uid}`;

  const newMembershipId =
    `${NEW_TEAM_ID}__${user.uid}`;

  const [oldMembershipSnap, newMembershipSnap] =
    await Promise.all([
      db.collection("teamMemberships")
        .doc(oldMembershipId)
        .get(),

      db.collection("teamMemberships")
        .doc(newMembershipId)
        .get(),
    ]);

  if (!oldMembershipSnap.exists) {
    throw new Error(
      "Old team membership was not found.",
    );
  }

  if (!newMembershipSnap.exists) {
    throw new Error(
      "New team membership was not found.",
    );
  }

  const oldMembership =
    oldMembershipSnap.data();

  const newMembership =
    newMembershipSnap.data();

  if (
    newMembership.active !== true ||
    newMembership.role !== "MEMBER"
  ) {
    throw new Error(
      `Expected active MEMBER membership in new team. ` +
      `Found role=${newMembership.role}, active=${newMembership.active}`,
    );
  }

  console.log("");
  console.log("MEMBERSHIP CHECK");

  console.table([
    {
      team: OLD_TEAM_ID,
      role: oldMembership.role,
      active: oldMembership.active,
    },
    {
      team: NEW_TEAM_ID,
      role: newMembership.role,
      active: newMembership.active,
    },
  ]);

  /*
   * ----------------------------------------------------------
   * Load workspace documents
   * ----------------------------------------------------------
   */

  const results = {};

  for (const collectionName of COLLECTIONS) {
    results[collectionName] =
      await loadMemberDocs(
        db,
        collectionName,
        user.uid,
      );
  }

  const taskGroups =
    results.taskGroups.oldTeam;

  const tasks =
    results.tasks.oldTeam;

  const roadmapGoals =
    results.roadmapGoals.oldTeam;

  /*
   * ----------------------------------------------------------
   * Reference integrity checks
   * ----------------------------------------------------------
   */

  const oldGroupIds = new Set(
    taskGroups.map((row) => row.id),
  );

  const newGroupIds = new Set(
    results.taskGroups.newTeam.map(
      (row) => row.id,
    ),
  );

  const oldGoalIds = new Set(
    roadmapGoals.map((row) => row.id),
  );

  const newGoalIds = new Set(
    results.roadmapGoals.newTeam.map(
      (row) => row.id,
    ),
  );

  const missingGroupReferences = [];

  const missingGoalReferences = [];

  for (const task of tasks) {
    const groupId =
      typeof task.data.groupId === "string"
        ? task.data.groupId.trim()
        : "";

    if (
      groupId &&
      !oldGroupIds.has(groupId) &&
      !newGroupIds.has(groupId)
    ) {
      missingGroupReferences.push({
        taskId: task.id,
        groupId,
        title: task.data.title ?? "",
      });
    }

    const roadmapGoalId =
      typeof task.data.roadmapGoalId === "string"
        ? task.data.roadmapGoalId.trim()
        : "";

    if (
      roadmapGoalId &&
      !oldGoalIds.has(roadmapGoalId) &&
      !newGoalIds.has(roadmapGoalId)
    ) {
      missingGoalReferences.push({
        taskId: task.id,
        roadmapGoalId,
        title: task.data.title ?? "",
      });
    }
  }

  /*
   * ----------------------------------------------------------
   * Preview summary
   * ----------------------------------------------------------
   */

  console.log("");
  console.log("WORKSPACE DOCUMENTS TO MOVE");

  console.table([
    {
      collection: "taskGroups",
      fromOldTeam: taskGroups.length,
      alreadyInNewTeam:
        results.taskGroups.newTeam.length,
    },
    {
      collection: "tasks",
      fromOldTeam: tasks.length,
      alreadyInNewTeam:
        results.tasks.newTeam.length,
    },
    {
      collection: "roadmapGoals",
      fromOldTeam: roadmapGoals.length,
      alreadyInNewTeam:
        results.roadmapGoals.newTeam.length,
    },
  ]);

  console.log("");
  console.log("TASK SAMPLE");

  console.table(
    tasks.slice(0, 20).map((row) => ({
      id: row.id,
      title: row.data.title ?? "",
      status: row.data.status ?? "",
      originalDate:
        row.data.originalDate ?? "",
      workDate:
        row.data.workDate ?? "",
      groupId:
        row.data.groupId ?? "",
      roadmapGoalId:
        row.data.roadmapGoalId ?? "",
    })),
  );

  console.log("");
  console.log("REFERENCE CHECK");

  console.log({
    missingGroupReferences:
      missingGroupReferences.length,
    missingGoalReferences:
      missingGoalReferences.length,
  });

  if (missingGroupReferences.length > 0) {
    console.log("");
    console.log("MISSING GROUP REFERENCES");
    console.table(missingGroupReferences);
  }

  if (missingGoalReferences.length > 0) {
    console.log("");
    console.log("MISSING ROADMAP REFERENCES");
    console.table(missingGoalReferences);
  }

  const totalToMove =
    taskGroups.length +
    tasks.length +
    roadmapGoals.length;

  console.log("");
  console.log({
    totalDocumentsToMove: totalToMove,
  });

  /*
   * ----------------------------------------------------------
   * Safety stop on broken references
   * ----------------------------------------------------------
   */

  if (
    missingGroupReferences.length > 0 ||
    missingGoalReferences.length > 0
  ) {
    throw new Error(
      "Reference integrity check failed. " +
      "Do not apply until the references above are reviewed.",
    );
  }

  /*
   * ----------------------------------------------------------
   * Preview ends here
   * ----------------------------------------------------------
   */

  if (!APPLY) {
    console.log("");
    console.log(
      "PREVIEW ONLY — NO WRITES WERE MADE.",
    );

    console.log("");
    console.log(
      'To apply, set APPLY_MAYMOUNA_TEAM_MOVE="1".',
    );

    return;
  }

  /*
   * ==========================================================
   * APPLY
   * ==========================================================
   */

  if (totalToMove === 0) {
    console.log("");
    console.log(
      "Nothing to move. Migration may already be complete.",
    );

    return;
  }

  /*
   * Groups and roadmap goals first, then tasks.
   * This keeps task references valid during the migration.
   */

  await applyUpdates(
    db,
    taskGroups,
  );

  await applyUpdates(
    db,
    roadmapGoals,
  );

  await applyUpdates(
    db,
    tasks,
  );

  /*
   * ----------------------------------------------------------
   * Verification
   * ----------------------------------------------------------
   */

  const verification = {};

  for (const collectionName of COLLECTIONS) {
    verification[collectionName] =
      await loadMemberDocs(
        db,
        collectionName,
        user.uid,
      );
  }

  console.log("");
  console.log("================================================");
  console.log("VERIFICATION");
  console.log("================================================");

  console.table([
    {
      collection: "taskGroups",
      remainingInOldTeam:
        verification.taskGroups.oldTeam.length,
      nowInNewTeam:
        verification.taskGroups.newTeam.length,
    },
    {
      collection: "tasks",
      remainingInOldTeam:
        verification.tasks.oldTeam.length,
      nowInNewTeam:
        verification.tasks.newTeam.length,
    },
    {
      collection: "roadmapGoals",
      remainingInOldTeam:
        verification.roadmapGoals.oldTeam.length,
      nowInNewTeam:
        verification.roadmapGoals.newTeam.length,
    },
  ]);

  const remainingOld =
    verification.taskGroups.oldTeam.length +
    verification.tasks.oldTeam.length +
    verification.roadmapGoals.oldTeam.length;

  if (remainingOld !== 0) {
    throw new Error(
      `Verification failed: ${remainingOld} documents still belong to the old team.`,
    );
  }

  console.log("");
  console.log("MOVE COMPLETE");
  console.log({
    member: MEMBER_EMAIL,
    uid: user.uid,
    movedTaskGroups: taskGroups.length,
    movedTasks: tasks.length,
    movedRoadmapGoals: roadmapGoals.length,
  });

  console.log("");
  console.log(
    "Only teamId was changed. Historical task dates/statuses were preserved.",
  );
}

main()
  .catch((error) => {
    console.error("");
    console.error("FAILED");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (firebaseApp) {
      try {
        await deleteApp(firebaseApp);
      } catch {
        // Ignore cleanup error.
      }
    }
  });