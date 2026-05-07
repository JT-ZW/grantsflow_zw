"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const EXPENSE_CATEGORIES = [
  "Personnel / Salaries",
  "Equipment & Materials",
  "Travel & Accommodation",
  "Research Activities",
  "Publishing & Dissemination",
  "Overheads",
  "Other",
] as const;

const CURRENCIES = ["ZAR", "USD", "EUR", "GBP"] as const;

const submitExpenseSchema = z.object({
  grant_id: z.string().uuid(),
  milestone_id: z.string().uuid().optional().or(z.literal("")),
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().min(1).max(500),
  amount: z.coerce.number().positive(),
  currency_code: z.enum(CURRENCIES),
  expense_date: z.string().min(1),
});

export async function submitExpense(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const parsed = submitExpenseSchema.safeParse({
    grant_id: formData.get("grant_id"),
    milestone_id: formData.get("milestone_id"),
    category: formData.get("category"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    currency_code: formData.get("currency_code"),
    expense_date: formData.get("expense_date"),
  });
  if (!parsed.success) return;

  const { grant_id, milestone_id, category, description, amount, currency_code, expense_date } = parsed.data;

  // Ownership verification
  const { data: grant } = await supabase
    .from("grants")
    .select("id, awardees!inner(user_id)")
    .eq("id", grant_id)
    .single();

  const grantData = grant as unknown as {
    id: string;
    awardees: { user_id: string };
  } | null;

  if (!grantData || grantData.awardees.user_id !== user.id) return;

  // Handle receipt file upload to storage
  let receiptStoragePath: string | null = null;
  const receiptFile = formData.get("receipt_file") as File | null;
  if (receiptFile && receiptFile.size > 0) {
    if (receiptFile.size > 10 * 1024 * 1024) return; // 10 MB limit
    const ext = receiptFile.name.split(".").pop();
    const storagePath = `receipts/${grant_id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("expense-receipts")
      .upload(storagePath, receiptFile, { contentType: receiptFile.type, upsert: false });
    if (!uploadError) receiptStoragePath = storagePath;
  }

  const { data: expense } = await supabase
    .from("expenses")
    .insert({
      grant_id,
      milestone_id: milestone_id || null,
      category,
      description,
      amount,
      currency_code,
      expense_date,
      receipt_storage_path: receiptStoragePath,
      submitted_by: user.id,
      status: "pending",
    })
    .select("id")
    .single();

  if (expense) {
    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "expense.submitted",
      entity_type: "expense",
      entity_id: expense.id,
      new_data: { grant_id, category, amount, currency_code, expense_date },
    });

    const { data: staffProfiles } = await supabase
      .from("profiles")
      .select("id")
      .in("role", ["admin", "finance_officer", "program_manager"]);

    if (staffProfiles && staffProfiles.length > 0) {
      await supabase.from("notifications").insert(
        staffProfiles.map((p) => ({
          user_id: p.id,
          title: "New Expense Submitted",
          body: `${description} — ${currency_code} ${Number(amount).toFixed(2)} (${category})`,
          type: "expense_submitted",
          entity_type: "expense",
          entity_id: expense.id,
          href: `/finances`,
        }))
      );
    }
  }

  revalidatePath("/portal/finances");
}
