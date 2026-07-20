import type { NextAuthConfig } from "next-auth";

/**
 * Edge-compatible auth config — NO Prisma, NO Node.js-only modules.
 * Used in proxy.ts (middleware) which runs on the Edge Runtime.
 */
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const publicPaths = ["/login", "/register", "/api/auth"];
      const isPublic = publicPaths.some((p) => nextUrl.pathname.startsWith(p));

      if (isPublic) return true;
      if (!isLoggedIn) {
        const loginUrl = nextUrl.clone();
        loginUrl.pathname = "/login";
        loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
        return Response.redirect(loginUrl);
      }

      return true;
    },
  },
};
