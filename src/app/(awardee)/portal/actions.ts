"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const statusSchema = z.object({
  milestone_id: z.string().uuid(),
  status: z.enum(["in_progress", "completed"]),
});

// Awardees can only move milestones to in_progress or completed (not delayed — that's admin only)
export async function awardeeUpdateMilestoneStatus(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const parsed = statusSchema.safeParse({
    milestone_id: formData.get("milestone_id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;

  const { milestone_id, status } = parsed.data;

  // Verify the milestone belongs to this awardee's grant
  const { data: milestone } = await supabase
    .from("milestones")
    .select("id, status, grants(awardees(user_id))")
    .eq("id", milestone_id)
    .single();

  if (!milestone) return;

  const awardeeUserId = (
    milestone as unknown as {
      grants: { awardees: { user_id: string | null } } | null;
    }
  ).grants?.awardees?.user_id;

  if (awardeeUserId !== user.id) return; // Ownership check

  const old_status = milestone.status;

  await supabase.from("milestones").update({ status }).eq("id", milestone_id);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "milestone.status_changed",
    entity_type: "milestone",
    entity_id: milestone_id,
    old_data: { status: old_status },
    new_data: { status },
  });

  revalidatePath("/portal");
}

const progressSchema = z.object({
  milestone_id: z.string().uuid(),
  note: z.string().min(1).max(2000),
  status: z.enum(["not_started", "in_progress", "completed"]),
});

export async function submitMilestoneProgress(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const parsed = progressSchema.safeParse({
    milestone_id: formData.get("milestone_id"),
    note: formData.get("note"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;

  const { milestone_id, note, status } = parsed.data;

  // Ownership verification
  const { data: milestone } = await supabase
    .from("milestones")
    .select("id, status, grants(awardees(user_id))")
    .eq("id", milestone_id)
    .single();

  if (!milestone) return;

  const awardeeUserId = (
    milestone as unknown as {
      grants: { awardees: { user_id: string | null } } | null;
    }
  ).grants?.awardees?.user_id;

  if (awardeeUserId !== user.id) return;

  const old_status = milestone.status;

  // Update milestone status and latest progress note
  await supabase
    .from("milestones")
    .update({ status, progress_notes: note })
    .eq("id", milestone_id);

  // Insert into update history
  await supabase.from("milestone_updates").insert({
    milestone_id,
    submitted_by: user.id,
    note,
    status_at: status,
  });

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "milestone.progress_submitted",
    entity_type: "milestone",
    entity_id: milestone_id,
    old_data: { status: old_status },
    new_data: { status, note },
  });

  revalidatePath("/portal");
}
