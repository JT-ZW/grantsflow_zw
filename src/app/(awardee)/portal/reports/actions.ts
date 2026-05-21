"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  return { user, supabase };
}

async function getAwardeeContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<{ awardeeId: string; grantId: string } | null> {
  const { data: awardee } = await supabase
    .from("awardees")
    .select("id")
    .eq("user_id", userId)
    .single();
  if (!awardee) return null;

  const { data: grant } = await supabase
    .from("grants")
    .select("id")
    .eq("awardee_id", awardee.id)
    .single();
  if (!grant) return null;

  return { awardeeId: awardee.id, grantId: grant.id };
}

// ── Save Draft ────────────────────────────────────────────────────────────────
// Creates a new draft or updates an existing one. The awardee can iterate on
// content before submitting. Only drafts and revision-requested reports are editable.

const draftSchema = z.object({
  report_id:    z.string().uuid().optional(),
  period_label: z.string().min(1, "Period label is required").max(100),
  report_type:  z.enum(["quarterly", "annual", "final", "ad_hoc"]),
  content:      z.string().max(20000).optional(),
});

export async function saveReportDraft(formData: FormData) {
  const { user, supabase } = await requireUser();
  const ctx = await getAwardeeContext(supabase, user.id);
  if (!ctx) redirect("/portal");

  const parsed = draftSchema.safeParse({
    report_id:    formData.get("report_id") || undefined,
    period_label: formData.get("period_label"),
    report_type:  formData.get("report_type"),
    content:      formData.get("content") || undefined,
  });
  if (!parsed.success) redirect("/portal/reports?error=invalid");

  const { report_id, period_label, report_type, content } = parsed.data;
  const admin = createAdminClient();

  if (report_id) {
    await admin
      .from("grant_reports")
      .update({ period_label, report_type, content: content ?? null })
      .eq("id", report_id)
      .eq("awardee_id", ctx.awardeeId)
      .in("status", ["draft", "revision_requested"]);
  } else {
    await admin.from("grant_reports").insert({
      grant_id:     ctx.grantId,
      awardee_id:   ctx.awardeeId,
      period_label,
      report_type,
      content:      content ?? null,
      status:       "draft",
    });
  }

  redirect("/portal/reports?saved=draft");
}

// ── Submit Report ─────────────────────────────────────────────────────────────
// Transitions the report from draft/revision_requested → submitted.

const submitSchema = z.object({
  report_id: z.string().uuid(),
});

export async function submitReport(formData: FormData) {
  const { user, supabase } = await requireUser();
  const ctx = await getAwardeeContext(supabase, user.id);
  if (!ctx) redirect("/portal");

  const parsed = submitSchema.safeParse({ report_id: formData.get("report_id") });
  if (!parsed.success) redirect("/portal/reports?error=invalid");

  const admin = createAdminClient();
  await admin
    .from("grant_reports")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", parsed.data.report_id)
    .eq("awardee_id", ctx.awardeeId)
    .in("status", ["draft", "revision_requested"]);

  revalidatePath("/portal/reports");
  redirect("/portal/reports?saved=submitted");
}
