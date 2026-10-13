import type { NextAuthConfig } from "next-auth";

const PROTECTED = ["/map", "/timeline", "/import", "/stats", "/profile", "/settings"];

/** Edge-safe config shared by the proxy (no database access here). */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isProtected = PROTECTED.some((p) => nextUrl.pathname === p || nextUrl.pathname.startsWith(`${p}/`));
      if (isProtected) return !!auth?.user;
      if (auth?.user && ["/", "/login", "/register"].includes(nextUrl.pathname)) {
        return Response.redirect(new URL("/map", nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid && session.user) session.user.id = token.uid as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
