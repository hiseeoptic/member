// Emails that are ALWAYS admin — no license key needed, unlimited extension access.
// Edge-safe: plain data only, no Prisma import (used by middleware + auth config).
export const ADMIN_EMAILS = [
  "duchoa.swh21@gmail.com",
  "duchoa.klink@gmail.com",
];

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
