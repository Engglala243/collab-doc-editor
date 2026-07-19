import { Role } from "@prisma/client";

export type UserRole = "OWNER" | "EDITOR" | "VIEWER";

/**
 * Returns true if the role can view (read) a document.
 */
export function canView(role: UserRole | null | undefined): boolean {
  return role === "OWNER" || role === "EDITOR" || role === "VIEWER";
}

/**
 * Returns true if the role can edit (write) a document.
 */
export function canEdit(role: UserRole | null | undefined): boolean {
  return role === "OWNER" || role === "EDITOR";
}

/**
 * Returns true if the role can manage members / delete / admin actions.
 */
export function canManage(role: UserRole | null | undefined): boolean {
  return role === "OWNER";
}

/**
 * Resolves the effective role of a user on a document.
 * Returns null if the user has no access.
 */
export function resolveRole(
  ownerId: string,
  userId: string,
  memberRole?: Role | null,
): UserRole | null {
  if (ownerId === userId) return "OWNER";
  if (memberRole) return memberRole as UserRole;
  return null;
}
