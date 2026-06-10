import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Dedicated callback for password-reset emails.
 * Supabase redirects here after verifying the reset token.
 * We establish the session, then send the user to set-password.
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
      return NextResponse.redirect(`${origin}/auth/set-password?reset=1`);
    }
  }

  // ── OTP / token-hash flow (non-PKCE environments) ────────────────────
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      return NextResponse.redirect(`${origin}/auth/set-password?reset=1`);
    }
  }

  return NextResponse.redirect(
    `${origin}/auth/forgot-password?error=${encodeURIComponent("Reset link expired or invalid — please request a new one.")}`
  );
}
