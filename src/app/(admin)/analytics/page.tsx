import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

// -- Formatting -------------------------------------------------------------

function fmtMoney(n: number, currency = "USD") {
  if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${currency} ${(n / 1_000).toFixed(0)}k`;
  return `${currency} ${n.toLocaleString("en-ZA", { minimumFractionDigits: 0 })}`;
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toLocaleString();
}

// -- SVG Primitives --------------------------------------------------------

function MiniSparkBar({ data, color = "#ffffff" }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  const W = 52;
  const H = 26;
  const bw = Math.floor(W / data.length) - 1;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {data.map((v, i) => {
        const h = Math.max(2, (v / max) * H);
        const alpha = 0.25 + (i / Math.max(data.length - 1, 1)) * 0.75;
        return (
          <rect
            key={i}
            x={i * (bw + 1)}
            y={H - h}
            width={bw}
            height={h}
            rx={1.5}
            fill={color}
            fillOpacity={alpha}
          />
        );
      })}
    </svg>
  );
}

function DonutRing({
  pct,
  size = 148,
  strokeWidth = 13,
  color = "#6b1a2a",
}: {
  pct: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const cx = size / 2;
  const r = cx - strokeWidth / 2 - 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, Math.max(0, pct)) / 100) * circ;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="-rotate-90"
    >
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#f3f4f6" strokeWidth={strokeWidth} />
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}

function Card({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.04)] ${className}`} style={style}>
      {children}
    </div>
  );
}

// -- Types -----------------------------------------------------------------

type AwardeeRef = { id: string; full_name: string; awardee_type: string };
type GrantFull = {
  id: string;
  title: string;
  status: string;
  amount_awarded: number;
  currency_code: string;
  start_date: string;
  end_date: string;
  programme_id: string | null;
  awardees: AwardeeRef | null;
};

type MilestoneRow  = { id: string; status: string; due_date: string; grant_id: string };
type ExpenseRow    = { id: string; amount: number; category: string; status: string; grant_id: string };
type DisbRow       = { id: string; amount: number; disbursement_date: string; grant_id: string };
type AwardeeRow    = { id: string; awardee_type: string };
type ProgrammeRow  = { id: string; name: string };
type ReportRow     = { id: string; status: string; due_date: string; submitted_at: string | null; grant_id: string };

// -- Page ------------------------------------------------------------------

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const today = new Date();

  const [
    grantsRes, milestonesRes, expensesRes, disbRes,
    awardeesRes, programmesRes, reportsRes, pendDisbReqRes,
  ] = await Promise.all([
    supabase
      .from("grants")
      .select("id, title, status, amount_awarded, currency_code, start_date, end_date, programme_id, awardees(id, full_name, awardee_type)"),
    supabase.from("milestones").select("id, status, due_date, grant_id"),
    supabase.from("expenses").select("id, amount, category, status, grant_id"),
    supabase.from("disbursements").select("id, amount, disbursement_date, grant_id").order("disbursement_date"),
    supabase.from("awardees").select("id, awardee_type"),
    supabase.from("programmes").select("id, name"),
    supabase.from("grant_reports").select("id, status, due_date, submitted_at, grant_id"),
    supabase.from("disbursement_requests").select("id, status, grant_id").eq("status", "pending"),
  ]);

  const grants        = (grantsRes.data ?? [])     as unknown as GrantFull[];
  const milestones    = (milestonesRes.data ?? [])  as unknown as MilestoneRow[];
  const expenses      = (expensesRes.data ?? [])     as unknown as ExpenseRow[];
  const disbursements = (disbRes.data ?? [])         as unknown as DisbRow[];
  const awardees      = (awardeesRes.data ?? [])     as unknown as AwardeeRow[];
  const programmes    = (programmesRes.data ?? [])   as unknown as ProgrammeRow[];
  const reports       = (reportsRes.data ?? [])      as unknown as ReportRow[];
  const pendingDisbReqs = pendDisbReqRes.data ?? [];

  // -- Portfolio totals -----------------------------------------------------
  const activeGrants   = grants.filter((g) => g.status === "active");
  const totalAwarded   = grants.reduce((s, g) => s + Number(g.amount_awarded), 0);
  const totalDisbursed = disbursements.reduce((s, d) => s + Number(d.amount), 0);
  const deployedPct    = totalAwarded > 0 ? Math.round((totalDisbursed / totalAwarded) * 100) : 0;
  const avgGrantSize   = grants.length > 0 ? Math.round(totalAwarded / grants.length) : 0;

  const currencyCounts: Record<string, number> = {};
  for (const g of grants) currencyCounts[g.currency_code] = (currencyCounts[g.currency_code] ?? 0) + 1;
  const dominantCurrency = Object.entries(currencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "USD";

  // -- Milestone metrics (scoped to active grants only for accurate completion rate) ----
  const activeGrantIds = new Set(activeGrants.map((g) => g.id));
  const activeMilestones = milestones.filter((m) => activeGrantIds.has(m.grant_id));
  const msTotal     = activeMilestones.length;
  const msCompleted = activeMilestones.filter((m) => m.status === "completed").length;
  const msDelayed   = activeMilestones.filter((m) => m.status === "delayed").length;
  const msOverdue   = activeMilestones.filter((m) => m.status !== "completed" && new Date(m.due_date) < today).length;
  const msOnTrack   = activeMilestones.filter((m) => m.status !== "completed" && m.status !== "delayed" && new Date(m.due_date) >= today).length;
  const msRate      = msTotal > 0 ? Math.round((msCompleted / msTotal) * 100) : 0;
  const ringColor   = msRate >= 70 ? "#16a34a" : msRate >= 35 ? "#d97706" : "#dc2626";

  // -- Report compliance (submitted + under_review + approved = compliant) --
  const dueReports       = reports.filter((r) => new Date(r.due_date) < today);
  const submittedReports = dueReports.filter((r) => ["submitted", "under_review", "approved"].includes(r.status));
  const complianceRate   = dueReports.length > 0 ? Math.round((submittedReports.length / dueReports.length) * 100) : null;

  // -- Disbursement trend (last 6 months) -----------------------------------
  const monthKeys: string[] = [];
  const monthTotals: Record<string, number> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthKeys.push(k);
    monthTotals[k] = 0;
  }
  for (const d of disbursements) {
    const k = d.disbursement_date.slice(0, 7);
    if (k in monthTotals) monthTotals[k] += Number(d.amount);
  }
  const monthEntries = monthKeys.map((k) => ({ key: k, total: monthTotals[k] }));
  const maxMonth     = Math.max(...monthEntries.map((m) => m.total), 1);
  const sparkData    = monthEntries.map((m) => m.total);

  // -- Avg days to first disbursement --------------------------------------
  const daysArr = grants
    .filter((g) => ["active", "completed"].includes(g.status))
    .map((g) => {
      const gd = disbursements.filter((d) => d.grant_id === g.id);
      if (!gd.length) return null;
      const first = gd.reduce((min, d) =>
        new Date(d.disbursement_date) < new Date(min.disbursement_date) ? d : min
      );
      const diff = Math.ceil(
        (new Date(first.disbursement_date).getTime() - new Date(g.start_date).getTime()) / 86400000
      );
      return diff >= 0 ? diff : null;
    })
    .filter((d): d is number => d !== null);
  const avgDaysToDisb = daysArr.length > 0
    ? Math.round(daysArr.reduce((s, d) => s + d, 0) / daysArr.length)
    : null;

  // -- Expense breakdown ----------------------------------------------------
  const approvedExp   = expenses.filter((e) => e.status === "approved");
  const totalExpensed = approvedExp.reduce((s, e) => s + Number(e.amount), 0);
  const expByCategory: Record<string, number> = {};
  for (const e of approvedExp) expByCategory[e.category] = (expByCategory[e.category] ?? 0) + Number(e.amount);
  const categoryEntries = Object.entries(expByCategory).sort((a, b) => b[1] - a[1]);
  const maxCategory     = categoryEntries[0]?.[1] ?? 1;

  // -- Awardee type breakdown ------------------------------------------------
  const awardeeTypes = { individual: 0, team: 0, organization: 0 };
  for (const a of awardees) {
    if (a.awardee_type in awardeeTypes)
      awardeeTypes[a.awardee_type as keyof typeof awardeeTypes]++;
  }

  // -- Programme performance ------------------------------------------------
  const progMap: Record<string, { name: string; gs: GrantFull[] }> = {};
  for (const p of programmes) progMap[p.id] = { name: p.name, gs: [] };
  const uncategorized: GrantFull[] = [];
  for (const g of grants) {
    if (g.programme_id && progMap[g.programme_id]) progMap[g.programme_id].gs.push(g);
    else uncategorized.push(g);
  }
  if (uncategorized.length > 0) progMap["__none__"] = { name: "Uncategorized", gs: uncategorized };

  const progRows = Object.entries(progMap)
    .filter(([, { gs }]) => gs.length > 0)
    .map(([id, { name, gs }]) => {
      const awarded   = gs.reduce((s, g) => s + Number(g.amount_awarded), 0);
      const disbursed = gs.reduce(
        (s, g) => s + disbursements.filter((d) => d.grant_id === g.id).reduce((ss, d) => ss + Number(d.amount), 0),
        0
      );
      const grantIds = new Set(gs.map((g) => g.id));
      const ms       = milestones.filter((m) => grantIds.has(m.grant_id));
      const msComp   = ms.filter((m) => m.status === "completed").length;
      const msPct    = ms.length > 0 ? Math.round((msComp / ms.length) * 100) : 0;
      const deplPct  = awarded > 0 ? Math.round((disbursed / awarded) * 100) : 0;
      return { id, name, grantCount: gs.length, awarded, disbursed, deplPct, msPct };
    })
    .sort((a, b) => b.awarded - a.awarded);

  // -- Top performers --------------------------------------------------------
  const performers = activeGrants
    .map((g) => {
      const ms   = milestones.filter((m) => m.grant_id === g.id);
      const comp = ms.filter((m) => m.status === "completed").length;
      const pct  = ms.length > 0 ? Math.round((comp / ms.length) * 100) : 0;
      return { grant: g, pct, comp, total: ms.length, awardee: g.awardees };
    })
    .sort((a, b) => b.pct - a.pct || b.comp - a.comp)
    .slice(0, 4);

  // -- Alerts ----------------------------------------------------------------
  const nearingEnd = grants
    .filter((g) => {
      if (g.status !== "active") return false;
      const days = Math.ceil((new Date(g.end_date).getTime() - today.getTime()) / 86400000);
      return days >= 0 && days <= 60;
    })
    .sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime());

  const pendingExpCount  = expenses.filter((e) => e.status === "pending").length;
  const pendingDisbCount = pendingDisbReqs.length;
  const totalAlertItems  =
    nearingEnd.length + (msOverdue > 0 ? 1 : 0) + (pendingDisbCount > 0 ? 1 : 0) + (pendingExpCount > 0 ? 1 : 0);

  // -- Grant pipeline --------------------------------------------------------
  const statusGroups: Record<string, number> = { active: 0, completed: 0, suspended: 0, cancelled: 0 };
  for (const g of grants) if (g.status in statusGroups) statusGroups[g.status]++;

  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">Portfolio-wide performance intelligence</p>
        </div>
        <span className="text-xs text-gray-400 rounded-xl border border-gray-200 bg-white px-3 py-1.5 shadow-sm">
          {today.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
        </span>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">

        {/* Hero — Portfolio Deployed */}
        <div
          className="col-span-2 sm:col-span-1 rounded-2xl p-5 flex flex-col justify-between"
          style={{ background: "linear-gradient(145deg,#6b1a2a 0%,#3d0f19 100%)", minHeight: "116px" }}
        >
          <div className="flex items-start justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50">Portfolio Deployed</p>
            <MiniSparkBar data={sparkData} color="#ffffff" />
          </div>
          <div>
            <p className="text-[2.6rem] font-black leading-none text-white">{deployedPct}%</p>
            <p className="text-[11px] text-white/40 mt-1">
              {fmtMoney(totalDisbursed, dominantCurrency)} of {fmtMoney(totalAwarded, dominantCurrency)}
            </p>
          </div>
        </div>

        {/* Active Grants */}
        <Card className="p-5 flex flex-col justify-between min-h-[116px]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">Active Grants</p>
          <div>
            <p className="text-[2.2rem] font-black leading-none text-gray-900">{activeGrants.length}</p>
            <p className="text-xs text-gray-400 mt-1">of {grants.length} total</p>
          </div>
        </Card>

        {/* Milestone Rate */}
        <Card className="p-5 flex flex-col justify-between min-h-[116px]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">Milestone Rate</p>
          <div>
            <p
              className="text-[2.2rem] font-black leading-none"
              style={{ color: msRate >= 70 ? "#16a34a" : msRate >= 35 ? "#d97706" : "#dc2626" }}
            >
              {msRate}%
            </p>
            <p className="text-xs text-gray-400 mt-1">{msCompleted}/{msTotal} complete</p>
          </div>
        </Card>

        {/* Report Compliance */}
        <Card className="p-5 flex flex-col justify-between min-h-[116px]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">Report Compliance</p>
          <div>
            <p className="text-[2.2rem] font-black leading-none text-gray-900">
              {complianceRate !== null ? `${complianceRate}%` : "—"}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {dueReports.length > 0 ? `${submittedReports.length}/${dueReports.length} due` : "No reports due"}
            </p>
          </div>
        </Card>

        {/* Avg Days to Disburse */}
        <Card className="p-5 flex flex-col justify-between min-h-[116px]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">Avg Days to Disburse</p>
          <div>
            <p className="text-[2.2rem] font-black leading-none text-gray-900">
              {avgDaysToDisb !== null ? avgDaysToDisb : "—"}
            </p>
            <p className="text-xs text-gray-400 mt-1">days from grant start</p>
          </div>
        </Card>
      </div>

      {/* Disbursement Trend + Milestone Ring */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Disbursement Trend */}
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Disbursement Trend</h2>
              <p className="text-xs text-gray-400 mt-0.5">Last 6 months · {dominantCurrency}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-gray-900">{fmtMoney(totalDisbursed, dominantCurrency)}</p>
              <p className="text-xs text-gray-400 mt-0.5">total disbursed</p>
            </div>
          </div>
          <div className="flex items-end gap-2" style={{ height: "160px" }}>
            {monthEntries.map(({ key, total }, idx) => {
              const hPct = (total / maxMonth) * 100;
              const [yr, mon] = key.split("-");
              const label = new Date(Number(yr), Number(mon) - 1).toLocaleString("default", { month: "short" });
              const isCurrent = idx === monthEntries.length - 1;
              return (
                <div key={key} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-[10px] text-gray-400">{total > 0 ? fmtNum(total) : ""}</span>
                  <div className="w-full flex items-end" style={{ height: "118px" }}>
                    <div
                      className="w-full rounded-t-lg"
                      style={{
                        height: `${Math.max(hPct, total > 0 ? 6 : 2)}%`,
                        backgroundColor: isCurrent ? "#6b1a2a" : "#c9a0ab",
                        opacity: isCurrent ? 1 : 0.75,
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-gray-500">{label}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Milestone Health Ring */}
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-5">Milestone Health</h2>
          <div className="flex flex-col items-center">
            <div className="relative" style={{ width: 148, height: 148 }}>
              <DonutRing pct={msRate} size={148} strokeWidth={13} color={ringColor} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-gray-900">{msRate}%</span>
                <span className="text-[10px] text-gray-400 mt-0.5">complete</span>
              </div>
            </div>
            <div className="w-full mt-5 space-y-2.5">
              {[
                { label: "Completed", count: msCompleted, color: "#16a34a" },
                { label: "On Track",  count: msOnTrack,   color: "#2563eb" },
                { label: "Delayed",   count: msDelayed,   color: "#d97706" },
                { label: "Overdue",   count: msOverdue,   color: "#dc2626" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-gray-600">{item.label}</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-900">{item.count}</span>
                </div>
              ))}
              <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">Total milestones</span>
                <span className="text-xs font-bold text-gray-900">{msTotal}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Programme Performance */}
      {progRows.length > 0 && (
        <Card className="p-6">
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-gray-900">Programme Performance</h2>
            <p className="text-xs text-gray-400 mt-0.5">Comparative view across all programmes</p>
          </div>
          <div className="overflow-x-auto -mx-6">
            <div className="inline-block min-w-full px-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-3 text-left text-xs font-medium text-gray-400">Programme</th>
                    <th className="pb-3 text-right text-xs font-medium text-gray-400">Grants</th>
                    <th className="pb-3 text-right text-xs font-medium text-gray-400">Awarded</th>
                    <th className="pb-3 text-right text-xs font-medium text-gray-400 pr-6">Deployed</th>
                    <th className="pb-3 text-right text-xs font-medium text-gray-400">Milestone Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {progRows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3.5 font-medium text-gray-900 pr-8">{row.name}</td>
                      <td className="py-3.5 text-right text-gray-500">{row.grantCount}</td>
                      <td className="py-3.5 text-right text-gray-900 whitespace-nowrap">
                        {fmtMoney(row.awarded, dominantCurrency)}
                      </td>
                      <td className="py-3.5 pr-6">
                        <div className="flex items-center gap-2 justify-end">
                          <div className="w-24 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${row.deplPct}%`,
                                backgroundColor: row.deplPct >= 85 ? "#dc2626" : row.deplPct >= 50 ? "#d97706" : "#6b1a2a",
                              }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-gray-700 w-8 text-right">{row.deplPct}%</span>
                        </div>
                      </td>
                      <td className="py-3.5">
                        <div className="flex items-center gap-2 justify-end">
                          <div className="w-24 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${row.msPct}%`,
                                backgroundColor: row.msPct >= 70 ? "#16a34a" : row.msPct >= 35 ? "#d97706" : "#dc2626",
                              }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-gray-700 w-8 text-right">{row.msPct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* Grant Pipeline + Awardee Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Grant Pipeline */}
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-5">Grant Pipeline by Status</h2>
          <div className="space-y-4">
            {[
              { status: "active",    label: "Active",    bar: "#16a34a", bg: "#dcfce7", fg: "#15803d" },
              { status: "completed", label: "Completed", bar: "#2563eb", bg: "#dbeafe", fg: "#1d4ed8" },
              { status: "suspended", label: "Suspended", bar: "#d97706", bg: "#fef3c7", fg: "#b45309" },
              { status: "cancelled", label: "Cancelled", bar: "#dc2626", bg: "#fee2e2", fg: "#b91c1c" },
            ].map(({ status, label, bar, bg, fg }) => {
              const count = statusGroups[status] ?? 0;
              const pct   = grants.length > 0 ? (count / grants.length) * 100 : 0;
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{ backgroundColor: bg, color: fg }}
                    >
                      {label}
                    </span>
                    <span className="text-xs text-gray-500">
                      {count} grant{count !== 1 ? "s" : ""} &middot; {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: bar }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 pt-5 border-t border-gray-100 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wide">Total</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{grants.length}</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wide">Awardees</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{awardees.length}</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wide">Avg Size</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{fmtMoney(avgGrantSize, dominantCurrency)}</p>
            </div>
          </div>
        </Card>

        {/* Awardee Breakdown */}
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-5">Awardee Breakdown</h2>
          <div className="space-y-4 mb-6">
            {[
              { key: "individual",   label: "Individual",   color: "#6b1a2a" },
              { key: "team",         label: "Team",         color: "#2563eb" },
              { key: "organization", label: "Organization", color: "#7c3aed" },
            ].map(({ key, label, color }) => {
              const count = awardeeTypes[key as keyof typeof awardeeTypes];
              const pct   = awardees.length > 0 ? (count / awardees.length) * 100 : 0;
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-sm text-gray-700">{label}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {count}
                      <span className="text-xs font-normal text-gray-400 ml-1">({pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="pt-5 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400">Expense Accountability</p>
              <span className="text-sm font-bold text-gray-900">
                {totalDisbursed > 0 ? `${Math.round((totalExpensed / totalDisbursed) * 100)}%` : "—"}
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500"
                style={{ width: `${totalDisbursed > 0 ? Math.min(100, (totalExpensed / totalDisbursed) * 100) : 0}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {fmtMoney(totalExpensed, dominantCurrency)} approved of {fmtMoney(totalDisbursed, dominantCurrency)} disbursed
            </p>
          </div>
        </Card>
      </div>

      {/* Expenses by Category + Top Performers */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Expense Categories */}
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-5">Approved Expenses by Category</h2>
          {categoryEntries.length === 0 ? (
            <p className="text-sm text-gray-400">No approved expenses yet.</p>
          ) : (
            <div className="space-y-3.5">
              {categoryEntries.slice(0, 7).map(([cat, total], idx) => {
                const pct      = (total / maxCategory) * 100;
                const ofTotal  = totalExpensed > 0 ? Math.round((total / totalExpensed) * 100) : 0;
                const alpha    = Math.max(0.2, 1 - idx * 0.13);
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-gray-700 max-w-[180px] truncate">{cat}</span>
                      <div className="flex items-center gap-2.5">
                        <span className="text-[11px] text-gray-400">{ofTotal}%</span>
                        <span className="text-xs font-semibold text-gray-900 whitespace-nowrap">
                          {fmtMoney(total, dominantCurrency)}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: `rgba(107,26,42,${alpha})` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Top Performers */}
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-5">Top Performing Grants</h2>
          {performers.length === 0 ? (
            <p className="text-sm text-gray-400">No active grants with milestones yet.</p>
          ) : (
            <div className="space-y-5">
              {performers.map((p, rank) => {
                const rankBg = (["#6b1a2a", "#374151", "#6b7280", "#d1d5db"] as const)[rank] ?? "#d1d5db";
                const rankFg = rank < 3 ? "#ffffff" : "#6b7280";
                const barColor = p.pct >= 70 ? "#16a34a" : p.pct >= 35 ? "#d97706" : "#dc2626";
                return (
                  <div key={p.grant.id} className="flex items-start gap-3">
                    <span
                      className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ backgroundColor: rankBg, color: rankFg }}
                    >
                      {rank + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-sm font-semibold text-gray-900 truncate pr-2">{p.grant.title}</p>
                        <span className="text-sm font-bold whitespace-nowrap" style={{ color: barColor }}>{p.pct}%</span>
                      </div>
                      <p className="text-xs text-gray-400 mb-2">
                        {p.awardee?.full_name ?? "—"} &middot; {p.comp}/{p.total} milestones
                      </p>
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${p.pct}%`, backgroundColor: barColor }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Alerts & Action Items */}
      {totalAlertItems > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <h2 className="text-sm font-semibold text-gray-900">Alerts &amp; Action Items</h2>
            <span className="ml-auto rounded-full bg-red-50 border border-red-100 px-2.5 py-0.5 text-xs font-bold text-red-600">
              {totalAlertItems} item{totalAlertItems !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pendingDisbCount > 0 && (
              <Link
                href="/finances"
                className="group flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3.5 hover:bg-blue-100 transition-colors"
              >
                <span className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center text-sm transition-colors">
                  ??
                </span>
                <div>
                  <p className="text-sm font-semibold text-blue-900">
                    {pendingDisbCount} Disbursement Request{pendingDisbCount !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-blue-600 mt-0.5">Awaiting approval · Finances</p>
                </div>
              </Link>
            )}
            {pendingExpCount > 0 && (
              <Link
                href="/finances"
                className="group flex items-start gap-3 rounded-xl border border-yellow-100 bg-yellow-50 px-4 py-3.5 hover:bg-yellow-100 transition-colors"
              >
                <span className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-yellow-100 group-hover:bg-yellow-200 flex items-center justify-center text-sm transition-colors">
                  ??
                </span>
                <div>
                  <p className="text-sm font-semibold text-yellow-900">
                    {pendingExpCount} Pending Expense{pendingExpCount !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-yellow-600 mt-0.5">Awaiting review · Finances</p>
                </div>
              </Link>
            )}
            {msOverdue > 0 && (
              <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3.5">
                <span className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-sm">
                  ?
                </span>
                <div>
                  <p className="text-sm font-semibold text-red-900">
                    {msOverdue} Overdue Milestone{msOverdue !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-red-600 mt-0.5">Past due date, not yet completed</p>
                </div>
              </div>
            )}
            {nearingEnd.map((g) => {
              const days = Math.ceil((new Date(g.end_date).getTime() - today.getTime()) / 86400000);
              const awardeeData = g.awardees as { id: string; full_name: string } | null;
              return (
                <Link
                  key={g.id}
                  href={`/awardees/${awardeeData?.id ?? ""}/finances`}
                  className="group flex items-start gap-3 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3.5 hover:bg-orange-100 transition-colors"
                >
                  <span className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-orange-100 group-hover:bg-orange-200 flex items-center justify-center text-sm transition-colors">
                    ??
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-orange-900 truncate">{g.title}</p>
                    <p className="text-xs text-orange-600 mt-0.5">
                      {awardeeData?.full_name ?? "—"} &middot; {days}d left &middot;{" "}
                      {new Date(g.end_date).toLocaleDateString("en-ZA")}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      )}

    </div>
  );
}
