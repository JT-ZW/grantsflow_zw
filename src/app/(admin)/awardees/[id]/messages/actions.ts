"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const sendMessageSchema = z.object({
  grant_id: z.string().uuid(),
  awardee_id: z.string().uuid(),
  body: z.string().min(1).max(4000),
});

export async function sendMessage(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const parsed = sendMessageSchema.safeParse({
    grant_id: formData.get("grant_id"),
    awardee_id: formData.get("awardee_id"),
    body: formData.get("body"),
  });
  if (!parsed.success) return;

  const { grant_id, awardee_id, body } = parsed.data;

  await supabase.from("messages").insert({
    grant_id,
    sender_id: user.id,
    body,
  });

  revalidatePath(`/awardees/${awardee_id}/messages`);
}

export async function markMessagesReadByAdmin(grantId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("messages")
    .update({ read_by_admin_at: new Date().toISOString() })
    .eq("grant_id", grantId)
    .is("read_by_admin_at", null);
}
