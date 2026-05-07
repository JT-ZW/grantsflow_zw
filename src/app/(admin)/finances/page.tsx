import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

function fmt(amount: number, currency = "USD") {
  return `${currency} ${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
}

function parseDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-ZA");
}

const EXPENSE_STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default async function FinancesPage() {
  const supabase = await createClient();

  // Load everything in parallel
  const [awardeesRes, budgetsRes, disbursementsRes, expensesRes] =
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
    ]);

  const awardees = awardeesRes.data ?? [];
  const budgets = budgetsRes.data ?? [];
  const disbursements = disbursementsRes.data ?? [];
  const expenses = expensesRes.data ?? [];

  // Portfolio-wide totals
  const totalAwarded = awardees.reduce((s, a) => {
    const grants = a.grants as { amount_awarded: number }[] | null;
    return s + (grants?.[0]?.amount_awarded ?? 0);
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
    balance: number;
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

    awardeeRows.push({
      id: a.id,
      full_name: a.full_name,
      email: a.email,
      grant,
      disbursed,
      expApproved,
      expPending,
      balance,
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Finances</h1>
        <p className="text-sm text-gray-500 mt-0.5">Portfolio-wide financial overview</p>
      </div>

      {/* Portfolio summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Awarded", value: fmt(totalAwarded), note: `across ${awardees.length} awardee${awardees.length !== 1 ? "s" : ""}` },
          { label: "Approved Budget", value: fmt(totalBudgeted), note: null },
          { label: "Total Disbursed", value: fmt(totalDisbursed), note: null },
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
              <p className={`text-xs mt-0.5 ${s.alert ? "text-yellow-600" : "text-gray-400"}`}>
                {s.note}
              </p>
            )}
          </div>
        ))}
      </div>

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
                  className="flex items-center justify-between rounded-lg bg-white border border-yellow-100 px-4 py-3"
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
          <p className="text-sm text-gray-400">No awardees with grants yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">Awardee</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">Grant</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">Awarded</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">Disbursed</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">Exp. Approved</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">Balance</th>
                  <th className="pb-2 text-center text-xs font-medium text-gray-500">Pending Exp.</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {awardeeRows.map((row) => {
                  const currency = row.grant.currency_code;
                  return (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3">
                        <p className="font-medium text-gray-900">{row.full_name}</p>
                        <p className="text-xs text-gray-400">{row.email}</p>
                      </td>
                      <td className="py-3 text-gray-600 max-w-[180px] truncate">
                        {row.grant.title}
                      </td>
                      <td className="py-3 text-right text-gray-900">
                        {fmt(Number(row.grant.amount_awarded), currency)}
                      </td>
                      <td className="py-3 text-right text-gray-900">
                        {fmt(row.disbursed, currency)}
                      </td>
                      <td className="py-3 text-right text-gray-900">
                        {fmt(row.expApproved, currency)}
                      </td>
                      <td
                        className={`py-3 text-right font-medium ${
                          row.balance < 0 ? "text-red-600" : "text-gray-900"
                        }`}
                      >
                        {fmt(row.balance, currency)}
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
        )}
      </div>

      {/* Recent disbursements */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Recent Disbursements</h2>
        {disbursements.length === 0 ? (
          <p className="text-sm text-gray-400">No disbursements recorded yet.</p>
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
