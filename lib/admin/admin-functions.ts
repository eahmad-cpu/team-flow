import { httpsCallable } from "firebase/functions";

import { functions } from "@/lib/firebase/client";
import type { TeamRole } from "@/types/membership";

import type { AdminDirectory } from "./types";

export function getAdminDirectory(): Promise<AdminDirectory> {
  return httpsCallable<void, AdminDirectory>(functions, "getAdminDirectory")().then(
    (result) => result.data,
  );
}

export async function createAdminTeam(input: {
  name: string;
  description: string;
}): Promise<void> {
  await httpsCallable<typeof input, { teamId: string }>(
    functions,
    "createAdminTeam",
  )(input);
}

export async function updateAdminTeam(input: {
  teamId: string;
  name?: string;
  description?: string;
  active?: boolean;
}): Promise<void> {
  await httpsCallable<typeof input, void>(functions, "updateAdminTeam")(input);
}

export async function createAdminUser(input: {
  displayName: string;
  email: string;
  password: string;
}): Promise<void> {
  await httpsCallable<typeof input, { uid: string }>(
    functions,
    "createAdminUser",
  )(input);
}

export async function updateAdminUser(input: {
  uid: string;
  displayName?: string;
  active?: boolean;
}): Promise<void> {
  await httpsCallable<typeof input, void>(functions, "updateAdminUser")(input);
}

export async function setAdminUserPassword(input: {
  uid: string;
  password: string;
}): Promise<void> {
  await httpsCallable<typeof input, void>(
    functions,
    "setAdminUserPassword",
  )(input);
}

export async function setAdminMembership(input: {
  teamId: string;
  userId: string;
  role: TeamRole;
}): Promise<void> {
  await httpsCallable<typeof input, void>(
    functions,
    "setAdminMembership",
  )(input);
}

export async function setAdminMembershipActive(input: {
  teamId: string;
  userId: string;
  active: boolean;
}): Promise<void> {
  await httpsCallable<typeof input, void>(
    functions,
    "setAdminMembershipActive",
  )(input);
}

export async function transferAdminMembership(input: {
  userId: string;
  sourceTeamId: string;
  destinationTeamId: string;
  role: TeamRole;
  moveWorkspace: boolean;
}): Promise<void> {
  await httpsCallable<typeof input, void>(
    functions,
    "transferAdminMembership",
  )(input);
}
