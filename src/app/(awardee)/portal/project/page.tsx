import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  updateProjectDetails,
  updateContactDetails,
  proposeMilestone,
} from "./actions";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const GRANT_STATUS_STYLES: Record<string, string> = {
  active:    "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
  suspended: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-red-100 text-red-700",
};

const PROPOSAL_STATUS_STYLES: Record<string, { badge: string; label: string }> = {
  pending_approval: { badge: "bg-yellow-100 text-yellow-700", label: "Pending Approval" },
  approved:         { badge: "bg-green-100 text-green-700",   label: "Approved" },
  rejected:         { badge: "bg-red-100 text-red-700",       label: "Rejected" },
};

const MILESTONE_STATUS_STYLES: Record<string, { badge: string; border: string }> = {
  not_started: { badge: "bg-gray-100 text-gray-600",   border: "border-l-gray-300" },
  in_progress: { badge: "bg-blue-100 text-blue-700",   border: "border-l-blue-400" },
  completed:   { badge: "bg-green-100 text-green-700", border: "border-l-green-500" },
  delayed:     { badge: "bg-red-100 text-red-700",     border: "border-l-red-500"  },
};

const MILESTONE_STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed:   "Completed",
  delayed:     "Delayed",
};

// ── types ─────────────────────────────────────────────────────────────────────

type Milestone = {
  id: string;
  title: string;
  description: string | null;
  deliverables: string | null;
  due_date: string;
  status: string;
  sort_order: number;
  completion_pct: number | null;
  proposed_by: string | null;
  proposal_status: string | null;
  proposal_notes: string | null;
};

type Grant = {
  id: string;
  title: string;
  description: string | null;
  objectives: string | null;
  target_beneficiaries: string | null;
  geographic_reach: string | null;
  grant_type: string;
  status: string;
  amount_awarded: number;
  currency_code: string;
  start_date: string;
  end_date: string;
  milestones: Milestone[];
};

type Awardee = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  department: string | null;
  faculty: string | null;
  student_number: string | null;
  supervisor_name: string | null;
  grants: Grant[];
};

// ── page ─────────────────────────────────────────────────────────────────────

export default async function ProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: awardeeRaw } = await supabase
    .from("awardees")
    .select(`
      id, full_name, email, phone,
      department, faculty, student_number, supervisor_name,
      grants (
        id, title, description, objectives, target_beneficiaries,
        geographic_reach, grant_type, status,
        amount_awarded, currency_code, start_date, end_date,
        milestones (
          id, title, description, deliverables, due_date,
          status, sort_order, completion_pct,
          proposed_by, proposal_status, proposal_notes
        )
      )
    `)
    .eq("user_id", user.id)
    .single();

  const awardee = awardeeRaw as Awardee | null;

  if (!awardee) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="rounded-xl border border-gray-200 bg-white p-10 max-w-md">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Account not yet linked</h1>
          <p className="text-sm text-gray-500">
            Your account hasn&apos;t been linked to a grant yet. Please contact
            the Research &amp; Innovation Office to complete your onboarding.
          </p>
        </div>
      </div>
    );
  }

  const grant = awardee.grants?.[0];
  const sp = await searchParams;
  const savedSection = sp.saved;
  const errorMsg     = sp.error;

  const milestones = (grant?.milestones ?? []).sort(
    (a, b) => a.sort_order - b.sort_order
  );

  const adminMilestones   = milestones.filter((m) => !m.proposal_status);
  const proposedMilestones = milestones.filter((m) => m.proposal_status);

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Project</h1>
        <p className="mt-1 text-sm text-gray-500">
          Keep your project information up to date and propose new milestones.
          Changes to contact details and project narrative are reflected immediately.
        </p>
      </div>

      {/* ── Global feedback banner ───────────────────────────────────────────── */}
      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(errorMsg)}
        </div>
      )}
      {savedSection && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {savedSection === "project"   && "Project details saved."}
          {savedSection === "contact"   && "Contact details saved."}
          {savedSection === "milestone" && "Your milestone proposal has been submitted for admin review."}
        </div>
      )}

      {/* ── Grant overview (read-only) ───────────────────────────────────────── */}
      {grant && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="bg-[#6b1a2a] px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-red-200 uppercase tracking-wide mb-1">
                  Grant Overview
                </p>
                <h2 className="text-lg font-semibold text-white">{grant.title}</h2>
                <p className="text-sm text-red-200 mt-0.5 capitalize">
                  {grant.grant_type.replace(/_/g, " ")}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${GRANT_STATUS_STYLES[grant.status] ?? "bg-gray-100 text-gray-600"}`}
              >
                {grant.status}
              </span>
            </div>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 px-0">
            {[
              { label: "Amount Awarded", value: fmt(grant.amount_awarded, grant.currency_code) },
              { label: "Start Date",     value: fmtDate(grant.start_date) },
              { label: "End Date",       value: fmtDate(grant.end_date) },
              { label: "Milestones",     value: `${adminMilestones.filter((m) => m.status === "completed").length} / ${adminMilestones.length} completed` },
            ].map(({ label, value }) => (
              <div key={label} className="px-6 py-4">
                <dt className="text-xs text-gray-500">{label}</dt>
                <dd className="mt-0.5 text-sm font-semibold text-gray-900">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {!grant && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          No grant is linked to your profile yet.
        </div>
      )}

      {/* ── Project Details (editable) ───────────────────────────────────────── */}
      {grant && (
        <section className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="text-base font-semibold text-gray-900">Project Details</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Describe your project so the grants office has accurate context.
            </p>
          </div>
          <form action={updateProjectDetails} className="px-6 py-5 space-y-5">
            <input type="hidden" name="grant_id" value={grant.id} />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Project Description
              </label>
              <textarea
                name="description"
                rows={4}
                defaultValue={grant.description ?? ""}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#6b1a2a] focus:outline-none focus:ring-1 focus:ring-[#6b1a2a] resize-none"
                placeholder="Provide a clear summary of your project…"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Objectives
              </label>
              <textarea
                name="objectives"
                rows={4}
                defaultValue={grant.objectives ?? ""}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#6b1a2a] focus:outline-none focus:ring-1 focus:ring-[#6b1a2a] resize-none"
                placeholder="List the specific goals and expected outcomes…"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Target Beneficiaries
                </label>
                <textarea
                  name="target_beneficiaries"
                  rows={3}
                  defaultValue={grant.target_beneficiaries ?? ""}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#6b1a2a] focus:outline-none focus:ring-1 focus:ring-[#6b1a2a] resize-none"
                  placeholder="Who does this project serve or benefit?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Geographic Reach
                </label>
                <textarea
                  name="geographic_reach"
                  rows={3}
                  defaultValue={grant.geographic_reach ?? ""}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#6b1a2a] focus:outline-none focus:ring-1 focus:ring-[#6b1a2a] resize-none"
                  placeholder="Region, province, or country where activities take place…"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className={`rounded-lg px-5 py-2 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#6b1a2a] focus:ring-offset-2 ${savedSection === "project" ? "bg-green-600 hover:bg-green-700" : "bg-[#6b1a2a] hover:bg-[#8b2234]"}`}
              >
                {savedSection === "project" ? "Saved ✓" : "Save Project Details"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ── Contact Details (editable) ───────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">My Contact Details</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Update your phone number. Name and email are managed by the grants office.
          </p>
        </div>
        <form action={updateContactDetails} className="px-6 py-5">
          <input type="hidden" name="awardee_id" value={awardee.id} />

          <div className="grid sm:grid-cols-2 gap-5">
            {/* Read-only fields */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {awardee.full_name}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {awardee.email}
              </div>
            </div>
            {awardee.department && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Department</label>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {awardee.department}
                </div>
              </div>
            )}
            {awardee.faculty && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Faculty</label>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {awardee.faculty}
                </div>
              </div>
            )}
            {awardee.supervisor_name && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Supervisor</label>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {awardee.supervisor_name}
                </div>
              </div>
            )}
            {awardee.student_number && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Student Number</label>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {awardee.student_number}
                </div>
              </div>
            )}

            {/* Editable */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">
                Phone Number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={awardee.phone ?? ""}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#6b1a2a] focus:outline-none focus:ring-1 focus:ring-[#6b1a2a]"
                placeholder="+27 000 000 0000"
              />
            </div>
          </div>

          <div className="flex justify-end pt-5">
            <button
              type="submit"
              className={`rounded-lg px-5 py-2 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#6b1a2a] focus:ring-offset-2 ${savedSection === "contact" ? "bg-green-600 hover:bg-green-700" : "bg-[#6b1a2a] hover:bg-[#8b2234]"}`}
            >
              {savedSection === "contact" ? "Saved ✓" : "Save Contact Details"}
            </button>
          </div>
        </form>
      </section>

      {/* ── Milestones ───────────────────────────────────────────────────────── */}
      {grant && (
        <section className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="text-base font-semibold text-gray-900">Milestones</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Admin-set milestones are shown below. You can also propose additional milestones for
              review.
            </p>
          </div>

          <div className="divide-y divide-gray-100">
            {milestones.length === 0 && (
              <p className="px-6 py-8 text-center text-sm text-gray-400">
                No milestones have been set for this grant yet.
              </p>
            )}

            {milestones.map((m) => {
              const isProposed = !!m.proposal_status;
              const statusStyle = isProposed
                ? null
                : MILESTONE_STATUS_STYLES[m.status] ?? MILESTONE_STATUS_STYLES.not_started;
              const proposalStyle = isProposed
                ? PROPOSAL_STATUS_STYLES[m.proposal_status!] ?? PROPOSAL_STATUS_STYLES.pending_approval
                : null;

              return (
                <div
                  key={m.id}
                  className={`px-6 py-4 border-l-4 ${isProposed ? "border-l-yellow-300 bg-yellow-50/30" : statusStyle!.border}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900">{m.title}</p>
                        {isProposed ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${proposalStyle!.badge}`}>
                            {proposalStyle!.label}
                          </span>
                        ) : (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle!.badge}`}>
                            {MILESTONE_STATUS_LABELS[m.status] ?? m.status}
                          </span>
                        )}
                        {isProposed && (
                          <span className="text-xs text-gray-400 italic">Your proposal</span>
                        )}
                      </div>
                      {m.description && (
                        <p className="mt-1 text-xs text-gray-500 line-clamp-2">{m.description}</p>
                      )}
                      {isProposed && m.proposal_status === "rejected" && m.proposal_notes && (
                        <p className="mt-1 text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                          Admin note: {m.proposal_notes}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-gray-500">Due</p>
                      <p className="text-xs font-medium text-gray-700">{fmtDate(m.due_date)}</p>
                    </div>
                  </div>
                  {!isProposed && m.completion_pct !== null && (
                    <div className="mt-2">
                      <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#6b1a2a]"
                          style={{ width: `${m.completion_pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{m.completion_pct}% complete</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Propose a milestone */}
          <div className="border-t border-gray-100 bg-gray-50 px-6 py-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">Propose a New Milestone</h3>
            <p className="text-xs text-gray-500 mb-4">
              Suggest a milestone to the grants office. It will appear above as
              &ldquo;Pending Approval&rdquo; until reviewed.
            </p>
            <form action={proposeMilestone} className="space-y-4">
              <input type="hidden" name="grant_id" value={grant.id} />

              <div>
                <label htmlFor="m-title" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Milestone Title <span className="text-red-500">*</span>
                </label>
                <input
                  id="m-title"
                  name="title"
                  type="text"
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#6b1a2a] focus:outline-none focus:ring-1 focus:ring-[#6b1a2a]"
                  placeholder="e.g. Submit ethics clearance application"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="m-description" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Description
                  </label>
                  <textarea
                    id="m-description"
                    name="description"
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#6b1a2a] focus:outline-none focus:ring-1 focus:ring-[#6b1a2a] resize-none"
                    placeholder="What does this milestone involve?"
                  />
                </div>
                <div>
                  <label htmlFor="m-deliverables" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Deliverables
                  </label>
                  <textarea
                    id="m-deliverables"
                    name="deliverables"
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#6b1a2a] focus:outline-none focus:ring-1 focus:ring-[#6b1a2a] resize-none"
                    placeholder="What tangible outputs will be produced?"
                  />
                </div>
              </div>

              <div className="sm:w-48">
                <label htmlFor="m-due-date" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Proposed Due Date <span className="text-red-500">*</span>
                </label>
                <input
                  id="m-due-date"
                  name="due_date"
                  type="date"
                  required
                  min={grant.start_date}
                  max={grant.end_date}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#6b1a2a] focus:outline-none focus:ring-1 focus:ring-[#6b1a2a]"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="rounded-lg border border-[#6b1a2a] px-5 py-2 text-sm font-medium text-[#6b1a2a] hover:bg-[#6b1a2a] hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#6b1a2a] focus:ring-offset-2"
                >
                  Submit for Review
                </button>
              </div>
            </form>
          </div>
        </section>
      )}
    </div>
  );
}
