import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

type GrantRow = {
  id: string;
  title: string;
  status: string;
  amount_awarded: number;
  currency_code: string;
  start_date: string;
  end_date: string;
  awardees: { full_name: string } | null;
};

type ExpenseRow = {
  amount: number;
  category: string;
  status: string;
};

type DisbursementRow = {
  amount: number;
  disbursement_date: string;
};

type MilestoneRow = {
  status: string;
  due_date: string;
};

function ProgressBar({ value, color = "blue" }: { value: number; color?: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-500",
    green: "bg-green-500",
    yellow: "bg-yellow-400",
    red: "bg-red-500",
  };
  return (
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div
        className={`h-2 rounded-full ${colorMap[color] ?? "bg-blue-500"} transition-all`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const [grantsRes, milestonesRes, expensesRes, disbursementsRes, awardeesRes] =
    await Promise.all([
      supabase
        .from("grants")
        .select("id, title, status, amount_awarded, currency_code, start_date, end_date, awardees(full_name)"),
      supabase.from("milestones").select("status, due_date"),
      supabase.from("expenses").select("amount, category, status"),
      supabase.from("disbursements").select("amount, disbursement_date"),
      supabase.from("awardees").select("id", { count: "exact", head: true }),
    ]);

  const grants = (grantsRes.data ?? []) as unknown as GrantRow[];
  const milestones = (milestonesRes.data ?? []) as MilestoneRow[];
  const expenses = (expensesRes.data ?? []) as ExpenseRow[];
  const disbursements = (disbursementsRes.data ?? []) as DisbursementRow[];
  const totalAwardees = awardeesRes.count ?? 0;

  // ── Grant pipeline ────────────────────────────────────────────────
  const grantsByStatus: Record<string, number> = {};
  for (const g of grants) {
    grantsByStatus[g.status] = (grantsByStatus[g.status] ?? 0) + 1;
  }
  const statusOrder = ["active", "completed", "suspended", "cancelled"];
  const statusLabels: Record<string, string> = {
    active: "Active",
    completed: "Completed",
    suspended: "Suspended",
    cancelled: "Cancelled",
  };
  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    completed: "bg-blue-100 text-blue-700",
    suspended: "bg-yellow-100 text-yellow-700",
    cancelled: "bg-red-100 text-red-700",
  };

  // ── Financial totals ──────────────────────────────────────────────
  const totalAwarded = grants.reduce((s, g) => s + Number(g.amount_awarded), 0);
  const totalDisbursed = disbursements.reduce((s, d) => s + Number(d.amount), 0);
  const totalExpensed = expenses
    .filter((e) => e.status === "approved")
    .reduce((s, e) => s + Number(e.amount), 0);
  const pendingExpenses = expenses
    .filter((e) => e.status === "pending")
    .reduce((s, e) => s + Number(e.amount), 0);
  const disbursementRate = totalAwarded > 0 ? (totalDisbursed / totalAwarded) * 100 : 0;

  // ── Expense breakdown by category ─────────────────────────────────
  const expenseByCategory: Record<string, number> = {};
  for (const e of expenses.filter((e) => e.status === "approved")) {
    expenseByCategory[e.category] = (expenseByCategory[e.category] ?? 0) + Number(e.amount);
  }
  const categoryEntries = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]);
  const maxCategory = categoryEntries[0]?.[1] ?? 1;

  // ── Milestone summary ─────────────────────────────────────────────
  const today = new Date();
  const msTotal = milestones.length;
  const msCompleted = milestones.filter((m) => m.status === "completed").length;
  const msDelayed = milestones.filter((m) => m.status === "delayed").length;
  const msOverdue = milestones.filter(
    (m) => m.status !== "completed" && new Date(m.due_date) < today
  ).length;
  const msCompletionRate = msTotal > 0 ? Math.round((msCompleted / msTotal) * 100) : 0;

  // ── Disbursement trend (last 6 months) ───────────────────────────
  const monthTotals: Record<string, number> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthTotals[key] = 0;
  }
  for (const d of disbursements) {
    const key = d.disbursement_date.slice(0, 7);
    if (key in monthTotals) monthTotals[key] += Number(d.amount);
  }
  const monthEntries = Object.entries(monthTotals);
  const maxMonthValue = Math.max(...monthEntries.map(([, v]) => v), 1);

  // ── Grants nearing end (within 60 days) ──────────────────────────
  const nearingEnd = grants
    .filter((g) => {
      if (g.status !== "active") return false;
      const end = new Date(g.end_date);
      const days = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return days >= 0 && days <= 60;
    })
    .sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime());

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Portfolio-wide performance metrics</p>
      </div>

      {/* ── Top KPI cards ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Awardees", value: totalAwardees, sub: `${grants.length} grants` },
          {
            label: "Total Awarded",
            value: `$${(totalAwarded / 1000).toFixed(0)}k`,
            sub: "across all grants",
          },
          {
            label: "Disbursed",
            value: `${disbursementRate.toFixed(0)}%`,
            sub: `$${(totalDisbursed / 1000).toFixed(0)}k of $${(totalAwarded / 1000).toFixed(0)}k`,
          },
          {
            label: "Milestone Rate",
            value: `${msCompletionRate}%`,
            sub: `${msCompleted}/${msTotal} completed`,
          },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{card.label}</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{card.value}</p>
            <p className="mt-1 text-xs text-gray-400">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── Grant pipeline ── */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Grant Pipeline by Status</h2>
          <div className="space-y-3">
            {statusOrder.map((status) => {
              const count = grantsByStatus[status] ?? 0;
              const pct = grants.length > 0 ? (count / grants.length) * 100 : 0;
              return (
                <div key={status}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={`px-2 py-0.5 rounded-full font-medium ${statusColors[status]}`}>
                      {statusLabels[status]}
                    </span>
                    <span className="text-gray-500">
                      {count} grant{count !== 1 ? "s" : ""} ({pct.toFixed(0)}%)
                    </span>
                  </div>
                  <ProgressBar
                    value={pct}
                    color={
                      status === "active"
                        ? "green"
                        : status === "completed"
                        ? "blue"
                        : status === "suspended"
                        ? "yellow"
                        : "red"
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Milestone health ── */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Milestone Health</h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: "Completed", value: msCompleted, color: "text-green-600" },
              { label: "Delayed", value: msDelayed, color: "text-red-600" },
              { label: "Overdue (not completed)", value: msOverdue, color: "text-orange-600" },
              { label: "Total", value: msTotal, color: "text-gray-700" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className={`text-2xl font-bold mt-1 ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Completion rate</span>
              <span>{msCompletionRate}%</span>
            </div>
            <ProgressBar value={msCompletionRate} color="green" />
          </div>
        </div>

        {/* ── Financial summary ── */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Financial Overview</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Disbursed vs Awarded</span>
                <span>${totalDisbursed.toLocaleString()} / ${totalAwarded.toLocaleString()}</span>
              </div>
              <ProgressBar value={disbursementRate} color="blue" />
            </div>
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Expenses (approved) vs Disbursed</span>
                <span>
                  ${totalExpensed.toLocaleString()} /{" "}
                  ${totalDisbursed.toLocaleString()}
                </span>
              </div>
              <ProgressBar
                value={totalDisbursed > 0 ? (totalExpensed / totalDisbursed) * 100 : 0}
                color="green"
              />
            </div>
            {pendingExpenses > 0 && (
              <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-800">
                <span className="font-medium">${pendingExpenses.toLocaleString()}</span> in expenses
                awaiting review.{" "}
                <Link href="/finances" className="underline">
                  Review →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ── Expense breakdown by category ── */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            Approved Expenses by Category
          </h2>
          {categoryEntries.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No approved expenses yet.</p>
          ) : (
            <div className="space-y-2.5">
              {categoryEntries.slice(0, 8).map(([cat, total]) => (
                <div key={cat}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-700 capitalize">{cat}</span>
                    <span className="text-gray-500">${total.toLocaleString()}</span>
                  </div>
                  <ProgressBar value={(total / maxCategory) * 100} color="blue" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Disbursement trend (last 6 months) ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">
          Disbursements — Last 6 Months
        </h2>
        <div className="flex items-end gap-2 h-32">
          {monthEntries.map(([month, total]) => {
            const heightPct = (total / maxMonthValue) * 100;
            const [year, mon] = month.split("-");
            const label = new Date(Number(year), Number(mon) - 1).toLocaleString("default", {
              month: "short",
            });
            return (
              <div key={month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-gray-500">${(total / 1000).toFixed(0)}k</span>
                <div className="w-full flex items-end justify-center" style={{ height: "80px" }}>
                  <div
                    className="w-full bg-blue-500 rounded-t"
                    style={{ height: `${Math.max(heightPct, total > 0 ? 4 : 0)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400">{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Grants nearing end ── */}
      {nearingEnd.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-6">
          <h2 className="text-sm font-semibold text-orange-900 mb-3">
            ⚠ Grants Ending Within 60 Days ({nearingEnd.length})
          </h2>
          <div className="divide-y divide-orange-100">
            {nearingEnd.map((g) => {
              const awardeeData = g.awardees as unknown as { full_name: string } | null;
              const end = new Date(g.end_date);
              const days = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div key={g.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-orange-900">{g.title}</p>
                    <p className="text-xs text-orange-700">{awardeeData?.full_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-orange-800">{days}d left</p>
                    <p className="text-xs text-orange-600">{end.toLocaleDateString()}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
