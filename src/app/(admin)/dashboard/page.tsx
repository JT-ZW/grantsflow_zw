import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

/* ─── helpers ────────────────────────────────────────────────────────────── */

function fmtMoney(n: number, currency = "ZiG"): string {
  if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${currency} ${(n / 1_000).toFixed(1)}k`;
  return `${currency} ${n.toLocaleString("en-ZA")}`;
}

function relDate(dateStr: string): string {
  const diff = Math.ceil(
    (new Date(dateStr).setHours(23, 59, 59, 999) - Date.now()) / 86_400_000
  );
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `in ${diff}d`;
}

function monthShort(d: Date): string {
  return d.toLocaleString("default", { month: "short" });
}

/* ─── shared card shell ──────────────────────────────────────────────────── */

function Card({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.04)] ${className}`} style={style}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-3">
      {children}
    </p>
  );
}

/* ─── icons ──────────────────────────────────────────────────────────────── */

type IconProps = { className?: string; style?: React.CSSProperties };

function IconUsers({ className = "h-4 w-4", style }: IconProps) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function IconBriefcase({ className = "h-4 w-4", style }: IconProps) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}
function IconCash({ className = "h-4 w-4", style }: IconProps) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
function IconClock({ className = "h-4 w-4", style }: IconProps) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function IconAlert({ className = "h-4 w-4", style }: IconProps) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}
function IconFlag({ className = "h-4 w-4", style }: IconProps) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
    </svg>
  );
}
function IconDoc({ className = "h-4 w-4", style }: IconProps) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
function IconShield({ className = "h-4 w-4", style }: IconProps) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}
function IconGlobe({ className = "h-4 w-4", style }: IconProps) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function IconChart({ className = "h-4 w-4", style }: IconProps) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}
function IconArrowUpRight() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

/* ─── page ───────────────────────────────────────────────────────────────── */

export default async function DashboardPage() {
  const supabase = await createClient();

  const today = new Date();
  const in30 = new Date(today);
  in30.setDate(in30.getDate() + 30);
  const todayStr = today.toISOString().split("T")[0];
  const in30Str = in30.toISOString().split("T")[0];

  const [
    awardeesRes,
    grantsRes,
    milestonesAllRes,
    disbursementsRes,
    disbRequestsRes,
    activityRes,
    upcomingMsRes,
    reportsRes,
    compDocsRes,
    programmesRes,
  ] = await Promise.all([
    supabase.from("awardees").select("*", { count: "exact", head: true }),
    supabase.from("grants").select(
      "id, title, amount_awarded, currency_code, status, programme_id, awardee_id, awardees(full_name), milestones(id, status)"
    ),
    supabase.from("milestones").select("id, status, due_date"),
    supabase.from("disbursements").select("amount, created_at"),
    supabase.from("disbursement_requests").select("id, amount, status, currency_code"),
    supabase
      .from("audit_logs")
      .select("id, action, entity_type, created_at, actor_id, profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("milestones")
      .select("id, title, due_date, status, grants(id, title, awardee_id)")
      .gte("due_date", todayStr)
      .lte("due_date", in30Str)
      .neq("status", "completed")
      .order("due_date")
      .limit(6),
    supabase.from("grant_reports").select("id, status, grant_id"),
    supabase.from("documents").select("id, expires_at, is_compliance").eq("is_compliance", true),
    supabase.from("programmes").select("id, name, total_budget, currency_code"),
  ]);

  /* ── data processing ──────────────────────────────────────────────────── */

  const awardeesCount = awardeesRes.count ?? 0;

  type GrantRow = {
    id: string; title: string; amount_awarded: number; currency_code: string;
    status: string; programme_id: string | null; awardee_id: string;
    awardees: { full_name: string } | null;
    milestones: { id: string; status: string }[];
  };
  const grants = (grantsRes.data ?? []) as unknown as GrantRow[];
  const activeGrants = grants.filter((g) => g.status === "active");
  const totalPortfolio = grants.reduce((s, g) => s + Number(g.amount_awarded ?? 0), 0);

  const disbursements = (disbursementsRes.data ?? []) as { amount: number; created_at: string }[];
  const totalDisbursed = disbursements.reduce((s, d) => s + Number(d.amount ?? 0), 0);
  const utilizationPct = totalPortfolio > 0 ? Math.round((totalDisbursed / totalPortfolio) * 100) : 0;

  type DisbReq = { id: string; amount: number; status: string; currency_code: string };
  const disbRequests = ((disbRequestsRes.error ? [] : disbRequestsRes.data) ?? []) as unknown as DisbReq[];
  const byDisbStatus = (s: string) => disbRequests.filter((r) => r.status === s);
  const disbSum = (reqs: DisbReq[]) => reqs.reduce((t, r) => t + Number(r.amount ?? 0), 0);

  const milestones = (milestonesAllRes.data ?? []) as { id: string; status: string; due_date: string }[];
  const totalMs = milestones.length;
  const completedMs = milestones.filter((m) => m.status === "completed").length;
  const delayedMs = milestones.filter((m) => m.status === "delayed").length;
  const inProgressMs = milestones.filter((m) => m.status === "in_progress").length;
  const notStartedMs = milestones.filter((m) => m.status === "not_started").length;
  const milestoneRate = totalMs > 0 ? Math.round((completedMs / totalMs) * 100) : 0;

  const reports = ((reportsRes.error ? [] : reportsRes.data) ?? []) as { id: string; status: string; grant_id: string }[];
  const pendingReports = reports.filter((r) => r.status === "submitted" || r.status === "under_review").length;

  const compDocs = ((compDocsRes.error ? [] : compDocsRes.data) ?? []) as { id: string; expires_at: string | null }[];
  const expiredDocs = compDocs.filter((d) => d.expires_at && new Date(d.expires_at) < today).length;
  const expiringSoonDocs = compDocs.filter((d) => {
    if (!d.expires_at) return false;
    const e = new Date(d.expires_at);
    return e >= today && e <= in30;
  }).length;

  /* compliance score — reportHealth counts submitted + under_review + approved */
  const milestoneHealth = totalMs > 0 ? Math.round(((totalMs - delayedMs) / totalMs) * 100) : 100;
  const compliantReportGrantSet = new Set(
    reports
      .filter((r) => ["submitted", "under_review", "approved"].includes(r.status))
      .map((r) => r.grant_id)
  );
  const reportHealth = activeGrants.length > 0
    ? Math.round((compliantReportGrantSet.size / activeGrants.length) * 100)
    : 100;
  const docHealth = compDocs.length > 0 ? Math.round(((compDocs.length - expiredDocs) / compDocs.length) * 100) : 100;
  const complianceScore = Math.round(0.4 * milestoneHealth + 0.4 * reportHealth + 0.2 * docHealth);
  const complianceColor = complianceScore >= 80 ? "#059669" : complianceScore >= 60 ? "#d97706" : "#dc2626";
  const complianceLabel = complianceScore >= 80 ? "Healthy" : complianceScore >= 60 ? "Needs Attention" : "Critical";

  /* at-risk grants — includes formally delayed AND milestones overdue (past due date, not completed) */
  const atRiskGrants = activeGrants
    .filter((g) =>
      g.milestones.some(
        (m) =>
          m.status === "delayed" ||
          (m.status !== "completed" && new Date((m as unknown as { due_date: string }).due_date ?? "9999") < today)
      )
    )
    .slice(0, 5);

  /* upcoming milestones */
  type UpcomingMs = {
    id: string; title: string; due_date: string; status: string;
    grants: { id: string; title: string; awardee_id: string } | null;
  };
  const upcomingMs = (upcomingMsRes.data ?? []) as unknown as UpcomingMs[];

  /* programme breakdown */
  type Prog = { id: string; name: string; total_budget: number | null; currency_code: string };
  const programmes = (programmesRes.data ?? []) as unknown as Prog[];
  const progBreakdown = programmes
    .map((p) => {
      const pg = grants.filter((g) => g.programme_id === p.id);
      return { ...p, grantCount: pg.length, awarded: pg.reduce((s, g) => s + Number(g.amount_awarded ?? 0), 0) };
    })
    .filter((p) => p.grantCount > 0)
    .sort((a, b) => b.awarded - a.awarded);
  const uncatAmount = grants.filter((g) => !g.programme_id).reduce((s, g) => s + Number(g.amount_awarded ?? 0), 0);

  /* dominant currency across portfolio */
  const currencyCounts: Record<string, number> = {};
  for (const g of grants) {
    const cc = g.currency_code ?? "ZiG";
    currencyCounts[cc] = (currencyCounts[cc] ?? 0) + 1;
  }
  const dominantCurrency = Object.entries(currencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "ZiG";
  const multiCurrency = Object.keys(currencyCounts).length > 1;

  /* monthly spend (last 6 months) — use disbursement_date for accuracy */
  const months6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today);
    d.setMonth(d.getMonth() - (5 - i));
    return d;
  });
  const monthlySpend = months6.map((m) => ({
    label: monthShort(m),
    value: disbursements
      .filter((d) => {
        const dd = new Date(d.created_at);
        return dd.getFullYear() === m.getFullYear() && dd.getMonth() === m.getMonth();
      })
      .reduce((s, d) => s + Number(d.amount ?? 0), 0),
  }));
  const maxMonthly = Math.max(...monthlySpend.map((m) => m.value), 1);

  /* activity */
  type AL = { id: string; action: string; entity_type: string; created_at: string; actor_id: string; profiles: { full_name: string | null } | null };
  const activity = (activityRes.data ?? []) as unknown as AL[];

  /* ─── render ──────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-5 pb-12">

      {/* PAGE HEADER */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-gray-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-gray-400 font-medium">
            {today.toLocaleDateString("en-ZA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <Link
          href="/awardees/new"
          className="flex items-center gap-2 rounded-xl bg-[#6b1a2a] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#5a1522] transition-colors shadow-sm"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Awardee
        </Link>
      </div>

      {/* KPI STRIP — inspired by Donezo: first card dark/branded */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">

        {/* HERO KPI — Total Portfolio (dark branded card) */}
        <Link
          href="/finances"
          className="col-span-2 sm:col-span-1 relative overflow-hidden rounded-2xl bg-[#6b1a2a] p-5 text-white hover:bg-[#5a1522] transition-colors group shadow-[0_4px_24px_rgba(107,26,42,0.25)]"
        >
          <div className="absolute top-4 right-4 opacity-60 group-hover:opacity-100 transition-opacity">
            <IconArrowUpRight />
          </div>
          {/* Decorative ring */}
          <div className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full border-[6px] border-white/10" />
          <div className="absolute -bottom-2 -right-2 h-12 w-12 rounded-full border-[4px] border-white/10" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-red-200/80 mb-2">Total Portfolio</p>
          <p className="text-4xl font-extrabold tracking-tight">{fmtMoney(totalPortfolio, dominantCurrency)}</p>
          <p className="mt-2 text-xs text-red-200/60 font-medium">
            {multiCurrency ? "Mixed currencies — shown in dominant" : "All grants allocated"}
          </p>
        </Link>

        {/* Active Grants */}
        <Link href="/awardees" className="rounded-2xl bg-white p-5 hover:shadow-md transition-all shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.04)] group">
          <div className="flex items-center justify-between mb-3">
            <div className="h-8 w-8 rounded-xl bg-emerald-50 flex items-center justify-center">
              <IconBriefcase className="h-4 w-4 text-emerald-600" />
            </div>
            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">Active</span>
          </div>
          <p className="text-4xl font-extrabold tracking-tight text-gray-900">{activeGrants.length}</p>
          <p className="mt-1 text-[11px] font-medium text-gray-400 uppercase tracking-wide">Active Grants</p>
        </Link>

        {/* Total Disbursed */}
        <Link href="/finances" className="rounded-2xl bg-white p-5 hover:shadow-md transition-all shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-3">
            <div className="h-8 w-8 rounded-xl bg-violet-50 flex items-center justify-center">
              <IconCash className="h-4 w-4 text-violet-600" />
            </div>
            <span className="text-[10px] font-semibold text-gray-400 bg-gray-50 rounded-full px-2 py-0.5">{utilizationPct}% used</span>
          </div>
          <p className="text-3xl font-extrabold tracking-tight text-gray-900">{fmtMoney(totalDisbursed, dominantCurrency)}</p>
          <p className="mt-1 text-[11px] font-medium text-gray-400 uppercase tracking-wide">Disbursed</p>
        </Link>

        {/* Portfolio Compliance */}
        <Link href="/compliance" className="rounded-2xl bg-white p-5 hover:shadow-md transition-all shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-3">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${complianceColor}18` }}>
              <IconShield className="h-4 w-4" style={{ color: complianceColor }} />
            </div>
            <span className="text-[10px] font-semibold rounded-full px-2 py-0.5" style={{ color: complianceColor, backgroundColor: `${complianceColor}18` }}>
              {complianceLabel}
            </span>
          </div>
          <p className="text-4xl font-extrabold tracking-tight text-gray-900">{complianceScore}%</p>
          <p className="mt-1 text-[11px] font-medium text-gray-400 uppercase tracking-wide">Compliance</p>
        </Link>

        {/* At-Risk / Alerts */}
        <Link href="/awardees" className="rounded-2xl bg-white p-5 hover:shadow-md transition-all shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-3">
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${atRiskGrants.length > 0 ? "bg-red-50" : "bg-gray-50"}`}>
              <IconAlert className={`h-4 w-4 ${atRiskGrants.length > 0 ? "text-red-500" : "text-gray-400"}`} />
            </div>
            {atRiskGrants.length > 0 && (
              <span className="text-[10px] font-semibold text-red-600 bg-red-50 rounded-full px-2 py-0.5">Action needed</span>
            )}
          </div>
          <p className={`text-4xl font-extrabold tracking-tight ${atRiskGrants.length > 0 ? "text-red-600" : "text-gray-900"}`}>
            {atRiskGrants.length}
          </p>
          <p className="mt-1 text-[11px] font-medium text-gray-400 uppercase tracking-wide">At-Risk Grants</p>
        </Link>
      </div>

      {/* SECONDARY PILL STRIP */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: "Pending Reports",    value: pendingReports,                   icon: <IconDoc className="h-3.5 w-3.5" />,   color: pendingReports > 0 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-gray-50 text-gray-500 border-gray-200", href: "/reports" },
          { label: "Delayed Milestones", value: delayedMs,                        icon: <IconClock className="h-3.5 w-3.5" />, color: delayedMs > 0 ? "bg-red-50 text-red-700 border-red-200" : "bg-gray-50 text-gray-500 border-gray-200", href: "/awardees" },
          { label: "Expiring Docs",      value: expiringSoonDocs + expiredDocs,   icon: <IconShield className="h-3.5 w-3.5" />,color: (expiringSoonDocs + expiredDocs) > 0 ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-gray-50 text-gray-500 border-gray-200", href: "/compliance" },
          { label: "Total Awardees",     value: awardeesCount,                    icon: <IconUsers className="h-3.5 w-3.5" />, color: "bg-blue-50 text-blue-700 border-blue-200", href: "/awardees" },
          { label: "Disbursement Requests pending", value: byDisbStatus("pending").length, icon: <IconCash className="h-3.5 w-3.5" />, color: byDisbStatus("pending").length > 0 ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-gray-50 text-gray-500 border-gray-200", href: "/finances" },
        ].map(({ label, value, icon, color, href }) => (
          <Link key={label} href={href} className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[12px] font-semibold transition-opacity hover:opacity-80 ${color}`}>
            {icon}
            <span>{value} {label}</span>
          </Link>
        ))}
      </div>

      {/* BUDGET UTILIZATION + DISBURSEMENT PIPELINE */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

        {/* Budget Utilization */}
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <SectionLabel>Financial Overview</SectionLabel>
              <h2 className="text-[15px] font-bold text-gray-900">Budget Utilization</h2>
            </div>
            <span className={`text-[11px] font-semibold rounded-xl px-3 py-1.5 ${
              utilizationPct >= 75 ? "bg-emerald-50 text-emerald-700" :
              utilizationPct >= 40 ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
            }`}>
              {utilizationPct}% deployed
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: "Allocated", value: fmtMoney(totalPortfolio, dominantCurrency), color: "text-gray-900" },
              { label: "Disbursed", value: fmtMoney(totalDisbursed, dominantCurrency), color: "text-[#6b1a2a]" },
              { label: "Remaining", value: fmtMoney(Math.max(0, totalPortfolio - totalDisbursed), dominantCurrency), color: "text-gray-300" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl bg-gray-50 p-3.5">
                <p className={`text-xl font-extrabold tracking-tight ${color}`}>{value}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Progress track */}
          <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden mb-2">
            <div
              className="h-2.5 rounded-full transition-all"
              style={{
                width: `${Math.min(utilizationPct, 100)}%`,
                background: "linear-gradient(90deg, #6b1a2a 0%, #8b2535 100%)",
              }}
            />
          </div>
          <div className="flex items-center gap-5 text-[11px] font-medium text-gray-400 mb-6">
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#6b1a2a]" />Disbursed</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-gray-200" />Remaining</span>
          </div>

          {/* Monthly sparkline */}
          <div className="border-t border-gray-100 pt-5">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Monthly Disbursements</p>
            <div className="flex items-end gap-1.5" style={{ height: "64px" }}>
              {monthlySpend.map((m, i) => {
                const h = maxMonthly > 0 ? (m.value / maxMonthly) * 100 : 0;
                const isLast = i === monthlySpend.length - 1;
                return (
                  <div key={m.label} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      title={fmtMoney(m.value)}
                      className={`w-full rounded-t-lg transition-colors ${isLast ? "opacity-100" : "opacity-50"} hover:opacity-100`}
                      style={{
                        height: `${Math.max(h, m.value > 0 ? 8 : 1)}%`,
                        minHeight: m.value > 0 ? "4px" : "2px",
                        background: isLast ? "#6b1a2a" : "#6b1a2a",
                      }}
                    />
                    <span className="text-[9px] font-medium text-gray-400">{m.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Disbursement Pipeline */}
        <Card className="p-6 flex flex-col">
          <SectionLabel>Funding Workflow</SectionLabel>
          <h2 className="text-[15px] font-bold text-gray-900 mb-5">Disbursement Pipeline</h2>

          <div className="space-y-2.5 flex-1">
            {[
              { label: "Pending",   status: "pending",   dot: "#f59e0b", pillBg: "bg-amber-50",  pillText: "text-amber-700" },
              { label: "Approved",  status: "approved",  dot: "#3b82f6", pillBg: "bg-blue-50",   pillText: "text-blue-700" },
              { label: "Processed", status: "processed", dot: "#059669", pillBg: "bg-emerald-50", pillText: "text-emerald-700" },
              { label: "Rejected",  status: "rejected",  dot: "#ef4444", pillBg: "bg-red-50",    pillText: "text-red-700" },
            ].map(({ label, status, dot, pillBg, pillText }) => {
              const reqs = byDisbStatus(status);
              return (
                <div key={status} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: dot }} />
                  <span className="text-[13px] font-medium text-gray-700 flex-1">{label}</span>
                  <span className={`text-[11px] font-bold rounded-lg px-2 py-0.5 ${pillBg} ${pillText}`}>{reqs.length}</span>
                  <span className="text-[11px] text-gray-400 font-medium tabular-nums">{fmtMoney(disbSum(reqs))}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[12px] font-medium text-gray-400">Total Requested</span>
              <span className="text-[13px] font-bold text-gray-900">{fmtMoney(disbSum(disbRequests))}</span>
            </div>
            <Link href="/finances" className="flex items-center justify-center gap-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors px-3 py-2 text-[12px] font-semibold text-[#6b1a2a]">
              Manage disbursements <IconArrowUpRight />
            </Link>
          </div>
        </Card>
      </div>

      {/* AT-RISK + UPCOMING DEADLINES */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* At-Risk Grants */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <SectionLabel>Risk Monitor</SectionLabel>
              <h2 className="text-[15px] font-bold text-gray-900">At-Risk Grants</h2>
            </div>
            <div className="flex items-center gap-2">
              {atRiskGrants.length > 0 && (
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              )}
              <span className={`text-[12px] font-bold rounded-xl px-2.5 py-1 ${atRiskGrants.length > 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>
                {atRiskGrants.length} flagged
              </span>
            </div>
          </div>

          {atRiskGrants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="h-11 w-11 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                <IconCheck />
              </div>
              <p className="text-[14px] font-semibold text-gray-800">All grants on track</p>
              <p className="text-[12px] text-gray-400 mt-1">No delayed milestones detected</p>
            </div>
          ) : (
            <ul>
              {atRiskGrants.map((g, i) => {
                const delayed = g.milestones.filter((m) => m.status === "delayed").length;
                return (
                  <li key={g.id} className={i < atRiskGrants.length - 1 ? "border-b border-gray-50" : ""}>
                    <Link href={`/awardees/${g.awardee_id}`} className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50/80 transition-colors">
                      <div className="h-9 w-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                        <span className="text-[13px] font-bold text-red-600">{delayed}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-gray-900 truncate">{g.title}</p>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">{g.awardees?.full_name ?? "Unknown"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[12px] font-bold text-gray-700">{g.currency_code} {Number(g.amount_awarded).toLocaleString()}</p>
                        <p className="text-[10px] text-red-500 font-semibold mt-0.5">{delayed} milestone{delayed > 1 ? "s" : ""} delayed</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="px-6 py-3 border-t border-gray-100">
            <Link href="/awardees" className="text-[12px] font-semibold text-[#6b1a2a] hover:underline">View all awardees →</Link>
          </div>
        </Card>

        {/* Upcoming Deadlines */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <SectionLabel>Timeline</SectionLabel>
              <h2 className="text-[15px] font-bold text-gray-900">Upcoming Deadlines</h2>
            </div>
            <span className={`text-[12px] font-bold rounded-xl px-2.5 py-1 ${upcomingMs.length > 0 ? "bg-amber-50 text-amber-600" : "bg-gray-50 text-gray-400"}`}>
              Next 30 days
            </span>
          </div>

          {upcomingMs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="h-11 w-11 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                <IconClock className="h-5 w-5 text-gray-400" />
              </div>
              <p className="text-[14px] font-semibold text-gray-800">Clear horizon</p>
              <p className="text-[12px] text-gray-400 mt-1">No deadlines in the next 30 days</p>
            </div>
          ) : (
            <ul>
              {upcomingMs.map((ms, i) => {
                const label = relDate(ms.due_date);
                const urgent = label.includes("Today") || label.includes("Tomorrow") || label.includes("overdue");
                return (
                  <li key={ms.id} className={i < upcomingMs.length - 1 ? "border-b border-gray-50" : ""}>
                    <div className="flex items-center gap-4 px-6 py-3.5">
                      <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${urgent ? "bg-red-500" : "bg-amber-400"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-gray-900 truncate">{ms.title}</p>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">{ms.grants?.title ?? "—"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-[12px] font-bold ${urgent ? "text-red-600" : "text-amber-600"}`}>{label}</span>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(ms.due_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="px-6 py-3 border-t border-gray-100">
            <Link href="/analytics" className="text-[12px] font-semibold text-[#6b1a2a] hover:underline">View milestone tracker →</Link>
          </div>
        </Card>
      </div>

      {/* COMPLIANCE RING + PROGRAMME BREAKDOWN */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

        {/* Compliance Score */}
        <Card className="p-6 flex flex-col items-center text-center">
          <div className="self-start w-full mb-4">
            <SectionLabel>Health Score</SectionLabel>
            <h2 className="text-[15px] font-bold text-gray-900 text-left">Portfolio Compliance</h2>
          </div>

          <div className="relative h-40 w-40 my-2">
            <svg viewBox="0 0 36 36" className="h-40 w-40 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.9" fill="none"
                stroke={complianceColor} strokeWidth="3"
                strokeDasharray={`${complianceScore} ${100 - complianceScore}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-extrabold text-gray-900 tracking-tight">{complianceScore}%</span>
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: complianceColor }}>{complianceLabel}</span>
            </div>
          </div>

          <div className="w-full mt-4 space-y-3">
            {[
              { label: "Milestone Health",  value: milestoneHealth },
              { label: "Report Compliance", value: reportHealth },
              { label: "Document Status",   value: docHealth },
            ].map(({ label, value }) => {
              const c = value >= 80 ? "#059669" : value >= 60 ? "#d97706" : "#ef4444";
              return (
                <div key={label} className="text-left">
                  <div className="flex justify-between text-[11px] font-medium mb-1">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-bold text-gray-800">{value}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-100">
                    <div className="h-1.5 rounded-full" style={{ width: `${value}%`, backgroundColor: c }} />
                  </div>
                </div>
              );
            })}
          </div>

          <Link href="/compliance" className="mt-5 self-start text-[12px] font-semibold text-[#6b1a2a] hover:underline">
            View details →
          </Link>
        </Card>

        {/* Programme Breakdown */}
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <SectionLabel>Portfolio Allocation</SectionLabel>
              <h2 className="text-[15px] font-bold text-gray-900">Programme Breakdown</h2>
            </div>
            <Link href="/programmes" className="text-[12px] font-semibold text-[#6b1a2a] hover:underline flex items-center gap-1">
              Manage <IconArrowUpRight />
            </Link>
          </div>

          {progBreakdown.length === 0 && uncatAmount === 0 ? (
            <div className="py-8 text-center text-[13px] text-gray-400">No programmes configured yet.</div>
          ) : (
            <div className="space-y-4">
              {progBreakdown.slice(0, 5).map((p, i) => {
                const pct = totalPortfolio > 0 ? Math.round((p.awarded / totalPortfolio) * 100) : 0;
                const palette = ["#6b1a2a", "#2563eb", "#059669", "#d97706", "#8b5cf6"];
                const c = palette[i % palette.length];
                return (
                  <div key={p.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c }} />
                        <span className="text-[13px] font-semibold text-gray-800 truncate max-w-[180px]">{p.name}</span>
                        <span className="text-[10px] font-medium text-gray-400 bg-gray-100 rounded-lg px-1.5 py-0.5">
                          {p.grantCount}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[12px] font-bold text-gray-800">{fmtMoney(p.awarded)}</span>
                        <span className="text-[11px] text-gray-400 ml-1.5">{pct}%</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: c }} />
                    </div>
                  </div>
                );
              })}
              {uncatAmount > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] italic text-gray-400">Uncategorised</span>
                    <span className="text-[12px] text-gray-400">{fmtMoney(uncatAmount)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-gray-300" style={{ width: `${totalPortfolio > 0 ? Math.round((uncatAmount / totalPortfolio) * 100) : 0}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Grant status pills */}
          <div className="mt-6 pt-5 border-t border-gray-100 flex flex-wrap gap-2">
            {[
              { label: "Active",    count: grants.filter((g) => g.status === "active").length,    bg: "bg-emerald-50 text-emerald-700" },
              { label: "Completed", count: grants.filter((g) => g.status === "completed").length, bg: "bg-blue-50 text-blue-700" },
              { label: "Suspended", count: grants.filter((g) => g.status === "suspended").length, bg: "bg-amber-50 text-amber-700" },
              { label: "Cancelled", count: grants.filter((g) => g.status === "cancelled").length, bg: "bg-red-50 text-red-700" },
            ].map(({ label, count, bg }) => (
              <div key={label} className={`rounded-xl px-4 py-2 flex items-center gap-2 ${bg}`}>
                <span className="text-[18px] font-extrabold">{count}</span>
                <span className="text-[11px] font-semibold opacity-70">{label}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* MILESTONE PROGRESS + IMPACT TEASER */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* Milestone Progress */}
        <Card className="p-6">
          <SectionLabel>Progress Tracker</SectionLabel>
          <h2 className="text-[15px] font-bold text-gray-900 mb-5">Milestone Progress</h2>

          <div className="flex items-center gap-8">
            <div className="relative h-32 w-32 shrink-0">
              <svg viewBox="0 0 36 36" className="h-32 w-32 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke="#6b1a2a" strokeWidth="3"
                  strokeDasharray={`${milestoneRate} ${100 - milestoneRate}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold text-gray-900">{milestoneRate}%</span>
                <span className="text-[9px] font-medium text-gray-400 uppercase tracking-wide">done</span>
              </div>
            </div>

            <div className="flex-1 space-y-3">
              {[
                { label: "Completed",   count: completedMs,  hex: "#6b1a2a" },
                { label: "In Progress", count: inProgressMs, hex: "#3b82f6" },
                { label: "Delayed",     count: delayedMs,    hex: "#ef4444" },
                { label: "Not Started", count: notStartedMs, hex: "#e5e7eb" },
              ].map(({ label, count, hex }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                  <span className="text-[12px] font-medium text-gray-500 flex-1">{label}</span>
                  <span className="text-[13px] font-bold text-gray-900 tabular-nums">{count}</span>
                  {totalMs > 0 && (
                    <span className="text-[10px] text-gray-400 tabular-nums w-7 text-right">
                      {Math.round((count / totalMs) * 100)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Link href="/analytics" className="mt-5 inline-flex items-center gap-1 text-[12px] font-semibold text-[#6b1a2a] hover:underline">
            Detailed analytics <IconArrowUpRight />
          </Link>
        </Card>

        {/* Impact Map Teaser */}
        <Link
          href="/impact"
          className="group relative overflow-hidden rounded-2xl p-7 text-white block transition-all duration-300 hover:shadow-xl"
          style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0c1a2e 100%)" }}
        >
          {/* Dot matrix overlay */}
          <div className="absolute inset-0 opacity-[0.15]"
            style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
          {/* Glow blob */}
          <div className="absolute -bottom-8 -right-8 h-44 w-44 rounded-full opacity-20 blur-3xl" style={{ background: "#3b82f6" }} />

          <div className="relative z-10">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="h-8 w-8 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
                <IconGlobe className="h-4 w-4 text-blue-300" />
              </div>
              <span className="text-[10px] font-bold tracking-[0.18em] text-blue-300 uppercase">Geographic Impact</span>
            </div>

            <p className="text-[26px] font-extrabold tracking-tight mb-2 group-hover:text-blue-100 transition-colors">
              View Impact Map
            </p>
            <p className="text-[13px] text-slate-400 leading-relaxed mb-6">
              See how your grants reach communities across Africa. Track funding concentration and beneficiary distribution.
            </p>

            <div className="grid grid-cols-3 gap-2.5 mb-6">
              {[
                { label: "Beneficiaries", value: awardeesCount },
                { label: "Active Grants", value: activeGrants.length },
                { label: "Programmes",    value: programmes.length },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-center">
                  <p className="text-[22px] font-extrabold text-white tracking-tight">{value}</p>
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-1.5 text-[12px] font-bold text-blue-300 group-hover:text-blue-200 transition-colors">
              Open map
              <svg className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </div>
        </Link>
      </div>

      {/* RECENT ACTIVITY + QUICK ACTIONS */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* Recent Activity */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <SectionLabel>System</SectionLabel>
              <h2 className="text-[15px] font-bold text-gray-900">Recent Activity</h2>
            </div>
            <Link href="/audit" className="flex items-center gap-1 text-[12px] font-semibold text-[#6b1a2a] hover:underline">
              Full log <IconArrowUpRight />
            </Link>
          </div>

          {activity.length === 0 ? (
            <p className="px-6 py-10 text-center text-[13px] text-gray-400 italic">No activity yet.</p>
          ) : (
            <ul>
              {activity.map((log, i) => (
                <li key={log.id} className={`flex items-start gap-3.5 px-6 py-3.5 hover:bg-gray-50/80 transition-colors ${i < activity.length - 1 ? "border-b border-gray-50" : ""}`}>
                  <div className="mt-0.5 h-7 w-7 rounded-xl bg-[#f5e8ea] flex items-center justify-center shrink-0">
                    <IconFlag className="h-3.5 w-3.5 text-[#6b1a2a]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-gray-700 font-medium">
                      <span className="font-bold">{log.profiles?.full_name ?? "System"}</span>
                      <span className="text-gray-400"> · </span>
                      <code className="text-[10px] font-mono bg-gray-100 rounded px-1 py-0.5 text-gray-500">{log.action}</code>
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{new Date(log.created_at).toLocaleString()}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Quick Actions */}
        <Card className="p-6">
          <SectionLabel>Navigation</SectionLabel>
          <h2 className="text-[15px] font-bold text-gray-900 mb-4">Quick Actions</h2>

          <div className="grid grid-cols-2 gap-2.5">
            {[
              { href: "/awardees/new", label: "Add Awardee",   icon: <IconUsers className="h-4 w-4" />,    bg: "bg-[#f5e8ea]",  text: "text-[#6b1a2a]", hover: "hover:bg-[#ebd0d5]" },
              { href: "/reports",      label: "Reports",        icon: <IconDoc className="h-4 w-4" />,      bg: "bg-blue-50",    text: "text-blue-700",  hover: "hover:bg-blue-100" },
              { href: "/finances",     label: "Finances",       icon: <IconCash className="h-4 w-4" />,     bg: "bg-violet-50",  text: "text-violet-700",hover: "hover:bg-violet-100" },
              { href: "/analytics",   label: "Analytics",      icon: <IconChart className="h-4 w-4" />,    bg: "bg-emerald-50", text: "text-emerald-700", hover: "hover:bg-emerald-100" },
              { href: "/compliance",  label: "Compliance",     icon: <IconShield className="h-4 w-4" />,   bg: "bg-amber-50",   text: "text-amber-700", hover: "hover:bg-amber-100" },
              { href: "/audit",       label: "Audit Log",      icon: <IconFlag className="h-4 w-4" />,     bg: "bg-gray-100",   text: "text-gray-700",  hover: "hover:bg-gray-200" },
            ].map(({ href, label, icon, bg, text, hover }) => (
              <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${bg} ${text} ${hover}`}>
                {icon}
                <span className="text-[12px] font-semibold">{label}</span>
              </Link>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <a href="/api/cron/flag-milestones" className="flex items-center gap-2 text-[12px] font-medium text-gray-400 hover:text-[#6b1a2a] transition-colors">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sync overdue milestones
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}
