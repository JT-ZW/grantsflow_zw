import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { reviewMilestoneProposal, updateGrantApproval } from "./actions";
import { MilestoneTimeline } from "./MilestoneTimeline";
import { ImpactPanel } from "./ImpactPanel";

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
          milestone_updates ( id, note, status_at, completion_pct, planned_next, blockers, created_at )
        )
      )
    `)
    .eq("id", id)
    .single();

  if (!awardee) notFound();

  const grant = awardee.grants?.[0];
  const allMilestones = (grant?.milestones ?? []).sort(
    (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
  );
  // Separate admin-confirmed milestones from awardee proposals
  const milestones        = allMilestones.filter((m: { proposal_status?: string | null }) => !m.proposal_status || m.proposal_status === "approved");
  const pendingProposals  = allMilestones.filter((m: { proposal_status?: string | null }) => m.proposal_status === "pending_approval");
  const reviewedProposals = allMilestones.filter((m: { proposal_status?: string | null }) => m.proposal_status === "rejected");

  // ── Impact indicators ────────────────────────────────────────────────────
  const indicators = grant
    ? await supabase
        .from("grant_impact_indicators")
        .select("*, impact_submissions(id, actual_value, note, submitted_at)")
        .eq("grant_id", grant.id)
        .order("sort_order")
        .then(({ data }) =>
          (data ?? []).map((ind) => ({
            ...ind,
            impact_submissions: [...(ind.impact_submissions ?? [])].sort(
              (a: { submitted_at: string }, b: { submitted_at: string }) =>
                new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
            ),
          }))
        )
    : [];

  // ── Health bar stats ─────────────────────────────────────────────────────
  const totalMs        = milestones.length;
  const completedMs    = milestones.filter((m: { status: string }) => m.status === "completed").length;
  const delayedMs      = milestones.filter((m: { status: string }) => m.status === "delayed").length;
  const overdueMs      = milestones.filter(
    (m: { status: string; due_date: string }) =>
      m.status !== "completed" && m.status !== "delayed" && new Date(m.due_date) < new Date()
  ).length;
  const milestoneCompletionPct = totalMs > 0 ? Math.round((completedMs / totalMs) * 100) : 0;
  const riskScore = totalMs > 0
    ? Math.round((delayedMs / totalMs) * 60 + (overdueMs / totalMs) * 20)
    : 0;
  const daysRemaining = grant
    ? Math.ceil((new Date(grant.end_date).getTime() - Date.now()) / 86_400_000)
    : null;

  return (
    <div className="space-y-6">
      {/* Awardee header */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{awardee.full_name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{awardee.email}</p>
            {(awardee.faculty || awardee.department) && (
              <p className="text-sm text-gray-500 mt-0.5">
                {[awardee.faculty, awardee.department].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <span className="self-start rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-500 capitalize">
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

      {/* Project Health Bar */}
      {grant && totalMs > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Project Health</h2>

          {/* Progress bar */}
          <div className="mb-5">
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>Milestone completion</span>
              <span className="font-semibold text-gray-700">{completedMs} / {totalMs} done ({milestoneCompletionPct}%)</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  milestoneCompletionPct >= 80
                    ? "bg-green-500"
                    : milestoneCompletionPct >= 50
                    ? "bg-blue-500"
                    : "bg-amber-400"
                }`}
                style={{ width: `${milestoneCompletionPct}%` }}
              />
            </div>
          </div>

          {/* Stat pills */}
          <div className="flex flex-wrap gap-3">
            {/* Days remaining */}
            {daysRemaining !== null && (
              <div className={`flex items-center gap-2 rounded-lg px-4 py-2.5 border ${
                daysRemaining < 0
                  ? "bg-red-50 border-red-200"
                  : daysRemaining <= 30
                  ? "bg-amber-50 border-amber-200"
                  : "bg-green-50 border-green-200"
              }`}>
                <div>
                  <p className="text-xs text-gray-500">Days remaining</p>
                  <p className={`text-lg font-bold ${
                    daysRemaining < 0
                      ? "text-red-600"
                      : daysRemaining <= 30
                      ? "text-amber-600"
                      : "text-green-600"
                  }`}>
                    {daysRemaining < 0 ? `${Math.abs(daysRemaining)} overdue` : daysRemaining}
                  </p>
                </div>
              </div>
            )}

            {/* Overdue */}
            <div className={`flex items-center gap-2 rounded-lg px-4 py-2.5 border ${
              overdueMs > 0 ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"
            }`}>
              <div>
                <p className="text-xs text-gray-500">Overdue milestones</p>
                <p className={`text-lg font-bold ${overdueMs > 0 ? "text-red-600" : "text-gray-400"}`}>
                  {overdueMs}
                </p>
              </div>
            </div>

            {/* Delayed */}
            <div className={`flex items-center gap-2 rounded-lg px-4 py-2.5 border ${
              delayedMs > 0 ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200"
            }`}>
              <div>
                <p className="text-xs text-gray-500">Marked delayed</p>
                <p className={`text-lg font-bold ${delayedMs > 0 ? "text-amber-600" : "text-gray-400"}`}>
                  {delayedMs}
                </p>
              </div>
            </div>

            {/* Risk */}
            <div className={`flex items-center gap-2 rounded-lg px-4 py-2.5 border ${
              riskScore >= 60
                ? "bg-red-50 border-red-200"
                : riskScore >= 30
                ? "bg-yellow-50 border-yellow-200"
                : "bg-green-50 border-green-200"
            }`}>
              <div>
                <p className="text-xs text-gray-500">Risk level</p>
                <p className={`text-lg font-bold ${
                  riskScore >= 60 ? "text-red-600" : riskScore >= 30 ? "text-yellow-600" : "text-green-600"
                }`}>
                  {riskScore >= 60 ? "High" : riskScore >= 30 ? "Medium" : "Low"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Impact */}
      {grant && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Impact</h2>
          <ImpactPanel grant={grant} indicators={indicators} awardeeId={awardee.id} />
        </div>
      )}

      {/* Milestone Proposals (awardee-submitted) */}
      {grant && (pendingProposals.length > 0 || reviewedProposals.length > 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
          <div className="px-6 py-4 border-b border-amber-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-amber-900">Milestone Proposals</h2>
              <p className="text-xs text-amber-700 mt-0.5">
                Milestones proposed by the awardee — review and approve or reject each one.
              </p>
            </div>
            {pendingProposals.length > 0 && (
              <span className="rounded-full bg-amber-200 text-amber-900 text-xs font-semibold px-2.5 py-0.5">
                {pendingProposals.length} pending
              </span>
            )}
          </div>

          <div className="divide-y divide-amber-100">
            {[...pendingProposals, ...reviewedProposals].map((m: {
              id: string;
              title: string;
              description: string | null;
              deliverables: string | null;
              due_date: string;
              proposal_status: string;
              proposal_notes: string | null;
            }) => (
              <div key={m.id} className="px-6 py-5 bg-white">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-gray-900">{m.title}</p>
                      {m.proposal_status === "pending_approval" && (
                        <span className="rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium px-2 py-0.5">Pending</span>
                      )}
                      {m.proposal_status === "rejected" && (
                        <span className="rounded-full bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5">Rejected</span>
                      )}
                    </div>
                    {m.description && (
                      <p className="text-xs text-gray-500 mb-1">{m.description}</p>
                    )}
                    {m.deliverables && (
                      <p className="text-xs text-gray-400">Deliverables: {m.deliverables}</p>
                    )}
                    {m.proposal_notes && (
                      <p className="text-xs text-red-600 mt-1 italic">Your note: {m.proposal_notes}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-gray-400">Due</p>
                    <p className="text-xs font-medium text-gray-700">
                      {new Date(m.due_date + "T12:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>

                {m.proposal_status === "pending_approval" && (
                  <form action={reviewMilestoneProposal} className="mt-4 border-t border-gray-100 pt-4">
                    <input type="hidden" name="milestone_id" value={m.id} />
                    <input type="hidden" name="awardee_id" value={awardee.id} />
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        name="proposal_notes"
                        type="text"
                        placeholder="Optional rejection reason…"
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:border-[#6b1a2a] focus:outline-none focus:ring-1 focus:ring-[#6b1a2a]"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          name="decision"
                          value="approved"
                          className="rounded-lg bg-green-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          type="submit"
                          name="decision"
                          value="rejected"
                          className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Milestones — horizontal timeline */}
      {grant && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-900">
              Milestones
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({milestones.length})
              </span>
            </h2>
          </div>
          <MilestoneTimeline milestones={milestones} awardeeId={awardee.id} />
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
