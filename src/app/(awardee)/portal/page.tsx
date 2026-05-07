import { createClient } from "@/lib/supabase/server";
import { awardeeUpdateMilestoneStatus, submitMilestoneProgress } from "./actions";

const MILESTONE_STATUS_STYLES: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  delayed: "bg-red-100 text-red-700",
};

const MILESTONE_STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
  delayed: "Delayed",
};

const GRANT_STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
  suspended: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-red-100 text-red-700",
};

export default async function PortalPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get awardee profile linked to this user
  const { data: awardee } = await supabase
    .from("awardees")
    .select(`
      id,
      full_name,
      email,
      department,
      faculty,
      grants (
        id,
        title,
        description,
        grant_type,
        status,
        amount_awarded,
        currency_code,
        start_date,
        end_date,
        milestones (
          id,
          title,
          description,
          deliverables,
          due_date,
          status,
          progress_notes,
          sort_order
        )
      )
    `)
    .eq("user_id", user!.id)
    .single();

  // User is authenticated but not yet linked to an awardee record
  if (!awardee) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="rounded-xl border border-gray-200 bg-white p-10 max-w-md">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Account not yet linked
          </h1>
          <p className="text-sm text-gray-500">
            Your account hasn&apos;t been linked to a grant yet. Please contact
            the Research &amp; Innovation Office to complete your onboarding.
          </p>
        </div>
      </div>
    );
  }

  const grant = (awardee.grants as {
    id: string;
    title: string;
    description: string | null;
    grant_type: string;
    status: string;
    amount_awarded: number;
    currency_code: string;
    start_date: string;
    end_date: string;
    milestones: {
      id: string;
      title: string;
      description: string | null;
      deliverables: string | null;
      due_date: string;
      status: string;
      progress_notes: string | null;
      sort_order: number;
    }[];
  }[])?.[0];

  const milestones = (grant?.milestones ?? []).sort(
    (a, b) => a.sort_order - b.sort_order
  );

  const completedCount = milestones.filter((m) => m.status === "completed").length;
  const delayedCount = milestones.filter((m) => m.status === "delayed").length;
  const progress =
    milestones.length > 0
      ? Math.round((completedCount / milestones.length) * 100)
      : 0;

  const today = new Date();
  const endDate = grant ? new Date(grant.end_date) : null;
  const daysRemaining = endDate
    ? Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, {awardee.full_name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {[awardee.faculty, awardee.department].filter(Boolean).join(" · ")}
        </p>
      </div>

      {/* No grant yet */}
      {!grant && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <p className="text-sm text-gray-500">
            No grant has been assigned to your account yet.
          </p>
        </div>
      )}

      {grant && (
        <>
          {/* Grant summary card */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">{grant.title}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{grant.grant_type}</p>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                  GRANT_STATUS_STYLES[grant.status] ?? "bg-gray-100 text-gray-600"
                }`}
              >
                {grant.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
              {daysRemaining !== null && (
                <div>
                  <dt className="text-xs text-gray-400">Days Remaining</dt>
                  <dd
                    className={`text-sm font-semibold mt-0.5 ${
                      daysRemaining < 0
                        ? "text-red-600"
                        : daysRemaining < 30
                        ? "text-yellow-600"
                        : "text-gray-900"
                    }`}
                  >
                    {daysRemaining < 0
                      ? `${Math.abs(daysRemaining)} days overdue`
                      : `${daysRemaining} days`}
                  </dd>
                </div>
              )}
            </div>

            {grant.description && (
              <p className="mt-4 text-sm text-gray-600 border-t border-gray-100 pt-4">
                {grant.description}
              </p>
            )}
          </div>

          {/* Milestones */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-semibold text-gray-900">
                Milestones
                <span className="ml-2 text-sm font-normal text-gray-400">
                  {completedCount}/{milestones.length} completed
                  {delayedCount > 0 && (
                    <span className="text-red-500 ml-1">· {delayedCount} delayed</span>
                  )}
                </span>
              </h2>
            </div>

            {/* Progress bar */}
            {milestones.length > 0 && (
              <div className="mb-5">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Overall progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-blue-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {milestones.length === 0 ? (
              <p className="text-sm text-gray-400">
                No milestones have been set up yet.
              </p>
            ) : (
              <div className="space-y-3">
                {milestones.map((m) => {
                  const isPast = new Date(m.due_date) < today;
                  const canUpdate =
                    m.status !== "completed" && m.status !== "delayed";

                  return (
                    <div
                      key={m.id}
                      className="rounded-lg border border-gray-100 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-gray-900">
                              {m.title}
                            </p>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                MILESTONE_STATUS_STYLES[m.status] ??
                                "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {MILESTONE_STATUS_LABELS[m.status] ?? m.status}
                            </span>
                          </div>
                          {m.deliverables && (
                            <p className="text-xs text-gray-500 mt-1">
                              <span className="font-medium">Deliverable:</span>{" "}
                              {m.deliverables}
                            </p>
                          )}
                          {m.progress_notes && (
                            <p className="text-xs text-gray-500 mt-1 italic border-l-2 border-blue-200 pl-2">
                              Last update: {m.progress_notes}
                            </p>
                          )}
                          <p
                            className={`text-xs mt-1 ${
                              isPast && m.status !== "completed"
                                ? "text-red-500 font-medium"
                                : "text-gray-400"
                            }`}
                          >
                            Due {new Date(m.due_date).toLocaleDateString("en-ZA")}
                            {isPast && m.status !== "completed" && " — overdue"}
                          </p>
                        </div>

                        {/* Awardee can mark as in_progress or completed */}
                        {canUpdate && (
                          <form action={awardeeUpdateMilestoneStatus} className="shrink-0">
                            <input
                              type="hidden"
                              name="milestone_id"
                              value={m.id}
                            />
                            <div className="flex gap-2">
                              {m.status === "not_started" && (
                                <button
                                  name="status"
                                  value="in_progress"
                                  type="submit"
                                  className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                                >
                                  Start
                                </button>
                              )}
                              {(m.status === "not_started" ||
                                m.status === "in_progress") && (
                                <button
                                  name="status"
                                  value="completed"
                                  type="submit"
                                  className="rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
                                >
                                  Mark Complete
                                </button>
                              )}
                            </div>
                          </form>
                        )}
                      </div>

                      {/* Progress note form */}
                      {m.status !== "delayed" && (
                        <details className="mt-3 border-t border-gray-100 pt-3">
                          <summary className="cursor-pointer text-xs text-blue-600 hover:text-blue-800 select-none">
                            + Submit progress update
                          </summary>
                          <form action={submitMilestoneProgress} className="mt-2 space-y-2">
                            <input type="hidden" name="milestone_id" value={m.id} />
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Progress note *
                              </label>
                              <textarea
                                name="note"
                                required
                                rows={3}
                                maxLength={2000}
                                placeholder="Describe what has been done, any blockers, next steps..."
                                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div className="flex items-center gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Update status
                                </label>
                                <select
                                  name="status"
                                  defaultValue={m.status}
                                  className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="not_started">Not Started</option>
                                  <option value="in_progress">In Progress</option>
                                  <option value="completed">Completed</option>
                                </select>
                              </div>
                              <button
                                type="submit"
                                className="mt-4 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                              >
                                Submit Update
                              </button>
                            </div>
                          </form>
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
