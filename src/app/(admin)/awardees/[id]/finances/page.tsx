import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import {
  addBudgetLine,
  approveBudgetLine,
  recordDisbursement,
  reviewExpense,
} from "./actions";

const BUDGET_CATEGORIES = [
  "Personnel / Salaries",
  "Equipment & Materials",
  "Travel & Accommodation",
  "Research Activities",
  "Publishing & Dissemination",
  "Overheads",
  "Other",
];

const CURRENCIES = ["ZAR", "USD", "EUR", "GBP"];
const METHODS = ["EFT", "Cash", "Cheque", "Mobile Money", "Other"];

const EXPENSE_STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

function fmt(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
}

function parseDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-ZA");
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AwardeeFinancesPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: awardee } = await supabase
    .from("awardees")
    .select("id, full_name, grants(id, title, currency_code, amount_awarded, milestones(id, title))")
    .eq("id", id)
    .single();

  if (!awardee) notFound();

  const grant = (awardee.grants as {
    id: string;
    title: string;
    currency_code: string;
    amount_awarded: number;
    milestones: { id: string; title: string }[];
  }[])?.[0];

  if (!grant) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-400">
        No grant linked yet. Add a grant on the Overview tab first.
      </div>
    );
  }

  const milestones = grant.milestones ?? [];
  const currency = grant.currency_code;

  const [budgetsRes, disbursementsRes, expensesRes] = await Promise.all([
    supabase
      .from("budgets")
      .select("*")
      .eq("grant_id", grant.id)
      .order("created_at"),
    supabase
      .from("disbursements")
      .select("*")
      .eq("grant_id", grant.id)
      .order("disbursement_date", { ascending: false }),
    supabase
      .from("expenses")
      .select("*")
      .eq("grant_id", grant.id)
      .order("expense_date", { ascending: false }),
  ]);

  const budgets = budgetsRes.data ?? [];
  const disbursements = disbursementsRes.data ?? [];
  const expenses = expensesRes.data ?? [];

  // Summary calculations
  const totalBudgetApproved = budgets
    .filter((b) => b.approved)
    .reduce((s, b) => s + Number(b.amount_allocated), 0);
  const totalBudgetPending = budgets
    .filter((b) => !b.approved)
    .reduce((s, b) => s + Number(b.amount_allocated), 0);
  const totalDisbursed = disbursements.reduce((s, d) => s + Number(d.amount), 0);
  const totalExpensesApproved = expenses
    .filter((e) => e.status === "approved")
    .reduce((s, e) => s + Number(e.amount), 0);
  const totalExpensesPending = expenses
    .filter((e) => e.status === "pending")
    .reduce((s, e) => s + Number(e.amount), 0);
  const awardeeBalance = totalDisbursed - totalExpensesApproved;
  const pendingExpenses = expenses.filter((e) => e.status === "pending");

  const inputClass =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="space-y-6">
      {/* Financial Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: "Approved Budget",
            value: fmt(totalBudgetApproved, currency),
            sub: totalBudgetPending > 0 ? `+ ${fmt(totalBudgetPending, currency)} pending` : null,
          },
          { label: "Total Disbursed", value: fmt(totalDisbursed, currency), sub: null },
          {
            label: "Expenses Approved",
            value: fmt(totalExpensesApproved, currency),
            sub: totalExpensesPending > 0 ? `+ ${fmt(totalExpensesPending, currency)} pending` : null,
          },
          {
            label: "Awardee Balance",
            value: fmt(awardeeBalance, currency),
            sub: null,
            alert: awardeeBalance < 0,
          },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs font-medium text-gray-500">{s.label}</p>
            <p
              className={`mt-1 text-xl font-bold ${
                s.alert ? "text-red-600" : "text-gray-900"
              }`}
            >
              {s.value}
            </p>
            {s.sub && <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Budget Lines */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Budget Allocation
          <span className="ml-2 text-sm font-normal text-gray-400">
            {budgets.length} line{budgets.length !== 1 ? "s" : ""}
          </span>
        </h2>

        {budgets.length > 0 && (
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">Category</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">Description</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">Milestone</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">Amount</th>
                  <th className="pb-2 text-center text-xs font-medium text-gray-500">Status</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {budgets.map((b) => {
                  const ms = milestones.find((m) => m.id === b.milestone_id);
                  return (
                    <tr key={b.id}>
                      <td className="py-2.5 text-gray-900">{b.category}</td>
                      <td className="py-2.5 text-gray-500 max-w-[180px] truncate">{b.description || "—"}</td>
                      <td className="py-2.5 text-gray-500">{ms?.title || "—"}</td>
                      <td className="py-2.5 text-right font-medium text-gray-900">
                        {fmt(Number(b.amount_allocated), b.currency_code)}
                      </td>
                      <td className="py-2.5 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            b.approved
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {b.approved ? "Approved" : "Pending"}
                        </span>
                      </td>
                      <td className="py-2.5 pl-2">
                        {!b.approved && (
                          <form action={approveBudgetLine}>
                            <input type="hidden" name="budget_id" value={b.id} />
                            <input type="hidden" name="awardee_id" value={id} />
                            <input type="hidden" name="approved" value="true" />
                            <button type="submit" className="text-xs text-blue-600 hover:underline">
                              Approve
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <details>
          <summary className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-800 select-none">
            + Add budget line
          </summary>
          <form
            action={addBudgetLine}
            className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3"
          >
            <input type="hidden" name="grant_id" value={grant.id} />
            <input type="hidden" name="awardee_id" value={id} />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <select name="category" required className={inputClass}>
                <option value="">Select…</option>
                {BUDGET_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Description
              </label>
              <input name="description" placeholder="Optional detail" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Linked Milestone
              </label>
              <select name="milestone_id" className={inputClass}>
                <option value="">None</option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Amount <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select name="currency_code" defaultValue={currency} className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <input
                  name="amount_allocated"
                  type="number"
                  required
                  placeholder="0.00"
                  step="0.01"
                  min="0.01"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="sm:col-span-2 flex items-end">
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                Add Budget Line
              </button>
            </div>
          </form>
        </details>
      </div>

      {/* Disbursements */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Disbursements
          <span className="ml-2 text-sm font-normal text-gray-400">
            {disbursements.length} payment{disbursements.length !== 1 ? "s" : ""}
          </span>
        </h2>

        {disbursements.length > 0 && (
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">Date</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">Method</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">Reference</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">Milestone</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {disbursements.map((d) => {
                  const ms = milestones.find((m) => m.id === d.milestone_id);
                  return (
                    <tr key={d.id}>
                      <td className="py-2.5 text-gray-900">{parseDate(d.disbursement_date)}</td>
                      <td className="py-2.5 text-gray-600">{d.method}</td>
                      <td className="py-2.5 text-gray-500">{d.reference || "—"}</td>
                      <td className="py-2.5 text-gray-500">{ms?.title || "—"}</td>
                      <td className="py-2.5 text-right font-medium text-gray-900">
                        {fmt(Number(d.amount), d.currency_code)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {disbursements.length === 0 && (
          <p className="text-sm text-gray-400 mb-4">No disbursements recorded yet.</p>
        )}

        <details>
          <summary className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-800 select-none">
            + Record disbursement
          </summary>
          <form
            action={recordDisbursement}
            className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3"
          >
            <input type="hidden" name="grant_id" value={grant.id} />
            <input type="hidden" name="awardee_id" value={id} />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Amount <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select name="currency_code" defaultValue={currency} className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <input
                  name="amount"
                  type="number"
                  required
                  placeholder="0.00"
                  step="0.01"
                  min="0.01"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input name="disbursement_date" type="date" required className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Method <span className="text-red-500">*</span>
              </label>
              <select name="method" required className={inputClass}>
                {METHODS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Reference / Cheque No.
              </label>
              <input name="reference" placeholder="e.g. TXN-20260507" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Linked Milestone
              </label>
              <select name="milestone_id" className={inputClass}>
                <option value="">None</option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <input name="notes" placeholder="Optional notes" className={inputClass} />
            </div>
            <div className="sm:col-span-3">
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                Record Disbursement
              </button>
            </div>
          </form>
        </details>
      </div>

      {/* Expense Reports */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Expense Reports
          {pendingExpenses.length > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
              {pendingExpenses.length} pending review
            </span>
          )}
        </h2>

        {expenses.length === 0 ? (
          <p className="text-sm text-gray-400">No expense reports submitted yet.</p>
        ) : (
          <div className="space-y-3">
            {expenses.map((e) => {
              const ms = milestones.find((m) => m.id === e.milestone_id);
              return (
                <div
                  key={e.id}
                  className="flex items-start gap-4 rounded-lg border border-gray-100 p-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900">{e.description}</p>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                          EXPENSE_STATUS_STYLES[e.status] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {e.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {e.category} · {parseDate(e.expense_date)}
                      {ms && ` · ${ms.title}`}
                    </p>
                    {e.review_notes && (
                      <p className="text-xs text-gray-400 mt-1 italic">
                        Note: {e.review_notes}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {fmt(Number(e.amount), e.currency_code)}
                    </p>
                    {e.status === "pending" && (
                      <div className="flex gap-2">
                        <form action={reviewExpense}>
                          <input type="hidden" name="expense_id" value={e.id} />
                          <input type="hidden" name="awardee_id" value={id} />
                          <input type="hidden" name="status" value="approved" />
                          <button
                            type="submit"
                            className="rounded-lg border border-green-300 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
                          >
                            Approve
                          </button>
                        </form>
                        <form action={reviewExpense}>
                          <input type="hidden" name="expense_id" value={e.id} />
                          <input type="hidden" name="awardee_id" value={id} />
                          <input type="hidden" name="status" value="rejected" />
                          <button
                            type="submit"
                            className="rounded-lg border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
                          >
                            Reject
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
