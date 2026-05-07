import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

// ── Icons (inline SVG — no extra dependencies) ───────────────────────────────
function IconUsers() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function IconBriefcase() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}
function IconCash() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function IconAlert() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}
function IconFlag() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
    </svg>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    awardeesRes,
    grantsRes,
    milestonesDelayedRes,
    milestonesAllRes,
    milestonesCompletedRes,
    recentAwardeesRes,
    disbursementsRes,
    expensesPendingRes,
    grantsByStatusRes,
    activityRes,
  ] = await Promise.all([
    supabase.from("awardees").select("*", { count: "exact", head: true }),
    supabase.from("grants").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("milestones").select("*", { count: "exact", head: true }).eq("status", "delayed"),
    supabase.from("milestones").select("*", { count: "exact", head: true }),
    supabase.from("milestones").select("*", { count: "exact", head: true }).eq("status", "completed"),
    supabase
      .from("awardees")
      .select("id, full_name, email, grants(id, title, status, amount_awarded, currency_code)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("disbursements").select("amount"),
    supabase.from("expenses").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("grants").select("status"),
    supabase
      .from("audit_logs")
      .select("id, action, entity_type, created_at, actor_id, profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const awardeesCount = awardeesRes.count ?? 0;
  const activeGrantsCount = grantsRes.count ?? 0;
  const delayedMilestones = milestonesDelayedRes.count ?? 0;
  const totalMilestones = milestonesAllRes.count ?? 0;
  const completedMilestones = milestonesCompletedRes.count ?? 0;
  const milestoneRate = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;
  const recentAwardees = recentAwardeesRes.data ?? [];
  const pendingExpenses = expensesPendingRes.count ?? 0;

  const totalDisbursed = (disbursementsRes.data ?? []).reduce(
    (sum, d) => sum + Number(d.amount ?? 0),
    0
  );

  const grantStatuses = grantsByStatusRes.data ?? [];
  const statusCount = (s: string) => grantStatuses.filter((g) => g.status === s).length;

  const activity = (activityRes.data ?? []) as unknown as {
    id: string;
    action: string;
    entity_type: string;
    created_at: string;
    actor_id: string;
    profiles: { full_name: string | null } | null;
  }[];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Portfolio overview — University Innovation &amp; Grants
          </p>
        </div>
        <Link
          href="/awardees/new"
          className="rounded-lg bg-[#6b1a2a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5a1522] transition-colors shadow-sm"
        >
          + Add Awardee &amp; Grant
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Total Awardees"
          value={awardeesCount}
          href="/awardees"
          icon={<IconUsers />}
          color="blue"
        />
        <StatCard
          label="Active Grants"
          value={activeGrantsCount}
          href="/awardees"
          icon={<IconBriefcase />}
          color="green"
        />
        <StatCard
          label="Total Disbursed"
          value={`$${(totalDisbursed / 1000).toFixed(1)}k`}
          href="/finances"
          icon={<IconCash />}
          color="purple"
          raw
        />
        <StatCard
          label="Pending Expenses"
          value={pendingExpenses}
          href="/finances"
          icon={<IconClock />}
          color={pendingExpenses > 0 ? "orange" : "gray"}
        />
        <StatCard
          label="Delayed Milestones"
          value={delayedMilestones}
          href="/awardees"
          icon={<IconAlert />}
          color={delayedMilestones > 0 ? "red" : "gray"}
        />
      </div>

      {/* Middle row: Grant status breakdown + Milestone progress */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Grant pipeline */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Grant Pipeline</h2>
          <div className="space-y-3">
            {[
              { label: "Pending", status: "pending", color: "bg-yellow-400" },
              { label: "Active", status: "active", color: "bg-green-500" },
              { label: "Completed", status: "completed", color: "bg-blue-500" },
              { label: "Rejected", status: "rejected", color: "bg-red-400" },
            ].map(({ label, status, color }) => {
              const count = statusCount(status);
              const pct = grantStatuses.length > 0 ? Math.round((count / grantStatuses.length) * 100) : 0;
              return (
                <div key={status}>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>{label}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Milestone completion */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Milestone Progress</h2>
          <div className="flex items-center gap-6">
            {/* Donut-style ring */}
            <div className="relative h-24 w-24 shrink-0">
              <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke="#6b1a2a" strokeWidth="3"
                  strokeDasharray={`${milestoneRate} ${100 - milestoneRate}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-gray-900">{milestoneRate}%</span>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#6b1a2a]" />
                <span className="text-gray-600">Completed</span>
                <span className="ml-auto font-semibold text-gray-900">{completedMilestones}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="text-gray-600">Delayed</span>
                <span className="ml-auto font-semibold text-gray-900">{delayedMilestones}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-gray-200" />
                <span className="text-gray-600">Remaining</span>
                <span className="ml-auto font-semibold text-gray-900">{totalMilestones - completedMilestones}</span>
              </div>
            </div>
          </div>
          <Link href="/analytics" className="mt-4 inline-block text-xs text-[#6b1a2a] font-medium hover:underline">
            View detailed analytics →
          </Link>
        </div>
      </div>

      {/* Bottom row: Recent awardees + Activity feed */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent awardees */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Recently Added</h2>
            <Link href="/awardees" className="text-xs text-[#6b1a2a] font-medium hover:underline">View all</Link>
          </div>
          {recentAwardees.length === 0 ? (
            <p className="px-6 py-8 text-sm text-gray-400 italic text-center">No awardees yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentAwardees.map((a) => {
                const grant = (a.grants as { id: string; title: string; status: string; amount_awarded: number; currency_code: string }[])?.[0];
                const statusColors: Record<string, string> = {
                  active: "bg-green-100 text-green-700",
                  pending: "bg-yellow-100 text-yellow-700",
                  completed: "bg-blue-100 text-blue-700",
                  rejected: "bg-red-100 text-red-700",
                };
                return (
                  <li key={a.id}>
                    <Link href={`/awardees/${a.id}`} className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors">
                      <div className="h-8 w-8 rounded-full bg-[#f5e8ea] flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-[#6b1a2a]">
                          {a.full_name[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{a.full_name}</p>
                        <p className="text-xs text-gray-400 truncate">{a.email}</p>
                      </div>
                      {grant && (
                        <div className="text-right shrink-0">
                          <p className="text-xs font-semibold text-gray-700">
                            {grant.currency_code} {Number(grant.amount_awarded).toLocaleString()}
                          </p>
                          <span className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[grant.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {grant.status}
                          </span>
                        </div>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Recent activity */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Recent Activity</h2>
            <Link href="/audit" className="text-xs text-[#6b1a2a] font-medium hover:underline">View log</Link>
          </div>
          {activity.length === 0 ? (
            <p className="px-6 py-8 text-sm text-gray-400 italic text-center">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {activity.map((log) => (
                <li key={log.id} className="flex items-start gap-3 px-6 py-3">
                  <div className="mt-0.5 h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <IconFlag />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700">
                      <span className="font-medium">{log.profiles?.full_name ?? "System"}</span>
                      {" · "}
                      <span className="font-mono text-gray-500">{log.action}</span>
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Quick Actions bar */}
      <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-[#6b1a2a] to-[#8b2535] p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Quick Actions</p>
          <p className="text-xs text-red-200 mt-0.5">Common tasks at a glance</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Link href="/awardees/new" className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#6b1a2a] hover:bg-red-50 transition-colors">
            + Add Awardee
          </Link>
          <Link href="/awardees" className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 transition-colors">
            View Awardees
          </Link>
          <Link href="/analytics" className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 transition-colors">
            Analytics
          </Link>
          <Link href="/reports" className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 transition-colors">
            Reports
          </Link>
          <a href="/api/cron/flag-milestones" className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 transition-colors">
            Sync Overdue Milestones
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Stat card component ───────────────────────────────────────────────────────
type Color = "blue" | "green" | "purple" | "orange" | "red" | "gray";

const colorMap: Record<Color, { bg: string; icon: string; text: string }> = {
  blue:   { bg: "bg-blue-50",   icon: "text-blue-600",   text: "text-blue-700" },
  green:  { bg: "bg-green-50",  icon: "text-green-600",  text: "text-green-700" },
  purple: { bg: "bg-purple-50", icon: "text-purple-600", text: "text-purple-700" },
  orange: { bg: "bg-orange-50", icon: "text-orange-500", text: "text-orange-700" },
  red:    { bg: "bg-red-50",    icon: "text-red-600",    text: "text-red-700" },
  gray:   { bg: "bg-gray-50",   icon: "text-gray-400",   text: "text-gray-500" },
};

function StatCard({
  label,
  value,
  href,
  icon,
  color,
  raw = false,
}: {
  label: string;
  value: string | number;
  href: string;
  icon: React.ReactNode;
  color: Color;
  raw?: boolean;
}) {
  const c = colorMap[color];
  return (
    <Link
      href={href}
      className="rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow group"
    >
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${c.bg} ${c.icon} mb-3`}>
        {icon}
      </div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color === "gray" ? "text-gray-400" : "text-gray-900"}`}>
        {raw ? value : Number(value).toLocaleString()}
      </p>
    </Link>
  );
}
