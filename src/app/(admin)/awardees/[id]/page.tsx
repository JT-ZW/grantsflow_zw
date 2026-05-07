import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { updateGrantApproval } from "./actions";

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

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AwardeeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: awardee } = await supabase
    .from("awardees")
    .select(`
      *,
      grants (
        *,
        milestones (
          *,
          milestone_updates ( id, note, status_at, created_at )
        )
      )
    `)
    .eq("id", id)
    .single();

  if (!awardee) notFound();

  const grant = awardee.grants?.[0];
  const milestones = grant?.milestones?.sort(
    (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
  ) ?? [];

  return (
    <div className="space-y-6">
      {/* Awardee header */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{awardee.full_name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{awardee.email}</p>
            {(awardee.faculty || awardee.department) && (
              <p className="text-sm text-gray-500 mt-0.5">
                {[awardee.faculty, awardee.department].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <span className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-500 capitalize">
            {awardee.awardee_type}
          </span>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 border-t border-gray-100 pt-4">
          {awardee.student_number && (
            <div>
              <dt className="text-xs text-gray-400">Student / Staff No.</dt>
              <dd className="text-sm font-medium text-gray-900">{awardee.student_number}</dd>
            </div>
          )}
          {awardee.phone && (
            <div>
              <dt className="text-xs text-gray-400">Phone</dt>
              <dd className="text-sm font-medium text-gray-900">{awardee.phone}</dd>
            </div>
          )}
          {awardee.supervisor_name && (
            <div>
              <dt className="text-xs text-gray-400">Supervisor</dt>
              <dd className="text-sm font-medium text-gray-900">{awardee.supervisor_name}</dd>
            </div>
          )}
          {awardee.supervisor_email && (
            <div>
              <dt className="text-xs text-gray-400">Supervisor email</dt>
              <dd className="text-sm font-medium text-gray-900">{awardee.supervisor_email}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Grant Details */}
      {grant ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Grant</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <dt className="text-xs text-gray-400">Title</dt>
              <dd className="text-sm font-medium text-gray-900">{grant.title}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Type</dt>
              <dd className="text-sm font-medium text-gray-900">{grant.grant_type}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Status</dt>
              <dd className="text-sm font-medium text-gray-900 capitalize">{grant.status}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Amount Awarded</dt>
              <dd className="text-sm font-medium text-gray-900">
                {grant.currency_code} {Number(grant.amount_awarded).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Start Date</dt>
              <dd className="text-sm font-medium text-gray-900">
                {new Date(grant.start_date).toLocaleDateString("en-ZA")}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">End Date</dt>
              <dd className="text-sm font-medium text-gray-900">
                {new Date(grant.end_date).toLocaleDateString("en-ZA")}
              </dd>
            </div>
          </div>
          {grant.description && (
            <p className="mt-4 text-sm text-gray-600 border-t border-gray-100 pt-4">
              {grant.description}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
          No grant linked to this awardee yet.
        </div>
      )}

      {/* Approval Workflow */}
      {grant && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Approval Status</h2>
          <ApprovalWorkflow grant={grant} awardeeId={awardee.id} />
        </div>
      )}

      {/* Milestones */}
      {grant && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Milestones
            <span className="ml-2 text-sm font-normal text-gray-400">
              ({milestones.length})
            </span>
          </h2>

          {milestones.length === 0 ? (
            <p className="text-sm text-gray-400">No milestones defined.</p>
          ) : (
            <div className="space-y-3">
              {milestones.map(
                (m: {
                  id: string;
                  title: string;
                  due_date: string;
                  status: string;
                  deliverables?: string;
                  description?: string;
                  progress_notes?: string | null;
                  milestone_updates?: { id: string; note: string; status_at: string; created_at: string }[];
                }) => (
                  <div
                    key={m.id}
                    className="rounded-lg border border-gray-100 p-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{m.title}</p>
                        {m.deliverables && (
                          <p className="text-xs text-gray-500 mt-0.5">{m.deliverables}</p>
                        )}
                        {m.progress_notes && (
                          <p className="text-xs text-gray-500 mt-1 italic border-l-2 border-blue-200 pl-2">
                            Latest: {m.progress_notes}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            MILESTONE_STATUS_STYLES[m.status] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {MILESTONE_STATUS_LABELS[m.status] ?? m.status}
                        </span>
                        <span className="text-xs text-gray-400">
                          Due {new Date(m.due_date).toLocaleDateString("en-ZA")}
                        </span>
                      </div>
                    </div>

                    {/* Update history */}
                    {(m.milestone_updates ?? []).length > 0 && (
                      <details className="mt-3 border-t border-gray-50 pt-2">
                        <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 select-none">
                          {m.milestone_updates!.length} progress update{m.milestone_updates!.length !== 1 ? "s" : ""}
                        </summary>
                        <div className="mt-2 space-y-1.5">
                          {[...m.milestone_updates!]
                            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                            .map((u) => (
                              <div key={u.id} className="rounded bg-gray-50 px-3 py-2">
                                <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                                  <span className="capitalize">{u.status_at.replace("_", " ")}</span>
                                  <span>{new Date(u.created_at).toLocaleDateString("en-ZA")}</span>
                                </div>
                                <p className="text-xs text-gray-700">{u.note}</p>
                              </div>
                            ))}
                        </div>
                      </details>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Approval Workflow Component ───────────────────────────────────────────────

const APPROVAL_STEPS = [
  { key: "draft",        label: "Draft" },
  { key: "submitted",    label: "Submitted" },
  { key: "under_review", label: "Under Review" },
  { key: "approved",     label: "Approved" },
] as const;

const APPROVAL_COLORS: Record<string, string> = {
  draft:        "bg-gray-100 text-gray-600",
  submitted:    "bg-blue-100 text-blue-700",
  under_review: "bg-yellow-100 text-yellow-700",
  approved:     "bg-green-100 text-green-700",
  rejected:     "bg-red-100 text-red-700",
};

function ApprovalWorkflow({ grant, awardeeId }: { grant: { id: string; approval_status?: string; approval_notes?: string }; awardeeId: string }) {
  const currentStatus = grant.approval_status ?? "approved";
  const isRejected = currentStatus === "rejected";

  const currentIdx = APPROVAL_STEPS.findIndex((s) => s.key === currentStatus);

  const nextForward = APPROVAL_STEPS[currentIdx + 1];
  const canReject = currentStatus !== "approved" && !isRejected;

  return (
    <div className="space-y-4">
      {/* Progress pipeline */}
      <div className="flex items-center gap-0">
        {APPROVAL_STEPS.map((step, i) => {
          const done = isRejected ? false : currentIdx >= i;
          const active = step.key === currentStatus;
          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  done ? "bg-[#6b1a2a] text-white" : "bg-gray-100 text-gray-400"
                } ${active && !isRejected ? "ring-2 ring-offset-1 ring-[#6b1a2a]" : ""}`}>
                  {done ? "✓" : i + 1}
                </div>
                <span className={`text-[10px] mt-1 font-medium ${done ? "text-[#6b1a2a]" : "text-gray-400"}`}>
                  {step.label}
                </span>
              </div>
              {i < APPROVAL_STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mb-4 ${done && currentIdx > i ? "bg-[#6b1a2a]" : "bg-gray-200"}`} />
              )}
            </div>
          );
        })}
        {/* Rejected terminal state */}
        {isRejected && (
          <div className="flex flex-col items-center ml-2">
            <div className="h-7 w-7 rounded-full bg-red-100 flex items-center justify-center text-xs font-bold text-red-600">✕</div>
            <span className="text-[10px] mt-1 font-medium text-red-600">Rejected</span>
          </div>
        )}
      </div>

      {/* Current status badge */}
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold capitalize ${APPROVAL_COLORS[currentStatus] ?? "bg-gray-100 text-gray-600"}`}>
          {currentStatus.replace("_", " ")}
        </span>
        {grant.approval_notes && (
          <span className="text-xs text-gray-500 italic">{grant.approval_notes}</span>
        )}
      </div>

      {/* Action buttons */}
      {!isRejected && currentStatus !== "approved" && (
        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          {nextForward && (
            <form action={updateGrantApproval}>
              <input type="hidden" name="grant_id" value={grant.id} />
              <input type="hidden" name="awardee_id" value={awardeeId} />
              <input type="hidden" name="approval_status" value={nextForward.key} />
              <button type="submit" className="rounded-lg bg-[#6b1a2a] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#5a1522] transition-colors">
                Advance to &quot;{nextForward.label}&quot;
              </button>
            </form>
          )}
          {canReject && (
            <form action={updateGrantApproval} className="flex items-center gap-2">
              <input type="hidden" name="grant_id" value={grant.id} />
              <input type="hidden" name="awardee_id" value={awardeeId} />
              <input type="hidden" name="approval_status" value="rejected" />
              <input
                type="text"
                name="approval_notes"
                placeholder="Rejection reason (optional)"
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-400 w-56"
              />
              <button type="submit" className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors">
                Reject
              </button>
            </form>
          )}
        </div>
      )}
      {isRejected && (
        <form action={updateGrantApproval} className="border-t border-gray-100 pt-3">
          <input type="hidden" name="grant_id" value={grant.id} />
          <input type="hidden" name="awardee_id" value={awardeeId} />
          <input type="hidden" name="approval_status" value="submitted" />
          <button type="submit" className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50">
            Reopen for review
          </button>
        </form>
      )}
    </div>
  );
}
