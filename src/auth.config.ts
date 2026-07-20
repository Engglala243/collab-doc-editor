import type { NextAuthConfig } from "next-auth";

/**
 * Edge-compatible auth config — NO Prisma, NO Node.js-only modules.
 * Used in proxy.ts (middleware) which runs on the Edge Runtime.
 */
export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { nextUrl } = request;
      const publicPaths = ["/login", "/register", "/api/auth"];
      const isPublic = publicPaths.some((p) => nextUrl.pathname.startsWith(p));

      if (isPublic) return true;
      if (!isLoggedIn) {
        const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || nextUrl.host;
        const protocol = request.headers.get("x-forwarded-proto") || "https";
        const loginUrl = new URL(`/login?callbackUrl=${encodeURIComponent(nextUrl.pathname)}`, `${protocol}://${host}`);
        return Response.redirect(loginUrl);
      }

      return true;
    },
  },
};
