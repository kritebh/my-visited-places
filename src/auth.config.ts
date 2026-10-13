import type { NextAuthConfig } from "next-auth";

const PROTECTED = ["/map", "/timeline", "/import", "/stats", "/profile", "/settings"];

/**
 * Redirect to a path on the host the browser asked for. Behind Docker or a
 * proxy (e.g. Render) `nextUrl` carries the server's internal address
 * (0.0.0.0:3000), which the browser can't reach.
 */
function redirectTo(req: Request, path: string) {
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto")?.split(",")[0] ?? new URL(req.url).protocol.replace(":", "");
  return Response.redirect(host ? `${proto}://${host}${path}` : new URL(path, req.url), 307);
}

/** Edge-safe config shared by the proxy (no database access here). */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { nextUrl } = request;
      const isProtected = PROTECTED.some((p) => nextUrl.pathname === p || nextUrl.pathname.startsWith(`${p}/`));
      if (isProtected) return auth?.user ? true : redirectTo(request, `/login?callbackUrl=${encodeURIComponent(nextUrl.pathname + nextUrl.search)}`);
      if (auth?.user && ["/", "/login", "/register"].includes(nextUrl.pathname)) return redirectTo(request, "/map");
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
