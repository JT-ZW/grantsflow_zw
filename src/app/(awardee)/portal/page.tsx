import { createClient } from "@/lib/supabase/server";
import { awardeeUpdateMilestoneStatus, submitMilestoneProgress } from "./actions";

const MILESTONE_STATUS_STYLES: Record<string, { badge: string; border: string }> = {
  not_started: { badge: "bg-gray-100 text-gray-600",   border: "border-l-gray-300" },
  in_progress:  { badge: "bg-blue-100 text-blue-700",   border: "border-l-blue-400" },
  completed:    { badge: "bg-green-100 text-green-700", border: "border-l-green-500" },
  delayed:      { badge: "bg-red-100 text-red-700",     border: "border-l-red-500"  },
};

const MILESTONE_STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed:   "Completed",
  delayed:     "Delayed",
};

const GRANT_STATUS_STYLES: Record<string, string> = {
  active:    "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
  suspended: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-red-100 text-red-700",
};

export default async function PortalPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: awardee } = await supabase
    .from("awardees")
    .select(`
      id, full_name, email, department, faculty,
      grants (
        id, title, description, grant_type, status,
        amount_awarded, currency_code, start_date, end_date,
        milestones (
          id, title, description, deliverables, due_date,
          status, progress_notes, sort_order, completion_pct
        )
      )
    `)
    .eq("user_id", user!.id)
    .single();

  if (!awardee) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="rounded-xl border border-gray-200 bg-white p-10 max-w-md">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Account not yet linked</h1>
          <p className="text-sm text-gray-500">
            Your account hasn&apos;t been linked to a grant yet. Please contact
            the Research &amp; Innovation Office to complete your onboarding.
          </p>
        </div>
      </div>
    );
  }

  const allGrants = (awardee.grants as {
    id: string; title: string; description: string | null;
    grant_type: string; status: string; amount_awarded: number;
    currency_code: string; start_date: string; end_date: string;
    milestones: {
      id: string; title: string; description: string | null;
      deliverables: string | null; due_date: string; status: string;
      progress_notes: string | null; completion_pct: number | null; sort_order: number;
    }[];
  }[]) ?? [];

  // Show the most recently active grant first, or the first grant if none are active
  const grant = allGrants.find((g) => g.status === "active") ?? allGrants[0];

  const milestones = (grant?.milestones ?? []).sort((a, b) => a.sort_order - b.sort_order);

  const indicators = grant
    ? await supabase
        .from("grant_impact_indicators")
        .select("id, label, unit, target_value")
        .eq("grant_id", grant.id)
        .order("sort_order")
        .then(({ data }) => data ?? [])
    : [];

  const today = new Date();
  const completedCount = milestones.filter((m) => m.status === "completed").length;
  const inProgressCount = milestones.filter((m) => m.status === "in_progress").length;
  const delayedCount = milestones.filter((m) => m.status === "delayed").length;
  // overdueCount: past due date AND not completed AND not already formally delayed (avoid double-count)
  const overdueCount = milestones.filter(
    (m) => m.status !== "completed" && m.status !== "delayed" && new Date(m.due_date) < today
  ).length;
  const progress = milestones.length > 0
    ? Math.round((completedCount / milestones.length) * 100)
    : 0;

  const endDate = grant ? new Date(grant.end_date) : null;
  const startDate = grant ? new Date(grant.start_date) : null;
  const daysRemaining = endDate
    ? Math.ceil((endDate.getTime() - today.getTime()) / 86_400_000)
    : null;
  const totalDays = (startDate && endDate)
    ? Math.ceil((endDate.getTime() - startDate.getTime()) / 86_400_000)
    : null;
  const elapsedPct = (startDate && endDate && totalDays)
    ? Math.min(100, Math.max(0, Math.round(
        ((today.getTime() - startDate.getTime()) / 86_400_000) / totalDays * 100
      )))
    : null;

  // Next actionable milestone: include delayed (they need attention too), nearest due date
  const nextMilestone = milestones
    .filter((m) => m.status !== "completed")
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0] ?? null;

  // Safe firstName: skip honorifics like "Dr.", "Prof.", "Mr.", "Ms."
  const HONORIFICS = new Set(["dr.", "prof.", "mr.", "ms.", "mrs.", "miss", "rev."]);
  const nameParts = awardee.full_name.trim().split(/\s+/);
  const firstName = (HONORIFICS.has(nameParts[0]?.toLowerCase()) ? nameParts[1] : nameParts[0]) ?? nameParts[0];

  return (
    <div className="space-y-6">
      {/* â”€â”€ Welcome header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest text-blue-500 uppercase mb-1">
            Awardee Portal
          </p>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {firstName}
          </h1>
          {(awardee.faculty || awardee.department) && (
            <p className="mt-0.5 text-sm text-gray-400">
              {[awardee.faculty, awardee.department].filter(Boolean).join(" Â· ")}
            </p>
          )}
        </div>
        {grant && (
          <span className={`self-start sm:self-auto inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold capitalize ${GRANT_STATUS_STYLES[grant.status] ?? "bg-gray-100 text-gray-600"}`}>
            {grant.status}
          </span>
        )}
      </div>

      {/* Multi-grant notice */}
      {allGrants.length > 1 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          You have <strong>{allGrants.length}</strong> grants on your account. Showing your active grant below.
          Please contact the grants office to view details for your other grants.
        </div>
      )}

      {!grant && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <p className="text-sm text-gray-500">No grant has been assigned to your account yet.</p>
        </div>
      )}

      {grant && (
        <>
          {/* â”€â”€ Stat tiles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Milestones */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-400 mb-1">Milestones</p>
              <p className="text-2xl font-bold text-gray-900">{completedCount}<span className="text-base font-normal text-gray-400">/{milestones.length}</span></p>
              <p className="text-xs text-gray-500 mt-0.5">completed</p>
            </div>
            {/* In progress */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-400 mb-1">In Progress</p>
              <p className="text-2xl font-bold text-blue-600">{inProgressCount}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {delayedCount > 0
                  ? <span className="text-red-500">{delayedCount} delayed</span>
                  : "on track"}
              </p>
            </div>
            {/* Days remaining */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-400 mb-1">Days Left</p>
              <p className={`text-2xl font-bold ${daysRemaining !== null && daysRemaining < 0 ? "text-red-600" : daysRemaining !== null && daysRemaining < 30 ? "text-yellow-600" : "text-gray-900"}`}>
                {daysRemaining !== null
                  ? daysRemaining < 0 ? `${Math.abs(daysRemaining)}` : daysRemaining
                  : "â€”"}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {daysRemaining !== null && daysRemaining < 0 ? "days overdue" : "until grant end"}
              </p>
            </div>
            {/* Awarded amount */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-400 mb-1">Amount Awarded</p>
              <p className="text-2xl font-bold text-gray-900 truncate">
                {Number(grant.amount_awarded).toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{grant.currency_code}</p>
            </div>
          </div>

          {/* â”€â”€ Overdue warning banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {overdueCount > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700">
                <span className="font-semibold">{overdueCount} milestone{overdueCount > 1 ? "s are" : " is"} overdue.</span>{" "}
                Please submit a progress update or contact the grants office.
              </p>
            </div>
          )}

          {/* â”€â”€ Grant overview card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">{grant.title}</h2>
                <p className="text-xs text-gray-400 mt-0.5 capitalize">{grant.grant_type}</p>
              </div>
            </div>

            <dl className="px-6 py-4 grid grid-cols-2 gap-4 sm:grid-cols-4 border-b border-gray-100">
              <div>
                <dt className="text-xs text-gray-400">Amount Awarded</dt>
                <dd className="text-sm font-semibold text-gray-900 mt-0.5">
                  {grant.currency_code} {Number(grant.amount_awarded).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Start Date</dt>
                <dd className="text-sm font-medium text-gray-900 mt-0.5">
                  {new Date(grant.start_date).toLocaleDateString("en-ZA")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">End Date</dt>
                <dd className="text-sm font-medium text-gray-900 mt-0.5">
                  {new Date(grant.end_date).toLocaleDateString("en-ZA")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Grant Type</dt>
                <dd className="text-sm font-medium text-gray-900 mt-0.5 capitalize">{grant.grant_type}</dd>
              </div>
            </dl>

            {/* Time elapsed bar */}
            {elapsedPct !== null && (
              <div className="px-6 py-4">
                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                  <span>Time elapsed</span>
                  <span>{elapsedPct}% of grant period</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all ${elapsedPct >= progress ? "bg-amber-400" : "bg-blue-400"}`}
                    style={{ width: `${elapsedPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>{new Date(grant.start_date).toLocaleDateString("en-ZA")}</span>
                  <span>{new Date(grant.end_date).toLocaleDateString("en-ZA")}</span>
                </div>
              </div>
            )}

            {grant.description && (
              <div className="px-6 pb-4">
                <p className="text-sm text-gray-600">{grant.description}</p>
              </div>
            )}
          </div>

          {/* â”€â”€ Next up banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {nextMilestone && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
              <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-1">Next Up</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{nextMilestone.title}</p>
                  {nextMilestone.deliverables && (
                    <p className="text-xs text-gray-500 mt-0.5">Deliverable: {nextMilestone.deliverables}</p>
                  )}
                  <p className={`text-xs mt-0.5 font-medium ${new Date(nextMilestone.due_date) < today ? "text-red-600" : "text-blue-600"}`}>
                    Due {new Date(nextMilestone.due_date).toLocaleDateString("en-ZA")}
                    {new Date(nextMilestone.due_date) < today && " â€” overdue"}
                  </p>
                </div>
                {nextMilestone.completion_pct != null && (
                  <div className="shrink-0 flex items-center gap-2">
                    <div className="h-1.5 w-24 rounded-full bg-blue-200 overflow-hidden">
                      <div
                        className="h-1.5 rounded-full bg-blue-500"
                        style={{ width: `${nextMilestone.completion_pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-blue-600 font-medium">{nextMilestone.completion_pct}%</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* â”€â”€ Milestones â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Milestones</h2>
                <span className="text-sm text-gray-500">
                  {completedCount}/{milestones.length} completed
                </span>
              </div>
              {milestones.length > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                    <span>Overall progress</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-2 rounded-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {milestones.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-gray-400">No milestones have been set up yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {milestones.map((m) => {
                  const isPast = new Date(m.due_date) < today;
                  const isOverdue = isPast && m.status !== "completed" && m.status !== "delayed";
                  const canUpdate = m.status !== "completed" && m.status !== "delayed";
                  const styles = MILESTONE_STATUS_STYLES[m.status] ?? MILESTONE_STATUS_STYLES.not_started;
                  const completionPct = (m as { completion_pct?: number | null }).completion_pct;

                  return (
                    <div key={m.id} className={`border-l-4 px-6 py-5 ${styles.border}`}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <p className="text-sm font-semibold text-gray-900">{m.title}</p>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles.badge}`}>
                              {MILESTONE_STATUS_LABELS[m.status] ?? m.status}
                            </span>
                            {isOverdue && (
                              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                                Overdue
                              </span>
                            )}
                          </div>

                          {m.deliverables && (
                            <p className="text-xs text-gray-500 mb-1">
                              <span className="font-medium text-gray-600">Deliverable:</span> {m.deliverables}
                            </p>
                          )}

                          {m.progress_notes && (
                            <p className="text-xs text-gray-500 mt-1 italic border-l-2 border-blue-200 pl-2">
                              {m.progress_notes}
                            </p>
                          )}

                          <p className={`text-xs mt-1.5 ${isOverdue ? "text-red-500 font-medium" : "text-gray-400"}`}>
                            Due {new Date(m.due_date).toLocaleDateString("en-ZA")}
                          </p>

                          {/* Per-milestone completion bar */}
                          {completionPct != null && completionPct > 0 && m.status !== "completed" && (
                            <div className="mt-2 flex items-center gap-2">
                              <div className="h-1.5 flex-1 max-w-30 rounded-full bg-gray-100 overflow-hidden">
                                <div
                                  className="h-1.5 rounded-full bg-blue-400"
                                  style={{ width: `${completionPct}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-400">{completionPct}% done</span>
                            </div>
                          )}
                        </div>

                        {/* Quick status buttons */}
                        {canUpdate && (
                          <form action={awardeeUpdateMilestoneStatus} className="shrink-0">
                            <input type="hidden" name="milestone_id" value={m.id} />
                            <div className="flex gap-2">
                              {m.status === "not_started" && (
                                <button
                                  name="status"
                                  value="in_progress"
                                  type="submit"
                                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                                >
                                  Start
                                </button>
                              )}
                              {(m.status === "not_started" || m.status === "in_progress") && (
                                <button
                                  name="status"
                                  value="completed"
                                  type="submit"
                                  className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
                                >
                                  Mark Complete
                                </button>
                              )}
                            </div>
                          </form>
                        )}
                      </div>

                      {/* Progress update accordion */}
                      {m.status !== "delayed" && (
                        <details className="mt-4 group">
                          <summary className="cursor-pointer list-none flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 select-none">
                            <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            Submit progress update
                          </summary>

                          <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
                            <form action={submitMilestoneProgress} className="space-y-4">
                              <input type="hidden" name="milestone_id" value={m.id} />
                              <input type="hidden" name="indicator_actuals_json" id={`ind_json_${m.id}`} value="[]" />

                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {/* Completion % */}
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Completion (%)
                                  </label>
                                  <input
                                    type="number"
                                    name="completion_pct"
                                    min="0"
                                    max="100"
                                    defaultValue={completionPct ?? 0}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>
                                {/* Update status */}
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Status
                                  </label>
                                  <select
                                    name="status"
                                    defaultValue={m.status}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  >
                                    <option value="not_started">Not Started</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                  </select>
                                </div>
                              </div>

                              {/* What was achieved */}
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  What was achieved this period? <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                  name="note"
                                  required
                                  rows={3}
                                  maxLength={2000}
                                  placeholder="Describe what was accomplished since your last updateâ€¦"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                />
                              </div>

                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    What is planned next? <span className="text-gray-400 font-normal">(optional)</span>
                                  </label>
                                  <textarea
                                    name="planned_next"
                                    rows={2}
                                    maxLength={2000}
                                    placeholder="Upcoming tasks or goalsâ€¦"
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Blockers or challenges? <span className="text-gray-400 font-normal">(optional)</span>
                                  </label>
                                  <textarea
                                    name="blockers"
                                    rows={2}
                                    maxLength={2000}
                                    placeholder="Issues that may delay progressâ€¦"
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Impact story <span className="text-gray-400 font-normal">(optional)</span>
                                </label>
                                <textarea
                                  name="impact_story"
                                  rows={2}
                                  maxLength={2000}
                                  placeholder="e.g. 'Twenty smallholder farmers now use the new techniqueâ€¦'"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                />
                              </div>

                              {/* Indicator actuals */}
                              {indicators.length > 0 && (
                                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 space-y-3">
                                  <p className="text-xs font-semibold text-blue-800">Report impact indicators</p>
                                  {indicators.map((ind) => (
                                    <div key={ind.id} className="flex flex-wrap items-center gap-2">
                                      <span className="text-xs text-gray-700 flex-1 min-w-0">
                                        {ind.label} <span className="text-gray-400">({ind.unit})</span>
                                      </span>
                                      <input
                                        type="number"
                                        min="0"
                                        placeholder="Actual"
                                        id={`ind_val_${m.id}_${ind.id}`}
                                        className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      />
                                      <input
                                        type="text"
                                        placeholder="Note (optional)"
                                        id={`ind_note_${m.id}_${ind.id}`}
                                        className="w-36 rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      />
                                    </div>
                                  ))}
                                  <script dangerouslySetInnerHTML={{ __html: `
                                    (function(){
                                      var form = document.getElementById('ind_json_${m.id}')?.closest('form');
                                      if(!form) return;
                                      form.addEventListener('submit', function(){
                                        var rows = ${JSON.stringify(indicators.map((ind) => ({ id: ind.id })))};
                                        var actuals = rows.map(function(r){
                                          var val = parseFloat(document.getElementById('ind_val_${m.id}_'+r.id)?.value||'0')||0;
                                          var note = document.getElementById('ind_note_${m.id}_'+r.id)?.value||'';
                                          return { id: r.id, value: val, note: note };
                                        });
                                        var hidden = document.getElementById('ind_json_${m.id}');
                                        if(hidden) hidden.value = JSON.stringify(actuals);
                                      });
                                    })();
                                  `}} />
                                </div>
                              )}

                              <div className="flex justify-end">
                                <button
                                  type="submit"
                                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                                >
                                  Submit Update
                                </button>
                              </div>
                            </form>
                          </div>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
