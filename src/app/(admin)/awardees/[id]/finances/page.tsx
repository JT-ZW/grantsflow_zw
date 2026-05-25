import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import {
  addBudgetLine,
  approveBudgetLine,
  recordDisbursement,
  reviewExpense,
  reviewBudgetAmendment,
  reviewDisbursementRequest,
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

  const budgets       = budgetsRes.data      ?? [];
  const disbursements = disbursementsRes.data ?? [];
  const expenses      = expensesRes.data      ?? [];

  // Budget amendment requests
  const { data: rawAmendments } = await supabase
    .from("budget_amendments")
    .select("id, request_type, status, category, amount, currency_code, from_category, justification, review_notes, reviewed_at, created_at")
    .eq("grant_id", grant.id)
    .order("created_at", { ascending: false });
  const amendments = rawAmendments ?? [];
  const pendingAmendments = amendments.filter((a) => a.status === "pending");

  // Disbursement requests from the awardee
  const { data: rawDisbReqs } = await supabase
    .from("disbursement_requests")
    .select("id, amount, currency_code, milestone_id, justification, status, review_notes, reviewed_at, processed_at, created_at, milestones(title)")
    .eq("grant_id", grant.id)
    .order("created_at", { ascending: false });
  const disbursementReqs = rawDisbReqs ?? [];
  const pendingDisbReqs = disbursementReqs.filter((r) => r.status === "pending");

  // Generate signed receipt URLs for admin viewing (1h expiry).
  // Use the admin client (service role) so storage RLS doesn't block cross-user access.
  const adminClient = createAdminClient();
  const receiptUrls: Record<string, string> = {};
  await Promise.all(
    expenses
      .filter((e) => (e as unknown as { receipt_storage_path?: string }).receipt_storage_path)
      .map(async (e) => {
        const path = (e as unknown as { receipt_storage_path: string }).receipt_storage_path;
        const { data } = await adminClient.storage
          .from("expense-receipts")
          .createSignedUrl(path, 3600);
        if (data?.signedUrl) receiptUrls[e.id] = data.signedUrl;
      })
  );

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
              const receiptUrl = receiptUrls[e.id];
              return (
                <div
                  key={e.id}
                  className="rounded-lg border border-gray-100 p-4"
                >
                  <div className="flex items-start gap-4">
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
                      {receiptUrl ? (
                        <a
                          href={receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                          View Receipt
                        </a>
                      ) : (e as unknown as { receipt_storage_path?: string }).receipt_storage_path ? (
                        <p className="mt-1 text-xs text-gray-400">Receipt attached</p>
                      ) : null}
                    </div>
                    <p className="text-sm font-semibold text-gray-900 shrink-0">
                      {fmt(Number(e.amount), e.currency_code)}
                    </p>
                  </div>
                  {e.status === "pending" && (
                    <form action={reviewExpense} className="mt-3 border-t border-gray-100 pt-3 flex flex-col sm:flex-row gap-2">
                      <input type="hidden" name="expense_id" value={e.id} />
                      <input type="hidden" name="awardee_id" value={id} />
                      <input
                        name="review_notes"
                        type="text"
                        placeholder="Review note (optional for approval, recommended for rejection)…"
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="submit"
                          name="status"
                          value="approved"
                          className="rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          type="submit"
                          name="status"
                          value="rejected"
                          className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* Budget Amendment Requests */}
      {amendments.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Budget Amendment Requests</h2>
              <p className="mt-0.5 text-sm text-gray-400">Awardee-submitted requests to modify the approved budget</p>
            </div>
            {pendingAmendments.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                {pendingAmendments.length} pending
              </span>
            )}
          </div>
          <div className="divide-y divide-gray-100">
            {amendments.map((a) => (
              <div key={a.id} className="px-6 py-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{a.category}</p>
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 capitalize">
                        {a.request_type.replace("_", " ")}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        a.status === "pending" ? "bg-amber-100 text-amber-700" :
                        a.status === "approved" ? "bg-green-100 text-green-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {a.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {fmt(Number(a.amount), a.currency_code)}
                      {a.from_category && ` · From: ${a.from_category}`}
                      {" · "}{parseDate(a.created_at)}
                    </p>
                    <p className="mt-1 text-sm text-gray-600 italic">&ldquo;{a.justification}&rdquo;</p>
                    {a.review_notes && (
                      <p className="mt-1 text-xs text-gray-400 italic">Note: {a.review_notes}</p>
                    )}
                  </div>
                </div>
                {a.status === "pending" && (
                  <form action={reviewBudgetAmendment} className="flex flex-col sm:flex-row gap-2">
                    <input type="hidden" name="amendment_id" value={a.id} />
                    <input type="hidden" name="awardee_id" value={id} />
                    <input
                      name="review_notes"
                      type="text"
                      placeholder="Review note (optional)…"
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:border-[#6b1a2a] focus:outline-none focus:ring-1 focus:ring-[#6b1a2a]"
                    />
                    <div className="flex gap-2 shrink-0">
                      <button type="submit" name="status" value="approved"
                        className="rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors">
                        Approve
                      </button>
                      <button type="submit" name="status" value="rejected"
                        className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors">
                        Reject
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disbursement Requests */}
      {disbursementReqs.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Disbursement Requests</h2>
            {pendingDisbReqs.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                {pendingDisbReqs.length} pending
              </span>
            )}
          </div>
          <div className="divide-y divide-gray-100">
            {disbursementReqs.map((r) => {
              const milestone = r.milestones as unknown as { title: string } | null;
              return (
                <div key={r.id} className="px-6 py-4 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">
                        {r.currency_code} {Number(r.amount).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                      </p>
                      {milestone && (
                        <p className="text-xs text-blue-600 mt-0.5">📌 {milestone.title}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(r.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      r.status === "pending"   ? "bg-amber-100 text-amber-700" :
                      r.status === "approved"  ? "bg-blue-100 text-blue-700" :
                      r.status === "rejected"  ? "bg-red-100 text-red-700" :
                      r.status === "processed" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                    }`}>
                      {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{r.justification}</p>
                  {r.review_notes && (
                    <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-600">
                      <span className="font-medium text-gray-700">Note: </span>{r.review_notes}
                    </div>
                  )}
                  {r.status === "pending" && (
                    <form action={reviewDisbursementRequest} className="flex flex-col sm:flex-row gap-2">
                      <input type="hidden" name="request_id" value={r.id} />
                      <input type="hidden" name="awardee_id" value={id} />
                      <input
                        type="text"
                        name="review_notes"
                        placeholder="Optional note to awardee…"
                        maxLength={500}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#6b1a2a]"
                      />
                      <div className="flex gap-2">
                        <button type="submit" name="status" value="approved"
                          className="rounded-lg bg-[#6b1a2a] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#8b2234] transition-colors">
                          Approve
                        </button>
                        <button type="submit" name="status" value="rejected"
                          className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors">
                          Reject
                        </button>
                      </div>
                    </form>
                  )}
                  {r.status === "approved" && (
                    <form action={reviewDisbursementRequest}>
                      <input type="hidden" name="request_id" value={r.id} />
                      <input type="hidden" name="awardee_id" value={id} />
                      <input type="hidden" name="status" value="processed" />
                      <button type="submit"
                        className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 transition-colors">
                        Mark as Processed
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
