import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";

function fmt(amount: number, currency = "USD") {
  return `${currency} ${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
}

function parseDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-ZA");
}

export default async function FinancesPage() {
  const supabase = await createClient();

  // Load everything in parallel
  const [awardeesRes, budgetsRes, disbursementsRes, expensesRes, disbRequestsRes] =
    await Promise.all([
      supabase
        .from("awardees")
        .select(
          "id, full_name, email, grants(id, title, currency_code, amount_awarded, status)"
        )
        .order("created_at", { ascending: false }),
      supabase.from("budgets").select("grant_id, amount_allocated, approved, currency_code"),
      supabase.from("disbursements").select("*").order("disbursement_date", { ascending: false }),
      supabase
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false }),
      supabase
        .from("disbursement_requests")
        .select("id, grant_id, amount, currency_code, status, justification, created_at")
        .in("status", ["pending", "approved"])
        .order("created_at", { ascending: false }),
    ]);

  const awardees = awardeesRes.data ?? [];
  const budgets = budgetsRes.data ?? [];
  const disbursements = disbursementsRes.data ?? [];
  const expenses = expensesRes.data ?? [];
  const allDisbRequests = disbRequestsRes.data ?? [];
  const pendingDisbRequests = allDisbRequests.filter((r: { status: string }) => r.status === "pending");
  const approvedDisbRequests = allDisbRequests.filter((r: { status: string }) => r.status === "approved");

  // Portfolio-wide totals — sum across ALL grants per awardee
  const totalAwarded = awardees.reduce((s, a) => {
    const grants = a.grants as { amount_awarded: number }[] | null;
    return s + (grants ?? []).reduce((gs, g) => gs + Number(g.amount_awarded ?? 0), 0);
  }, 0);
  const totalBudgeted = budgets
    .filter((b) => b.approved)
    .reduce((s, b) => s + Number(b.amount_allocated), 0);
  const totalDisbursed = disbursements.reduce((s, d) => s + Number(d.amount), 0);
  const totalExpensesApproved = expenses
    .filter((e) => e.status === "approved")
    .reduce((s, e) => s + Number(e.amount), 0);
  const pendingExpenses = expenses.filter((e) => e.status === "pending");

  // Per-awardee financial rollup
  type GrantRow = {
    id: string;
    title: string;
    currency_code: string;
    amount_awarded: number;
    status: string;
  };

  type AwardeeRow = {
    id: string;
    full_name: string;
    email: string;
    grant: GrantRow;
    disbursed: number;
    expApproved: number;
    expPending: number;
    remaining: number;
    balance: number;
    utilizationPct: number;
  };

  const awardeeRows: AwardeeRow[] = [];
  for (const a of awardees) {
    const grant = (a.grants as GrantRow[])?.[0];
    if (!grant) continue;

    const disbursed = disbursements
      .filter((d) => d.grant_id === grant.id)
      .reduce((s, d) => s + Number(d.amount), 0);
    const expApproved = expenses
      .filter((e) => e.grant_id === grant.id && e.status === "approved")
      .reduce((s, e) => s + Number(e.amount), 0);
    const expPending = expenses.filter(
      (e) => e.grant_id === grant.id && e.status === "pending"
    ).length;
    const balance = disbursed - expApproved;
    const remaining = Number(grant.amount_awarded) - disbursed;
    const utilizationPct = grant.amount_awarded > 0
      ? Math.min(100, Math.round((disbursed / Number(grant.amount_awarded)) * 100))
      : 0;

    awardeeRows.push({
      id: a.id,
      full_name: a.full_name,
      email: a.email,
      grant,
      disbursed,
      expApproved,
      expPending,
      remaining,
      balance,
      utilizationPct,
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finances</h1>
          <p className="text-sm text-gray-500 mt-0.5">Portfolio-wide financial overview</p>
        </div>
      </div>

      {/* Portfolio summary */}
      {(() => {
        const deployedPct = totalAwarded > 0 ? Math.round((totalDisbursed / totalAwarded) * 100) : 0;
        return (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {[
              { label: "Total Awarded", value: fmt(totalAwarded), note: `across ${awardees.length} awardee${awardees.length !== 1 ? "s" : ""}` },
              { label: "Approved Budget", value: fmt(totalBudgeted), note: null },
              { label: "Total Disbursed", value: fmt(totalDisbursed), note: null },
              { label: "% Deployed", value: `${deployedPct}%`, note: "of total portfolio" },
              {
                label: "Expenses Approved",
                value: fmt(totalExpensesApproved),
                note: pendingExpenses.length > 0 ? `${pendingExpenses.length} pending review` : null,
                alert: pendingExpenses.length > 0,
              },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="text-xs font-medium text-gray-500">{s.label}</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{s.value}</p>
                {s.note && (
                  <p className={`text-xs mt-0.5 ${"alert" in s && s.alert ? "text-yellow-600" : "text-gray-400"}`}>
                    {s.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Approved disbursement requests awaiting processing */}
      {approvedDisbRequests.length > 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-green-900">
              Approved Requests Awaiting Payment ({approvedDisbRequests.length})
            </h2>
          </div>
          <div className="space-y-2">
            {approvedDisbRequests.slice(0, 6).map((req: { id: string; grant_id: string; amount: number; currency_code: string; created_at: string }) => {
              const awardee = awardees.find((a) => {
                const grants = a.grants as { id: string }[] | null;
                return (grants ?? []).some((g) => g.id === req.grant_id);
              });
              return (
                <div
                  key={req.id}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg bg-white border border-green-100 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{awardee?.full_name ?? "Unknown"}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <p className="text-sm font-semibold text-gray-900">{fmt(Number(req.amount), req.currency_code)}</p>
                    {awardee && (
                      <Link href={`/awardees/${awardee.id}/finances`} className="text-xs font-medium text-green-700 hover:underline whitespace-nowrap">
                        Process →
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending disbursement requests from awardees */}
      {pendingDisbRequests.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-blue-900">
              Disbursement Requests Awaiting Approval ({pendingDisbRequests.length})
            </h2>
          </div>
          <div className="space-y-2">
            {pendingDisbRequests.slice(0, 6).map((req) => {
              const awardee = awardees.find((a) => {
                const grants = a.grants as { id: string }[] | null;
                return grants?.[0]?.id === req.grant_id;
              });
              const grant = (awardee?.grants as { id: string; title: string }[] | null)?.[0];
              return (
                <div
                  key={req.id}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg bg-white border border-blue-100 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {awardee?.full_name ?? "Unknown"} — {grant?.title ?? "—"}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {req.justification?.slice(0, 90)}{(req.justification?.length ?? 0) > 90 ? "…" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {fmt(Number(req.amount), req.currency_code)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(req.created_at).toLocaleDateString("en-ZA")}
                    </p>
                    {awardee && (
                      <Link
                        href={`/awardees/${awardee.id}/finances`}
                        className="text-xs font-medium text-blue-600 hover:underline whitespace-nowrap"
                      >
                        Review →
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
            {pendingDisbRequests.length > 6 && (
              <p className="text-xs text-blue-700 text-center pt-1">
                +{pendingDisbRequests.length - 6} more — open individual awardee pages to process
              </p>
            )}
          </div>
        </div>
      )}

      {/* Pending expense reviews */}
      {pendingExpenses.length > 0 && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6">
          <h2 className="text-sm font-semibold text-yellow-800 mb-3">
            Pending Expense Reviews ({pendingExpenses.length})
          </h2>
          <div className="space-y-2">
            {pendingExpenses.slice(0, 5).map((e) => {
              const awardee = awardees.find((a) => {
                const grants = a.grants as { id: string }[] | null;
                return grants?.[0]?.id === e.grant_id;
              });
              return (
                <div
                  key={e.id}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg bg-white border border-yellow-100 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{e.description}</p>
                    <p className="text-xs text-gray-500">
                      {awardee?.full_name ?? "Unknown"} · {e.category} · {parseDate(e.expense_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-sm font-semibold text-gray-900">
                      {fmt(Number(e.amount), e.currency_code)}
                    </p>
                    {awardee && (
                      <Link
                        href={`/awardees/${awardee.id}/finances`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Review →
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
            {pendingExpenses.length > 5 && (
              <p className="text-xs text-yellow-700 text-center pt-1">
                +{pendingExpenses.length - 5} more — review per awardee below
              </p>
            )}
          </div>
        </div>
      )}

      {/* Per-awardee financial table */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">By Awardee</h2>
        {awardeeRows.length === 0 ? (
          <EmptyState title="No awardees with grants yet." description="Awardee financial data will appear here once grants are created." />
        ) : (
          <div className="overflow-x-auto -mx-6">
            <div className="inline-block min-w-full align-middle px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">Awardee</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">Grant</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">Awarded</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">Disbursed</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">Remaining</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">Exp. Approved</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500 pl-4">Utilization</th>
                  <th className="pb-2 text-center text-xs font-medium text-gray-500">Pending Exp.</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {awardeeRows.map((row) => {
                  const currency = row.grant.currency_code;
                  const barColor =
                    row.utilizationPct >= 90 ? "#dc2626"
                    : row.utilizationPct >= 60 ? "#d97706"
                    : "#16a34a";
                  return (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 pr-4">
                        <p className="font-medium text-gray-900 whitespace-nowrap">{row.full_name}</p>
                        <p className="text-xs text-gray-400">{row.email}</p>
                      </td>
                      <td className="py-3 pr-4 max-w-[180px]">
                        <Link
                          href={`/awardees/${row.id}/finances`}
                          className="text-gray-700 hover:text-[#6b1a2a] hover:underline truncate block"
                        >
                          {row.grant.title}
                        </Link>
                      </td>
                      <td className="py-3 text-right text-gray-900 whitespace-nowrap">
                        {fmt(Number(row.grant.amount_awarded), currency)}
                      </td>
                      <td className="py-3 text-right text-gray-900 whitespace-nowrap">
                        {fmt(row.disbursed, currency)}
                      </td>
                      <td className={`py-3 text-right font-medium whitespace-nowrap ${row.remaining < 0 ? "text-red-600" : "text-gray-700"}`}>
                        {fmt(row.remaining, currency)}
                      </td>
                      <td className="py-3 text-right text-gray-600 whitespace-nowrap">
                        {fmt(row.expApproved, currency)}
                      </td>
                      <td className="py-3 pl-4 w-36">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${row.utilizationPct}%`, backgroundColor: barColor }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 w-8 text-right">{row.utilizationPct}%</span>
                        </div>
                      </td>
                      <td className="py-3 text-center">
                        {row.expPending > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                            {row.expPending}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-3 pl-4">
                        <Link
                          href={`/awardees/${row.id}/finances`}
                          className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                        >
                          Manage →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      {/* Recent disbursements */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Recent Disbursements</h2>
        {disbursements.length === 0 ? (
          <EmptyState title="No disbursements recorded yet." description="Disbursements will appear here once payments are processed." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">Date</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">Awardee</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">Method</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">Reference</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {disbursements.slice(0, 10).map((d) => {
                  const awardee = awardees.find((a) => {
                    const grants = a.grants as { id: string }[] | null;
                    return grants?.[0]?.id === d.grant_id;
                  });
                  return (
                    <tr key={d.id}>
                      <td className="py-2.5 text-gray-900">{parseDate(d.disbursement_date)}</td>
                      <td className="py-2.5 text-gray-600">{awardee?.full_name ?? "—"}</td>
                      <td className="py-2.5 text-gray-600">{d.method}</td>
                      <td className="py-2.5 text-gray-500">{d.reference || "—"}</td>
                      <td className="py-2.5 text-right font-medium text-gray-900">
                        {fmt(Number(d.amount), d.currency_code)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {disbursements.length > 10 && (
              <p className="text-xs text-gray-400 text-center pt-3">
                Showing 10 of {disbursements.length} — see individual awardee pages for full history
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
