import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { reviewGrantReport } from "../actions";

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

export default async function AdminAwardeeReportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: awardee } = await supabase
    .from("awardees")
    .select("id, full_name, email")
    .eq("id", id)
    .single();
  if (!awardee) notFound();

  const { data: grant } = await supabase
    .from("grants")
    .select("id, title, status")
    .eq("awardee_id", id)
    .single();
  if (!grant) notFound();

  const { data: rawReports } = await supabase
    .from("grant_reports")
    .select("id, period_label, report_type, status, content, submitted_at, reviewed_at, review_notes, reviewed_by")
    .eq("grant_id", grant.id)
    .order("created_at", { ascending: false });

  const reports = rawReports ?? [];

  // Get reviewer names for reviewed reports
  const reviewerIds = [...new Set(reports.map((r) => r.reviewed_by).filter(Boolean))] as string[];
  const reviewerMap: Record<string, string> = {};
  if (reviewerIds.length > 0) {
    const { data: reviewers } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", reviewerIds);
    (reviewers ?? []).forEach((rv) => {
      reviewerMap[rv.id] = rv.full_name ?? rv.id;
    });
  }

  const pending = reports.filter((r) => r.status === "submitted" || r.status === "under_review");
  const reviewed = reports.filter((r) => r.status !== "submitted" && r.status !== "under_review");

  return (
    <div className="space-y-8">
      {/* Pending review */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Pending Review</h2>
            <p className="mt-0.5 text-sm text-gray-400">
              Reports submitted by the awardee awaiting your assessment
            </p>
          </div>
          {pending.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
              {pending.length}
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-gray-400">
            No reports pending review.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {pending.map((r) => (
              <div key={r.id} className="px-6 py-5 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{r.period_label}</p>
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {TYPE_LABELS[r.report_type] ?? r.report_type}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status]}`}>
                        {STATUS_LABELS[r.status]}
                      </span>
                    </div>
                    {r.submitted_at && (
                      <p className="mt-0.5 text-xs text-gray-400">
                        Submitted {fmtDate(r.submitted_at)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Content preview */}
                {r.content && (
                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">
                    {r.content}
                  </div>
                )}

                {/* Review form */}
                <form action={reviewGrantReport} className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-3">
                  <input type="hidden" name="report_id" value={r.id} />
                  <input type="hidden" name="awardee_id" value={id} />
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Review Notes <span className="font-normal text-gray-400">(visible to awardee)</span>
                    </label>
                    <textarea
                      name="review_notes"
                      rows={3}
                      placeholder="Add feedback or revision instructions…"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#6b1a2a] focus:outline-none focus:ring-1 focus:ring-[#6b1a2a] resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      name="status"
                      value="under_review"
                      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                    >
                      Mark Under Review
                    </button>
                    <button
                      type="submit"
                      name="status"
                      value="approved"
                      className="rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      type="submit"
                      name="status"
                      value="revision_requested"
                      className="rounded-lg border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 transition-colors"
                    >
                      Request Revision
                    </button>
                  </div>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History */}
      {reviewed.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="text-base font-semibold text-gray-900">Report History</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {reviewed.map((r) => (
              <div key={r.id} className="px-6 py-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900">{r.period_label}</p>
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                        {TYPE_LABELS[r.report_type] ?? r.report_type}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {r.reviewed_at && `Reviewed ${fmtDate(r.reviewed_at)}`}
                      {r.reviewed_by && reviewerMap[r.reviewed_by] && ` by ${reviewerMap[r.reviewed_by]}`}
                    </p>
                    {r.review_notes && (
                      <p className="mt-1.5 text-xs text-gray-500 italic">
                        &ldquo;{r.review_notes}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {reports.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-12 text-center">
          <p className="text-sm font-medium text-gray-500">No reports submitted yet</p>
          <p className="mt-1 text-xs text-gray-400">
            The awardee has not submitted any progress reports.
          </p>
        </div>
      )}
    </div>
  );
}
