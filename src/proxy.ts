import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

/**
 * Edge-compatible proxy (Next.js 16 replaces middleware.ts).
 * Uses only authConfig — NO Prisma, NO Node.js-only modules.
 */
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
