"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const sendSchema = z.object({
  grant_id: z.string().uuid(),
  body: z.string().min(1).max(4000),
});

export async function awardeeSendMessage(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const parsed = sendSchema.safeParse({
    grant_id: formData.get("grant_id"),
    body: formData.get("body"),
  });
  if (!parsed.success) return;

  const { grant_id, body } = parsed.data;

  // Ownership verification — RLS ensures only accessible grants are returned
  const { data: grant } = await supabase
    .from("grants")
    .select("id")
    .eq("id", grant_id)
    .single();

  if (!grant) return;

  await supabase.from("messages").insert({ grant_id, sender_id: user.id, body });

  revalidatePath("/portal/messages");
}

export async function markReadByAwardee(grantId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("messages")
    .update({ read_by_awardee_at: new Date().toISOString() })
    .eq("grant_id", grantId)
    .is("read_by_awardee_at", null);

  revalidatePath("/portal/messages");
}
