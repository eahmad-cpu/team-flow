"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = requireAdmin;
const https_1 = require("firebase-functions/v2/https");
const firebase_admin_js_1 = require("../firebase-admin.js");
const ADMIN_EMAIL = "e.ahmad@qz.org.sa";
async function requireAdmin(request) {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication is required.");
    }
    const caller = await firebase_admin_js_1.adminAuth.getUser(request.auth.uid);
    if (caller.email?.trim().toLowerCase() !== ADMIN_EMAIL) {
        throw new https_1.HttpsError("permission-denied", "Administrator access is required.");
    }
    return caller.uid;
}
