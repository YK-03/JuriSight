import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/", "/guest(.*)", "/how-it-works(.*)", "/api/analyze", "/api/guest-eligibility", "/api/guest-analyze"]);
const isAuthRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(
  async (auth, request) => {
    const { userId } = await auth();

    if (userId && isAuthRoute(request)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (!isPublicRoute(request)) {
      await auth.protect();
    }
  },
  { clockSkewInMs: 60000 }
);

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
