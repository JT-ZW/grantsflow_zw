import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { awardeeUploadDocument } from "./actions";

type DocumentRow = {
  id: string;
  name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  description: string | null;
  created_at: string;
  milestone_id: string | null;
  profiles: { full_name: string | null; email: string } | null;
};

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

export default async function PortalDocumentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get awardee + grant for this user
  const { data: awardee } = await supabase
    .from("awardees")
    .select("id, grants(id, title)")
    .eq("user_id", user.id)
    .single();

  const awardeeData = awardee as unknown as {
    id: string;
    grants: { id: string; title: string } | null;
  } | null;

  const grant = awardeeData?.grants ?? null;

  const { data: milestones } = grant
    ? await supabase
        .from("milestones")
        .select("id, title")
        .eq("grant_id", grant.id)
        .order("due_date")
    : { data: [] };

  const { data: rawDocs } = grant
    ? await supabase
        .from("documents")
        .select(
          "id, name, storage_path, mime_type, size_bytes, description, created_at, milestone_id, profiles(full_name, email)"
        )
        .eq("grant_id", grant.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  const docs = (rawDocs ?? []) as unknown as DocumentRow[];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Documents</h1>
        <p className="text-sm text-gray-500 mt-1">
          Files for{" "}
          <span className="font-medium">{grant?.title ?? "your grant"}</span>.
        </p>
      </div>

      {/* Upload form */}
      {grant && (
        <details className="rounded-lg border border-dashed border-gray-300 bg-gray-50">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-blue-600 hover:text-blue-800">
            + Upload a document
          </summary>
          <form
            action={awardeeUploadDocument}
            encType="multipart/form-data"
            className="px-4 pb-4 pt-2 space-y-3"
          >
            <input type="hidden" name="grant_id" value={grant.id} />
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">File *</label>
              <input
                type="file"
                name="file"
                required
                className="block w-full text-sm text-gray-700 file:mr-3 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="mt-1 text-xs text-gray-500">Max 20 MB. PDF, images, spreadsheets, Word documents.</p>
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
                    <option key={m.id} value={m.id}>{m.title}</option>
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

      {docs.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No documents yet.</p>
      ) : (
        <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden bg-white">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-start gap-3 px-4 py-3">
              <span className="text-xl mt-0.5">{fileIcon(doc.mime_type)}</span>
              <div className="flex-1 min-w-0">
                <DownloadLink storagePath={doc.storage_path} name={doc.name} />
                {doc.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{doc.description}</p>
                )}
                <div className="flex flex-wrap gap-x-3 mt-0.5 text-xs text-gray-400">
                  <span>{formatBytes(doc.size_bytes)}</span>
                  {doc.profiles && (
                    <span>by {doc.profiles.full_name ?? doc.profiles.email}</span>
                  )}
                  <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                  {doc.milestone_id && <span className="text-blue-500">📌 milestone</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
    .createSignedUrl(storagePath, 60 * 60);

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
