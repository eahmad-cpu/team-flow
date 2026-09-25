"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transferAdminMembership = exports.setAdminMembershipActive = exports.setAdminMembership = exports.setAdminUserPassword = exports.updateAdminUser = exports.createAdminUser = exports.updateAdminTeam = exports.createAdminTeam = exports.getAdminDirectory = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const authorization_js_1 = require("./authorization.js");
const firebase_admin_js_1 = require("../firebase-admin.js");
const MEMBERSHIPS_COLLECTION = "teamMemberships";
const BATCH_WRITE_LIMIT = 450;
function requiredString(value, field, maxLength = 512) {
    if (typeof value !== "string") {
        throw new https_1.HttpsError("invalid-argument", `${field} is required.`);
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > maxLength) {
        throw new https_1.HttpsError("invalid-argument", `${field} is invalid.`);
    }
    return trimmed;
}
function optionalString(value, field, maxLength = 2_000) {
    if (value === undefined) {
        return "";
    }
    if (typeof value !== "string" || value.trim().length > maxLength) {
        throw new https_1.HttpsError("invalid-argument", `${field} is invalid.`);
    }
    return value.trim();
}
function requiredRole(value) {
    if (value === "LEADER" || value === "MEMBER") {
        return value;
    }
    throw new https_1.HttpsError("invalid-argument", "A valid team role is required.");
}
function requiredBoolean(value, field) {
    if (typeof value !== "boolean") {
        throw new https_1.HttpsError("invalid-argument", `${field} is required.`);
    }
    return value;
}
function membershipId(teamId, userId) {
    return `${teamId}__${userId}`;
}
async function assertActiveTeam(teamId) {
    const team = await firebase_admin_js_1.db.collection("teams").doc(teamId).get();
    if (!team.exists || team.data()?.active !== true) {
        throw new https_1.HttpsError("failed-precondition", "The destination team is unavailable.");
    }
}
async function assertApplicationUser(userId) {
    const user = await firebase_admin_js_1.db.collection("users").doc(userId).get();
    if (!user.exists) {
        throw new https_1.HttpsError("not-found", "The application user does not exist.");
    }
}
async function nextMembershipOrder(teamId) {
    const memberships = await firebase_admin_js_1.db
        .collection(MEMBERSHIPS_COLLECTION)
        .where("teamId", "==", teamId)
        .get();
    const maxOrder = memberships.docs.reduce((highestOrder, membership) => {
        const order = membership.data().order;
        return typeof order === "number" ? Math.max(highestOrder, order) : highestOrder;
    }, 0);
    return maxOrder + 1;
}
async function addOrReactivateMembership(teamId, userId, role) {
    await assertActiveTeam(teamId);
    await assertApplicationUser(userId);
    const ref = firebase_admin_js_1.db.collection(MEMBERSHIPS_COLLECTION).doc(membershipId(teamId, userId));
    const existing = await ref.get();
    if (existing.exists) {
        await ref.update({
            role,
            active: true,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
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
        joinedAt: firestore_1.FieldValue.serverTimestamp(),
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
}
async function moveWorkspaceCollection(collectionName, userId, sourceTeamId, destinationTeamId) {
    const documents = await firebase_admin_js_1.db
        .collection(collectionName)
        .where("memberId", "==", userId)
        .where("teamId", "==", sourceTeamId)
        .get();
    for (let index = 0; index < documents.docs.length; index += BATCH_WRITE_LIMIT) {
        const batch = firebase_admin_js_1.db.batch();
        for (const document of documents.docs.slice(index, index + BATCH_WRITE_LIMIT)) {
            batch.update(document.ref, { teamId: destinationTeamId });
        }
        await batch.commit();
    }
}
async function moveMemberWorkspace(userId, sourceTeamId, destinationTeamId) {
    await moveWorkspaceCollection("taskGroups", userId, sourceTeamId, destinationTeamId);
    await moveWorkspaceCollection("roadmapGoals", userId, sourceTeamId, destinationTeamId);
    await moveWorkspaceCollection("tasks", userId, sourceTeamId, destinationTeamId);
}
exports.getAdminDirectory = (0, https_1.onCall)(async (request) => {
    await (0, authorization_js_1.requireAdmin)(request);
    const [teams, users, memberships] = await Promise.all([
        firebase_admin_js_1.db.collection("teams").get(),
        firebase_admin_js_1.db.collection("users").get(),
        firebase_admin_js_1.db.collection(MEMBERSHIPS_COLLECTION).get(),
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
exports.createAdminTeam = (0, https_1.onCall)(async (request) => {
    const adminUserId = await (0, authorization_js_1.requireAdmin)(request);
    const name = requiredString(request.data.name, "name", 160);
    const description = optionalString(request.data.description, "description");
    const ref = firebase_admin_js_1.db.collection("teams").doc();
    await ref.create({
        id: ref.id,
        name,
        description,
        active: true,
        createdBy: adminUserId,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { teamId: ref.id };
});
exports.updateAdminTeam = (0, https_1.onCall)(async (request) => {
    await (0, authorization_js_1.requireAdmin)(request);
    const teamId = requiredString(request.data.teamId, "teamId");
    const update = {
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
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
    await firebase_admin_js_1.db.collection("teams").doc(teamId).update(update);
});
exports.createAdminUser = (0, https_1.onCall)(async (request) => {
    await (0, authorization_js_1.requireAdmin)(request);
    const displayName = requiredString(request.data.displayName, "displayName", 160);
    const email = requiredString(request.data.email, "email", 320).toLowerCase();
    const password = requiredString(request.data.password, "password", 1_024);
    if (password.length < 6) {
        throw new https_1.HttpsError("invalid-argument", "The temporary password is too short.");
    }
    const authUser = await firebase_admin_js_1.adminAuth.createUser({
        email,
        password,
        displayName,
        disabled: false,
    });
    try {
        await firebase_admin_js_1.db.collection("users").doc(authUser.uid).create({
            uid: authUser.uid,
            displayName,
            email,
            photoURL: null,
            active: true,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    catch (error) {
        await firebase_admin_js_1.adminAuth.deleteUser(authUser.uid).catch(() => undefined);
        throw error;
    }
    return { uid: authUser.uid };
});
exports.updateAdminUser = (0, https_1.onCall)(async (request) => {
    await (0, authorization_js_1.requireAdmin)(request);
    const uid = requiredString(request.data.uid, "uid");
    const update = {
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    };
    if (request.data.displayName !== undefined) {
        const displayName = requiredString(request.data.displayName, "displayName", 160);
        await firebase_admin_js_1.adminAuth.updateUser(uid, { displayName });
        update.displayName = displayName;
    }
    if (request.data.active !== undefined) {
        const active = requiredBoolean(request.data.active, "active");
        await firebase_admin_js_1.adminAuth.updateUser(uid, { disabled: !active });
        update.active = active;
    }
    await firebase_admin_js_1.db.collection("users").doc(uid).update(update);
});
exports.setAdminUserPassword = (0, https_1.onCall)(async (request) => {
    await (0, authorization_js_1.requireAdmin)(request);
    const uid = requiredString(request.data.uid, "uid");
    const password = requiredString(request.data.password, "password", 1_024);
    if (password.length < 6) {
        throw new https_1.HttpsError("invalid-argument", "The password is too short.");
    }
    await firebase_admin_js_1.adminAuth.updateUser(uid, { password });
});
exports.setAdminMembership = (0, https_1.onCall)(async (request) => {
    await (0, authorization_js_1.requireAdmin)(request);
    const teamId = requiredString(request.data.teamId, "teamId");
    const userId = requiredString(request.data.userId, "userId");
    const role = requiredRole(request.data.role);
    await addOrReactivateMembership(teamId, userId, role);
});
exports.setAdminMembershipActive = (0, https_1.onCall)(async (request) => {
    await (0, authorization_js_1.requireAdmin)(request);
    const teamId = requiredString(request.data.teamId, "teamId");
    const userId = requiredString(request.data.userId, "userId");
    const active = requiredBoolean(request.data.active, "active");
    const ref = firebase_admin_js_1.db.collection(MEMBERSHIPS_COLLECTION).doc(membershipId(teamId, userId));
    const membership = await ref.get();
    if (!membership.exists) {
        throw new https_1.HttpsError("not-found", "The membership does not exist.");
    }
    await ref.update({ active, updatedAt: firestore_1.FieldValue.serverTimestamp() });
});
exports.transferAdminMembership = (0, https_1.onCall)(async (request) => {
    await (0, authorization_js_1.requireAdmin)(request);
    const userId = requiredString(request.data.userId, "userId");
    const sourceTeamId = requiredString(request.data.sourceTeamId, "sourceTeamId");
    const destinationTeamId = requiredString(request.data.destinationTeamId, "destinationTeamId");
    const role = requiredRole(request.data.role);
    const moveWorkspace = requiredBoolean(request.data.moveWorkspace, "moveWorkspace");
    if (sourceTeamId === destinationTeamId) {
        throw new https_1.HttpsError("invalid-argument", "Choose a different destination team.");
    }
    const sourceRef = firebase_admin_js_1.db
        .collection(MEMBERSHIPS_COLLECTION)
        .doc(membershipId(sourceTeamId, userId));
    const sourceMembership = await sourceRef.get();
    if (!sourceMembership.exists || sourceMembership.data()?.active !== true) {
        throw new https_1.HttpsError("failed-precondition", "The source membership is unavailable.");
    }
    await addOrReactivateMembership(destinationTeamId, userId, role);
    if (moveWorkspace) {
        await moveMemberWorkspace(userId, sourceTeamId, destinationTeamId);
    }
    await sourceRef.update({
        active: false,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
});
