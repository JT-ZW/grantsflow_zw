import { createClient } from "@/lib/supabase/server";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  "awardee.created":        { label: "Awardee Created",          color: "bg-blue-100 text-blue-700" },
  "grant.created":          { label: "Grant Created",             color: "bg-blue-100 text-blue-700" },
  "grant.status_changed":   { label: "Grant Status Changed",      color: "bg-purple-100 text-purple-700" },
  "milestone.created":      { label: "Milestone Added",           color: "bg-blue-100 text-blue-700" },
  "milestone.status_changed": { label: "Milestone Status Changed", color: "bg-purple-100 text-purple-700" },
  "budget.created":         { label: "Budget Line Added",         color: "bg-green-100 text-green-700" },
  "budget.approved":        { label: "Budget Approved",           color: "bg-green-100 text-green-700" },
  "budget.unapproved":      { label: "Budget Unapproved",         color: "bg-yellow-100 text-yellow-700" },
  "disbursement.recorded":  { label: "Disbursement Recorded",     color: "bg-green-100 text-green-700" },
  "disbursement.approved":  { label: "Disbursement Approved",     color: "bg-blue-100 text-blue-700" },
  "disbursement.rejected":  { label: "Disbursement Rejected",     color: "bg-red-100 text-red-700" },
  "disbursement.processed": { label: "Disbursement Processed",    color: "bg-green-100 text-green-700" },
  "expense.submitted":      { label: "Expense Submitted",         color: "bg-yellow-100 text-yellow-700" },
  "expense.approved":       { label: "Expense Approved",          color: "bg-green-100 text-green-700" },
  "expense.rejected":       { label: "Expense Rejected",          color: "bg-red-100 text-red-700" },
  "document.uploaded":      { label: "Document Uploaded",         color: "bg-blue-100 text-blue-700" },
  "document.deleted":       { label: "Document Deleted",          color: "bg-red-100 text-red-700" },
  "document.expiry_set":    { label: "Document Expiry Set",       color: "bg-purple-100 text-purple-700" },
  "amendment.submitted":    { label: "Amendment Submitted",       color: "bg-yellow-100 text-yellow-700" },
  "amendment.approved":     { label: "Amendment Approved",        color: "bg-green-100 text-green-700" },
  "amendment.rejected":     { label: "Amendment Rejected",        color: "bg-red-100 text-red-700" },
  "report.submitted":       { label: "Report Submitted",          color: "bg-yellow-100 text-yellow-700" },
  "report.approved":        { label: "Report Approved",           color: "bg-green-100 text-green-700" },
  "report.revision_requested": { label: "Report Revision Requested", color: "bg-yellow-100 text-yellow-700" },
  "impact.updated":         { label: "Impact Updated",            color: "bg-purple-100 text-purple-700" },
  "user.invited":           { label: "User Invited",              color: "bg-blue-100 text-blue-700" },
  "user.role_changed":      { label: "User Role Changed",         color: "bg-purple-100 text-purple-700" },
};

function fmtDatetime(d: string) {
  return new Date(d).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface PageProps {
  searchParams: Promise<{ entity_type?: string; action?: string; page?: string }>;
}

const PAGE_SIZE = 50;

export default async function AuditLogPage({ searchParams }: PageProps) {
  const { entity_type, action, page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();

  let query = supabase
    .from("audit_logs")
    .select("*, profiles(email, full_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (entity_type) query = query.eq("entity_type", entity_type);
  if (action) query = query.eq("action", action);

  const { data: logs, count } = await query;

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  // Entity type options for filter
  const entityTypes = [
    "awardee", "grant", "milestone", "budget", "disbursement", "expense",
  ];
  const actionOptions = Object.keys(ACTION_LABELS);

  function buildUrl(params: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    if (params.entity_type) p.set("entity_type", params.entity_type);
    if (params.action) p.set("action", params.action);
    if (params.page && params.page !== "1") p.set("page", params.page);
    const qs = p.toString();
    return `/audit${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Complete history of all actions — {count ?? 0} total entries
        </p>
      </div>

      {/* Filters */}
      <form method="GET" action="/audit" className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Entity Type</label>
          <select
            name="entity_type"
            defaultValue={entity_type ?? ""}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All types</option>
            {entityTypes.map((t) => (
              <option key={t} value={t} className="capitalize">{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Action</label>
          <select
            name="action"
            defaultValue={action ?? ""}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All actions</option>
            {actionOptions.map((a) => (
              <option key={a} value={a}>{ACTION_LABELS[a]?.label ?? a}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          Filter
        </button>
        {(entity_type || action) && (
          <a
            href="/audit"
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Clear
          </a>
        )}
      </form>

      {/* Log table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {!logs || logs.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">No log entries found.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Actor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Entity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => {
                  const meta = ACTION_LABELS[log.action];
                  const actor = log.profiles as { email: string; full_name: string } | null;
                  const newData = log.new_data as Record<string, unknown> | null;
                  const oldData = log.old_data as Record<string, unknown> | null;

                  return (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {fmtDatetime(log.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        {actor ? (
                          <div>
                            <p className="text-xs font-medium text-gray-900">{actor.full_name}</p>
                            <p className="text-xs text-gray-400">{actor.email}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">System</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            meta?.color ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {meta?.label ?? log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs capitalize text-gray-700 font-medium">{log.entity_type}</p>
                        <p className="text-xs text-gray-400 font-mono">{log.entity_id.slice(0, 8)}…</p>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        {newData && (
                          <div className="text-xs text-gray-500 space-y-0.5">
                            {Object.entries(newData)
                              .filter(([k]) => !["id", "grant_id", "awardee_id"].includes(k))
                              .slice(0, 4)
                              .map(([k, v]) => {
                                const oldVal = oldData?.[k];
                                const changed = oldVal !== undefined && oldVal !== v;
                                return (
                                  <div key={k}>
                                    <span className="text-gray-400">{k}: </span>
                                    {changed && (
                                      <>
                                        <span className="line-through text-red-400">{String(oldVal)}</span>
                                        {" → "}
                                      </>
                                    )}
                                    <span className={changed ? "text-green-700 font-medium" : "text-gray-700"}>
                                      {String(v)}
                                    </span>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 bg-gray-50">
                <p className="text-xs text-gray-500">
                  Page {page} of {totalPages} — {count} entries
                </p>
                <div className="flex gap-2">
                  {page > 1 && (
                    <a
                      href={buildUrl({ entity_type, action, page: String(page - 1) })}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white transition-colors"
                    >
                      ← Previous
                    </a>
                  )}
                  {page < totalPages && (
                    <a
                      href={buildUrl({ entity_type, action, page: String(page + 1) })}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white transition-colors"
                    >
                      Next →
                    </a>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
