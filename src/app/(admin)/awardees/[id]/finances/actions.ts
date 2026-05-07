"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const CURRENCIES = ["ZAR", "USD", "EUR", "GBP"] as const;
const METHODS = ["EFT", "Cash", "Cheque", "Mobile Money", "Other"] as const;

// ── Add budget line ──────────────────────────────────────────────────────────

const addBudgetSchema = z.object({
  grant_id: z.string().uuid(),
  awardee_id: z.string().uuid(),
  milestone_id: z.string().uuid().optional().or(z.literal("")),
  category: z.string().min(1),
  description: z.string().optional(),
  amount_allocated: z.coerce.number().positive(),
  currency_code: z.enum(CURRENCIES),
});

export async function addBudgetLine(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const parsed = addBudgetSchema.safeParse({
    grant_id: formData.get("grant_id"),
    awardee_id: formData.get("awardee_id"),
    milestone_id: formData.get("milestone_id"),
    category: formData.get("category"),
    description: formData.get("description"),
    amount_allocated: formData.get("amount_allocated"),
    currency_code: formData.get("currency_code"),
  });
  if (!parsed.success) return;

  const { grant_id, awardee_id, milestone_id, category, description, amount_allocated, currency_code } = parsed.data;

  const { data: budget } = await supabase
    .from("budgets")
    .insert({
      grant_id,
      milestone_id: milestone_id || null,
      category,
      description: description || null,
      amount_allocated,
      currency_code,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (budget) {
    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "budget.created",
      entity_type: "budget",
      entity_id: budget.id,
      new_data: { grant_id, category, amount_allocated, currency_code },
    });
  }

  revalidatePath(`/awardees/${awardee_id}/finances`);
}

// ── Approve / unapprove budget line ─────────────────────────────────────────

const approveBudgetSchema = z.object({
  budget_id: z.string().uuid(),
  awardee_id: z.string().uuid(),
  approved: z.enum(["true", "false"]),
});

export async function approveBudgetLine(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const parsed = approveBudgetSchema.safeParse({
    budget_id: formData.get("budget_id"),
    awardee_id: formData.get("awardee_id"),
    approved: formData.get("approved"),
  });
  if (!parsed.success) return;

  const { budget_id, awardee_id, approved } = parsed.data;
  const isApproved = approved === "true";

  await supabase
    .from("budgets")
    .update({
      approved: isApproved,
      approved_by: isApproved ? user.id : null,
      approved_at: isApproved ? new Date().toISOString() : null,
    })
    .eq("id", budget_id);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: isApproved ? "budget.approved" : "budget.unapproved",
    entity_type: "budget",
    entity_id: budget_id,
    new_data: { approved: isApproved },
  });

  revalidatePath(`/awardees/${awardee_id}/finances`);
}

// ── Record disbursement ──────────────────────────────────────────────────────

const disbursementSchema = z.object({
  grant_id: z.string().uuid(),
  awardee_id: z.string().uuid(),
  milestone_id: z.string().uuid().optional().or(z.literal("")),
  amount: z.coerce.number().positive(),
  currency_code: z.enum(CURRENCIES),
  disbursement_date: z.string().min(1),
  method: z.enum(METHODS),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export async function recordDisbursement(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const parsed = disbursementSchema.safeParse({
    grant_id: formData.get("grant_id"),
    awardee_id: formData.get("awardee_id"),
    milestone_id: formData.get("milestone_id"),
    amount: formData.get("amount"),
    currency_code: formData.get("currency_code"),
    disbursement_date: formData.get("disbursement_date"),
    method: formData.get("method"),
    reference: formData.get("reference"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return;

  const { grant_id, awardee_id, milestone_id, amount, currency_code, disbursement_date, method, reference, notes } = parsed.data;

  const { data: disbursement } = await supabase
    .from("disbursements")
    .insert({
      grant_id,
      milestone_id: milestone_id || null,
      amount,
      currency_code,
      disbursement_date,
      method,
      reference: reference || null,
      notes: notes || null,
      recorded_by: user.id,
    })
    .select("id")
    .single();

  if (disbursement) {
    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "disbursement.recorded",
      entity_type: "disbursement",
      entity_id: disbursement.id,
      new_data: { grant_id, amount, currency_code, disbursement_date, method },
    });

    // Notify the awardee
    const { data: awardeeProfile } = await supabase
      .from("awardees")
      .select("user_id")
      .eq("id", awardee_id)
      .single();
    if (awardeeProfile?.user_id) {
      await supabase.from("notifications").insert({
        user_id: awardeeProfile.user_id,
        title: "Payment Disbursed",
        body: `${currency_code} ${Number(amount).toFixed(2)} was disbursed to you via ${method}${reference ? ` (Ref: ${reference})` : ""}.`,
        type: "disbursement_received",
        entity_type: "disbursement",
        entity_id: disbursement.id,
        href: "/portal/finances",
      });
    }
  }

  revalidatePath(`/awardees/${awardee_id}/finances`);
}

// ── Review expense ───────────────────────────────────────────────────────────

const reviewExpenseSchema = z.object({
  expense_id: z.string().uuid(),
  awardee_id: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
  review_notes: z.string().optional(),
});

export async function reviewExpense(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const parsed = reviewExpenseSchema.safeParse({
    expense_id: formData.get("expense_id"),
    awardee_id: formData.get("awardee_id"),
    status: formData.get("status"),
    review_notes: formData.get("review_notes"),
  });
  if (!parsed.success) return;

  const { expense_id, awardee_id, status, review_notes } = parsed.data;

  await supabase
    .from("expenses")
    .update({
      status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_notes: review_notes || null,
    })
    .eq("id", expense_id);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: `expense.${status}`,
    entity_type: "expense",
    entity_id: expense_id,
    new_data: { status, review_notes },
  });

  // Notify the awardee of the review decision
  const { data: expense } = await supabase
    .from("expenses")
    .select("description, amount, currency_code, submitted_by")
    .eq("id", expense_id)
    .single();
  if (expense?.submitted_by) {
    await supabase.from("notifications").insert({
      user_id: expense.submitted_by,
      title: `Expense ${status === "approved" ? "Approved" : "Rejected"}`,
      body: `Your expense "${expense.description}" (${expense.currency_code} ${Number(expense.amount).toFixed(2)}) was ${status}${review_notes ? `: ${review_notes}` : "."}`,
      type: "expense_reviewed",
      entity_type: "expense",
      entity_id: expense_id,
      href: "/portal/finances",
    });
  }

  revalidatePath(`/awardees/${awardee_id}/finances`);
}
