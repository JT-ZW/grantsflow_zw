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

const EXPENSE_STATUS: Record<string, { badge: string; label: string }> = {
  pending:  { badge: "bg-yellow-100 text-yellow-700", label: "Pending Review" },
  approved: { badge: "bg-green-100 text-green-700",   label: "Approved" },
  rejected: { badge: "bg-red-100 text-red-700",       label: "Rejected" },
};

function fmt(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type Budget = {
  id: string;
  category: string;
  amount_allocated: number;
  currency_code: string;
  approved: boolean;
};

type Expense = {
  id: string;
  description: string;
  category: string;
  amount: number;
  currency_code: string;
  expense_date: string;
  status: string;
  review_notes: string | null;
  milestone_id: string | null;
  receipt_storage_path: string | null;
};

type Disbursement = {
  id: string;
  amount: number;
  currency_code: string;
  disbursement_date: string;
  method: string;
  reference: string | null;
  milestone_id: string | null;
};

export default async function AwardeeFinancesPortalPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: awardeeRaw } = await supabase
    .from("awardees")
    .select("id, full_name, grants(id, title, currency_code, amount_awarded, milestones(id, title))")
    .eq("user_id", user.id)
    .single();

  if (!awardeeRaw) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
        Your account hasn&apos;t been linked to a grant yet. Please contact the grants office.
      </div>
    );
  }

  const awardee = awardeeRaw as {
    id: string;
    full_name: string;
    grants: { id: string; title: string; currency_code: string; amount_awarded: number; milestones: { id: string; title: string }[] }[];
  };

  const grant = awardee.grants?.[0];

  if (!grant) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
        No grant is linked to your profile yet.
      </div>
    );
  }

  const milestones = grant.milestones ?? [];
  const currency   = grant.currency_code;

  const [budgetsRes, disbursementsRes, expensesRes] = await Promise.all([
    supabase
      .from("budgets")
      .select("id, category, amount_allocated, currency_code, approved")
      .eq("grant_id", grant.id)
      .eq("approved", true)
      .order("category"),
    supabase
      .from("disbursements")
      .select("id, amount, currency_code, disbursement_date, method, reference, milestone_id")
      .eq("grant_id", grant.id)
      .order("disbursement_date", { ascending: false }),
    supabase
      .from("expenses")
      .select("id, description, category, amount, currency_code, expense_date, status, review_notes, milestone_id, receipt_storage_path")
      .eq("grant_id", grant.id)
      .eq("submitted_by", user.id)
      .order("expense_date", { ascending: false }),
  ]);

  const budgets       = (budgetsRes.data      ?? []) as Budget[];
  const disbursements = (disbursementsRes.data ?? []) as Disbursement[];
  const expenses      = (expensesRes.data      ?? []) as Expense[];

  const receiptUrls: Record<string, string> = {};
  await Promise.all(
    expenses
      .filter((e) => e.receipt_storage_path)
      .map(async (e) => {
        const { data } = await supabase.storage
          .from("expense-receipts")
          .createSignedUrl(e.receipt_storage_path!, 3600);
        if (data?.signedUrl) receiptUrls[e.id] = data.signedUrl;
      })
  );

  const totalDisbursed = disbursements.reduce((s, d) => s + Number(d.amount), 0);
  const totalApproved  = expenses.filter((e) => e.status === "approved").reduce((s, e) => s + Number(e.amount), 0);
  const totalPending   = expenses.filter((e) => e.status === "pending").reduce((s, e) => s + Number(e.amount), 0);
  const balance        = totalDisbursed - totalApproved;

  const budgetByCategory: Record<string, number> = {};
  budgets.forEach((b) => {
    budgetByCategory[b.category] = (budgetByCategory[b.category] ?? 0) + Number(b.amount_allocated);
  });

  const allCategories = [
    ...new Set([
      ...Object.keys(budgetByCategory),
      ...expenses.filter((e) => e.status !== "rejected").map((e) => e.category),
    ]),
  ].sort();

  const categoryRows = allCategories.map((cat) => {
    const budgeted  = budgetByCategory[cat] ?? 0;
    const spent     = expenses.filter((e) => e.category === cat && e.status === "approved").reduce((s, e) => s + Number(e.amount), 0);
    const pending   = expenses.filter((e) => e.category === cat && e.status === "pending").reduce((s, e) => s + Number(e.amount), 0);
    const remaining = budgeted - spent;
    const pct       = budgeted > 0 ? Math.min(Math.round((spent / budgeted) * 100), 100) : 0;
    return { cat, budgeted, spent, pending, remaining, pct };
  });

  const inputClass =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-[#6b1a2a] focus:outline-none focus:ring-1 focus:ring-[#6b1a2a]";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Finances</h1>
        <p className="mt-1 text-sm text-gray-500">{grant.title}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Grant Amount",      value: fmt(Number(grant.amount_awarded), currency), sub: null,                                             alert: false },
          { label: "Disbursed to Me",   value: fmt(totalDisbursed, currency),               sub: null,                                             alert: false },
          { label: "Expenses Approved", value: fmt(totalApproved, currency),                sub: totalPending > 0 ? `+ ${fmt(totalPending, currency)} pending` : null, alert: false },
          { label: "My Balance",        value: fmt(balance, currency),                      sub: balance < 0 ? "Overspent" : null,                 alert: balance < 0 },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs font-medium text-gray-500">{s.label}</p>
            <p className={`mt-1 text-xl font-bold ${s.alert ? "text-red-600" : "text-gray-900"}`}>{s.value}</p>
            {s.sub && <p className={`text-xs mt-0.5 ${s.alert ? "text-red-500" : "text-gray-400"}`}>{s.sub}</p>}
          </div>
        ))}
      </div>

      {categoryRows.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="text-base font-semibold text-gray-900">Budget vs Actuals</h2>
            <p className="text-xs text-gray-500 mt-0.5">Your approved budget per category and spending to date.</p>
          </div>
          <div className="divide-y divide-gray-50">
            {categoryRows.map(({ cat, budgeted, spent, pending, remaining, pct }) => {
              const isOver    = budgeted > 0 && remaining < 0;
              const isWarning = budgeted > 0 && !isOver && pct >= 80;
              const barColor  = isOver ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-[#6b1a2a]";
              return (
                <div key={cat} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <p className="text-sm font-medium text-gray-900">{cat}</p>
                    <div className="text-right shrink-0">
                      {budgeted > 0 ? (
                        <>
                          <p className={`text-sm font-semibold ${isOver ? "text-red-600" : "text-gray-900"}`}>
                            {isOver ? `${fmt(Math.abs(remaining), currency)} over` : `${fmt(remaining, currency)} left`}
                          </p>
                          <p className="text-xs text-gray-400">{pct}% used</p>
                        </>
                      ) : (
                        <p className="text-xs italic text-gray-400">No budget line</p>
                      )}
                    </div>
                  </div>
                  {budgeted > 0 && (
                    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                    {budgeted > 0 && (
                      <span>Budgeted: <span className="font-medium text-gray-700">{fmt(budgeted, currency)}</span></span>
                    )}
                    <span>Spent: <span className="font-medium text-gray-700">{fmt(spent, currency)}</span></span>
                    {pending > 0 && <span className="text-yellow-600">+ {fmt(pending, currency)} pending review</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Disbursement History</h2>
        </div>
        {disbursements.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-gray-400">No payments have been made to you yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                  <th className="py-3 text-left text-xs font-medium text-gray-500">Method</th>
                  <th className="py-3 text-left text-xs font-medium text-gray-500">Reference</th>
                  <th className="py-3 text-left text-xs font-medium text-gray-500">Milestone</th>
                  <th className="py-3 pr-6 text-right text-xs font-medium text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {disbursements.map((d) => {
                  const ms = milestones.find((m) => m.id === d.milestone_id);
                  return (
                    <tr key={d.id}>
                      <td className="px-6 py-3 text-gray-900">{fmtDate(d.disbursement_date)}</td>
                      <td className="py-3 text-gray-600">{d.method}</td>
                      <td className="py-3 text-gray-500">{d.reference || "—"}</td>
                      <td className="py-3 text-gray-500">{ms?.title || "—"}</td>
                      <td className="py-3 pr-6 text-right font-semibold text-gray-900">{fmt(Number(d.amount), d.currency_code)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">My Expense Reports</h2>
          {totalPending > 0 && (
            <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
              {fmt(totalPending, currency)} pending
            </span>
          )}
        </div>
        {expenses.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-gray-400">No expense reports submitted yet.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {expenses.map((e) => {
              const ms      = milestones.find((m) => m.id === e.milestone_id);
              const style   = EXPENSE_STATUS[e.status] ?? { badge: "bg-gray-100 text-gray-600", label: e.status };
              const receipt = receiptUrls[e.id];
              return (
                <div key={e.id} className="px-6 py-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900">{e.description}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}>{style.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {e.category} · {fmtDate(e.expense_date)}{ms && ` · ${ms.title}`}
                    </p>
                    {e.review_notes && (
                      <p className="mt-1 text-xs text-gray-500 italic bg-gray-50 rounded px-2 py-1">
                        Reviewer note: {e.review_notes}
                      </p>
                    )}
                    {receipt ? (
                      <a
                        href={receipt}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#6b1a2a] hover:underline"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        View Receipt
                      </a>
                    ) : e.receipt_storage_path ? (
                      <p className="mt-1 text-xs text-gray-400">Receipt attached</p>
                    ) : null}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 shrink-0">{fmt(Number(e.amount), e.currency_code)}</p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Submit an Expense</h2>
          <p className="text-xs text-gray-500 mt-0.5">Attach your receipt and submit for review. Approved expenses are deducted from your balance.</p>
        </div>
        <form action={submitExpense} className="px-6 py-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <input type="hidden" name="grant_id" value={grant.id} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Category <span className="text-red-500">*</span></label>
            <select name="category" required className={inputClass}>
              <option value="">Select category…</option>
              {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description <span className="text-red-500">*</span></label>
            <input name="description" required placeholder="What was this expense for?" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              <select name="currency_code" defaultValue={currency} className="rounded-lg border border-gray-300 px-2 py-2 text-sm shadow-sm focus:border-[#6b1a2a] focus:outline-none focus:ring-1 focus:ring-[#6b1a2a]">
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input name="amount" type="number" required placeholder="0.00" step="0.01" min="0.01" className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#6b1a2a] focus:outline-none focus:ring-1 focus:ring-[#6b1a2a]" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Date of Expense <span className="text-red-500">*</span></label>
            <input name="expense_date" type="date" required className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Linked Milestone</label>
            <select name="milestone_id" className={inputClass}>
              <option value="">None</option>
              {milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Receipt / Invoice</label>
            <input name="receipt_file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 shadow-sm file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-1 file:text-xs file:font-medium" />
            <p className="mt-1 text-xs text-gray-400">PDF, JPG or PNG — max 10 MB</p>
          </div>
          <div className="sm:col-span-2 flex justify-end pt-1">
            <button type="submit" className="rounded-lg bg-[#6b1a2a] px-5 py-2 text-sm font-medium text-white hover:bg-[#8b2234] transition-colors focus:outline-none focus:ring-2 focus:ring-[#6b1a2a] focus:ring-offset-2">
              Submit Expense
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
