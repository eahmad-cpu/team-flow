import type { TeamRole } from "@/types/membership";

export interface AdminTeam {
  id: string;
  name: string;
  description: string;
  active: boolean;
}

export interface AdminUser {
  uid: string;
  displayName: string;
  email: string;
  active: boolean;
}

export interface AdminMembership {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  active: boolean;
  order: number;
}

export interface AdminDirectory {
  teams: AdminTeam[];
  users: AdminUser[];
  memberships: AdminMembership[];
}
