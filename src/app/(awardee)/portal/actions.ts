"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
    .select("id, title, status, grants(id, title, awardees(id, full_name, user_id))")
    .eq("id", milestone_id)
    .single();

  if (!milestone) return;

  const ms = milestone as unknown as {
    title: string;
    grants: { id: string; title: string; awardees: { id: string; full_name: string; user_id: string | null } } | null;
  };

  const awardeeUserId = ms.grants?.awardees?.user_id;

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

  // Notify admins & programme managers of the milestone status change
  const adminClient = createAdminClient();
  const { data: staffProfiles } = await adminClient
    .from("profiles")
    .select("id")
    .in("role", ["admin", "program_manager"]);

  if (staffProfiles && staffProfiles.length > 0) {
    const awardee_name  = ms.grants?.awardees?.full_name ?? "Awardee";
    const grant_title   = ms.grants?.title ?? "grant";
    const awardee_id    = ms.grants?.awardees?.id;
    const status_label  = status === "completed" ? "Completed" : "In Progress";

    await adminClient.from("notifications").insert(
      staffProfiles.map((p) => ({
        user_id:     p.id,
        title:       `Milestone ${status_label}: ${ms.title}`,
        body:        `${awardee_name} marked "${ms.title}" as ${status.replace("_", " ")} on "${grant_title}"`,
        type:        "milestone_status_changed",
        entity_type: "milestone",
        entity_id:   milestone_id,
        href:        awardee_id ? `/awardees/${awardee_id}` : "/awardees",
      }))
    );
  }

  revalidatePath("/portal");
}

const progressSchema = z.object({
  milestone_id:   z.string().uuid(),
  note:           z.string().min(1, "Please describe what was achieved.").max(2000),
  status:         z.enum(["not_started", "in_progress", "completed"]),
  completion_pct: z.coerce.number().int().min(0).max(100).optional(),
  planned_next:   z.string().max(2000).optional(),
  blockers:       z.string().max(2000).optional(),
  impact_story:   z.string().max(2000).optional(),
  // Indicator actuals — submitted as JSON: [{ id, value }]
  indicator_actuals_json: z.string().optional(),
});

export async function submitMilestoneProgress(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const rawPct = formData.get("completion_pct");
  const parsed = progressSchema.safeParse({
    milestone_id:   formData.get("milestone_id"),
    note:           formData.get("note"),
    status:         formData.get("status"),
    completion_pct: rawPct !== null && rawPct !== "" ? rawPct : undefined,
    planned_next:   (formData.get("planned_next") as string) || undefined,
    blockers:       (formData.get("blockers")      as string) || undefined,
    impact_story:   (formData.get("impact_story")  as string) || undefined,
    indicator_actuals_json: (formData.get("indicator_actuals_json") as string) || undefined,
  });
  if (!parsed.success) return;

  const { milestone_id, note, status, completion_pct, planned_next, blockers, impact_story, indicator_actuals_json } = parsed.data;

  // Ownership verification
  const { data: milestone } = await supabase
    .from("milestones")
    .select("id, title, status, grants(id, title, awardees(id, full_name, user_id))")
    .eq("id", milestone_id)
    .single();

  if (!milestone) return;

  const ms2 = milestone as unknown as {
    title: string;
    grants: { id: string; title: string; awardees: { id: string; full_name: string; user_id: string | null } } | null;
  };

  const awardeeUserId = ms2.grants?.awardees?.user_id;

  if (awardeeUserId !== user.id) return;

  const old_status = milestone.status;
  const milestoneUpdate: Record<string, unknown> = { status, progress_notes: note };
  if (completion_pct !== undefined) milestoneUpdate.completion_pct = completion_pct;

  await supabase
    .from("milestones")
    .update(milestoneUpdate)
    .eq("id", milestone_id);

  // Insert into update history with all new fields
  const { data: updateRow } = await supabase.from("milestone_updates").insert({
    milestone_id,
    submitted_by: user.id,
    note,
    status_at: status,
    ...(completion_pct !== undefined && { completion_pct }),
    ...(planned_next ? { planned_next } : {}),
    ...(blockers ? { blockers } : {}),
    ...(impact_story ? { impact_story } : {}),
  }).select("id").single();

  // Save indicator actuals if provided
  if (indicator_actuals_json && updateRow?.id) {
    try {
      const actuals = JSON.parse(indicator_actuals_json) as { id: string; value: number; note: string }[];
      const rows = actuals
        .filter((a) => a.value > 0 || a.note)
        .map((a) => ({
          indicator_id:        a.id,
          milestone_update_id: updateRow.id,
          actual_value:        a.value,
          note:                a.note || null,
          submitted_by:        user.id,
        }));
      if (rows.length > 0) await supabase.from("impact_submissions").insert(rows);
    } catch { /* non-fatal */ }
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "milestone.progress_submitted",
    entity_type: "milestone",
    entity_id: milestone_id,
    old_data: { status: old_status },
    new_data: { status, note, completion_pct },
  });

  // Notify admins & programme managers of the progress submission
  const adminClient2 = createAdminClient();
  const { data: staffProfiles } = await adminClient2
    .from("profiles")
    .select("id")
    .in("role", ["admin", "program_manager"]);

  if (staffProfiles && staffProfiles.length > 0) {
    const awardee_name = ms2.grants?.awardees?.full_name ?? "Awardee";
    const grant_title  = ms2.grants?.title ?? "grant";
    const awardee_id   = ms2.grants?.awardees?.id;
    const pct_str      = completion_pct !== undefined ? ` (${completion_pct}% complete)` : "";

    await adminClient2.from("notifications").insert(
      staffProfiles.map((p) => ({
        user_id:     p.id,
        title:       `Progress Update: ${ms2.title}`,
        body:        `${awardee_name} submitted a progress update for "${ms2.title}" on "${grant_title}"${pct_str}`,
        type:        "milestone_progress",
        entity_type: "milestone",
        entity_id:   milestone_id,
        href:        awardee_id ? `/awardees/${awardee_id}` : "/awardees",
      }))
    );
  }

  revalidatePath("/portal");
}
