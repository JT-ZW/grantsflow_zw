import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requestBudgetAmendment } from "./actions";

const STATUS_STYLES: Record<string, string> = {
  pending:  "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const TYPE_LABELS: Record<string, string> = {
  new_line:     "New Budget Line",
  reallocation: "Reallocation",
  increase:     "Budget Increase",
};

const TYPE_DESCRIPTIONS: Record<string, string> = {
  new_line:     "Add a new spending category that was not in the original budget",
  reallocation: "Move funds from one existing category to another",
  increase:     "Request additional funds above the original budget for a category",
};

const BUDGET_CATEGORIES = [
  "Personnel / Salaries",
  "Equipment & Materials",
  "Travel & Accommodation",
  "Research Activities",
  "Publishing & Dissemination",
  "Overheads",
  "Other",
];

const CURRENCIES = ["ZiG", "USD", "ZAR", "EUR", "GBP"];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-ZA", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function fmt(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
}

type Amendment = {
  id: string;
  request_type: string;
  status: string;
  category: string;
  amount: number;
  currency_code: string;
  from_category: string | null;
  justification: string;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
};

export default async function AmendmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { saved, error } = await searchParams;

  const { data: awardee } = await supabase
    .from("awardees")
    .select("id, full_name")
    .eq("user_id", user.id)
    .single();
  if (!awardee) redirect("/portal");

  const { data: grant } = await supabase
    .from("grants")
    .select("id, title, currency_code")
    .eq("awardee_id", awardee.id)
    .single();
  if (!grant) redirect("/portal");

  const { data: rawAmendments } = await supabase
    .from("budget_amendments")
    .select("id, request_type, status, category, amount, currency_code, from_category, justification, reviewed_at, review_notes, created_at")
    .eq("grant_id", grant.id)
    .order("created_at", { ascending: false });

  const amendments: Amendment[] = rawAmendments ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Budget Amendments</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Request changes to the approved budget for{" "}
          <span className="font-medium text-gray-700">{grant.title}</span>
        </p>
      </div>

      {/* Feedback banners */}
      {saved && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Your amendment request has been submitted and is pending review.
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {decodeURIComponent(error)}
        </div>
      )}

      {/* Existing requests */}
      {amendments.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="text-base font-semibold text-gray-900">Your Requests</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {amendments.map((a) => (
              <div key={a.id} className="px-6 py-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{a.category}</p>
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {TYPE_LABELS[a.request_type] ?? a.request_type}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[a.status] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {a.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {fmt(a.amount, a.currency_code)}
                      {a.from_category && ` · From: ${a.from_category}`}
                      {" · "}Submitted {fmtDate(a.created_at)}
                    </p>
                    <p className="mt-1.5 text-sm text-gray-600 italic">&ldquo;{a.justification}&rdquo;</p>
                    {a.review_notes && (
                      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                        <p className="text-xs font-medium text-amber-800 mb-0.5">Reviewer feedback</p>
                        <p className="text-xs text-amber-700 italic">{a.review_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {amendments.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-10 text-center">
          <p className="text-sm font-medium text-gray-500">No amendment requests yet</p>
          <p className="mt-1 text-xs text-gray-400">Use the form below to submit your first request.</p>
        </div>
      )}

      {/* New request form */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">New Amendment Request</h2>
          <p className="mt-0.5 text-sm text-gray-400">
            All requests are reviewed by the grants team before any budget changes are applied.
          </p>
        </div>
        <form action={requestBudgetAmendment} className="p-6 space-y-5">

          {/* Request type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Request Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(["new_line", "reallocation", "increase"] as const).map((type) => (
                <label
                  key={type}
                  className="relative flex cursor-pointer rounded-lg border border-gray-200 p-4 hover:border-[#6b1a2a]/40 has-[:checked]:border-[#6b1a2a] has-[:checked]:bg-[#fdf6f7] transition-colors"
                >
                  <input
                    type="radio"
                    name="request_type"
                    value={type}
                    required
                    className="sr-only"
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{TYPE_LABELS[type]}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{TYPE_DESCRIPTIONS[type]}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Target category */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                Target Category <span className="text-red-500">*</span>
              </label>
              <select
                id="category"
                name="category"
                required
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#6b1a2a] focus:outline-none focus:ring-1 focus:ring-[#6b1a2a]"
              >
                <option value="">— select category —</option>
                {BUDGET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Source category (reallocation only) */}
            <div>
              <label htmlFor="from_category" className="block text-sm font-medium text-gray-700 mb-1">
                Source Category
                <span className="ml-1 text-xs font-normal text-gray-400">(reallocation only)</span>
              </label>
              <select
                id="from_category"
                name="from_category"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#6b1a2a] focus:outline-none focus:ring-1 focus:ring-[#6b1a2a]"
              >
                <option value="">— not applicable —</option>
                {BUDGET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                Amount <span className="text-red-500">*</span>
              </label>
              <input
                id="amount"
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="e.g. 15000"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#6b1a2a] focus:outline-none focus:ring-1 focus:ring-[#6b1a2a]"
              />
            </div>

            {/* Currency */}
            <div>
              <label htmlFor="currency_code" className="block text-sm font-medium text-gray-700 mb-1">
                Currency <span className="text-red-500">*</span>
              </label>
              <select
                id="currency_code"
                name="currency_code"
                defaultValue={grant.currency_code}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#6b1a2a] focus:outline-none focus:ring-1 focus:ring-[#6b1a2a]"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Justification */}
          <div>
            <label htmlFor="justification" className="block text-sm font-medium text-gray-700 mb-1">
              Justification <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Explain why this budget change is necessary and how it supports the grant objectives.
            </p>
            <textarea
              id="justification"
              name="justification"
              rows={4}
              required
              minLength={10}
              placeholder="Describe the reason for this amendment request…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#6b1a2a] focus:outline-none focus:ring-1 focus:ring-[#6b1a2a] resize-y"
            />
          </div>

          <button
            type="submit"
            className="rounded-lg bg-[#6b1a2a] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#8b2234] transition-colors"
          >
            Submit Request
          </button>
        </form>
      </div>
    </div>
  );
}
