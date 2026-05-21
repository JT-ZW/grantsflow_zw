"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

// ── helpers ──────────────────────────────────────────────────────────────────

/** Returns the authenticated user or redirects to login. */
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  return { user, supabase };
}

/**
 * Verifies the authenticated user owns the given grant.
 * Returns the grant row or null if ownership fails.
 */
async function verifyGrantOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  grantId: string,
  userId: string
) {
  const { data } = await supabase
    .from("grants")
    .select("id, awardees(user_id)")
    .eq("id", grantId)
    .single();

  if (!data) return null;

  const ownerUserId = (
    data as unknown as { awardees: { user_id: string | null } }
  ).awardees?.user_id;

  return ownerUserId === userId ? data : null;
}

// ── updateProjectDetails ─────────────────────────────────────────────────────

const projectDetailsSchema = z.object({
  grant_id:             z.string().uuid(),
  description:          z.string().max(3000).optional(),
  objectives:           z.string().max(3000).optional(),
  target_beneficiaries: z.string().max(2000).optional(),
  geographic_reach:     z.string().max(500).optional(),
});

export async function updateProjectDetails(formData: FormData) {
  const { user, supabase } = await requireUser();

  const parsed = projectDetailsSchema.safeParse({
    grant_id:             formData.get("grant_id"),
    description:          formData.get("description")          || undefined,
    objectives:           formData.get("objectives")           || undefined,
    target_beneficiaries: formData.get("target_beneficiaries") || undefined,
    geographic_reach:     formData.get("geographic_reach")     || undefined,
  });

  if (!parsed.success) {
    redirect("/portal/project?error=Invalid+input");
  }

  const { grant_id, ...fields } = parsed.data;

  const grant = await verifyGrantOwnership(supabase, grant_id, user.id);
  if (!grant) redirect("/portal/project?error=Access+denied");

  const admin = createAdminClient();
  const { error } = await admin.from("grants").update(fields).eq("id", grant_id);

  if (error) redirect("/portal/project?error=Save+failed");

  redirect("/portal/project?saved=project");
}

// ── updateContactDetails ─────────────────────────────────────────────────────

const contactSchema = z.object({
  awardee_id: z.string().uuid(),
  phone:      z.string().max(30).optional(),
});

export async function updateContactDetails(formData: FormData) {
  const { user, supabase } = await requireUser();

  const parsed = contactSchema.safeParse({
    awardee_id: formData.get("awardee_id"),
    phone:      formData.get("phone") || undefined,
  });

  if (!parsed.success) redirect("/portal/project?error=Invalid+input");

  const { awardee_id, phone } = parsed.data;

  // Verify ownership
  const { data: awardee } = await supabase
    .from("awardees")
    .select("id, user_id")
    .eq("id", awardee_id)
    .single();

  if (!awardee || awardee.user_id !== user.id) {
    redirect("/portal/project?error=Access+denied");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("awardees")
    .update({ phone })
    .eq("id", awardee_id);

  if (error) redirect("/portal/project?error=Save+failed");

  redirect("/portal/project?saved=contact");
}

// ── proposeMilestone ─────────────────────────────────────────────────────────

const milestoneProposalSchema = z.object({
  grant_id:     z.string().uuid(),
  title:        z.string().min(3, "Title must be at least 3 characters").max(200),
  description:  z.string().max(2000).optional(),
  deliverables: z.string().max(2000).optional(),
  due_date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
});

export async function proposeMilestone(formData: FormData) {
  const { user, supabase } = await requireUser();

  const parsed = milestoneProposalSchema.safeParse({
    grant_id:     formData.get("grant_id"),
    title:        formData.get("title"),
    description:  formData.get("description")  || undefined,
    deliverables: formData.get("deliverables") || undefined,
    due_date:     formData.get("due_date"),
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input";
    redirect(`/portal/project?error=${encodeURIComponent(msg)}`);
  }

  const { grant_id, ...milestoneData } = parsed.data;

  const grant = await verifyGrantOwnership(supabase, grant_id, user.id);
  if (!grant) redirect("/portal/project?error=Access+denied");

  const admin = createAdminClient();

  // Place the proposal at the end of the current milestone list
  const { data: existing } = await admin
    .from("milestones")
    .select("sort_order")
    .eq("grant_id", grant_id)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.sort_order ?? 0) + 1;

  const { error } = await admin.from("milestones").insert({
    grant_id,
    ...milestoneData,
    sort_order:      nextOrder,
    status:          "not_started",
    proposed_by:     user.id,
    proposal_status: "pending_approval",
  });

  if (error) redirect("/portal/project?error=Proposal+failed");

  redirect("/portal/project?saved=milestone");
}
