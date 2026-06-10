import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requestDisbursement } from "./actions";

const STATUS_STYLES: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-700",
  approved:  "bg-blue-100 text-blue-700",
  rejected:  "bg-red-100 text-red-700",
  processed: "bg-green-100 text-green-700",
};

const STATUS_LABELS: Record<string, string> = {
  pending:   "Pending",
  approved:  "Approved",
  rejected:  "Rejected",
  processed: "Processed",
};

const CURRENCIES = ["ZiG", "USD", "ZAR", "EUR", "GBP"];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-ZA", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function fmt(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
}

type DisbursementRequest = {
  id: string;
  amount: number;
  currency_code: string;
  milestone_id: string | null;
  justification: string;
  status: string;
  review_notes: string | null;
  reviewed_at: string | null;
  processed_at: string | null;
  created_at: string;
  milestones: { title: string } | null;
};

export default async function DisbursementsPage({
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

  // Fetch milestones for the dropdown
  const { data: rawMilestones } = await supabase
    .from("milestones")
    .select("id, title")
    .eq("grant_id", grant.id)
    .order("due_date", { ascending: true });
  const milestones = rawMilestones ?? [];

  const { data: rawRequests } = await supabase
    .from("disbursement_requests")
    .select(
      "id, amount, currency_code, milestone_id, justification, status, review_notes, reviewed_at, processed_at, created_at, milestones(title)"
    )
    .eq("grant_id", grant.id)
    .order("created_at", { ascending: false });
  const requests: DisbursementRequest[] = (rawRequests ?? []) as unknown as DisbursementRequest[];

  const pending = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Disbursement Requests</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Request fund transfers for{" "}
          <span className="font-medium text-gray-700">{grant.title}</span>
        </p>
      </div>

      {/* Banner feedback */}
      {saved && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Your disbursement request has been submitted and is pending review.
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}

      {/* Existing requests */}
      <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Your Requests</h2>
          {pending > 0 && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              {pending} pending
            </span>
          )}
        </div>

        {requests.length === 0 ? (
          <p className="px-6 py-8 text-sm text-gray-400 text-center">
            No disbursement requests yet. Submit one below.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {requests.map((req) => (
              <li key={req.id} className="px-6 py-4 space-y-1.5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">
                      {fmt(req.amount, req.currency_code)}
                    </p>
                    {req.milestones && (
                      <p className="text-xs text-blue-600 mt-0.5">
                        📌 {req.milestones.title}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      Submitted {fmtDate(req.created_at)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      STATUS_STYLES[req.status] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {STATUS_LABELS[req.status] ?? req.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{req.justification}</p>
                {req.review_notes && (
                  <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-600">
                    <span className="font-medium text-gray-700">Reviewer note: </span>
                    {req.review_notes}
                  </div>
                )}
                {req.processed_at && (
                  <p className="text-xs text-green-600">
                    ✓ Processed on {fmtDate(req.processed_at)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* New request form */}
      <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">New Request</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Provide the amount needed and the reason for this disbursement.
          </p>
        </div>
        <form action={requestDisbursement} className="px-6 py-5 space-y-4">
          {/* Amount + currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Amount requested <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="amount"
                min="0.01"
                step="0.01"
                required
                placeholder="0.00"
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Currency <span className="text-red-500">*</span>
              </label>
              <select
                name="currency_code"
                defaultValue={grant.currency_code ?? "ZiG"}
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a]"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Milestone (optional) */}
          {milestones.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Link to milestone <span className="text-gray-400">(optional)</span>
              </label>
              <select
                name="milestone_id"
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a]"
              >
                <option value="">— not linked to a milestone —</option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* Justification */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Justification <span className="text-red-500">*</span>
            </label>
            <textarea
              name="justification"
              required
              minLength={10}
              maxLength={2000}
              rows={4}
              placeholder="Describe what these funds will be used for and why they are needed now…"
              className="w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a] resize-y"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-md bg-[#6b1a2a] px-5 py-2 text-sm font-medium text-white hover:bg-[#8b2234] transition-colors"
            >
              Submit Request
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
