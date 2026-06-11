"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const profileSchema = z.object({
  gender: z.enum(["female", "male"]).optional(),
  phone: z.string().max(30).optional(),
});

export async function updateAwardeeProfile(
  _prev: { error?: string; success?: string } | null,
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const raw = {
    gender: (formData.get("gender") as string) || undefined,
    phone: (formData.get("phone") as string) || undefined,
  };

  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  // Verify the user is an awardee
  const { data: awardee } = await supabase
    .from("awardees")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!awardee) return { error: "Awardee record not found." };

  const { error } = await supabase
    .from("awardees")
    .update({
      gender: parsed.data.gender ?? null,
      phone: parsed.data.phone ?? null,
    })
    .eq("id", awardee.id);

  if (error) return { error: "Failed to update profile. Please try again." };

  revalidatePath("/portal/profile");
  return { success: "Profile updated successfully." };
}
