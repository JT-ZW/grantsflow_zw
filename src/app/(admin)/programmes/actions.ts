"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const programmeSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(1000).optional(),
  total_budget: z.coerce.number().positive().optional(),
  currency_code: z.string().min(2).max(10).default("USD"),
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

  const { data: prog, error } = await supabase.from("programmes").insert({
    name: d.name,
    description: d.description || null,
    total_budget: d.total_budget || null,
    currency_code: d.currency_code,
    start_date: d.start_date || null,
    end_date: d.end_date || null,
    created_by: user.id,
  }).select("id").single();

  if (error) return { error: error.message };

  // Insert categories if provided
  const categoriesJson = formData.get("categories_json") as string | null;
  if (categoriesJson) {
    try {
      const names: string[] = JSON.parse(categoriesJson);
      const rows = names
        .filter((n) => n.trim())
        .map((name, i) => ({ programme_id: prog.id, name: name.trim(), sort_order: i }));
      if (rows.length > 0) {
        await supabase.from("programme_categories").insert(rows);
      }
    } catch { /* ignore malformed JSON */ }
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "programme.created",
    entity_type: "programme",
    entity_id: prog.id,
    new_data: { name: d.name },
  });

  revalidatePath("/programmes");
  return { success: `Programme "${d.name}" created.` };
}

// ── Category management ──────────────────────────────────────────────────────

export type CategoryActionState = { error?: string; success?: string } | null;

export async function addProgrammeCategory(
  _prev: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { error: "Only admins can manage categories." };

  const programmeId = formData.get("programme_id") as string;
  const name = (formData.get("name") as string)?.trim();
  if (!programmeId || !name) return { error: "Category name is required." };

  // Determine next sort_order
  const { data: existing } = await supabase
    .from("programme_categories")
    .select("sort_order")
    .eq("programme_id", programmeId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder = ((existing?.[0]?.sort_order ?? -1) as number) + 1;

  const { error } = await supabase.from("programme_categories").insert({
    programme_id: programmeId,
    name,
    sort_order: nextOrder,
  });
  if (error) return { error: error.message };

  revalidatePath("/programmes");
  revalidatePath(`/programmes/${programmeId}/categories`);
  return { success: `Category "${name}" added.` };
}

export async function deleteProgrammeCategory(categoryId: string, programmeId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { error: "Only admins can manage categories." };

  const { error } = await supabase.from("programme_categories").delete().eq("id", categoryId);
  if (error) return { error: error.message };

  revalidatePath("/programmes");
  revalidatePath(`/programmes/${programmeId}/categories`);
  return {};
}
