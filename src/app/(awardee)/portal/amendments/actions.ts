"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { z } from "zod";

const CURRENCIES = ["ZAR", "USD", "EUR", "GBP"] as const;

const amendmentSchema = z.object({
  request_type:  z.enum(["new_line", "reallocation", "increase"]),
  category:      z.string().min(1).max(200),
  amount:        z.coerce.number().positive(),
  currency_code: z.enum(CURRENCIES),
  from_category: z.string().max(200).optional(),
  justification: z.string().min(10, "Please provide a justification (at least 10 characters)").max(2000),
});

export async function requestBudgetAmendment(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Resolve awardee + grant
  const { data: awardee } = await supabase
    .from("awardees")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!awardee) redirect("/portal");

  const { data: grant } = await supabase
    .from("grants")
    .select("id")
    .eq("awardee_id", awardee.id)
    .single();
  if (!grant) redirect("/portal");

  const parsed = amendmentSchema.safeParse({
    request_type:  formData.get("request_type"),
    category:      formData.get("category"),
    amount:        formData.get("amount"),
    currency_code: formData.get("currency_code"),
    from_category: formData.get("from_category") || undefined,
    justification: formData.get("justification"),
  });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input";
    redirect(`/portal/amendments?error=${encodeURIComponent(msg)}`);
  }

  const { request_type, category, amount, currency_code, from_category, justification } = parsed.data;

  // Require from_category for reallocations
  if (request_type === "reallocation" && !from_category) {
    redirect("/portal/amendments?error=Please+specify+the+source+category+for+reallocation");
  }

  const admin = createAdminClient();
  await admin.from("budget_amendments").insert({
    grant_id:      grant.id,
    awardee_id:    awardee.id,
    request_type,
    category,
    amount,
    currency_code,
    from_category: from_category ?? null,
    justification,
    status: "pending",
  });

  redirect("/portal/amendments?saved=1");
}
