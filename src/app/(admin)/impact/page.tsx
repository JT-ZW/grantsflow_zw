import { createAdminClient } from "@/lib/supabase/admin";
import { AfricaMap } from "./AfricaMap";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.04)] ${className}`}>
      {children}
    </div>
  );
}

const SDG_LABELS: Record<number, string> = {
  1: "No Poverty", 2: "Zero Hunger", 3: "Good Health", 4: "Quality Education",
  5: "Gender Equality", 6: "Clean Water", 7: "Affordable Energy", 8: "Decent Work",
  9: "Industry & Innovation", 10: "Reduced Inequalities", 11: "Sustainable Cities",
  12: "Responsible Consumption", 13: "Climate Action", 14: "Life Below Water",
  15: "Life on Land", 16: "Peace & Justice", 17: "Partnerships",
};

const SDG_COLORS: Record<number, string> = {
  1: "#E5243B", 2: "#DDA63A", 3: "#4C9F38", 4: "#C5192D", 5: "#FF3A21",
  6: "#26BDE2", 7: "#FCC30B", 8: "#A21942", 9: "#FD6925", 10: "#DD1367",
  11: "#FD9D24", 12: "#BF8B2E", 13: "#3F7E44", 14: "#0A97D9", 15: "#56C02B",
  16: "#00689D", 17: "#19486A",
};

export default async function ImpactPage() {
  const supabase = createAdminClient();

  // Fetch all grants with impact classification fields
  const [{ data: grants }, { data: awardeeGenders }] = await Promise.all([
    supabase
      .from("grants")
      .select("id, title, status, sectors, sdg_goals, country_codes, geographic_scope, amount_awarded, currency_code")
      .not("status", "eq", "cancelled"),
    supabase
      .from("awardees")
      .select("id, gender"),
  ]);

  const allGrants = grants ?? [];
  const activeGrants = allGrants.filter((g) => g.status === "active");

  // Aggregate sectors
  const sectorCounts: Record<string, number> = {};
  for (const g of activeGrants) {
    for (const s of (g.sectors as string[] | null) ?? []) {
      sectorCounts[s] = (sectorCounts[s] ?? 0) + 1;
    }
  }

  // Aggregate SDGs
  const sdgCounts: Record<number, number> = {};
  for (const g of activeGrants) {
    for (const n of (g.sdg_goals as number[] | null) ?? []) {
      sdgCounts[n] = (sdgCounts[n] ?? 0) + 1;
    }
  }

  // Aggregate country distribution for map
  const grantsByCountry: Record<string, number> = {};
  for (const g of activeGrants) {
    for (const code of (g.country_codes as string[] | null) ?? []) {
      grantsByCountry[code] = (grantsByCountry[code] ?? 0) + 1;
    }
  }
  const activeCountryCodes = Object.keys(grantsByCountry);

  // Aggregate gender breakdown
  const genderRaw = (awardeeGenders ?? []) as { id: string; gender: string | null }[];
  const genderCounts = {
    female:          genderRaw.filter((a) => a.gender === "female").length,
    male:            genderRaw.filter((a) => a.gender === "male").length,
    non_binary:      genderRaw.filter((a) => a.gender === "non_binary").length,
    prefer_not_to_say: genderRaw.filter((a) => a.gender === "prefer_not_to_say").length,
    unspecified:     genderRaw.filter((a) => !a.gender || a.gender === "").length,
  };
  const totalAwardees = genderRaw.length;

  // Fetch indicators + actuals for Layer 2 summary
  const { data: indicators } = await supabase
    .from("grant_impact_indicators")
    .select("id, label, unit, target_value, impact_submissions(actual_value)");

  const indicatorSummary = (indicators ?? []).map((ind) => {
    const subs = (ind.impact_submissions as { actual_value: number }[] | null) ?? [];
    const total = subs.reduce((s, r) => s + (r.actual_value ?? 0), 0);
    return { label: ind.label, unit: ind.unit, target: ind.target_value, actual: total };
  });

  // Fetch latest impact stories for Layer 3 narrative feed
  const { data: stories } = await supabase
    .from("milestone_updates")
    .select("id, impact_story, created_at, milestones(title, grants(title))")
    .not("impact_story", "is", null)
    .order("created_at", { ascending: false })
    .limit(6);

  const totalAmountAwarded = activeGrants.reduce((s, g) => s + (g.amount_awarded ?? 0), 0);

  // Dominant currency
  const currencyCounts: Record<string, number> = {};
  for (const g of activeGrants) currencyCounts[g.currency_code] = (currencyCounts[g.currency_code] ?? 0) + 1;
  const dominantCurrency = Object.entries(currencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "USD";

  function fmtMoney(n: number, currency = "USD") {
    if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${currency} ${(n / 1_000).toFixed(0)}k`;
    return `${currency} ${n.toLocaleString("en-ZA", { minimumFractionDigits: 0 })}`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Impact Reporting</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Sector coverage, SDG alignment, geographic reach, and reported outcomes.
          </p>
        </div>
      </div>

      {/* Hero impact statement */}
      <div
        className="rounded-2xl p-6 text-white"
        style={{ background: "linear-gradient(135deg,#6b1a2a 0%,#3d0f19 100%)" }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50 mb-3">Portfolio at a Glance</p>
        <p className="text-xl sm:text-2xl font-bold text-white leading-snug">
          Supporting <span className="text-white font-black">{totalAwardees}</span> awardee{totalAwardees !== 1 ? "s" : ""} across{" "}
          <span className="text-white font-black">{activeCountryCodes.length}</span> countr{activeCountryCodes.length !== 1 ? "ies" : "y"} with{" "}
          <span className="text-white font-black">{fmtMoney(totalAmountAwarded, dominantCurrency)}</span> invested
          {Object.keys(sectorCounts).length > 0 && (
            <> across <span className="text-white font-black">{Object.keys(sectorCounts).length}</span> sector{Object.keys(sectorCounts).length !== 1 ? "s" : ""}</>
          )}
          {Object.keys(sdgCounts).length > 0 && (
            <>, aligned to <span className="text-white font-black">{Object.keys(sdgCounts).length}</span> SDG{Object.keys(sdgCounts).length !== 1 ? "s" : ""}</>
          )}.
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Active Grants",    value: activeGrants.length },
          { label: "Total Awardees",   value: totalAwardees },
          { label: "Countries Reached",value: activeCountryCodes.length },
          { label: "Sectors Covered",  value: Object.keys(sectorCounts).length },
          { label: "SDGs Addressed",   value: Object.keys(sdgCounts).length },
        ].map((s) => (
          <Card key={s.label} className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400">{s.label}</p>
            <p className="text-3xl font-black text-gray-900 mt-1.5">{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Africa Map */}
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Geographic Reach</h2>
          <AfricaMap grantsByCountry={grantsByCountry} />
          <p className="mt-3 text-xs text-gray-400 text-center">
            {activeCountryCodes.length} countr{activeCountryCodes.length !== 1 ? "ies" : "y"} with active grant activity
          </p>
        </Card>

        {/* SDG Grid */}
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">SDG Alignment</h2>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            {Array.from({ length: 17 }, (_, i) => i + 1).map((n) => {
              const count = sdgCounts[n] ?? 0;
              const active = count > 0;
              return (
                <div
                  key={n}
                  title={SDG_LABELS[n]}
                  className={`flex flex-col items-center justify-center rounded-lg p-2 text-center`}
                  style={{ backgroundColor: active ? SDG_COLORS[n] : "#d1d5db" }}
                >
                  <span className={`text-lg font-black leading-none ${active ? "text-white" : "text-gray-400"}`}>{n}</span>
                  {active && (
                    <span className="text-[9px] text-white/80 mt-0.5">{count} grant{count !== 1 ? "s" : ""}</span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Sector breakdown */}
      {Object.keys(sectorCounts).length > 0 && (
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Sector Breakdown</h2>
          <div className="space-y-2.5">
            {Object.entries(sectorCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([sector, count]) => {
                const pct = Math.round((count / activeGrants.length) * 100);
                return (
                  <div key={sector} className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 w-44 truncate">{sector}</span>
                    <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#6b1a2a]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-8 text-right">{count}</span>
                  </div>
                );
              })}
          </div>
        </Card>
      )}

      {/* Gender breakdown */}
      {totalAwardees > 0 && (
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Gender Breakdown</h2>
          <p className="text-xs text-gray-400 mb-5">Disaggregated by awardee gender across all registered awardees.</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
            {[
              { label: "Female-led",    count: genderCounts.female,          color: "#be185d" },
              { label: "Male-led",      count: genderCounts.male,            color: "#1d4ed8" },
              { label: "Non-binary",    count: genderCounts.non_binary,      color: "#7c3aed" },
              { label: "Undisclosed",   count: genderCounts.prefer_not_to_say + genderCounts.unspecified, color: "#6b7280" },
            ].map((g) => {
              const pct = totalAwardees > 0 ? Math.round((g.count / totalAwardees) * 100) : 0;
              return (
                <div key={g.label} className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                    <span className="text-xs text-gray-500">{g.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{g.count}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{pct}% of awardees</p>
                  <div className="mt-3 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: g.color }} />
                  </div>
                </div>
              );
            })}
          </div>
          {genderCounts.female > 0 && (
            <div className="rounded-lg bg-pink-50 border border-pink-100 px-4 py-3 flex items-center gap-3">
              <span className="text-pink-600 text-lg">♀</span>
              <p className="text-sm text-pink-800">
                <strong>{genderCounts.female}</strong> female-led awardee{genderCounts.female !== 1 ? "s" : ""} —{" "}
                {Math.round((genderCounts.female / totalAwardees) * 100)}% of your portfolio. Strong on gender equity.
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Indicator actuals (Layer 2) */}
      {indicatorSummary.length > 0 && (
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Quantitative Outcomes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                  <th className="pb-2 font-medium">Indicator</th>
                  <th className="pb-2 font-medium">Unit</th>
                  <th className="pb-2 font-medium text-right">Target</th>
                  <th className="pb-2 font-medium text-right">Reported</th>
                  <th className="pb-2 font-medium w-28">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {indicatorSummary.map((ind) => {
                  const pct = ind.target > 0 ? Math.min(100, Math.round((ind.actual / ind.target) * 100)) : 0;
                  return (
                    <tr key={ind.label}>
                      <td className="py-2.5 text-gray-900 pr-4">{ind.label}</td>
                      <td className="py-2.5 text-gray-400">{ind.unit}</td>
                      <td className="py-2.5 text-right text-gray-600">{ind.target.toLocaleString()}</td>
                      <td className="py-2.5 text-right font-semibold text-gray-900">{ind.actual.toLocaleString()}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-1.5 rounded-full bg-gray-100">
                            <div
                              className={`h-full rounded-full ${pct >= 100 ? "bg-green-500" : pct >= 50 ? "bg-blue-500" : "bg-yellow-400"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Impact narratives (Layer 3) */}
      {(stories ?? []).length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Impact Stories</h2>
              <p className="text-xs text-gray-400 mt-0.5">First-hand narratives from milestone submissions</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(stories ?? []).map((s) => {
              const milestone = (s.milestones as unknown as { title: string; grants: { title: string } | null } | null);
              return (
                <div key={s.id} className="rounded-xl border border-gray-100 bg-gray-50/70 p-5 flex flex-col gap-3">
                  {milestone && (
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#6b1a2a]" />
                      <p className="text-xs font-semibold text-[#6b1a2a] truncate">
                        {milestone.grants?.title ?? ""} · {milestone.title}
                      </p>
                    </div>
                  )}
                  <p className="text-sm text-gray-700 leading-relaxed line-clamp-5 flex-1">&ldquo;{s.impact_story}&rdquo;</p>
                  <p className="text-[10px] text-gray-400 font-medium">
                    {new Date(s.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
