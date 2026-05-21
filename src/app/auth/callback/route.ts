import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  // PKCE code exchange (OAuth, magic link via PKCE)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return redirectAfterAuth(supabase, origin);
    }
  }

  // OTP token hash exchange (invite emails, email confirmation)
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      if (type === "invite") {
        // Link the awardee record to this newly confirmed user
        await linkAwardeeToUser(supabase);
        return NextResponse.redirect(`${origin}/auth/set-password`);
      }
      return redirectAfterAuth(supabase, origin);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=Auth+callback+failed`);
}

/**
 * When an awardee accepts an invite, their user account is freshly created but
 * the awardee record was inserted earlier (before they had an account). We find
 * that record by email and write the user_id so the portal can resolve the link.
 */
async function linkAwardeeToUser(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return;

  const admin = createAdminClient();

  // Find the unlinked awardee record that matches this email
  const { data: awardee } = await admin
    .from("awardees")
    .select("id")
    .eq("email", user.email)
    .is("user_id", null)
    .maybeSingle();

  if (!awardee) return;

  // Set user_id on the awardee record (used by the portal page query)
  await admin.from("awardees").update({ user_id: user.id }).eq("id", awardee.id);

  // Also insert into awardee_members for the phase-12 RLS my_awardee_ids() function
  await admin.from("awardee_members").upsert(
    { awardee_id: awardee.id, profile_id: user.id, is_primary: true },
    { onConflict: "awardee_id,profile_id" }
  );
}

async function redirectAfterAuth(
  supabase: Awaited<ReturnType<typeof createClient>>,
  origin: string
): Promise<NextResponse> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/auth/login`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "awardee") {
    return NextResponse.redirect(`${origin}/portal`);
  }
  return NextResponse.redirect(`${origin}/dashboard`);
}
