import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: ["/", "/map/:path*", "/timeline/:path*", "/import/:path*", "/stats/:path*", "/profile/:path*", "/settings/:path*", "/login", "/register"],
};
