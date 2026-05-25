"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

const uploadSchema = z.object({
  grant_id:      z.string().uuid(),
  milestone_id:  z.string().uuid().optional(),
  description:   z.string().max(500).optional(),
  document_type: z.enum([
    "ethics_clearance", "tax_clearance", "institutional_agreement",
    "research_permit", "financial_report", "identity_document", "insurance", "other",
  ]).optional(),
  expires_at:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").refine((d) => new Date(d) > new Date(), { message: "Expiry date must be in the future" }).optional(),
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

  // Validate MIME type and extension against allowlists
  if (!ALLOWED_MIME_TYPES.has(file.type)) return;
  const ext = safeExtension(file.name);
  if (!ext) return;

  const parsed = uploadSchema.safeParse({
    grant_id:      formData.get("grant_id"),
    milestone_id:  formData.get("milestone_id") || undefined,
    description:   formData.get("description") || undefined,
    document_type: formData.get("document_type") || undefined,
    expires_at:    formData.get("expires_at") || undefined,
  });
  if (!parsed.success) return;

  const { grant_id, milestone_id, description, document_type, expires_at } = parsed.data;

  // Ownership verification — RLS ensures only accessible grants are returned
  const { data: grant } = await supabase
    .from("grants")
    .select("id")
    .eq("id", grant_id)
    .single();

  if (!grant) return;

  const storagePath = `grants/${grant_id}/${crypto.randomUUID()}.${ext}`;

  const adminStorage = createAdminClient();
  const { error: uploadError } = await adminStorage.storage
    .from("grants-documents")
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) return;

  const isCompliance = !!document_type;

  const { error: dbError } = await supabase.from("documents").insert({
    grant_id,
    milestone_id:  milestone_id || null,
    uploaded_by:   user.id,
    name:          file.name,
    storage_path:  storagePath,
    mime_type:     file.type || null,
    size_bytes:    file.size,
    description:   description || null,
    is_compliance: isCompliance,
    document_type: document_type ?? null,
    expires_at:    expires_at || null,
  });

  if (dbError) {
    await adminStorage.storage.from("grants-documents").remove([storagePath]);
    return;
  }

  await supabase.from("audit_logs").insert({
    actor_id:    user.id,
    action:      "document.uploaded",
    entity_type: "document",
    entity_id:   grant_id,
    new_data:    { name: file.name, grant_id, milestone_id, document_type, expires_at },
  });

  revalidatePath("/portal/documents");
}
