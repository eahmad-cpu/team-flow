const fs = require("node:fs");
const path = require("node:path");

const { initializeApp, cert, deleteApp } = require("firebase-admin/app");

const { getAuth } = require("firebase-admin/auth");

const { getFirestore, FieldValue } = require("firebase-admin/firestore");

/*
 * ============================================================
 * Configuration
 * ============================================================
 */

const SERVICE_ACCOUNT_PATH = path.resolve(
  __dirname,
  "../../service-account.json",
);

const APPLY = process.env.APPLY_EXECUTIVE_TEAM_2 === "1";

const OLD_TEAM = {
  id: "executive-management-takween",
  name: "الإدارة التنفيذية - تكوين",
};

const NEW_TEAM = {
  id: "executive-management-2-takween",
  name: "الإدارة التنفيذية 2 - تكوين",
  description: "",
};

/*
 * Existing primary leader.
 * Must already exist in Firebase Auth.
 */
const PRIMARY_LEADER = {
  displayName: "قائد الفريق",
  email: "pres.tk@qz.org.sa",
};

/*
 * CEO account.
 * Same real person as asalfayez@qz.org.sa,
 * but this is intentionally a separate Firebase Auth account.
 */
const CEO_LEADER = {
  displayName: "عبدالله سليمان الفايز",
  email: "ceo-takween@qz.org.sa",
  temporaryPassword: "1077448080",
};

/*
 * Leader of Executive Management 2.
 */
const HESSA_LEADER = {
  displayName: "حصه محمد الفهد",
  email: "halfahad@qz.org.sa",
  temporaryPassword: "1020230551",
};

/*
 * Existing members that must leave the OLD team
 * and become members of the NEW team.
 *
 * Their Auth accounts already exist, so passwords
 * are NOT reset or touched.
 */
const MOVED_EXISTING_MEMBERS = [
  {
    displayName: "ميمونة أحمد الجوير",
    email: "m.alfaraj@qz.org.sa",
  },
  {
    displayName: "أروى عبدالله الشايع",
    email: "aa.alshaya@qz.org.sa",
  },
];

/*
 * New members for Executive Management 2.
 */
const NEW_MEMBERS = [
  {
    displayName: "انفال عبدالعزيز الجاسر",
    email: "a.aljasir@qz.org.sa",
    temporaryPassword: "1092667474",
  },
  {
    displayName: "ريف فهد المحترش",
    email: "r.almuhatrsh@qz.org.sa",
    temporaryPassword: "1098380866",
  },
  {
    displayName: "مرام صالح الفراج",
    email: "m.alfrraj@qz.org.sa",
    temporaryPassword: "1078399795",
  },
  {
    displayName: "لولوه عبدالعزيز السويكت",
    email: "la.alsuwiket@qz.org.sa",
    temporaryPassword: "1027636644",
  },
];

const NEW_TEAM_LEADERS = [
  PRIMARY_LEADER.email,
  CEO_LEADER.email,
  HESSA_LEADER.email,
];

const NEW_TEAM_MEMBER_ORDER = [
  "m.alfaraj@qz.org.sa",
  "aa.alshaya@qz.org.sa",
  "a.aljasir@qz.org.sa",
  "r.almuhatrsh@qz.org.sa",
  "m.alfrraj@qz.org.sa",
  "la.alsuwiket@qz.org.sa",
];

/*
 * ============================================================
 * Helpers
 * ============================================================
 */

let firebaseApp = null;

function serverTimestamp() {
  return FieldValue.serverTimestamp();
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

async function getAuthUserByEmail(auth, email) {
  try {
    return await auth.getUserByEmail(normalizeEmail(email));
  } catch (error) {
    if (error?.code === "auth/user-not-found") {
      return null;
    }

    throw error;
  }
}

async function ensureExistingAuthUser(auth, person) {
  const user = await getAuthUserByEmail(auth, person.email);

  if (!user) {
    throw new Error(
      `Expected existing Firebase Auth account was not found: ${person.email}`,
    );
  }

  return user;
}

async function ensureAuthUser(auth, person) {
  let user = await getAuthUserByEmail(auth, person.email);

  if (user) {
    return {
      user,
      action: "EXISTING",
    };
  }

  if (!person.temporaryPassword) {
    throw new Error(
      `Cannot create Auth user without temporaryPassword: ${person.email}`,
    );
  }

  if (!APPLY) {
    return {
      user: null,
      action: "WOULD_CREATE",
    };
  }

  user = await auth.createUser({
    email: normalizeEmail(person.email),
    password: person.temporaryPassword,
    displayName: person.displayName,
    disabled: false,
    emailVerified: false,
  });

  return {
    user,
    action: "CREATED",
  };
}

async function ensureUserProfile(db, authUser, person) {
  if (!authUser) {
    return "WOULD_CREATE";
  }

  const ref = db.collection("users").doc(authUser.uid);
  const snap = await ref.get();

  if (!APPLY) {
    return snap.exists ? "WOULD_UPDATE" : "WOULD_CREATE";
  }

  if (!snap.exists) {
    await ref.set({
      uid: authUser.uid,
      displayName: person.displayName,
      email: normalizeEmail(person.email),
      photoURL: authUser.photoURL ?? null,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return "CREATED";
  }

  await ref.set(
    {
      uid: authUser.uid,
      displayName: person.displayName,
      email: normalizeEmail(person.email),
      active: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return "UPDATED";
}

async function ensureMembership({ db, authUser, teamId, role, order }) {
  if (!authUser) {
    return {
      action: "WOULD_CREATE",
      membershipId: null,
    };
  }

  const membershipId = `${teamId}__${authUser.uid}`;

  const ref = db.collection("teamMemberships").doc(membershipId);

  const snap = await ref.get();

  if (!APPLY) {
    return {
      action: snap.exists ? "WOULD_UPDATE" : "WOULD_CREATE",
      membershipId,
    };
  }

  if (!snap.exists) {
    await ref.set({
      id: membershipId,
      teamId,
      userId: authUser.uid,
      role,
      active: true,
      order,
      joinedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      action: "CREATED",
      membershipId,
    };
  }

  await ref.set(
    {
      id: membershipId,
      teamId,
      userId: authUser.uid,
      role,
      active: true,
      order,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return {
    action: "UPDATED",
    membershipId,
  };
}

/*
 * ============================================================
 * Main
 * ============================================================
 */

async function main() {
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    throw new Error(`Service account not found:\n${SERVICE_ACCOUNT_PATH}`);
  }

  const serviceAccount = require(SERVICE_ACCOUNT_PATH);

  firebaseApp = initializeApp({
    credential: cert(serviceAccount),
  });

  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp);

  console.log("");
  console.log("================================================");
  console.log("EXECUTIVE MANAGEMENT 2 SETUP");
  console.log("================================================");
  console.log(`Mode: ${APPLY ? "APPLY" : "PREVIEW"}`);
  console.log(`Old team: ${OLD_TEAM.name}`);
  console.log(`New team: ${NEW_TEAM.name}`);
  console.log("");

  /*
   * ----------------------------------------------------------
   * Verify OLD team
   * ----------------------------------------------------------
   */

  const oldTeamRef = db.collection("teams").doc(OLD_TEAM.id);

  const oldTeamSnap = await oldTeamRef.get();

  if (!oldTeamSnap.exists) {
    throw new Error(`Old team not found: ${OLD_TEAM.id}`);
  }

  /*
   * ----------------------------------------------------------
   * Verify primary leader exists
   * ----------------------------------------------------------
   */

  const presUser = await ensureExistingAuthUser(auth, PRIMARY_LEADER);

  /*
   * ----------------------------------------------------------
   * Verify moved members exist
   * ----------------------------------------------------------
   */

  const movedUsers = [];

  for (const person of MOVED_EXISTING_MEMBERS) {
    const user = await ensureExistingAuthUser(auth, person);

    movedUsers.push({
      person,
      user,
    });
  }

  /*
   * ----------------------------------------------------------
   * Preview/create CEO + Hessa + new members
   * ----------------------------------------------------------
   */

  const accountsToEnsure = [CEO_LEADER, HESSA_LEADER, ...NEW_MEMBERS];

  const resolvedAccounts = new Map();

  for (const person of accountsToEnsure) {
    const result = await ensureAuthUser(auth, person);

    resolvedAccounts.set(normalizeEmail(person.email), {
      person,
      ...result,
    });
  }

  /*
   * ----------------------------------------------------------
   * Preview team creation
   * ----------------------------------------------------------
   */

  const newTeamRef = db.collection("teams").doc(NEW_TEAM.id);

  const newTeamSnap = await newTeamRef.get();

  const teamAction = newTeamSnap.exists
    ? "EXISTING"
    : APPLY
      ? "CREATE"
      : "WOULD_CREATE";

  /*
   * ----------------------------------------------------------
   * Plan output
   * ----------------------------------------------------------
   */

  const accountPlan = [];

  accountPlan.push({
    name: PRIMARY_LEADER.displayName,
    email: PRIMARY_LEADER.email,
    role: "LEADER / BOTH TEAMS",
    auth: "EXISTING",
  });

  for (const [email, entry] of resolvedAccounts) {
    accountPlan.push({
      name: entry.person.displayName,
      email,
      role:
        email === normalizeEmail(CEO_LEADER.email)
          ? "LEADER / BOTH TEAMS"
          : email === normalizeEmail(HESSA_LEADER.email)
            ? "LEADER / NEW TEAM"
            : "MEMBER / NEW TEAM",
      auth: entry.action,
    });
  }

  for (const entry of movedUsers) {
    accountPlan.push({
      name: entry.person.displayName,
      email: entry.person.email,
      role: "MOVE OLD → NEW",
      auth: "EXISTING",
    });
  }

  console.log("ACCOUNT PLAN");
  console.table(accountPlan);

  console.log("");
  console.log("TEAM PLAN");
  console.table([
    {
      teamId: NEW_TEAM.id,
      name: NEW_TEAM.name,
      action: teamAction,
    },
  ]);

  console.log("");
  console.log("OLD TEAM CHANGES");
  console.table(
    movedUsers.map(({ person }) => ({
      email: person.email,
      action: "DEACTIVATE MEMBER MEMBERSHIP",
    })),
  );

  console.log("");
  console.log("NEW TEAM LEADERS");
  console.table(
    NEW_TEAM_LEADERS.map((email, index) => ({
      order: index + 1,
      email,
      role: "LEADER",
    })),
  );

  console.log("");
  console.log("NEW TEAM MEMBERS");
  console.table(
    NEW_TEAM_MEMBER_ORDER.map((email, index) => ({
      order: index + 1,
      email,
      role: "MEMBER",
    })),
  );

  /*
   * ----------------------------------------------------------
   * Preview ends here
   * ----------------------------------------------------------
   */

  if (!APPLY) {
    console.log("");
    console.log("PREVIEW ONLY — NO WRITES WERE MADE.");
    console.log("");
    console.log('Run with APPLY_EXECUTIVE_TEAM_2="1" to apply.');

    return;
  }

  /*
   * ==========================================================
   * APPLY
   * ==========================================================
   */

  /*
   * ----------------------------------------------------------
   * Create/update missing Auth users again now that APPLY=true
   * ----------------------------------------------------------
   *
   * This section also handles the case where preview found
   * accounts that did not yet exist.
   */

  const finalUsersByEmail = new Map();

  finalUsersByEmail.set(normalizeEmail(PRIMARY_LEADER.email), {
    person: PRIMARY_LEADER,
    user: presUser,
  });

  for (const person of accountsToEnsure) {
    const authResult = await ensureAuthUser(auth, person);

    const user = authResult.user;

    if (!user) {
      throw new Error(`Failed to resolve/create Auth user: ${person.email}`);
    }

    /*
     * Keep Auth displayName correct without changing password.
     */
    let finalUser = user;

    const authUpdates = {};

    if (user.displayName !== person.displayName) {
      authUpdates.displayName = person.displayName;
    }

    if (user.disabled) {
      authUpdates.disabled = false;
    }

    if (Object.keys(authUpdates).length > 0) {
      finalUser = await auth.updateUser(user.uid, authUpdates);
    }

    finalUsersByEmail.set(normalizeEmail(person.email), {
      person,
      user: finalUser,
    });
  }

  for (const entry of movedUsers) {
    finalUsersByEmail.set(normalizeEmail(entry.person.email), entry);
  }

  /*
   * ----------------------------------------------------------
   * Ensure user profiles
   * ----------------------------------------------------------
   */

  for (const { person, user } of finalUsersByEmail.values()) {
    if (normalizeEmail(person.email) === normalizeEmail(PRIMARY_LEADER.email)) {
      continue;
    }

    await ensureUserProfile(db, user, person);
  }

  /*
   * ----------------------------------------------------------
   * Create/update NEW team
   * ----------------------------------------------------------
   */

  if (!newTeamSnap.exists) {
    await newTeamRef.set({
      id: NEW_TEAM.id,
      name: NEW_TEAM.name,
      description: NEW_TEAM.description,
      active: true,
      createdBy: presUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    await newTeamRef.set(
      {
        id: NEW_TEAM.id,
        name: NEW_TEAM.name,
        description: NEW_TEAM.description,
        active: true,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  /*
   * ----------------------------------------------------------
   * CEO becomes LEADER of OLD team
   * ----------------------------------------------------------
   */

  const ceoEntry = finalUsersByEmail.get(normalizeEmail(CEO_LEADER.email));

  if (!ceoEntry) {
    throw new Error("CEO account could not be resolved.");
  }

  await ensureMembership({
    db,
    authUser: ceoEntry.user,
    teamId: OLD_TEAM.id,
    role: "LEADER",
    order: 2,
  });

  /*
   * ----------------------------------------------------------
   * Preserve / normalize pres as leader of OLD team
   * ----------------------------------------------------------
   */

  await ensureMembership({
    db,
    authUser: presUser,
    teamId: OLD_TEAM.id,
    role: "LEADER",
    order: 1,
  });

  /*
   * ----------------------------------------------------------
   * Deactivate Mimeona + Arwa from OLD team
   * ----------------------------------------------------------
   */

  for (const { person, user } of movedUsers) {
    const membershipId = `${OLD_TEAM.id}__${user.uid}`;

    const ref = db.collection("teamMemberships").doc(membershipId);

    const snap = await ref.get();

    if (!snap.exists) {
      throw new Error(
        `Old team membership not found for moved member: ${person.email}`,
      );
    }

    const data = snap.data();

    if (data.role !== "MEMBER") {
      throw new Error(
        `Expected MEMBER role in old team for ${person.email}, found: ${data.role}`,
      );
    }

    await ref.set(
      {
        active: false,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  /*
   * ----------------------------------------------------------
   * Create NEW team leader memberships
   * ----------------------------------------------------------
   */

  for (let index = 0; index < NEW_TEAM_LEADERS.length; index += 1) {
    const email = normalizeEmail(NEW_TEAM_LEADERS[index]);

    const entry = finalUsersByEmail.get(email);

    if (!entry) {
      throw new Error(`Unable to resolve new-team leader: ${email}`);
    }

    await ensureMembership({
      db,
      authUser: entry.user,
      teamId: NEW_TEAM.id,
      role: "LEADER",
      order: index + 1,
    });
  }

  /*
   * ----------------------------------------------------------
   * Create NEW team member memberships
   * ----------------------------------------------------------
   */

  for (let index = 0; index < NEW_TEAM_MEMBER_ORDER.length; index += 1) {
    const email = normalizeEmail(NEW_TEAM_MEMBER_ORDER[index]);

    const entry = finalUsersByEmail.get(email);

    if (!entry) {
      throw new Error(`Unable to resolve new-team member: ${email}`);
    }

    await ensureMembership({
      db,
      authUser: entry.user,
      teamId: NEW_TEAM.id,
      role: "MEMBER",
      order: index + 1,
    });
  }

  /*
   * ----------------------------------------------------------
   * Verification summary
   * ----------------------------------------------------------
   */

  const newTeamMemberships = await db
    .collection("teamMemberships")
    .where("teamId", "==", NEW_TEAM.id)
    .get();

  const leaderCount = newTeamMemberships.docs.filter(
    (doc) => doc.data().active === true && doc.data().role === "LEADER",
  ).length;

  const memberCount = newTeamMemberships.docs.filter(
    (doc) => doc.data().active === true && doc.data().role === "MEMBER",
  ).length;

  console.log("");
  console.log("================================================");
  console.log("APPLY COMPLETE");
  console.log("================================================");

  console.log({
    oldTeam: OLD_TEAM.name,
    newTeam: NEW_TEAM.name,
    newTeamActiveLeaders: leaderCount,
    newTeamActiveMembers: memberCount,
    movedOutOfOldTeam: MOVED_EXISTING_MEMBERS.length,
  });

  console.log("");
  console.log("Expected new team:");
  console.log("- 3 active leaders");
  console.log("- 6 active members");
  console.log("");
  console.log("Completed successfully.");
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
