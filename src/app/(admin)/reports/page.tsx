import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// ── Helpers ────────────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.04)] ${className}`}>
      {children}
    </div>
  );
}

type GrantRow = { id: string; title: string; status: string };
type AwardeeRow = { id: string; full_name: string; grants: GrantRow[] | null };
type ReportRow  = { id: string; grant_id: string; status: string; due_date: string; submitted_at: string | null; period_label: string | null };

// ── Page ──────────────────────────────────────────────────────────────────

export default async function ReportsPage() {
  const supabase = await createClient();
  const today    = new Date();

  const [awardeesRes, reportsRes] = await Promise.all([
    supabase
      .from("awardees")
      .select("id, full_name, grants(id, title, status)")
      .order("full_name"),
    supabase
      .from("grant_reports")
      .select("id, grant_id, status, due_date, submitted_at, period_label")
      .order("due_date", { ascending: false }),
  ]);

  const awardees = (awardeesRes.data ?? []) as unknown as AwardeeRow[];
  const reports  = (reportsRes.data ?? []) as unknown as ReportRow[];

  // ── Report submission health ───────────────────────────────────────────
  const dueReports       = reports.filter((r) => new Date(r.due_date) < today);
  const overdueReports   = dueReports.filter((r) => r.status !== "submitted" && r.status !== "approved");
  const submittedReports = dueReports.filter((r) => r.status === "submitted" || r.status === "approved");
  const complianceRate   = dueReports.length > 0
    ? Math.round((submittedReports.length / dueReports.length) * 100)
    : null;

  // Map grant_id → awardee for report lookup
  const grantToAwardee: Record<string, AwardeeRow> = {};
  for (const a of awardees) {
    for (const g of (a.grants ?? [])) {
      grantToAwardee[g.id] = a;
    }
  }

  // Per-awardee report status (latest report for each grant)
  const grantReportMap: Record<string, ReportRow[]> = {};
  for (const r of reports) {
    if (!grantReportMap[r.grant_id]) grantReportMap[r.grant_id] = [];
    grantReportMap[r.grant_id].push(r);
  }

  // Build per-awardee rows
  type AwardeeReportRow = {
    awardeeId: string;
    awardeeName: string;
    grantId: string;
    grantTitle: string;
    totalReports: number;
    submitted: number;
    overdue: number;
    lastSubmission: string | null;
    nextDue: string | null;
    latestStatus: string | null;
  };

  const awardeeReportRows: AwardeeReportRow[] = [];
  for (const a of awardees) {
    const grant = (a.grants ?? [])[0];
    if (!grant) continue;
    const grantRpts = grantReportMap[grant.id] ?? [];
    const due       = grantRpts.filter((r) => new Date(r.due_date) < today);
    const sub       = due.filter((r) => r.status === "submitted" || r.status === "approved");
    const over      = due.filter((r) => r.status !== "submitted" && r.status !== "approved");
    const latest    = grantRpts.find((r) => r.submitted_at) ?? null;
    const upcoming  = grantRpts
      .filter((r) => new Date(r.due_date) >= today)
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0] ?? null;

    awardeeReportRows.push({
      awardeeId:    a.id,
      awardeeName:  a.full_name,
      grantId:      grant.id,
      grantTitle:   grant.title,
      totalReports: grantRpts.length,
      submitted:    sub.length,
      overdue:      over.length,
      lastSubmission: latest?.submitted_at ?? null,
      nextDue:      upcoming?.due_date ?? null,
      latestStatus: grantRpts[0]?.status ?? null,
    });
  }

  // Sort: overdue first, then by awardee name
  awardeeReportRows.sort((a, b) => b.overdue - a.overdue || a.awardeeName.localeCompare(b.awardeeName));

  // ── Exports config ─────────────────────────────────────────────────────
  const csvExports = [
    { title: "All Grants",    desc: "Awardee details, status, amounts, dates",         csvHref: "/api/exports/grants",        pdfHref: "/api/exports/pdf/grants",        icon: "📋", color: "#6b1a2a" },
    { title: "Disbursements", desc: "All payments with dates, methods, references",     csvHref: "/api/exports/disbursements",  pdfHref: "/api/exports/pdf/disbursements", icon: "💸", color: "#2563eb" },
    { title: "Expenses",      desc: "All expense reports with approval status",         csvHref: "/api/exports/expenses",       pdfHref: "/api/exports/pdf/expenses",      icon: "🧾", color: "#16a34a" },
    { title: "Budget Lines",  desc: "All budget allocations and approval status",       csvHref: "/api/exports/budgets",        pdfHref: "/api/exports/pdf/budgets",       icon: "📊", color: "#d97706" },
    { title: "Milestones",    desc: "All milestones with status and due dates",         csvHref: "/api/exports/milestones",     pdfHref: "/api/exports/pdf/milestones",    icon: "🏁", color: "#7c3aed" },
    { title: "Grant Reports", desc: "Submission history with dates and statuses",       csvHref: "/api/exports/grant-reports",  pdfHref: "/api/exports/pdf/grant-reports", icon: "📝", color: "#db2777" },
  ];

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-400 mt-0.5">Report submission tracking and data exports</p>
        </div>
      </div>

      {/* Submission Health Strip */}
      {reports.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Submission Rate",
              value: complianceRate !== null ? `${complianceRate}%` : "—",
              note: "of due reports submitted",
              color: complianceRate !== null && complianceRate >= 75 ? "#16a34a" : complianceRate !== null && complianceRate >= 50 ? "#d97706" : "#dc2626",
            },
            {
              label: "Submitted",
              value: submittedReports.length,
              note: "reports on file",
              color: "#16a34a",
            },
            {
              label: "Overdue",
              value: overdueReports.length,
              note: "past due, not submitted",
              color: overdueReports.length > 0 ? "#dc2626" : "#6b7280",
            },
            {
              label: "Total Reports",
              value: reports.length,
              note: "across all grants",
              color: "#374151",
            },
          ].map((s) => (
            <Card key={s.label} className="p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400">{s.label}</p>
              <p className="text-3xl font-black mt-2" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-1">{s.note}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Overdue callout */}
      {overdueReports.length > 0 && (
        <Card className="p-5 border-red-100" style={{ backgroundColor: "#fef2f2", borderColor: "#fecaca" }}>
          <div className="flex items-start gap-3">
            <span className="text-red-500 text-lg mt-0.5">⚠</span>
            <div>
              <p className="text-sm font-semibold text-red-900">
                {overdueReports.length} overdue report{overdueReports.length !== 1 ? "s" : ""} — action required
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                The following awardees have report submissions past their due date. Follow up to ensure compliance.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Per-awardee report status */}
      {awardeeReportRows.length > 0 && (
        <Card className="p-6">
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-gray-900">Report Status by Awardee</h2>
            <p className="text-xs text-gray-400 mt-0.5">Overdue awardees shown first</p>
          </div>
          <div className="overflow-x-auto -mx-6">
            <div className="inline-block min-w-full px-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-3 text-left text-xs font-medium text-gray-400">Awardee</th>
                    <th className="pb-3 text-center text-xs font-medium text-gray-400">Submitted</th>
                    <th className="pb-3 text-center text-xs font-medium text-gray-400">Overdue</th>
                    <th className="pb-3 text-left text-xs font-medium text-gray-400 pl-4">Last Submission</th>
                    <th className="pb-3 text-left text-xs font-medium text-gray-400">Next Due</th>
                    <th className="pb-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {awardeeReportRows.map((row) => {
                    const hasOverdue = row.overdue > 0;
                    return (
                      <tr
                        key={row.awardeeId}
                        className={`transition-colors ${hasOverdue ? "bg-red-50/40 hover:bg-red-50/70" : "hover:bg-gray-50/70"}`}
                      >
                        <td className="py-3.5 pr-6">
                          <p className="font-medium text-gray-900">{row.awardeeName}</p>
                          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{row.grantTitle}</p>
                        </td>
                        <td className="py-3.5 text-center">
                          <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                            {row.submitted}
                          </span>
                        </td>
                        <td className="py-3.5 text-center">
                          {row.overdue > 0 ? (
                            <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                              {row.overdue}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3.5 pl-4 text-xs text-gray-500">
                          {row.lastSubmission
                            ? new Date(row.lastSubmission).toLocaleDateString("en-ZA")
                            : <span className="text-gray-300">Never submitted</span>}
                        </td>
                        <td className="py-3.5 text-xs">
                          {row.nextDue ? (
                            (() => {
                              const days = Math.ceil((new Date(row.nextDue).getTime() - today.getTime()) / 86400000);
                              return (
                                <span className={days <= 7 ? "font-semibold text-amber-700" : "text-gray-500"}>
                                  {new Date(row.nextDue).toLocaleDateString("en-ZA")}
                                  {days <= 7 && <span className="ml-1 text-[10px]">({days}d)</span>}
                                </span>
                              );
                            })()
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-3.5 pl-4">
                          <Link
                            href={`/awardees/${row.awardeeId}/report`}
                            target="_blank"
                            className="text-xs font-medium text-[#6b1a2a] hover:underline whitespace-nowrap"
                          >
                            Report →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* No reports state */}
      {reports.length === 0 && awardees.length > 0 && (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium text-gray-500">No grant reports have been created yet.</p>
          <p className="text-xs text-gray-400 mt-1">Grant reports are created via reporting cycles — check awardee portal access.</p>
        </Card>
      )}

      {/* PDF Export — Portfolio Summary */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">PDF Reports</h2>
            <p className="text-xs text-gray-400 mt-0.5">Formatted PDF documents for sharing and archiving</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Portfolio summary */}
          <a
            href="/api/exports/portfolio-pdf"
            download
            className="group flex items-start gap-3.5 rounded-xl border border-[#6b1a2a]/20 bg-[#6b1a2a]/[0.03] p-4 hover:border-[#6b1a2a]/30 hover:bg-[#6b1a2a]/[0.06] transition-all"
          >
            <span className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-base" style={{ backgroundColor: "#6b1a2a18" }}>
              📄
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900 group-hover:text-[#6b1a2a] transition-colors">
                Portfolio Summary
                <span className="ml-1 text-xs font-normal text-gray-400">.pdf</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">All awardees — grant details, milestones, disbursements, report history</p>
            </div>
          </a>
          {/* Tip card */}
          <div className="flex items-start gap-3.5 rounded-xl border border-gray-100 bg-gray-50/70 p-4">
            <span className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-base bg-gray-100">
              💡
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-700">Per-awardee PDFs</p>
              <p className="text-xs text-gray-400 mt-0.5">Use the &quot;Download PDF&quot; buttons in the Printable Reports section below to export individual grant reports.</p>
            </div>
          </div>
        </div>
      </Card>

      {/* CSV + PDF Exports */}
      <Card className="p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Data Exports</h2>
        <p className="text-xs text-gray-400 mb-5">Download as CSV for spreadsheets or PDF for sharing and archiving</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {csvExports.map((e) => (
            <div
              key={e.csvHref}
              className="rounded-xl border border-gray-100 bg-gray-50 p-4"
            >
              <div className="flex items-start gap-3 mb-3">
                <span className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-base" style={{ backgroundColor: `${e.color}15` }}>
                  {e.icon}
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{e.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{e.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={e.csvHref}
                  download
                  className="flex-1 text-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  ↓ CSV
                </a>
                <a
                  href={e.pdfHref}
                  download
                  className="flex-1 text-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={{ borderColor: `${e.color}30`, color: e.color, backgroundColor: `${e.color}08` }}
                >
                  ↓ PDF
                </a>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Printable Reports */}
      <Card className="p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Printable Grant Reports</h2>
        <p className="text-xs text-gray-400 mb-5">
          Download a formatted PDF or open the full report in a new tab
        </p>
        {awardees.length === 0 ? (
          <p className="text-sm text-gray-400">No awardees yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {awardees.map((a) => {
              const grant = (a.grants ?? [])[0];
              return (
                <div key={a.id} className="flex items-center justify-between py-3 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{a.full_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{grant?.title ?? "No grant linked"}</p>
                  </div>
                  {grant ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={`/api/reports/${a.id}/pdf`}
                        download
                        className="rounded-xl border border-[#6b1a2a]/20 bg-[#6b1a2a]/[0.04] px-3 py-1.5 text-xs font-medium text-[#6b1a2a] hover:bg-[#6b1a2a]/[0.09] transition-colors"
                      >
                        ↓ PDF
                      </a>
                      <Link
                        href={`/awardees/${a.id}/report`}
                        target="_blank"
                        className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-[#6b1a2a]/30 hover:text-[#6b1a2a] transition-colors"
                      >
                        Open →
                      </Link>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

    </div>
  );
}
