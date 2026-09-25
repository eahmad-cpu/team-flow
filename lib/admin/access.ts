export const ADMIN_EMAIL = "e.ahmad@qz.org.sa";

export function isAdminEmail(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === ADMIN_EMAIL;
}
