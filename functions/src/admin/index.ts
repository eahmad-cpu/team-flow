import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { requireAdmin } from "./authorization.js";
import { adminAuth, db } from "../firebase-admin.js";

const MEMBERSHIPS_COLLECTION = "teamMemberships";
const BATCH_WRITE_LIMIT = 450;

type TeamRole = "LEADER" | "MEMBER";

interface TeamInput {
  teamId?: unknown;
  name?: unknown;
  description?: unknown;
  active?: unknown;
}

interface UserInput {
  uid?: unknown;
  displayName?: unknown;
  email?: unknown;
  password?: unknown;
  active?: unknown;
}

interface MembershipInput {
  teamId?: unknown;
  userId?: unknown;
  role?: unknown;
  active?: unknown;
}

interface TransferMembershipInput extends MembershipInput {
  sourceTeamId?: unknown;
  destinationTeamId?: unknown;
  moveWorkspace?: unknown;
}

function requiredString(value: unknown, field: string, maxLength = 512): string {
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", `${field} is required.`);
  }

  const trimmed = value.trim();

  if (!trimmed || trimmed.length > maxLength) {
    throw new HttpsError("invalid-argument", `${field} is invalid.`);
  }

  return trimmed;
}

function optionalString(value: unknown, field: string, maxLength = 2_000): string {
  if (value === undefined) {
    return "";
  }

  if (typeof value !== "string" || value.trim().length > maxLength) {
    throw new HttpsError("invalid-argument", `${field} is invalid.`);
  }

  return value.trim();
}

function requiredRole(value: unknown): TeamRole {
  if (value === "LEADER" || value === "MEMBER") {
    return value;
  }

  throw new HttpsError("invalid-argument", "A valid team role is required.");
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new HttpsError("invalid-argument", `${field} is required.`);
  }

  return value;
}

function membershipId(teamId: string, userId: string): string {
  return `${teamId}__${userId}`;
}

async function assertActiveTeam(teamId: string): Promise<void> {
  const team = await db.collection("teams").doc(teamId).get();

  if (!team.exists || team.data()?.active !== true) {
    throw new HttpsError("failed-precondition", "The destination team is unavailable.");
  }
}

async function assertApplicationUser(userId: string): Promise<void> {
  const user = await db.collection("users").doc(userId).get();

  if (!user.exists) {
    throw new HttpsError("not-found", "The application user does not exist.");
  }
}

async function nextMembershipOrder(teamId: string): Promise<number> {
  const memberships = await db
    .collection(MEMBERSHIPS_COLLECTION)
    .where("teamId", "==", teamId)
    .get();
  const maxOrder = memberships.docs.reduce((highestOrder, membership) => {
    const order = membership.data().order;

    return typeof order === "number" ? Math.max(highestOrder, order) : highestOrder;
  }, 0);

  return maxOrder + 1;
}

async function addOrReactivateMembership(
  teamId: string,
  userId: string,
  role: TeamRole,
): Promise<void> {
  await assertActiveTeam(teamId);
  await assertApplicationUser(userId);

  const ref = db.collection(MEMBERSHIPS_COLLECTION).doc(membershipId(teamId, userId));
  const existing = await ref.get();

  if (existing.exists) {
    await ref.update({
      role,
      active: true,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  const order = await nextMembershipOrder(teamId);
  await ref.create({
    id: ref.id,
    teamId,
    userId,
    role,
    active: true,
    order,
    joinedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function moveWorkspaceCollection(
  collectionName: "taskGroups" | "roadmapGoals" | "tasks",
  userId: string,
  sourceTeamId: string,
  destinationTeamId: string,
): Promise<void> {
  const documents = await db
    .collection(collectionName)
    .where("memberId", "==", userId)
    .where("teamId", "==", sourceTeamId)
    .get();

  for (let index = 0; index < documents.docs.length; index += BATCH_WRITE_LIMIT) {
    const batch = db.batch();

    for (const document of documents.docs.slice(index, index + BATCH_WRITE_LIMIT)) {
      batch.update(document.ref, { teamId: destinationTeamId });
    }

    await batch.commit();
  }
}

async function moveMemberWorkspace(
  userId: string,
  sourceTeamId: string,
  destinationTeamId: string,
): Promise<void> {
  await moveWorkspaceCollection("taskGroups", userId, sourceTeamId, destinationTeamId);
  await moveWorkspaceCollection("roadmapGoals", userId, sourceTeamId, destinationTeamId);
  await moveWorkspaceCollection("tasks", userId, sourceTeamId, destinationTeamId);
}

export const getAdminDirectory = onCall(async (request) => {
  await requireAdmin(request);

  const [teams, users, memberships] = await Promise.all([
    db.collection("teams").get(),
    db.collection("users").get(),
    db.collection(MEMBERSHIPS_COLLECTION).get(),
  ]);

  return {
    teams: teams.docs.map((team) => {
      const data = team.data();

      return {
        id: team.id,
        name: typeof data.name === "string" ? data.name : "",
        description: typeof data.description === "string" ? data.description : "",
        active: data.active === true,
      };
    }),
    users: users.docs.map((user) => {
      const data = user.data();

      return {
        uid: user.id,
        displayName: typeof data.displayName === "string" ? data.displayName : "",
        email: typeof data.email === "string" ? data.email : "",
        active: data.active === true,
      };
    }),
    memberships: memberships.docs.map((membership) => {
      const data = membership.data();

      return {
        id: membership.id,
        teamId: typeof data.teamId === "string" ? data.teamId : "",
        userId: typeof data.userId === "string" ? data.userId : "",
        role: data.role === "LEADER" ? "LEADER" : "MEMBER",
        active: data.active === true,
        order: typeof data.order === "number" ? data.order : 0,
      };
    }),
  };
});

export const createAdminTeam = onCall<TeamInput>(async (request) => {
  const adminUserId = await requireAdmin(request);
  const name = requiredString(request.data.name, "name", 160);
  const description = optionalString(request.data.description, "description");
  const ref = db.collection("teams").doc();

  await ref.create({
    id: ref.id,
    name,
    description,
    active: true,
    createdBy: adminUserId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { teamId: ref.id };
});

export const updateAdminTeam = onCall<TeamInput>(async (request) => {
  await requireAdmin(request);
  const teamId = requiredString(request.data.teamId, "teamId");
  const update: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (request.data.name !== undefined) {
    update.name = requiredString(request.data.name, "name", 160);
  }
  if (request.data.description !== undefined) {
    update.description = optionalString(request.data.description, "description");
  }
  if (request.data.active !== undefined) {
    update.active = requiredBoolean(request.data.active, "active");
  }

  await db.collection("teams").doc(teamId).update(update);
});

export const createAdminUser = onCall<UserInput>(async (request) => {
  await requireAdmin(request);
  const displayName = requiredString(request.data.displayName, "displayName", 160);
  const email = requiredString(request.data.email, "email", 320).toLowerCase();
  const password = requiredString(request.data.password, "password", 1_024);

  if (password.length < 6) {
    throw new HttpsError("invalid-argument", "The temporary password is too short.");
  }

  const authUser = await adminAuth.createUser({
    email,
    password,
    displayName,
    disabled: false,
  });

  try {
    await db.collection("users").doc(authUser.uid).create({
      uid: authUser.uid,
      displayName,
      email,
      photoURL: null,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    await adminAuth.deleteUser(authUser.uid).catch(() => undefined);
    throw error;
  }

  return { uid: authUser.uid };
});

export const updateAdminUser = onCall<UserInput>(async (request) => {
  await requireAdmin(request);
  const uid = requiredString(request.data.uid, "uid");
  const update: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (request.data.displayName !== undefined) {
    const displayName = requiredString(request.data.displayName, "displayName", 160);
    await adminAuth.updateUser(uid, { displayName });
    update.displayName = displayName;
  }

  if (request.data.active !== undefined) {
    const active = requiredBoolean(request.data.active, "active");
    await adminAuth.updateUser(uid, { disabled: !active });
    update.active = active;
  }

  await db.collection("users").doc(uid).update(update);
});

export const setAdminUserPassword = onCall<UserInput>(async (request) => {
  await requireAdmin(request);
  const uid = requiredString(request.data.uid, "uid");
  const password = requiredString(request.data.password, "password", 1_024);

  if (password.length < 6) {
    throw new HttpsError("invalid-argument", "The password is too short.");
  }

  await adminAuth.updateUser(uid, { password });
});

export const setAdminMembership = onCall<MembershipInput>(async (request) => {
  await requireAdmin(request);
  const teamId = requiredString(request.data.teamId, "teamId");
  const userId = requiredString(request.data.userId, "userId");
  const role = requiredRole(request.data.role);

  await addOrReactivateMembership(teamId, userId, role);
});

export const setAdminMembershipActive = onCall<MembershipInput>(async (request) => {
  await requireAdmin(request);
  const teamId = requiredString(request.data.teamId, "teamId");
  const userId = requiredString(request.data.userId, "userId");
  const active = requiredBoolean(request.data.active, "active");
  const ref = db.collection(MEMBERSHIPS_COLLECTION).doc(membershipId(teamId, userId));
  const membership = await ref.get();

  if (!membership.exists) {
    throw new HttpsError("not-found", "The membership does not exist.");
  }

  await ref.update({ active, updatedAt: FieldValue.serverTimestamp() });
});

export const transferAdminMembership = onCall<TransferMembershipInput>(async (request) => {
  await requireAdmin(request);
  const userId = requiredString(request.data.userId, "userId");
  const sourceTeamId = requiredString(request.data.sourceTeamId, "sourceTeamId");
  const destinationTeamId = requiredString(
    request.data.destinationTeamId,
    "destinationTeamId",
  );
  const role = requiredRole(request.data.role);
  const moveWorkspace = requiredBoolean(request.data.moveWorkspace, "moveWorkspace");

  if (sourceTeamId === destinationTeamId) {
    throw new HttpsError("invalid-argument", "Choose a different destination team.");
  }

  const sourceRef = db
    .collection(MEMBERSHIPS_COLLECTION)
    .doc(membershipId(sourceTeamId, userId));
  const sourceMembership = await sourceRef.get();

  if (!sourceMembership.exists || sourceMembership.data()?.active !== true) {
    throw new HttpsError("failed-precondition", "The source membership is unavailable.");
  }

  await addOrReactivateMembership(destinationTeamId, userId, role);

  if (moveWorkspace) {
    await moveMemberWorkspace(userId, sourceTeamId, destinationTeamId);
  }

  await sourceRef.update({
    active: false,
    updatedAt: FieldValue.serverTimestamp(),
  });
});
