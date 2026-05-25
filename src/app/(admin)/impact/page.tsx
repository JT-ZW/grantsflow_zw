import { createAdminClient } from "@/lib/supabase/admin";
import { AfricaMap } from "./AfricaMap";

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
  const { data: grants } = await supabase
    .from("grants")
    .select("id, title, status, sectors, sdg_goals, country_codes, geographic_scope, amount_awarded, currency_code")
    .not("status", "eq", "cancelled");

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Impact Reporting</h1>
        <p className="mt-1 text-sm text-gray-500">
          Aggregate view of sector coverage, SDG alignment, geographic reach, and reported outcomes.
        </p>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Active Grants", value: activeGrants.length },
          { label: "Countries Reached", value: activeCountryCodes.length },
          { label: "Sectors Covered", value: Object.keys(sectorCounts).length },
          { label: "SDGs Addressed", value: Object.keys(sdgCounts).length },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Africa Map */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Geographic Reach</h2>
          <AfricaMap grantsByCountry={grantsByCountry} />
          <p className="mt-3 text-xs text-gray-400 text-center">
            {activeCountryCodes.length} countr{activeCountryCodes.length !== 1 ? "ies" : "y"} with active grant activity
          </p>
        </div>

        {/* SDG Grid */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">SDG Coverage</h2>
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
        </div>
      </div>

      {/* Sector breakdown */}
      {Object.keys(sectorCounts).length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Sector Breakdown</h2>
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
        </div>
      )}

      {/* Indicator actuals (Layer 2) */}
      {indicatorSummary.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Quantitative Outcomes</h2>
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
        </div>
      )}

      {/* Impact narratives (Layer 3) */}
      {(stories ?? []).length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Impact Stories</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(stories ?? []).map((s) => {
              const milestone = (s.milestones as unknown as { title: string; grants: { title: string } | null } | null);
              return (
                <div key={s.id} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                  {milestone && (
                    <p className="text-xs font-medium text-[#6b1a2a] mb-1 truncate">
                      {milestone.grants?.title ?? ""} · {milestone.title}
                    </p>
                  )}
                  <p className="text-sm text-gray-700 leading-relaxed line-clamp-4">{s.impact_story}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(s.created_at).toLocaleDateString("en-ZA")}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
