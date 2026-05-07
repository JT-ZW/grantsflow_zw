import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import PrintButton from "./PrintButton";

const MILESTONE_STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
  delayed: "Delayed",
};

const MILESTONE_STATUS_PRINT: Record<string, string> = {
  not_started: "text-gray-500",
  in_progress: "text-blue-700",
  completed: "text-green-700",
  delayed: "text-red-700",
};

function fmt(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AwardeeReportPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: awardee } = await supabase
    .from("awardees")
    .select(
      "*, grants(*, milestones(*))"
    )
    .eq("id", id)
    .single();

  if (!awardee) notFound();

  const grant = (awardee.grants as {
    id: string;
    title: string;
    description: string | null;
    status: string;
    amount_awarded: number;
    currency_code: string;
    start_date: string | null;
    end_date: string | null;
    milestones: {
      id: string;
      title: string;
      description: string | null;
      status: string;
      due_date: string | null;
      sort_order: number;
    }[];
  }[])?.[0];

  const milestones = grant?.milestones?.sort((a, b) => a.sort_order - b.sort_order) ?? [];
  const completedCount = milestones.filter((m) => m.status === "completed").length;
  const progressPct = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;

  const [budgetsRes, disbursementsRes, expensesRes] = await Promise.all([
    supabase.from("budgets").select("*").eq("grant_id", grant?.id ?? "").order("created_at"),
    supabase.from("disbursements").select("*").eq("grant_id", grant?.id ?? "").order("disbursement_date"),
    supabase.from("expenses").select("*").eq("grant_id", grant?.id ?? "").order("expense_date"),
  ]);

  const budgets = budgetsRes.data ?? [];
  const disbursements = disbursementsRes.data ?? [];
  const expenses = expensesRes.data ?? [];

  const totalDisbursed = disbursements.reduce((s, d) => s + Number(d.amount), 0);
  const totalBudgeted = budgets.filter((b) => b.approved).reduce((s, b) => s + Number(b.amount_allocated), 0);
  const totalExpApproved = expenses.filter((e) => e.status === "approved").reduce((s, e) => s + Number(e.amount), 0);
  const currency = grant?.currency_code ?? "USD";
  const generatedAt = new Date().toLocaleDateString("en-ZA", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Print button — hidden when printing */}
      <div className="print:hidden fixed top-4 right-4 z-10 flex gap-2">
        <PrintButton />
        <a
          href={`/api/reports/${id}/pdf`}
          target="_blank"
          className="rounded-lg bg-[#6b1a2a] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[#5a1522] transition-colors"
        >
          ↓ Download PDF
        </a>
        <a
          href={`/awardees/${id}`}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow hover:bg-gray-50 transition-colors"
        >
          ← Back
        </a>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-10 print:px-0 print:py-0">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-gray-900 pb-6 mb-8">
          <div>
            <img src="/logo.png" alt="GrantsFlow" className="h-10 w-auto mb-1" />
            <h1 className="text-2xl font-bold text-gray-900">Grant Progress Report</h1>
            <p className="text-sm text-gray-500 mt-1">Generated on {generatedAt}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Status</p>
            <p className="text-lg font-bold text-gray-900 capitalize mt-0.5">{grant?.status?.replace("_", " ") ?? "—"}</p>
          </div>
        </div>

        {/* Awardee & Grant Details */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Awardee</h2>
            <p className="text-lg font-bold text-gray-900">{awardee.full_name}</p>
            <p className="text-sm text-gray-600">{awardee.email}</p>
            {awardee.phone && <p className="text-sm text-gray-600">{awardee.phone}</p>}
            {(awardee.faculty || awardee.department) && (
              <p className="text-sm text-gray-600 mt-1">
                {[awardee.faculty, awardee.department].filter(Boolean).join(", ")}
              </p>
            )}
            {awardee.supervisor_name && (
              <p className="text-sm text-gray-500 mt-1">
                Supervisor: {awardee.supervisor_name}
              </p>
            )}
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Grant</h2>
            <p className="text-base font-semibold text-gray-900">{grant?.title ?? "—"}</p>
            {grant?.description && (
              <p className="text-sm text-gray-600 mt-1">{grant.description}</p>
            )}
            <div className="mt-3 space-y-1">
              <p className="text-sm text-gray-600">
                <span className="text-gray-400">Amount: </span>
                <span className="font-medium">{grant ? fmt(Number(grant.amount_awarded), currency) : "—"}</span>
              </p>
              <p className="text-sm text-gray-600">
                <span className="text-gray-400">Start: </span>{fmtDate(grant?.start_date ?? null)}
              </p>
              <p className="text-sm text-gray-600">
                <span className="text-gray-400">End: </span>{fmtDate(grant?.end_date ?? null)}
              </p>
            </div>
          </div>
        </div>

        {/* Milestone Progress */}
        <div className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
            Milestone Progress — {completedCount} of {milestones.length} completed ({progressPct}%)
          </h2>
          {/* Progress bar */}
          <div className="w-full bg-gray-100 rounded-full h-2 mb-5">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {milestones.length === 0 ? (
            <p className="text-sm text-gray-400">No milestones added.</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-2 text-left text-xs font-semibold text-gray-500">#</th>
                  <th className="py-2 text-left text-xs font-semibold text-gray-500">Milestone</th>
                  <th className="py-2 text-left text-xs font-semibold text-gray-500">Due Date</th>
                  <th className="py-2 text-left text-xs font-semibold text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {milestones.map((m, i) => (
                  <tr key={m.id} className="border-b border-gray-100">
                    <td className="py-2 text-gray-400">{i + 1}</td>
                    <td className="py-2 text-gray-900 font-medium">{m.title}</td>
                    <td className="py-2 text-gray-600">{fmtDate(m.due_date)}</td>
                    <td className={`py-2 font-medium ${MILESTONE_STATUS_PRINT[m.status] ?? "text-gray-600"}`}>
                      {MILESTONE_STATUS_LABELS[m.status] ?? m.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Financial Summary */}
        <div className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Financial Summary</h2>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Amount Awarded", value: fmt(Number(grant?.amount_awarded ?? 0), currency) },
              { label: "Budget Approved", value: fmt(totalBudgeted, currency) },
              { label: "Disbursed", value: fmt(totalDisbursed, currency) },
              { label: "Expenses Approved", value: fmt(totalExpApproved, currency) },
            ].map((s) => (
              <div key={s.label} className="border border-gray-200 rounded-lg p-3">
                <p className="text-xs text-gray-400">{s.label}</p>
                <p className="text-base font-bold text-gray-900 mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Budget Allocation */}
        {budgets.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Budget Allocation</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-2 text-left text-xs font-semibold text-gray-500">Category</th>
                  <th className="py-2 text-left text-xs font-semibold text-gray-500">Description</th>
                  <th className="py-2 text-right text-xs font-semibold text-gray-500">Amount</th>
                  <th className="py-2 text-left text-xs font-semibold text-gray-500">Approved</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map((b) => (
                  <tr key={b.id} className="border-b border-gray-100">
                    <td className="py-2 text-gray-900">{b.category}</td>
                    <td className="py-2 text-gray-600">{b.description || "—"}</td>
                    <td className="py-2 text-right text-gray-900">{fmt(Number(b.amount_allocated), b.currency_code)}</td>
                    <td className={`py-2 ${b.approved ? "text-green-700" : "text-yellow-600"}`}>
                      {b.approved ? "Yes" : "Pending"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Disbursements */}
        {disbursements.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Disbursements</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-2 text-left text-xs font-semibold text-gray-500">Date</th>
                  <th className="py-2 text-left text-xs font-semibold text-gray-500">Method</th>
                  <th className="py-2 text-left text-xs font-semibold text-gray-500">Reference</th>
                  <th className="py-2 text-right text-xs font-semibold text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody>
                {disbursements.map((d) => (
                  <tr key={d.id} className="border-b border-gray-100">
                    <td className="py-2 text-gray-900">{fmtDate(d.disbursement_date)}</td>
                    <td className="py-2 text-gray-600">{d.method}</td>
                    <td className="py-2 text-gray-600">{d.reference || "—"}</td>
                    <td className="py-2 text-right text-gray-900">{fmt(Number(d.amount), d.currency_code)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-300">
                  <td colSpan={3} className="py-2 text-right text-sm font-semibold text-gray-700">Total Disbursed</td>
                  <td className="py-2 text-right font-bold text-gray-900">{fmt(totalDisbursed, currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Expenses */}
        {expenses.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Expense Reports</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-2 text-left text-xs font-semibold text-gray-500">Date</th>
                  <th className="py-2 text-left text-xs font-semibold text-gray-500">Category</th>
                  <th className="py-2 text-left text-xs font-semibold text-gray-500">Description</th>
                  <th className="py-2 text-right text-xs font-semibold text-gray-500">Amount</th>
                  <th className="py-2 text-left text-xs font-semibold text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b border-gray-100">
                    <td className="py-2 text-gray-900">{fmtDate(e.expense_date)}</td>
                    <td className="py-2 text-gray-600">{e.category}</td>
                    <td className="py-2 text-gray-600">{e.description}</td>
                    <td className="py-2 text-right text-gray-900">{fmt(Number(e.amount), e.currency_code)}</td>
                    <td className={`py-2 capitalize font-medium ${e.status === "approved" ? "text-green-700" : e.status === "rejected" ? "text-red-700" : "text-yellow-600"}`}>
                      {e.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-200 pt-6 mt-10 text-xs text-gray-400 flex justify-between print:fixed print:bottom-0 print:left-0 print:right-0 print:px-8 print:pb-4 print:bg-white">
          <p>GrantsFlow — Funding. Transparency. Impact.</p>
          <p>Confidential — {generatedAt}</p>
        </div>
      </div>
    </div>
  );
}
