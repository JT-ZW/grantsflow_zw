import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { submitExpense } from "./actions";

const EXPENSE_CATEGORIES = [
  "Personnel / Salaries",
  "Equipment & Materials",
  "Travel & Accommodation",
  "Research Activities",
  "Publishing & Dissemination",
  "Overheads",
  "Other",
];

const CURRENCIES = ["ZAR", "USD", "EUR", "GBP"];

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

export default async function AwardeeFinancesPortalPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: awardee } = await supabase
    .from("awardees")
    .select(
      "id, full_name, grants(id, title, currency_code, amount_awarded, milestones(id, title))"
    )
    .eq("user_id", user.id)
    .single();

  if (!awardee) {
    return (
      <div className="max-w-2xl mx-auto mt-12 rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
        <p className="text-sm text-gray-500">
          Your account hasn&apos;t been linked to a grant yet. Please contact the grants office.
        </p>
      </div>
    );
  }

  const grant = (awardee.grants as {
    id: string;
    title: string;
    currency_code: string;
    amount_awarded: number;
    milestones: { id: string; title: string }[];
  }[])?.[0];

  if (!grant) {
    return (
      <div className="max-w-2xl mx-auto mt-12 rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
        <p className="text-sm text-gray-500">No grant is linked to your profile yet.</p>
      </div>
    );
  }

  const milestones = grant.milestones ?? [];
  const currency = grant.currency_code;

  const [disbursementsRes, expensesRes] = await Promise.all([
    supabase
      .from("disbursements")
      .select("*")
      .eq("grant_id", grant.id)
      .order("disbursement_date", { ascending: false }),
    supabase
      .from("expenses")
      .select("*")
      .eq("grant_id", grant.id)
      .eq("submitted_by", user.id)
      .order("expense_date", { ascending: false }),
  ]);

  const disbursements = disbursementsRes.data ?? [];
  const expenses = expensesRes.data ?? [];

  const totalDisbursed = disbursements.reduce((s, d) => s + Number(d.amount), 0);
  const totalApproved = expenses
    .filter((e) => e.status === "approved")
    .reduce((s, e) => s + Number(e.amount), 0);
  const totalPending = expenses
    .filter((e) => e.status === "pending")
    .reduce((s, e) => s + Number(e.amount), 0);
  const balance = totalDisbursed - totalApproved;

  const inputClass =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Finances</h1>
      <p className="text-sm text-gray-500 -mt-4">{grant.title}</p>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Grant Amount", value: fmt(Number(grant.amount_awarded), currency) },
          { label: "Disbursed to Me", value: fmt(totalDisbursed, currency) },
          { label: "Expenses Approved", value: fmt(totalApproved, currency) },
          {
            label: "My Balance",
            value: fmt(balance, currency),
            alert: balance < 0,
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
          </div>
        ))}
      </div>

      {/* Disbursement History */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Disbursement History</h2>
        {disbursements.length === 0 ? (
          <p className="text-sm text-gray-400">No payments have been made to you yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">Date</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">Method</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">Reference</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {disbursements.map((d) => (
                  <tr key={d.id}>
                    <td className="py-2.5 text-gray-900">{parseDate(d.disbursement_date)}</td>
                    <td className="py-2.5 text-gray-600">{d.method}</td>
                    <td className="py-2.5 text-gray-500">{d.reference || "—"}</td>
                    <td className="py-2.5 text-right font-medium text-gray-900">
                      {fmt(Number(d.amount), d.currency_code)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* My Expense Reports */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">
          My Expense Reports
        </h2>
        {totalPending > 0 && (
          <p className="text-xs text-yellow-600 mb-4">
            {fmt(totalPending, currency)} pending review
          </p>
        )}

        {expenses.length > 0 && (
          <div className="space-y-3 mb-4">
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
                        Reviewer note: {e.review_notes}
                      </p>
                    )}
                    {(e as unknown as { receipt_storage_path?: string }).receipt_storage_path && (
                      <p className="text-xs text-blue-600 mt-1">📎 Receipt attached</p>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 shrink-0">
                    {fmt(Number(e.amount), e.currency_code)}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        <details>
          <summary className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-800 select-none">
            + Submit expense report
          </summary>
          <form
            action={submitExpense}
            className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            <input type="hidden" name="grant_id" value={grant.id} />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <select name="category" required className={inputClass}>
                <option value="">Select…</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <input
                name="description"
                required
                placeholder="What was this expense for?"
                className={inputClass}
              />
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
                Date of Expense <span className="text-red-500">*</span>
              </label>
              <input name="expense_date" type="date" required className={inputClass} />
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
                Receipt / Invoice (optional)
              </label>
              <input
                name="receipt_file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 focus:outline-none file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-1 file:text-xs file:font-medium"
              />
              <p className="mt-0.5 text-[10px] text-gray-400">PDF, JPG or PNG — max 10 MB</p>
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                Submit Expense
              </button>
            </div>
          </form>
        </details>
      </div>
    </div>
  );
}
