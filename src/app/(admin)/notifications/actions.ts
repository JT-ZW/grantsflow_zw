"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function markNotificationRead(notificationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  revalidatePath("/notifications");
}

export async function markAllRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false);

  revalidatePath("/notifications");
}

/**
 * Called by server actions whenever a relevant event happens.
 * Uses the same Supabase client (server) — works within Server Actions.
 */
export async function createNotification({
  user_id,
  title,
  body,
  type,
  entity_type,
  entity_id,
  href,
}: {
  user_id: string;
  title: string;
  body: string;
  type: string;
  entity_type?: string;
  entity_id?: string;
  href?: string;
}) {
  const supabase = await createClient();
  await supabase.from("notifications").insert({
    user_id,
    title,
    body,
    type,
    entity_type: entity_type ?? null,
    entity_id: entity_id ?? null,
    href: href ?? null,
  });
}
