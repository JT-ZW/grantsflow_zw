"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const uploadSchema = z.object({
  grant_id: z.string().uuid(),
  milestone_id: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
});

export async function awardeeUploadDocument(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return;
  if (file.size > 20 * 1024 * 1024) return;

  const parsed = uploadSchema.safeParse({
    grant_id: formData.get("grant_id"),
    milestone_id: formData.get("milestone_id") || undefined,
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return;

  const { grant_id, milestone_id, description } = parsed.data;

  // Ownership verification
  const { data: grant } = await supabase
    .from("grants")
    .select("id, awardees!inner(user_id)")
    .eq("id", grant_id)
    .single();

  const grantData = grant as unknown as { id: string; awardees: { user_id: string } } | null;
  if (!grantData || grantData.awardees.user_id !== user.id) return;

  const ext = file.name.split(".").pop();
  const storagePath = `grants/${grant_id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("grant-documents")
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) return;

  const { error: dbError } = await supabase.from("documents").insert({
    grant_id,
    milestone_id: milestone_id || null,
    uploaded_by: user.id,
    name: file.name,
    storage_path: storagePath,
    mime_type: file.type || null,
    size_bytes: file.size,
    description: description || null,
  });

  if (dbError) {
    await supabase.storage.from("grant-documents").remove([storagePath]);
    return;
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "document.uploaded",
    entity_type: "document",
    entity_id: grant_id,
    new_data: { name: file.name, grant_id, milestone_id },
  });

  revalidatePath("/portal/documents");
}
