"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const CURRENCIES = ["ZAR", "USD", "EUR", "GBP"] as const;

const programmeSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(1000).optional(),
  total_budget: z.coerce.number().positive().optional(),
  currency_code: z.enum(CURRENCIES).default("USD"),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

export type ProgrammeState = { error?: string; success?: string } | null;

export async function createProgramme(_prev: ProgrammeState, formData: FormData): Promise<ProgrammeState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { error: "Only admins can create programmes." };

  const parsed = programmeSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    total_budget: formData.get("total_budget") || undefined,
    currency_code: formData.get("currency_code"),
    start_date: formData.get("start_date") || undefined,
    end_date: formData.get("end_date") || undefined,
  });
  if (!parsed.success) return { error: "Invalid input — check all fields." };

  const d = parsed.data;

  const { error } = await supabase.from("programmes").insert({
    name: d.name,
    description: d.description || null,
    total_budget: d.total_budget || null,
    currency_code: d.currency_code,
    start_date: d.start_date || null,
    end_date: d.end_date || null,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "programme.created",
    entity_type: "programme",
    entity_id: null,
    new_data: { name: d.name },
  });

  revalidatePath("/programmes");
  return { success: `Programme "${d.name}" created.` };
}
