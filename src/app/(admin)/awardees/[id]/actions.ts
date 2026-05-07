"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ── Milestone status update ──────────────────────────────────────────────────

const milestoneStatusSchema = z.object({
  milestone_id: z.string().uuid(),
  status: z.enum(["not_started", "in_progress", "completed", "delayed"]),
  awardee_id: z.string().uuid(),
});

export async function updateMilestoneStatus(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const parsed = milestoneStatusSchema.safeParse({
    milestone_id: formData.get("milestone_id"),
    status: formData.get("status"),
    awardee_id: formData.get("awardee_id"),
  });
  if (!parsed.success) return;

  const { milestone_id, status, awardee_id } = parsed.data;

  // Fetch old status for audit log
  const { data: old } = await supabase
    .from("milestones")
    .select("status")
    .eq("id", milestone_id)
    .single();

  await supabase
    .from("milestones")
    .update({ status })
    .eq("id", milestone_id);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "milestone.status_changed",
    entity_type: "milestone",
    entity_id: milestone_id,
    old_data: { status: old?.status },
    new_data: { status },
  });

  revalidatePath(`/awardees/${awardee_id}`);
}

// ── Grant status update ──────────────────────────────────────────────────────

const grantStatusSchema = z.object({
  grant_id: z.string().uuid(),
  status: z.enum(["active", "completed", "suspended", "cancelled"]),
  awardee_id: z.string().uuid(),
});

export async function updateGrantStatus(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const parsed = grantStatusSchema.safeParse({
    grant_id: formData.get("grant_id"),
    status: formData.get("status"),
    awardee_id: formData.get("awardee_id"),
  });
  if (!parsed.success) return;

  const { grant_id, status, awardee_id } = parsed.data;

  const { data: old } = await supabase
    .from("grants")
    .select("status")
    .eq("id", grant_id)
    .single();

  await supabase.from("grants").update({ status }).eq("id", grant_id);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "grant.status_changed",
    entity_type: "grant",
    entity_id: grant_id,
    old_data: { status: old?.status },
    new_data: { status },
  });

  revalidatePath(`/awardees/${awardee_id}`);
}

// ── Add milestone ────────────────────────────────────────────────────────────

const addMilestoneSchema = z.object({
  grant_id: z.string().uuid(),
  awardee_id: z.string().uuid(),
  title: z.string().min(1),
  due_date: z.string().min(1),
  deliverables: z.string().optional(),
});

export async function addMilestone(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const parsed = addMilestoneSchema.safeParse({
    grant_id: formData.get("grant_id"),
    awardee_id: formData.get("awardee_id"),
    title: formData.get("title"),
    due_date: formData.get("due_date"),
    deliverables: formData.get("deliverables"),
  });
  if (!parsed.success) return;

  const { grant_id, awardee_id, title, due_date, deliverables } = parsed.data;

  // Get current max sort_order
  const { data: last } = await supabase
    .from("milestones")
    .select("sort_order")
    .eq("grant_id", grant_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const { data: milestone } = await supabase
    .from("milestones")
    .insert({
      grant_id,
      title,
      due_date,
      deliverables: deliverables || null,
      sort_order: (last?.sort_order ?? -1) + 1,
    })
    .select("id")
    .single();

  if (milestone) {
    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "milestone.created",
      entity_type: "milestone",
      entity_id: milestone.id,
      new_data: { grant_id, title, due_date },
    });
  }

  revalidatePath(`/awardees/${awardee_id}`);
}

// ── Grant Approval Workflow ───────────────────────────────────────────────────

const APPROVAL_STATUSES = ["draft", "submitted", "under_review", "approved", "rejected"] as const;

const updateApprovalSchema = z.object({
  grant_id: z.string().uuid(),
  awardee_id: z.string().uuid(),
  approval_status: z.enum(APPROVAL_STATUSES),
  approval_notes: z.string().max(1000).optional(),
});

export async function updateGrantApproval(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["admin", "program_manager"].includes(profile.role)) return;

  const parsed = updateApprovalSchema.safeParse({
    grant_id: formData.get("grant_id"),
    awardee_id: formData.get("awardee_id"),
    approval_status: formData.get("approval_status"),
    approval_notes: formData.get("approval_notes") || undefined,
  });
  if (!parsed.success) return;

  const { grant_id, awardee_id, approval_status, approval_notes } = parsed.data;

  const { data: old } = await supabase
    .from("grants")
    .select("approval_status")
    .eq("id", grant_id)
    .single();

  const updates: Record<string, unknown> = { approval_status, approval_notes: approval_notes ?? null };
  if (approval_status === "approved") updates.status = "active";
  if (approval_status === "rejected") updates.status = "suspended";

  await supabase.from("grants").update(updates).eq("id", grant_id);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "grant.approval_changed",
    entity_type: "grant",
    entity_id: grant_id,
    old_data: { approval_status: old?.approval_status },
    new_data: { approval_status, approval_notes },
  });

  revalidatePath(`/awardees/${awardee_id}`);
}
