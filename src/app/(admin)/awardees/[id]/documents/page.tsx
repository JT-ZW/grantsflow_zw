import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { deleteDocument, uploadDocument, setDocumentExpiry } from "./actions";

async function handleUpload(formData: FormData) {
  "use server";
  await uploadDocument(formData);
}

async function handleDelete(formData: FormData) {
  "use server";
  await deleteDocument(formData);
}

async function handleSetExpiry(formData: FormData) {
  "use server";
  await setDocumentExpiry(formData);
}

type DocumentRow = {
  id: string;
  name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  description: string | null;
  created_at: string;
  milestone_id: string | null;
  version: number | null;
  is_current: boolean | null;
  is_compliance: boolean | null;
  document_type: string | null;
  expires_at: string | null;
  profiles: { full_name: string | null; email: string } | null;
};

const DOC_TYPE_LABELS: Record<string, string> = {
  ethics_clearance:        "Ethics Clearance",
  tax_clearance:           "Tax Clearance",
  institutional_agreement: "Institutional Agreement",
  research_permit:         "Research Permit",
  financial_report:        "Financial Report",
  identity_document:       "Identity Document",
  insurance:               "Insurance",
  other:                   "Other",
};

const DOC_TYPES = Object.keys(DOC_TYPE_LABELS);

function expiryBadge(expiresAt: string | null) {
  if (!expiresAt) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiresAt + "T00:00:00");
  const days = Math.ceil((exp.getTime() - today.getTime()) / 86_400_000);
  if (days < 0)
    return <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Expired {Math.abs(days)}d ago</span>;
  if (days <= 30)
    return <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Expires in {days}d</span>;
  return <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Valid · {exp.toLocaleDateString("en-ZA")}</span>;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileIcon(mime: string | null) {
  if (!mime) return "📄";
  if (mime.startsWith("image/")) return "🖼️";
  if (mime === "application/pdf") return "📕";
  if (mime.includes("spreadsheet") || mime.includes("excel")) return "📊";
  if (mime.includes("word") || mime.includes("document")) return "📝";
  return "📄";
}

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: awardeeId } = await params;
  const supabase = await createClient();

  const { data: awardee } = await supabase
    .from("awardees")
    .select("id, grants(id, title)")
    .eq("id", awardeeId)
    .single();

  if (!awardee) notFound();

  const grantData = awardee as unknown as {
    id: string;
    grants: { id: string; title: string } | null;
  };

  const grant = grantData.grants;

  const { data: milestones } = await supabase
    .from("milestones")
    .select("id, title")
    .eq("grant_id", grant?.id ?? "")
    .order("due_date");

  const { data: rawDocs } = grant
    ? await supabase
        .from("documents")
        .select("id, name, storage_path, mime_type, size_bytes, description, created_at, milestone_id, version, is_current, is_compliance, document_type, expires_at, profiles(full_name, email)")
        .eq("grant_id", grant.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  const docs = (rawDocs ?? []) as unknown as DocumentRow[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Documents</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {docs.length} file{docs.length !== 1 ? "s" : ""} uploaded
          </p>
        </div>
      </div>

      {/* Upload form */}
      {grant && (
        <details className="rounded-lg border border-dashed border-gray-300 bg-gray-50">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-blue-600 hover:text-blue-800">
            + Upload document
          </summary>
          <form action={handleUpload} className="px-4 pb-4 pt-2 space-y-3">
            <input type="hidden" name="grant_id" value={grant.id} />
            <input type="hidden" name="awardee_id" value={awardeeId} />

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">File *</label>
              <input
                type="file"
                name="file"
                required
                className="block w-full text-sm text-gray-700 file:mr-3 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="mt-1 text-xs text-gray-500">Max 20 MB. PDF, images, spreadsheets, Word documents supported.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Linked milestone <span className="text-gray-400">(optional)</span>
                </label>
                <select
                  name="milestone_id"
                  className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">None</option>
                  {(milestones ?? []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Description <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  name="description"
                  maxLength={500}
                  placeholder="Brief note about this file"
                  className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Upload
            </button>
          </form>
        </details>
      )}

      {/* Document list */}
      {docs.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No documents uploaded yet.</p>
      ) : (
        <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden bg-white">
          {docs.map((doc) => (
            <div key={doc.id} className="px-4 py-3">
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">{fileIcon(doc.mime_type)}</span>
                <div className="flex-1 min-w-0">
                  <DownloadLink storagePath={doc.storage_path} name={doc.name} />
                  {doc.description && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{doc.description}</p>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-400">
                    <span>{formatBytes(doc.size_bytes)}</span>
                    {doc.version && (
                      <span className={`font-medium ${doc.is_current ? "text-green-600" : "text-gray-400"}`}>
                        v{doc.version}{doc.is_current ? "" : " (old)"}
                      </span>
                    )}
                    {doc.profiles && (
                      <span>by {doc.profiles.full_name ?? doc.profiles.email}</span>
                    )}
                    <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                    {doc.milestone_id && <span className="text-blue-500">📌 milestone</span>}
                    {doc.is_compliance && doc.document_type && (
                      <span className="font-medium text-[#6b1a2a]">{DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}</span>
                    )}
                  </div>
                  {doc.is_compliance && (
                    <div className="mt-1.5">{expiryBadge(doc.expires_at)}</div>
                  )}
                </div>
                <form action={handleDelete}>
                  <input type="hidden" name="document_id" value={doc.id} />
                  <input type="hidden" name="awardee_id" value={awardeeId} />
                  <button
                    type="submit"
                    className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    title="Delete document"
                  >
                    Delete
                  </button>
                </form>
              </div>
              {/* Per-document compliance / expiry form */}
              <details className="mt-2 ml-8">
                <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 select-none">
                  {doc.is_compliance ? "Edit compliance metadata" : "Mark as compliance document"}
                </summary>
                <form action={handleSetExpiry} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <input type="hidden" name="document_id" value={doc.id} />
                  <input type="hidden" name="awardee_id" value={awardeeId} />
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Document Type</label>
                    <select
                      name="document_type"
                      defaultValue={doc.document_type ?? ""}
                      className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#6b1a2a]"
                    >
                      <option value="">— none —</option>
                      {DOC_TYPES.map((t) => (
                        <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Expiry Date</label>
                    <input
                      type="date"
                      name="expires_at"
                      defaultValue={doc.expires_at ?? ""}
                      className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#6b1a2a]"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Compliance flag</label>
                    <div className="flex gap-3 items-center">
                      <label className="flex items-center gap-1 text-xs">
                        <input type="radio" name="is_compliance" value="true" defaultChecked={!!doc.is_compliance} />
                        Yes
                      </label>
                      <label className="flex items-center gap-1 text-xs">
                        <input type="radio" name="is_compliance" value="false" defaultChecked={!doc.is_compliance} />
                        No
                      </label>
                      <button type="submit" className="ml-auto rounded-md bg-[#6b1a2a] px-3 py-1 text-xs font-medium text-white hover:bg-[#8b2234] transition-colors">
                        Save
                      </button>
                    </div>
                  </div>
                </form>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Inline async server component that generates a signed URL for each doc
async function DownloadLink({
  storagePath,
  name,
}: {
  storagePath: string;
  name: string;
}) {
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("grant-documents")
    .createSignedUrl(storagePath, 60 * 60); // 1 hour

  if (!data?.signedUrl) {
    return <span className="text-sm font-medium text-gray-700 truncate">{name}</span>;
  }

  return (
    <a
      href={data.signedUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm font-medium text-blue-600 hover:underline truncate block"
    >
      {name}
    </a>
  );
}
