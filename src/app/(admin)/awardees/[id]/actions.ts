"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ── Impact indicator management ──────────────────────────────────────────────

const indicatorSchema = z.object({
  grant_id:     z.string().uuid(),
  awardee_id:   z.string().uuid(),
  label:        z.string().min(1).max(200),
  unit:         z.string().min(1).max(80),
  target_value: z.coerce.number().min(0),
});

export async function addImpactIndicator(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "program_manager"].includes(profile.role)) return;

  const parsed = indicatorSchema.safeParse({
    grant_id:     formData.get("grant_id"),
    awardee_id:   formData.get("awardee_id"),
    label:        formData.get("label"),
    unit:         formData.get("unit"),
    target_value: formData.get("target_value"),
  });
  if (!parsed.success) return;

  const { grant_id, awardee_id, label, unit, target_value } = parsed.data;

  const { data: last } = await supabase
    .from("grant_impact_indicators")
    .select("sort_order")
    .eq("grant_id", grant_id)
    .order("sort_order", { ascending: false })
    .limit(1).single();

  await supabase.from("grant_impact_indicators").insert({
    grant_id, label, unit, target_value,
    sort_order: (last?.sort_order ?? -1) + 1,
  });

  revalidatePath(`/awardees/${awardee_id}`);
}

export async function deleteImpactIndicator(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "program_manager"].includes(profile.role)) return;

  const indicator_id = formData.get("indicator_id") as string;
  const awardee_id   = formData.get("awardee_id")   as string;
  if (!indicator_id || !awardee_id) return;

  await supabase.from("grant_impact_indicators").delete().eq("id", indicator_id);
  revalidatePath(`/awardees/${awardee_id}`);
}

// ── Update grant impact classification ───────────────────────────────────────

const impactClassSchema = z.object({
  grant_id:        z.string().uuid(),
  awardee_id:      z.string().uuid(),
  sectors_json:    z.string(),
  sdg_goals_json:  z.string(),
  country_codes_json: z.string(),
  geographic_scope: z.enum(["local", "national", "regional", "continental", "international"]).optional(),
  beneficiary_type: z.string().max(200).optional(),
});

export async function updateGrantImpact(
  formData: FormData
): Promise<{ error: string } | undefined> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "program_manager"].includes(profile.role)) {
    return { error: "Insufficient permissions" };
  }

  const parsed = impactClassSchema.safeParse({
    grant_id:           formData.get("grant_id"),
    awardee_id:         formData.get("awardee_id"),
    sectors_json:       formData.get("sectors_json"),
    sdg_goals_json:     formData.get("sdg_goals_json"),
    country_codes_json: formData.get("country_codes_json"),
    geographic_scope:   formData.get("geographic_scope") || undefined,
    beneficiary_type:   formData.get("beneficiary_type") || undefined,
  });
  if (!parsed.success) return { error: "Invalid data" };

  let sectors: string[], sdgGoals: number[], countryCodes: string[];
  try {
    sectors      = JSON.parse(parsed.data.sectors_json);
    sdgGoals     = JSON.parse(parsed.data.sdg_goals_json);
    countryCodes = JSON.parse(parsed.data.country_codes_json);
  } catch {
    return { error: "Malformed JSON in classification fields" };
  }

  const { error } = await supabase
    .from("grants")
    .update({
      sectors,
      sdg_goals:        sdgGoals,
      country_codes:    countryCodes,
      geographic_scope: parsed.data.geographic_scope ?? null,
      beneficiary_type: parsed.data.beneficiary_type ?? null,
    })
    .eq("id", parsed.data.grant_id);

  if (error) return { error: error.message };

  revalidatePath(`/awardees/${parsed.data.awardee_id}`);
}

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
  revalidatePath(`/awardees/${awardee_id}`);
}

// ── Admin milestone annotation ───────────────────────────────────────────────

const adminNoteSchema = z.object({
  milestone_id: z.string().uuid(),
  awardee_id:   z.string().uuid(),
  admin_notes:  z.string().max(2000).optional(),
  admin_flag:   z.enum(["on_track", "needs_attention", "at_risk"]).optional(),
});

export async function saveMilestoneAdminNote(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["admin", "program_manager"].includes(profile.role)) return;

  const parsed = adminNoteSchema.safeParse({
    milestone_id: formData.get("milestone_id"),
    awardee_id:   formData.get("awardee_id"),
    admin_notes:  (formData.get("admin_notes") as string) || undefined,
    admin_flag:   (formData.get("admin_flag") as string)  || undefined,
  });
  if (!parsed.success) return;

  const { milestone_id, awardee_id, admin_notes, admin_flag } = parsed.data;

  const updates: Record<string, unknown> = {};
  if (admin_notes !== undefined) updates.admin_notes = admin_notes || null;
  if (admin_flag  !== undefined) updates.admin_flag  = admin_flag  || null;
  if (Object.keys(updates).length === 0) return;

  await supabase.from("milestones").update(updates).eq("id", milestone_id);

  await supabase.from("audit_logs").insert({
    actor_id:    user.id,
    action:      "milestone.admin_note_saved",
    entity_type: "milestone",
    entity_id:   milestone_id,
    new_data:    { admin_notes, admin_flag },
  });

  revalidatePath(`/awardees/${awardee_id}`);
}

// ── Milestone proposal review (approve / reject) ─────────────────────────────

const proposalReviewSchema = z.object({
  milestone_id:   z.string().uuid(),
  decision:       z.enum(["approved", "rejected"]),
  proposal_notes: z.string().max(1000).optional(),
  awardee_id:     z.string().uuid(),
});

export async function reviewMilestoneProposal(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["admin", "program_manager"].includes(profile.role)) return;

  const parsed = proposalReviewSchema.safeParse({
    milestone_id:   formData.get("milestone_id"),
    decision:       formData.get("decision"),
    proposal_notes: (formData.get("proposal_notes") as string) || undefined,
    awardee_id:     formData.get("awardee_id"),
  });
  if (!parsed.success) return;

  const { milestone_id, decision, proposal_notes, awardee_id } = parsed.data;

  await supabase
    .from("milestones")
    .update({ proposal_status: decision, proposal_notes: proposal_notes ?? null })
    .eq("id", milestone_id);

  await supabase.from("audit_logs").insert({
    actor_id:    user.id,
    action:      `milestone.proposal_${decision}`,
    entity_type: "milestone",
    entity_id:   milestone_id,
    new_data:    { proposal_status: decision, proposal_notes },
  });

  revalidatePath(`/awardees/${awardee_id}`);
}

// ── Grant Report Review ───────────────────────────────────────────────────────

const reviewReportSchema = z.object({
  report_id:    z.string().uuid(),
  awardee_id:   z.string().uuid(),
  status:       z.enum(["approved", "under_review", "revision_requested"]),
  review_notes: z.string().max(2000).optional(),
});

export async function reviewGrantReport(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["admin", "program_manager"].includes(profile.role)) return;

  const parsed = reviewReportSchema.safeParse({
    report_id:    formData.get("report_id"),
    awardee_id:   formData.get("awardee_id"),
    status:       formData.get("status"),
    review_notes: formData.get("review_notes") || undefined,
  });
  if (!parsed.success) return;

  const { report_id, awardee_id, status, review_notes } = parsed.data;

  await supabase
    .from("grant_reports")
    .update({
      status,
      review_notes: review_notes ?? null,
      reviewed_by:  user.id,
      reviewed_at:  new Date().toISOString(),
    })
    .eq("id", report_id);

  await supabase.from("audit_logs").insert({
    actor_id:    user.id,
    action:      `grant_report.${status}`,
    entity_type: "grant_report",
    entity_id:   report_id,
    new_data:    { status, review_notes },
  });

  revalidatePath(`/awardees/${awardee_id}/reports`);
}
