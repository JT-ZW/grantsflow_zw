"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const uploadDocumentSchema = z.object({
  grant_id: z.string().uuid(),
  awardee_id: z.string().uuid(),
  milestone_id: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
});

export async function uploadDocument(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "No file provided" };
  if (file.size > 20 * 1024 * 1024) return { error: "File must be under 20 MB" };

  const parsed = uploadDocumentSchema.safeParse({
    grant_id: formData.get("grant_id"),
    awardee_id: formData.get("awardee_id"),
    milestone_id: formData.get("milestone_id") || undefined,
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return { error: "Invalid input" };

  const { grant_id, awardee_id, milestone_id, description } = parsed.data;

  // Unique storage path to avoid collisions
  const ext = file.name.split(".").pop();
  const storagePath = `grants/${grant_id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("grant-documents")
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) return { error: uploadError.message };

  // Versioning — check if a current document with the same name already exists
  const { data: existingDocs } = await supabase
    .from("documents")
    .select("id, version")
    .eq("grant_id", grant_id)
    .eq("name", file.name)
    .eq("is_current", true)
    .order("version", { ascending: false })
    .limit(1);

  const existing = (existingDocs ?? [])[0] as { id: string; version: number } | undefined;
  const nextVersion = existing ? existing.version + 1 : 1;

  if (existing) {
    await supabase.from("documents").update({ is_current: false }).eq("id", existing.id);
  }

  const { error: dbError } = await supabase.from("documents").insert({
    grant_id,
    milestone_id: milestone_id || null,
    uploaded_by: user.id,
    name: file.name,
    storage_path: storagePath,
    mime_type: file.type || null,
    size_bytes: file.size,
    description: description || null,
    version: nextVersion,
    is_current: true,
    previous_version_id: existing?.id ?? null,
  });

  if (dbError) {
    // Roll back the storage upload if DB insert fails
    await supabase.storage.from("grant-documents").remove([storagePath]);
    return { error: dbError.message };
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "document.uploaded",
    entity_type: "document",
    entity_id: grant_id,
    new_data: { name: file.name, grant_id, milestone_id },
  });

  revalidatePath(`/awardees/${awardee_id}/documents`);
  return { success: true };
}

const deleteDocumentSchema = z.object({
  document_id: z.string().uuid(),
  awardee_id: z.string().uuid(),
});

export async function deleteDocument(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const parsed = deleteDocumentSchema.safeParse({
    document_id: formData.get("document_id"),
    awardee_id: formData.get("awardee_id"),
  });
  if (!parsed.success) return { error: "Invalid input" };

  const { document_id, awardee_id } = parsed.data;

  const { data: doc } = await supabase
    .from("documents")
    .select("id, storage_path, name, grant_id")
    .eq("id", document_id)
    .single();

  if (!doc) return { error: "Document not found" };

  await supabase.storage.from("grant-documents").remove([doc.storage_path]);

  await supabase.from("documents").delete().eq("id", document_id);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "document.deleted",
    entity_type: "document",
    entity_id: doc.grant_id,
    new_data: { name: doc.name },
  });

  revalidatePath(`/awardees/${awardee_id}/documents`);
  return { success: true };
}
