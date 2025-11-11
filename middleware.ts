import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  // Clone the request so the response shares the same cookies
  const res = NextResponse.next({ request: { headers: req.headers } });
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  const path = req.nextUrl.pathname;

  // Handle Supabase error
  if (error) {
    console.error("Middleware Supabase error:", error.message);
    if (path.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return res;
  }

  // Redirect logged-in users away from public pages
  if (session && ["/", "/login", "/landing"].includes(path)) {
    const role = session.user.user_metadata?.role;
    const home =
      role === "professor"
        ? "/dashboard/professor"
        : "/dashboard/student";
    return NextResponse.redirect(new URL(home, req.url));
  }

  // Protect dashboard routes
  if (!session && path.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Role mismatch protection
  if (session && path.startsWith("/dashboard")) {
    const role = session.user.user_metadata?.role;
    const isProfPath = path.startsWith("/dashboard/professor");
    const isStudentPath = path.startsWith("/dashboard/student");

    if (role === "professor" && !isProfPath) {
      return NextResponse.redirect(new URL("/dashboard/professor", req.url));
    }

    if (role === "student" && !isStudentPath) {
      return NextResponse.redirect(new URL("/dashboard/student", req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ["/", "/login", "/landing", "/dashboard/:path*"],
};
