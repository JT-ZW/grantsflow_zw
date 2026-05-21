"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ALLOWED_ROLES = ["admin", "program_manager", "finance_officer", "auditor", "awardee"] as const;

// ── Guard: caller must be admin ───────────────────────────────────────────────
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return null;
  return user;
}

// ── Invite a new user ─────────────────────────────────────────────────────────

const inviteSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1).max(200),
  role: z.enum(ALLOWED_ROLES),
});

export type InviteState = { error?: string; success?: string } | null;

export async function inviteUser(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const actor = await requireAdmin();
  if (!actor) return { error: "Unauthorized" };

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    full_name: formData.get("full_name"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: "Invalid input — check all fields." };

  const { email, full_name, role } = parsed.data;
  const admin = createAdminClient();

  // Check if email already exists
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) return { error: "A user with that email already exists." };

  // Invite via Auth Admin API — sends a magic-link invitation email
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name },
    redirectTo: `${siteUrl}/auth/callback`,
  });

  if (inviteError) return { error: inviteError.message };

  // Set the role on the auto-created profile (trigger creates it with default 'awardee')
  if (invited?.user?.id) {
    await admin
      .from("profiles")
      .update({ role, full_name })
      .eq("id", invited.user.id);

    const supabase = await createClient();
    await supabase.from("audit_logs").insert({
      actor_id: actor.id,
      action: "user.invited",
      entity_type: "profile",
      entity_id: invited.user.id,
      new_data: { email, role, full_name },
    });
  }

  revalidatePath("/users");
  return { success: `Invitation sent to ${email}.` };
}

// ── Create a user directly (with password) ────────────────────────────────────

const createUserSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1).max(200),
  role: z.enum(ALLOWED_ROLES),
  password: z.string().min(8).max(128),
});

export type CreateUserState = { error?: string; success?: string } | null;

export async function createUser(_prev: CreateUserState, formData: FormData): Promise<CreateUserState> {
  const actor = await requireAdmin();
  if (!actor) return { error: "Unauthorized" };

  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    full_name: formData.get("full_name"),
    role: formData.get("role"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
    return { error: msg };
  }

  const { email, full_name, role, password } = parsed.data;
  const admin = createAdminClient();

  // Check if email already exists
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) return { error: "A user with that email already exists." };

  // Create user directly — no invitation email sent
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (createError) return { error: createError.message };

  if (created?.user?.id) {
    await admin
      .from("profiles")
      .update({ role, full_name })
      .eq("id", created.user.id);

    const supabase = await createClient();
    await supabase.from("audit_logs").insert({
      actor_id: actor.id,
      action: "user.created",
      entity_type: "profile",
      entity_id: created.user.id,
      new_data: { email, role, full_name },
    });
  }

  revalidatePath("/users");
  return { success: `User ${full_name} created. They can sign in immediately with the password you set.` };
}

// ── Change a user's role ──────────────────────────────────────────────────────

const changeRoleSchema = z.object({
  profile_id: z.string().uuid(),
  role: z.enum(ALLOWED_ROLES),
});

export async function changeUserRole(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  if (!actor) return;

  const parsed = changeRoleSchema.safeParse({
    profile_id: formData.get("profile_id"),
    role: formData.get("role"),
  });
  if (!parsed.success) return;
  const { profile_id, role } = parsed.data;
  if (profile_id === actor.id) return;

  const supabase = await createClient();
  const { data: old } = await supabase.from("profiles").select("role").eq("id", profile_id).single();

  await supabase.from("profiles").update({ role }).eq("id", profile_id);
  await supabase.from("audit_logs").insert({
    actor_id: actor.id,
    action: "user.role_changed",
    entity_type: "profile",
    entity_id: profile_id,
    old_data: { role: old?.role },
    new_data: { role },
  });

  revalidatePath("/users");
}

// ── Deactivate / Reactivate ───────────────────────────────────────────────────

const toggleActiveSchema = z.object({
  profile_id: z.string().uuid(),
  active: z.enum(["true", "false"]),
});

export async function toggleUserActive(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  if (!actor) return;

  const parsed = toggleActiveSchema.safeParse({
    profile_id: formData.get("profile_id"),
    active: formData.get("active"),
  });
  if (!parsed.success) return;
  const { profile_id, active } = parsed.data;
  if (profile_id === actor.id) return;

  const isActive = active === "true";
  const supabase = await createClient();

  await supabase.from("profiles").update({ is_active: isActive }).eq("id", profile_id);
  await supabase.from("audit_logs").insert({
    actor_id: actor.id,
    action: isActive ? "user.reactivated" : "user.deactivated",
    entity_type: "profile",
    entity_id: profile_id,
    new_data: { is_active: isActive },
  });

  revalidatePath("/users");
}

// ── Change a user's password ──────────────────────────────────────────────────

const changePasswordSchema = z.object({
  profile_id: z.string().uuid(),
  password: z.string().min(8).max(128),
});

export type ChangePasswordState = { error?: string; success?: string } | null;

export async function changeUserPassword(
  _prev: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const actor = await requireAdmin();
  if (!actor) return { error: "Unauthorized" };

  const parsed = changePasswordSchema.safeParse({
    profile_id: formData.get("profile_id"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
    return { error: msg };
  }

  const { profile_id, password } = parsed.data;
  if (profile_id === actor.id) return { error: "Use your account settings to change your own password." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(profile_id, { password });
  if (error) return { error: error.message };

  const supabase = await createClient();
  await supabase.from("audit_logs").insert({
    actor_id: actor.id,
    action: "user.password_changed",
    entity_type: "profile",
    entity_id: profile_id,
    new_data: { changed_by: actor.id },
  });

  return { success: "Password updated successfully." };
}

// ── Delete a user entirely ────────────────────────────────────────────────────

const deleteUserSchema = z.object({
  profile_id: z.string().uuid(),
});

export async function deleteUser(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  if (!actor) return;

  const parsed = deleteUserSchema.safeParse({ profile_id: formData.get("profile_id") });
  if (!parsed.success) return;
  const { profile_id } = parsed.data;
  if (profile_id === actor.id) return;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", profile_id)
    .single();

  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(profile_id);

  await supabase.from("audit_logs").insert({
    actor_id: actor.id,
    action: "user.deleted",
    entity_type: "profile",
    entity_id: profile_id,
    old_data: { email: profile?.email, full_name: profile?.full_name },
  });

  revalidatePath("/users");
}
