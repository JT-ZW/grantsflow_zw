"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { z } from "zod";

const CURRENCIES = ["ZAR", "USD", "EUR", "GBP"] as const;

const disbursementSchema = z.object({
  amount:        z.coerce.number().positive("Amount must be a positive number"),
  currency_code: z.enum(CURRENCIES),
  milestone_id:  z.string().uuid().optional(),
  justification: z
    .string()
    .min(10, "Please provide a justification (at least 10 characters)")
    .max(2000),
});

export async function requestDisbursement(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: awardee } = await supabase
    .from("awardees")
    .select("id, full_name")
    .eq("user_id", user.id)
    .single();
  if (!awardee) redirect("/portal");

  const { data: grant } = await supabase
    .from("grants")
    .select("id, title")
    .eq("awardee_id", awardee.id)
    .single();
  if (!grant) redirect("/portal");

  const parsed = disbursementSchema.safeParse({
    amount:        formData.get("amount"),
    currency_code: formData.get("currency_code"),
    milestone_id:  formData.get("milestone_id") || undefined,
    justification: formData.get("justification"),
  });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input";
    redirect(`/portal/disbursements?error=${encodeURIComponent(msg)}`);
  }

  const { amount, currency_code, milestone_id, justification } = parsed.data;

  const admin = createAdminClient();
  const { data: newRequest, error } = await admin
    .from("disbursement_requests")
    .insert({
      grant_id:     grant.id,
      awardee_id:   awardee.id,
      amount,
      currency_code,
      milestone_id: milestone_id ?? null,
      justification,
      status:       "pending",
    })
    .select("id")
    .single();

  if (error) {
    redirect(`/portal/disbursements?error=${encodeURIComponent(error.message)}`);
  }

  // Notify admin, programme managers, and finance officers
  // Use admin client (service role) — notifications RLS has no INSERT policy for awardees
  const { data: staffProfiles } = await admin
    .from("profiles")
    .select("id")
    .in("role", ["admin", "program_manager", "finance_officer"]);

  if (staffProfiles && staffProfiles.length > 0) {
    const grantTitle = (grant as unknown as { id: string; title: string }).title ?? "grant";
    const awardeeName = (awardee as unknown as { id: string; full_name: string }).full_name ?? "Awardee";
    await admin.from("notifications").insert(
      staffProfiles.map((p) => ({
        user_id:     p.id,
        title:       "New Disbursement Request",
        body:        `${awardeeName} requested ${currency_code} ${Number(amount).toFixed(2)} for "${grantTitle}"`,
        type:        "disbursement_request_received",
        entity_type: "disbursement_request",
        entity_id:   newRequest?.id ?? awardee.id,
        href:        `/awardees/${awardee.id}/finances`,
      }))
    );
  }

  redirect("/portal/disbursements?saved=1");
}
