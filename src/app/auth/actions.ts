"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/auth/login?error=Invalid+credentials");
  }

  // Fetch role to decide where to redirect
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  if (profile?.role === "awardee") {
    redirect("/portal");
  }

  // Redirect non-awardee known roles to dashboard; unknown roles go to login
  const adminRoles = ["admin", "program_manager", "finance_officer", "auditor"];
  if (profile?.role && adminRoles.includes(profile.role)) {
    redirect("/dashboard");
  }

  redirect("/auth/login?error=Your+account+does+not+have+access+to+this+system");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}

export async function requestPasswordReset(formData: FormData) {
  const email = (formData.get("email") as string)?.trim();
  if (!email) {
    redirect("/auth/forgot-password?error=Please+enter+your+email+address");
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const supabase = await createClient();

  // Supabase sends the reset email. We always redirect to "success" regardless
  // of whether the email exists (prevents user enumeration).
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/reset-callback`,
  });

  redirect("/auth/forgot-password?success=1");
}

// Shared password strength check
function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must contain at least one special character";
  return null;
}

export async function setPassword(formData: FormData) {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirm_password") as string;

  if (password !== confirmPassword) {
    redirect("/auth/set-password?error=Passwords+do+not+match");
  }

  const strengthError = validatePasswordStrength(password);
  if (strengthError) {
    redirect(`/auth/set-password?error=${encodeURIComponent(strengthError)}`);
  }

  const supabase = await createClient();

  // Ensure the user has a valid session (invite exchange must have happened)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/set-password?error=Session+expired+%E2%80%94+please+click+your+invite+link+again");
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(
      `/auth/set-password?error=${encodeURIComponent(error.message)}`
    );
  }

  // Redirect based on role so admins who were invited go to dashboard, not portal
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "awardee") {
    redirect("/portal");
  }
  redirect("/dashboard");
}
