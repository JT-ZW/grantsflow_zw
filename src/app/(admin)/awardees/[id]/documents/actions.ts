"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ── Allowlisted MIME types and safe extensions ───────────────────────────────
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv",
  "application/zip",
]);

const ALLOWED_EXTENSIONS = new Set([
  "pdf", "jpg", "jpeg", "png", "gif", "webp",
  "doc", "docx", "xls", "xlsx", "txt", "csv", "zip",
]);

function safeExtension(filename: string): string | null {
  const parts = filename.split(".");
  if (parts.length < 2) return null;
  const ext = parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, "");
  return ALLOWED_EXTENSIONS.has(ext) ? ext : null;
}

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

  // Validate MIME type and extension against allowlists
  if (!ALLOWED_MIME_TYPES.has(file.type)) return { error: "File type not permitted. Allowed: PDF, images, Office documents, CSV, ZIP." };
  const safeExt = safeExtension(file.name);
  if (!safeExt) return { error: "File extension not permitted." };

  const parsed = uploadDocumentSchema.safeParse({
    grant_id: formData.get("grant_id"),
    awardee_id: formData.get("awardee_id"),
    milestone_id: formData.get("milestone_id") || undefined,
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return { error: "Invalid input" };

  const { grant_id, awardee_id, milestone_id, description } = parsed.data;

  // Unique storage path to avoid collisions
  const storagePath = `grants/${grant_id}/${crypto.randomUUID()}.${safeExt}`;

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

// ── Set document expiry & compliance metadata ────────────────────────────────

const DOCUMENT_TYPES = [
  "ethics_clearance", "tax_clearance", "institutional_agreement",
  "research_permit", "financial_report", "identity_document", "insurance", "other",
] as const;

const expirySchema = z.object({
  document_id:   z.string().uuid(),
  awardee_id:    z.string().uuid(),
  is_compliance: z.enum(["true", "false"]),
  document_type: z.enum(DOCUMENT_TYPES).optional(),
  expires_at:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").refine((d) => new Date(d) > new Date(), { message: "Expiry date must be in the future" }).optional(),
});

export async function setDocumentExpiry(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "program_manager"].includes(profile.role)) {
    return { error: "Insufficient permissions" };
  }

  const parsed = expirySchema.safeParse({
    document_id:   formData.get("document_id"),
    awardee_id:    formData.get("awardee_id"),
    is_compliance: formData.get("is_compliance"),
    document_type: formData.get("document_type") || undefined,
    expires_at:    formData.get("expires_at") || undefined,
  });
  if (!parsed.success) return { error: "Invalid input" };

  const { document_id, awardee_id, is_compliance, document_type, expires_at } = parsed.data;

  const { error } = await supabase
    .from("documents")
    .update({
      is_compliance: is_compliance === "true",
      document_type: document_type ?? null,
      expires_at:    expires_at ?? null,
    })
    .eq("id", document_id);

  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({
    actor_id:    user.id,
    action:      "document.expiry_set",
    entity_type: "document",
    entity_id:   document_id,
    new_data:    { is_compliance, document_type, expires_at },
  });

  revalidatePath(`/awardees/${awardee_id}/documents`);
  return { success: true };
}

const deleteDocumentSchema = z.object({
  document_id: z.string().uuid(),
  awardee_id:  z.string().uuid(),
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
