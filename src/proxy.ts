import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Roles that may access the admin area
const ADMIN_ROLES = new Set(["admin", "program_manager", "finance_officer", "auditor"]);

// Route prefixes that belong exclusively to the admin area
const ADMIN_PREFIXES = [
  "/dashboard", "/awardees", "/finances", "/analytics",
  "/impact", "/reports", "/audit", "/users", "/notifications",
  "/programmes", "/compliance",
];

// Route prefixes that belong exclusively to the awardee portal
const AWARDEE_PREFIXES = ["/portal"];

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — do NOT remove this
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public routes — allow through without auth
  const publicPrefixes = ["/auth/", "/api/"];
  if (publicPrefixes.some((p) => pathname.startsWith(p))) {
    return supabaseResponse;
  }

  // Not authenticated → redirect to login
  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    return NextResponse.redirect(loginUrl);
  }

  // Role-based routing: fetch role from profiles table
  // (this is a lightweight single-column query, cached by Supabase edge)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "";

  const isAdminRoute  = ADMIN_PREFIXES.some((p) => pathname.startsWith(p));
  const isPortalRoute = AWARDEE_PREFIXES.some((p) => pathname.startsWith(p));

  if (isAdminRoute && !ADMIN_ROLES.has(role)) {
    // Awardee trying to access admin area → send to portal
    const dest = request.nextUrl.clone();
    dest.pathname = "/portal";
    return NextResponse.redirect(dest);
  }

  if (isPortalRoute && role !== "awardee") {
    // Admin user trying to access portal area → send to dashboard
    const dest = request.nextUrl.clone();
    dest.pathname = "/dashboard";
    return NextResponse.redirect(dest);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
