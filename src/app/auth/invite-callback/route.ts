import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Dedicated callback for invite-flow only.
 * Supabase redirects here after verifying the invite token (PKCE code or OTP hash).
 * We establish the session, link the awardee record, then send to set-password.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code      = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type      = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  // ── PKCE flow (default with @supabase/ssr) ────────────────────────────
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await linkAwardeeToUser(supabase);
      return NextResponse.redirect(`${origin}/auth/set-password`);
    }
  }

  // ── OTP / token-hash flow (non-PKCE environments) ────────────────────
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      await linkAwardeeToUser(supabase);
      return NextResponse.redirect(`${origin}/auth/set-password`);
    }
  }

  return NextResponse.redirect(
    `${origin}/auth/login?error=${encodeURIComponent("Invite link expired or invalid — please ask an admin to resend.")}`
  );
}

/**
 * When an awardee accepts an invite their auth user is freshly created,
 * but the awardee record was inserted earlier (before they had an account).
 * Find the awardee record by email and write the user_id so the portal works.
 */
async function linkAwardeeToUser(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return;

  const admin = createAdminClient();

  // Ensure the profile role is "awardee" (it should be set by the invite action,
  // but this is a safety net in case the trigger ran with a different default).
  await admin
    .from("profiles")
    .update({ role: "awardee" })
    .eq("id", user.id)
    .eq("role", "awardee"); // only overwrite if already awardee — don't downgrade admins

  // Find the unlinked awardee record matching this email
  const { data: awardee } = await admin
    .from("awardees")
    .select("id")
    .eq("email", user.email)
    .is("user_id", null)
    .maybeSingle();

  if (!awardee) return;

  // Link: write user_id on the awardee row
  await admin.from("awardees").update({ user_id: user.id }).eq("id", awardee.id);

  // Also upsert into awardee_members (used by RLS my_awardee_ids() function)
  await admin.from("awardee_members").upsert(
    { awardee_id: awardee.id, profile_id: user.id, is_primary: true },
    { onConflict: "awardee_id,profile_id" }
  );
}
