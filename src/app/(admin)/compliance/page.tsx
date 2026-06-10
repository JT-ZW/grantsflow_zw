import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────

type ComplianceDoc = {
  id: string;
  name: string;
  document_type: string | null;
  expires_at: string | null;
  grants: { id: string; title: string; awardee_id: string } | null;
  profiles: { full_name: string | null; email: string } | null;
};

type GrantRow = {
  id: string;
  title: string;
  status: string;
  awardee_id: string;
  awardees: { id: string; full_name: string; email: string } | null;
};

type MilestoneRow = { id: string; status: string; due_date: string; grant_id: string };
type ReportRow    = { id: string; status: string; due_date: string; submitted_at: string | null; grant_id: string };

// ── Helpers ───────────────────────────────────────────────────────────────

function Card({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.04)] ${className}`} style={style}>
      {children}
    </div>
  );
}

const DOC_TYPE_LABELS: Record<string, string> = {
  ethics_clearance:        "Ethics Clearance",
  tax_clearance:           "Tax Clearance",
  institutional_agreement: "Institutional Agreement",
  research_permit:         "Research Permit",
  financial_report:        "Financial Report",
  identity_document:       "Identity Document",
  insurance:               "Insurance",
  other:                   "Other",
};

type ExpiryStatus = "expired" | "expiring_soon" | "active" | "no_expiry";

function getExpiryStatus(expiresAt: string | null): ExpiryStatus {
  if (!expiresAt) return "no_expiry";
  const today = new Date();
  const exp   = new Date(expiresAt + "T00:00:00");
  const days  = Math.ceil((exp.getTime() - today.getTime()) / 86_400_000);
  if (days < 0)   return "expired";
  if (days <= 30) return "expiring_soon";
  return "active";
}

function daysUntilExpiry(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const today = new Date();
  const exp   = new Date(expiresAt + "T00:00:00");
  return Math.ceil((exp.getTime() - today.getTime()) / 86_400_000);
}

function scoreBadge(score: number) {
  if (score >= 75) return "bg-green-50 text-green-700 border border-green-100";
  if (score >= 50) return "bg-amber-50 text-amber-700 border border-amber-100";
  return "bg-red-50 text-red-700 border border-red-100";
}

function ScoreRing({ score, size = 40 }: { score: number; size?: number }) {
  const cx  = size / 2;
  const sw  = Math.max(4, size * 0.1);
  const r   = cx - sw / 2 - 1;
  const c   = 2 * Math.PI * r;
  const col = score >= 75 ? "#16a34a" : score >= 50 ? "#d97706" : "#dc2626";
  const off = c - (score / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#f3f4f6" strokeWidth={sw} />
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={col} strokeWidth={sw}
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
    </svg>
  );
}

// ── Document table ────────────────────────────────────────────────────────

function DocTable({ items }: { items: ComplianceDoc[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-400 py-6 text-center px-6">None.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-50 text-left">
            <th className="px-6 py-3 text-xs font-medium text-gray-400">Grant / Awardee</th>
            <th className="px-4 py-3 text-xs font-medium text-gray-400">Document</th>
            <th className="px-4 py-3 text-xs font-medium text-gray-400">Type</th>
            <th className="px-4 py-3 text-xs font-medium text-gray-400">Expiry</th>
            <th className="px-4 py-3 text-xs font-medium text-gray-400">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {items.map((doc) => {
            const status = getExpiryStatus(doc.expires_at);
            const days   = daysUntilExpiry(doc.expires_at);
            const grant  = Array.isArray(doc.grants) ? doc.grants[0] : doc.grants;
            return (
              <tr key={doc.id} className="hover:bg-gray-50/70 transition-colors">
                <td className="px-6 py-3.5">
                  {grant ? (
                    <>
                      <p className="font-medium text-gray-900 truncate max-w-[200px]">{grant.title}</p>
                      {doc.profiles && (
                        <p className="text-xs text-gray-400 mt-0.5">{doc.profiles.full_name ?? doc.profiles.email}</p>
                      )}
                    </>
                  ) : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-3.5">
                  <span className="font-medium text-gray-800 truncate max-w-[180px] block">{doc.name}</span>
                </td>
                <td className="px-4 py-3.5 text-gray-500 text-xs">
                  {doc.document_type ? (DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type) : "—"}
                </td>
                <td className="px-4 py-3.5 text-gray-600 text-xs whitespace-nowrap">
                  {doc.expires_at ? new Date(doc.expires_at + "T00:00:00").toLocaleDateString("en-ZA") : "—"}
                </td>
                <td className="px-4 py-3.5">
                  {status === "expired" && (
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                      Expired {days !== null ? `${Math.abs(days)}d ago` : ""}
                    </span>
                  )}
                  {status === "expiring_soon" && (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                      Expires in {days}d
                    </span>
                  )}
                  {status === "active" && (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Valid</span>
                  )}
                  {status === "no_expiry" && (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">No expiry</span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-right">
                  {grant?.awardee_id && (
                    <Link href={`/awardees/${grant.awardee_id}/documents`} className="text-xs text-[#6b1a2a] hover:underline font-medium">
                      View →
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default async function CompliancePage() {
  const supabase = await createClient();
  const today    = new Date();

  const [docsRes, grantsRes, milestonesRes, reportsRes] = await Promise.all([
    supabase
      .from("documents")
      .select("id, name, document_type, expires_at, is_compliance, grants(id, title, awardee_id), profiles:uploaded_by(full_name, email)")
      .eq("is_compliance", true)
      .order("expires_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("grants")
      .select("id, title, status, awardee_id, awardees(id, full_name, email)")
      .neq("status", "cancelled"),
    supabase.from("milestones").select("id, status, due_date, grant_id"),
    supabase.from("grant_reports").select("id, status, due_date, submitted_at, grant_id"),
  ]);

  const compliance = (docsRes.data ?? [])      as unknown as ComplianceDoc[];
  const grants     = (grantsRes.data ?? [])     as unknown as GrantRow[];
  const milestones = (milestonesRes.data ?? []) as unknown as MilestoneRow[];
  const reports    = (reportsRes.data ?? [])    as unknown as ReportRow[];

  // ── Document groups ──────────────────────────────────────────────────────
  const expired      = compliance.filter((d) => getExpiryStatus(d.expires_at) === "expired");
  const expiringSoon = compliance.filter((d) => getExpiryStatus(d.expires_at) === "expiring_soon");
  const active       = compliance.filter((d) => getExpiryStatus(d.expires_at) === "active");
  const noExpiry     = compliance.filter((d) => getExpiryStatus(d.expires_at) === "no_expiry");
  const validDocs    = active.length + noExpiry.length;

  // ── Portfolio compliance score ────────────────────────────────────────────
  const msTotal     = milestones.length;
  const msCompleted = milestones.filter((m) => m.status === "completed").length;
  const msScore     = msTotal > 0 ? Math.round((msCompleted / msTotal) * 100) : 100;

  const dueReports  = reports.filter((r) => new Date(r.due_date) < today);
  const submitted   = dueReports.filter((r) => r.status === "submitted" || r.status === "approved");
  const rptScore    = dueReports.length > 0 ? Math.round((submitted.length / dueReports.length) * 100) : 100;

  const totalDocs   = compliance.length;
  const docScore    = totalDocs > 0 ? Math.round((validDocs / totalDocs) * 100) : 100;

  const portfolioScore = Math.round(msScore * 0.4 + rptScore * 0.4 + docScore * 0.2);
  const portfolioColor = portfolioScore >= 75 ? "#16a34a" : portfolioScore >= 50 ? "#d97706" : "#dc2626";
  const portfolioLabel = portfolioScore >= 75 ? "Good Standing" : portfolioScore >= 50 ? "Needs Attention" : "At Risk";

  // Donut parameters for hero ring
  const heroSize = 100;
  const heroCx   = heroSize / 2;
  const heroSw   = 10;
  const heroR    = heroCx - heroSw / 2 - 1;
  const heroCirc = 2 * Math.PI * heroR;
  const heroOff  = heroCirc - (portfolioScore / 100) * heroCirc;

  // ── Per-awardee compliance ranking ──────────────────────────────────────
  const awardeeRows = grants
    .filter((g) => g.awardees)
    .map((g) => {
      const awardee  = g.awardees!;
      const grantMs  = milestones.filter((m) => m.grant_id === g.id);
      const grantRpt = reports.filter((r) => r.grant_id === g.id);
      const grantDoc = compliance.filter((d) => {
        const gr = Array.isArray(d.grants) ? d.grants[0] : d.grants;
        return gr?.id === g.id;
      });

      const comp = grantMs.filter((m) => m.status === "completed").length;
      const aMsS = grantMs.length > 0 ? Math.round((comp / grantMs.length) * 100) : 100;

      const due  = grantRpt.filter((r) => new Date(r.due_date) < today);
      const sub  = due.filter((r) => r.status === "submitted" || r.status === "approved");
      const aRpt = due.length > 0 ? Math.round((sub.length / due.length) * 100) : 100;

      const valid = grantDoc.filter((d) => {
        const s = getExpiryStatus(d.expires_at);
        return s === "active" || s === "no_expiry";
      }).length;
      const aDoc = grantDoc.length > 0 ? Math.round((valid / grantDoc.length) * 100) : 100;

      const overall     = Math.round(aMsS * 0.4 + aRpt * 0.4 + aDoc * 0.2);
      const overdueMs   = grantMs.filter((m) => m.status !== "completed" && new Date(m.due_date) < today).length;
      const overdueRpts = due.filter((r) => r.status !== "submitted" && r.status !== "approved").length;
      const expiredDocs = grantDoc.filter((d) => getExpiryStatus(d.expires_at) === "expired").length;

      return { id: awardee.id, full_name: awardee.full_name, grantTitle: g.title, aMsS, aRpt, aDoc, overall, overdueMs, overdueRpts, expiredDocs };
    })
    .sort((a, b) => a.overall - b.overall);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance</h1>
          <p className="text-sm text-gray-400 mt-0.5">Portfolio-wide compliance monitoring</p>
        </div>
        <span className="text-xs text-gray-400 rounded-xl border border-gray-200 bg-white px-3 py-1.5 shadow-sm">
          {today.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
        </span>
      </div>

      {/* Portfolio Score Hero */}
      <Card className="p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-10">
          {/* Ring + label */}
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <svg width={heroSize} height={heroSize} viewBox={`0 0 ${heroSize} ${heroSize}`} className="-rotate-90">
                <circle cx={heroCx} cy={heroCx} r={heroR} fill="none" stroke="#f3f4f6" strokeWidth={heroSw} />
                <circle cx={heroCx} cy={heroCx} r={heroR} fill="none" stroke={portfolioColor} strokeWidth={heroSw}
                  strokeDasharray={heroCirc} strokeDashoffset={heroOff} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-xl font-black text-gray-900">{portfolioScore}</span>
              </div>
            </div>
            <div>
              <p className="text-3xl font-black text-gray-900">{portfolioScore}%</p>
              <p className="text-sm font-medium text-gray-500 mt-0.5">Portfolio Compliance Score</p>
              <span className={`inline-block mt-2 rounded-full px-3 py-0.5 text-xs font-semibold ${scoreBadge(portfolioScore)}`}>
                {portfolioLabel}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px bg-gray-100 self-stretch" />

          {/* Component scores */}
          <div className="grid grid-cols-3 gap-6 flex-1">
            {[
              { label: "Milestone Completion", score: msScore, weight: "40% weight", detail: `${msCompleted}/${msTotal} complete` },
              { label: "Report Submissions",   score: rptScore, weight: "40% weight", detail: `${submitted.length}/${dueReports.length} due submitted` },
              { label: "Document Validity",    score: docScore,  weight: "20% weight", detail: `${validDocs}/${totalDocs} valid` },
            ].map((comp) => (
              <div key={comp.label} className="text-center">
                <p className="text-2xl font-black text-gray-900" style={{ color: comp.score >= 75 ? "#16a34a" : comp.score >= 50 ? "#d97706" : "#dc2626" }}>
                  {comp.score}%
                </p>
                <p className="text-xs font-semibold text-gray-700 mt-1">{comp.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{comp.detail}</p>
                <p className="text-[10px] text-gray-300 mt-0.5">{comp.weight}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Quick-read stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Expired Docs",      count: expired.length,                       color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
          { label: "Expiring ≤30 days", count: expiringSoon.length,                  color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
          { label: "Valid Docs",        count: validDocs,                             color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
          { label: "Overdue Reports",   count: dueReports.length - submitted.length,  color: "#7c3aed", bg: "#faf5ff", border: "#e9d5ff" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border p-5 text-center" style={{ backgroundColor: s.bg, borderColor: s.border }}>
            <p className="text-3xl font-black" style={{ color: s.color }}>{s.count}</p>
            <p className="text-xs font-medium text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Per-awardee compliance ranking */}
      {awardeeRows.length > 0 && (
        <Card className="p-6">
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-gray-900">Awardee Compliance Ranking</h2>
            <p className="text-xs text-gray-400 mt-0.5">Sorted lowest score first — identifies who needs attention</p>
          </div>
          <div className="overflow-x-auto -mx-6">
            <div className="inline-block min-w-full px-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-3 text-left text-xs font-medium text-gray-400">Awardee</th>
                    <th className="pb-3 text-center text-xs font-medium text-gray-400">Score</th>
                    <th className="pb-3 text-center text-xs font-medium text-gray-400">Milestones</th>
                    <th className="pb-3 text-center text-xs font-medium text-gray-400">Reports</th>
                    <th className="pb-3 text-center text-xs font-medium text-gray-400">Documents</th>
                    <th className="pb-3 text-center text-xs font-medium text-gray-400">Flags</th>
                    <th className="pb-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {awardeeRows.map((row) => {
                    const flags = row.overdueMs + row.overdueRpts + row.expiredDocs;
                    return (
                      <tr key={row.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="py-3.5 pr-6">
                          <p className="font-medium text-gray-900">{row.full_name}</p>
                          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{row.grantTitle}</p>
                        </td>
                        <td className="py-3.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="relative w-10 h-10">
                              <ScoreRing score={row.overall} size={40} />
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="text-[10px] font-bold text-gray-700">{row.overall}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        {[row.aMsS, row.aRpt, row.aDoc].map((score, i) => (
                          <td key={i} className="py-3.5 text-center">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${scoreBadge(score)}`}>
                              {score}%
                            </span>
                          </td>
                        ))}
                        <td className="py-3.5 text-center">
                          {flags > 0 ? (
                            <div className="flex items-center justify-center gap-1 flex-wrap">
                              {row.overdueMs > 0 && (
                                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">{row.overdueMs}ms</span>
                              )}
                              {row.overdueRpts > 0 && (
                                <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">{row.overdueRpts}rpt</span>
                              )}
                              {row.expiredDocs > 0 && (
                                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">{row.expiredDocs}doc</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs font-medium text-green-600">✓ Clean</span>
                          )}
                        </td>
                        <td className="py-3.5 pl-4">
                          <Link href={`/awardees/${row.id}/documents`} className="text-xs text-[#6b1a2a] hover:underline font-medium whitespace-nowrap">
                            View →
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

      {/* Document sections */}
      {expired.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <h2 className="text-sm font-semibold text-gray-900">Expired Documents</h2>
            <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">{expired.length}</span>
          </div>
          <DocTable items={expired} />
        </Card>
      )}

      {expiringSoon.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <h2 className="text-sm font-semibold text-gray-900">Expiring Within 30 Days</h2>
            <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">{expiringSoon.length}</span>
          </div>
          <DocTable items={expiringSoon} />
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <h2 className="text-sm font-semibold text-gray-900">Valid Documents</h2>
          <span className="ml-auto rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">{active.length}</span>
        </div>
        {active.length > 0 ? <DocTable items={active} /> : (
          <p className="text-sm text-gray-400 py-6 text-center">No valid compliance documents yet.</p>
        )}
      </Card>

      {noExpiry.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">No Expiry Set</h2>
            <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">{noExpiry.length}</span>
          </div>
          <DocTable items={noExpiry} />
        </Card>
      )}

      {compliance.length === 0 && (
        <Card className="p-12 text-center">
          <p className="text-sm text-gray-400">No compliance documents tracked yet.</p>
          <p className="text-xs text-gray-400 mt-1">Upload documents and mark them as compliance on an awardee&apos;s Documents tab.</p>
        </Card>
      )}

    </div>
  );
}
