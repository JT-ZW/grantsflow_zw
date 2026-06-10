import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminNav from "@/components/layout/AdminNav";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["admin", "program_manager", "finance_officer", "auditor"];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defence-in-depth: verify auth + role even if middleware already checked.
  // This prevents access if middleware is misconfigured or bypassed.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !ADMIN_ROLES.includes(profile.role)) {
    redirect("/portal");
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <AdminNav />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
