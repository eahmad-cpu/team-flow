import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";

import { adminAuth } from "../firebase-admin.js";

const ADMIN_EMAIL = "e.ahmad@qz.org.sa";

export async function requireAdmin(
  request: CallableRequest<unknown>,
): Promise<string> {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const caller = await adminAuth.getUser(request.auth.uid);

  if (caller.email?.trim().toLowerCase() !== ADMIN_EMAIL) {
    throw new HttpsError("permission-denied", "Administrator access is required.");
  }

  return caller.uid;
}
