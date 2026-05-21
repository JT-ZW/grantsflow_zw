import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { saveReportDraft, submitReport } from "./actions";

const STATUS_STYLES: Record<string, string> = {
  draft:               "bg-gray-100 text-gray-700",
  submitted:           "bg-blue-100 text-blue-700",
  under_review:        "bg-amber-100 text-amber-700",
  approved:            "bg-green-100 text-green-700",
  revision_requested:  "bg-orange-100 text-orange-700",
};

const STATUS_LABELS: Record<string, string> = {
  draft:               "Draft",
  submitted:           "Submitted",
  under_review:        "Under Review",
  approved:            "Approved",
  revision_requested:  "Revision Requested",
};

const TYPE_LABELS: Record<string, string> = {
  quarterly: "Quarterly",
  annual:    "Annual",
  final:     "Final",
  ad_hoc:    "Ad Hoc",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-ZA", {
    day: "numeric", month: "long", year: "numeric",
  });
}

type Report = {
  id: string;
  period_label: string;
  report_type: string;
  status: string;
  content: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
};

export default async function AwardeeReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; edit?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { saved, error, edit } = await searchParams;

  // Resolve awardee → grant
  const { data: awardee } = await supabase
    .from("awardees")
    .select("id, full_name")
    .eq("user_id", user.id)
    .single();
  if (!awardee) redirect("/portal");

  const { data: grant } = await supabase
    .from("grants")
    .select("id, title")
    .eq("awardee_id", awardee.id)
    .single();
  if (!grant) redirect("/portal");

  const { data: rawReports } = await supabase
    .from("grant_reports")
    .select("id, period_label, report_type, status, content, submitted_at, reviewed_at, review_notes, created_at")
    .eq("grant_id", grant.id)
    .order("created_at", { ascending: false });

  const reports: Report[] = rawReports ?? [];
  const editingReport = edit ? reports.find((r) => r.id === edit) : null;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Reports</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Submit periodic progress reports for <span className="font-medium text-gray-700">{grant.title}</span>
        </p>
      </div>

      {/* Feedback banners */}
      {saved === "draft" && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Draft saved successfully.
        </div>
      )}
      {saved === "submitted" && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Report submitted for review. You will be notified once it has been assessed.
        </div>
      )}
      {error === "invalid" && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Something went wrong — please check your inputs and try again.
        </div>
      )}

      {/* Report list */}
      {reports.length > 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="text-base font-semibold text-gray-900">Submitted &amp; Draft Reports</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {reports.map((r) => (
              <div key={r.id} className="px-6 py-5">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{r.period_label}</p>
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {TYPE_LABELS[r.report_type] ?? r.report_type}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">
                      Created {fmtDate(r.created_at)}
                      {r.submitted_at && ` · Submitted ${fmtDate(r.submitted_at)}`}
                      {r.reviewed_at && ` · Reviewed ${fmtDate(r.reviewed_at)}`}
                    </p>
                    {r.content && (
                      <p className="mt-2 text-sm text-gray-600 line-clamp-3">{r.content}</p>
                    )}
                    {/* Admin feedback */}
                    {r.review_notes && (
                      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                        <p className="text-xs font-medium text-amber-800 mb-0.5">Reviewer feedback</p>
                        <p className="text-xs text-amber-700 italic">{r.review_notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {(r.status === "draft" || r.status === "revision_requested") && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <a
                        href={`/portal/reports?edit=${r.id}`}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 text-center"
                      >
                        Edit
                      </a>
                      <form action={submitReport}>
                        <input type="hidden" name="report_id" value={r.id} />
                        <button
                          type="submit"
                          className="w-full rounded-lg bg-[#6b1a2a] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#8b2234] transition-colors"
                        >
                          Submit
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-12 text-center">
          <p className="text-sm font-medium text-gray-500">No reports yet</p>
          <p className="mt-1 text-xs text-gray-400">
            Use the form below to create your first progress report.
          </p>
        </div>
      )}

      {/* New / Edit report form */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            {editingReport ? `Editing: ${editingReport.period_label}` : "New Report"}
          </h2>
          <p className="mt-0.5 text-sm text-gray-400">
            {editingReport
              ? "Update your draft — click Save Draft to preserve changes, or Submit to send for review."
              : "Save a draft to continue writing later, or submit directly when ready."}
          </p>
        </div>
        <form action={saveReportDraft} className="p-6 space-y-5">
          {editingReport && (
            <input type="hidden" name="report_id" value={editingReport.id} />
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Period label */}
            <div>
              <label htmlFor="period_label" className="block text-sm font-medium text-gray-700 mb-1">
                Period Label <span className="text-red-500">*</span>
              </label>
              <input
                id="period_label"
                name="period_label"
                type="text"
                required
                placeholder="e.g. Q1 2026, Annual 2025, Final"
                defaultValue={editingReport?.period_label ?? ""}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#6b1a2a] focus:outline-none focus:ring-1 focus:ring-[#6b1a2a]"
              />
            </div>

            {/* Report type */}
            <div>
              <label htmlFor="report_type" className="block text-sm font-medium text-gray-700 mb-1">
                Report Type <span className="text-red-500">*</span>
              </label>
              <select
                id="report_type"
                name="report_type"
                required
                defaultValue={editingReport?.report_type ?? "quarterly"}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#6b1a2a] focus:outline-none focus:ring-1 focus:ring-[#6b1a2a]"
              >
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
                <option value="final">Final</option>
                <option value="ad_hoc">Ad Hoc</option>
              </select>
            </div>
          </div>

          {/* Content */}
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
              Report Content
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Describe progress made during this period, challenges encountered, and planned next steps.
            </p>
            <textarea
              id="content"
              name="content"
              rows={10}
              defaultValue={editingReport?.content ?? ""}
              placeholder="Write your progress report here…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#6b1a2a] focus:outline-none focus:ring-1 focus:ring-[#6b1a2a] resize-y"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Save Draft
            </button>
            {editingReport && (
              <form action={submitReport} className="contents">
                <input type="hidden" name="report_id" value={editingReport.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-[#6b1a2a] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#8b2234] transition-colors"
                >
                  Submit for Review
                </button>
              </form>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
