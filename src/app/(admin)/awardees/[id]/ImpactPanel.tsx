"use client";

import { useState, useTransition } from "react";
import { addImpactIndicator, deleteImpactIndicator, updateGrantImpact } from "./actions";

type Submission = {
  id: string;
  actual_value: number;
  note: string | null;
  submitted_at: string;
};

type Indicator = {
  id: string;
  grant_id: string;
  label: string;
  unit: string;
  target_value: number;
  sort_order: number;
  impact_submissions: Submission[];
};

type Grant = {
  id: string;
  sectors: string[] | null;
  sdg_goals: number[] | null;
  country_codes: string[] | null;
  geographic_scope: string | null;
  beneficiary_type: string | null;
};

type Props = {
  grant: Grant;
  indicators: Indicator[];
  awardeeId: string;
};

const SECTORS = [
  "Climate & Environment", "Agriculture & Food Security", "Health & Wellbeing",
  "Education & Skills", "Technology & Innovation", "Economic Development",
  "Arts, Culture & Heritage", "Water & Sanitation", "Energy",
  "Gender & Inclusion", "Governance & Peace", "Other",
];

const SDG_LABELS: Record<number, string> = {
  1: "No Poverty", 2: "Zero Hunger", 3: "Good Health & Well-being",
  4: "Quality Education", 5: "Gender Equality", 6: "Clean Water & Sanitation",
  7: "Affordable & Clean Energy", 8: "Decent Work & Economic Growth",
  9: "Industry, Innovation & Infrastructure", 10: "Reduced Inequalities",
  11: "Sustainable Cities & Communities", 12: "Responsible Consumption & Production",
  13: "Climate Action", 14: "Life Below Water", 15: "Life on Land",
  16: "Peace, Justice & Strong Institutions", 17: "Partnerships for the Goals",
};

const AFRICAN_COUNTRIES: { code: string; name: string }[] = [
  { code: "DZA", name: "Algeria" }, { code: "AGO", name: "Angola" },
  { code: "BEN", name: "Benin" }, { code: "BWA", name: "Botswana" },
  { code: "BFA", name: "Burkina Faso" }, { code: "BDI", name: "Burundi" },
  { code: "CMR", name: "Cameroon" }, { code: "CPV", name: "Cabo Verde" },
  { code: "CAF", name: "Central African Republic" }, { code: "TCD", name: "Chad" },
  { code: "COM", name: "Comoros" }, { code: "COD", name: "DR Congo" },
  { code: "COG", name: "Republic of Congo" }, { code: "CIV", name: "CÃ´te d'Ivoire" },
  { code: "DJI", name: "Djibouti" }, { code: "EGY", name: "Egypt" },
  { code: "GNQ", name: "Equatorial Guinea" }, { code: "ERI", name: "Eritrea" },
  { code: "SWZ", name: "Eswatini" }, { code: "ETH", name: "Ethiopia" },
  { code: "GAB", name: "Gabon" }, { code: "GMB", name: "Gambia" },
  { code: "GHA", name: "Ghana" }, { code: "GIN", name: "Guinea" },
  { code: "GNB", name: "Guinea-Bissau" }, { code: "KEN", name: "Kenya" },
  { code: "LSO", name: "Lesotho" }, { code: "LBR", name: "Liberia" },
  { code: "LBY", name: "Libya" }, { code: "MDG", name: "Madagascar" },
  { code: "MWI", name: "Malawi" }, { code: "MLI", name: "Mali" },
  { code: "MRT", name: "Mauritania" }, { code: "MUS", name: "Mauritius" },
  { code: "MAR", name: "Morocco" }, { code: "MOZ", name: "Mozambique" },
  { code: "NAM", name: "Namibia" }, { code: "NER", name: "Niger" },
  { code: "NGA", name: "Nigeria" }, { code: "RWA", name: "Rwanda" },
  { code: "STP", name: "SÃ£o TomÃ© & PrÃ­ncipe" }, { code: "SEN", name: "Senegal" },
  { code: "SLE", name: "Sierra Leone" }, { code: "SOM", name: "Somalia" },
  { code: "ZAF", name: "South Africa" }, { code: "SSD", name: "South Sudan" },
  { code: "SDN", name: "Sudan" }, { code: "TZA", name: "Tanzania" },
  { code: "TGO", name: "Togo" }, { code: "TUN", name: "Tunisia" },
  { code: "UGA", name: "Uganda" }, { code: "ZMB", name: "Zambia" },
  { code: "ZWE", name: "Zimbabwe" },
];

const SDG_COLORS: Record<number, string> = {
  1: "#e5243b", 2: "#dda63a", 3: "#4c9f38", 4: "#c5192d",
  5: "#ff3a21", 6: "#26bde2", 7: "#fcc30b", 8: "#a21942",
  9: "#fd6925", 10: "#dd1367", 11: "#fd9d24", 12: "#bf8b2e",
  13: "#3f7e44", 14: "#0a97d9", 15: "#56c02b", 16: "#00689d",
  17: "#19486a",
};

function ProgressBar({ actual, target }: { actual: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span className="font-semibold text-gray-700">{actual.toLocaleString()}</span>
        <span>of {target.toLocaleString()} ({pct}%)</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            pct >= 100 ? "bg-green-500" : pct >= 60 ? "bg-blue-500" : "bg-amber-400"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function ImpactPanel({ grant, indicators, awardeeId }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [showEditClass, setShowEditClass] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Edit state â€” initialised from current grant data
  const [editSectors, setEditSectors] = useState<string[]>(grant.sectors ?? []);
  const [editSdgs, setEditSdgs] = useState<number[]>(grant.sdg_goals ?? []);
  const [editCountries, setEditCountries] = useState<string[]>(grant.country_codes ?? []);

  function toggleSector(s: string) {
    setEditSectors((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]);
  }
  function toggleSdg(n: number) {
    setEditSdgs((p) => p.includes(n) ? p.filter((x) => x !== n) : [...p, n]);
  }
  function toggleCountry(code: string) {
    setEditCountries((p) => p.includes(code) ? p.filter((x) => x !== code) : [...p, code]);
  }

  function handleSaveClassification(formData: FormData) {
    formData.set("sectors_json",       JSON.stringify(editSectors));
    formData.set("sdg_goals_json",     JSON.stringify(editSdgs));
    formData.set("country_codes_json", JSON.stringify(editCountries));
    setSaveError(null);
    setSaveSuccess(false);
    startTransition(async () => {
      const result = await updateGrantImpact(formData);
      if (result?.error) {
        setSaveError(result.error);
      } else {
        setSaveSuccess(true);
        setShowEditClass(false);
      }
    });
  }

  function handleAdd(formData: FormData) {
    startTransition(async () => {
      await addImpactIndicator(formData);
      setShowForm(false);
    });
  }

  function handleDelete(indicatorId: string) {
    const fd = new FormData();
    fd.set("indicator_id", indicatorId);
    fd.set("awardee_id", awardeeId);
    startTransition(() => deleteImpactIndicator(fd));
  }

  const hasClassification =
    (grant.sectors ?? []).length > 0 ||
    (grant.sdg_goals ?? []).length > 0 ||
    (grant.country_codes ?? []).length > 0 ||
    grant.geographic_scope ||
    grant.beneficiary_type;

  return (
    <div className="space-y-6">
      {/* â”€â”€ Grant classification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Impact Classification</p>
          <button
            onClick={() => { setShowEditClass((v) => !v); setSaveError(null); setSaveSuccess(false); }}
            className="text-xs text-[#6b1a2a] hover:underline font-medium"
          >
            {showEditClass ? "Cancel" : "Edit classification"}
          </button>
        </div>

        {/* Edit form */}
        {showEditClass && (
          <form action={handleSaveClassification} className="rounded-xl border border-dashed border-[#6b1a2a]/30 bg-[#fdf6f7] p-5 space-y-5">
            <input type="hidden" name="grant_id"   value={grant.id} />
            <input type="hidden" name="awardee_id" value={awardeeId} />

            {/* Sectors */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">Sectors</p>
              <div className="flex flex-wrap gap-2">
                {SECTORS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSector(s)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      editSectors.includes(s)
                        ? "bg-[#6b1a2a] border-[#6b1a2a] text-white"
                        : "border-gray-300 text-gray-600 hover:border-[#6b1a2a] hover:text-[#6b1a2a]"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* SDG Goals */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">SDG Goals</p>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 17 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    title={SDG_LABELS[n]}
                    onClick={() => toggleSdg(n)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center border-2 transition-all ${
                      editSdgs.includes(n)
                        ? "border-transparent text-white opacity-100"
                        : "border-gray-200 text-gray-500 opacity-40 hover:opacity-80"
                    }`}
                    style={editSdgs.includes(n) ? { backgroundColor: SDG_COLORS[n] } : {}}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Countries */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">Countries</p>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 grid grid-cols-2 sm:grid-cols-3 gap-1">
                {AFRICAN_COUNTRIES.map((c) => (
                  <label key={c.code} className="flex items-center gap-1.5 cursor-pointer rounded px-2 py-1 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-[#6b1a2a] focus:ring-[#6b1a2a]"
                      checked={editCountries.includes(c.code)}
                      onChange={() => toggleCountry(c.code)}
                    />
                    <span className="text-xs text-gray-700">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Scope + Beneficiaries */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Geographic scope</label>
                <select
                  name="geographic_scope"
                  defaultValue={grant.geographic_scope ?? ""}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a]"
                >
                  <option value="">â€” not specified â€”</option>
                  <option value="local">Local</option>
                  <option value="national">National</option>
                  <option value="regional">Regional</option>
                  <option value="continental">Continental</option>
                  <option value="international">International</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Beneficiary type</label>
                <input
                  name="beneficiary_type"
                  defaultValue={grant.beneficiary_type ?? ""}
                  placeholder="e.g. Smallholder farmers"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a]"
                />
              </div>
            </div>

            {saveError && (
              <p className="text-xs text-red-600">{saveError}</p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-[#6b1a2a] text-white text-xs font-semibold px-5 py-2 hover:bg-[#5a1522] disabled:opacity-50 transition-colors"
            >
              {isPending ? "Savingâ€¦" : "Save classification"}
            </button>
          </form>
        )}

        {/* Display current values */}
        {!showEditClass && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(grant.sectors ?? []).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Sectors</p>
                <div className="flex flex-wrap gap-1.5">
                  {grant.sectors!.map((s) => (
                    <span key={s} className="rounded-full bg-[#6b1a2a]/10 text-[#6b1a2a] border border-[#6b1a2a]/20 px-3 py-0.5 text-xs font-medium">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(grant.sdg_goals ?? []).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">SDG Alignment</p>
                <div className="flex flex-wrap gap-1.5">
                  {grant.sdg_goals!.map((n) => (
                    <span
                      key={n}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: SDG_COLORS[n] ?? "#555" }}
                      title={`SDG ${n}`}
                    >
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(grant.country_codes ?? []).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Countries</p>
                <div className="flex flex-wrap gap-1.5">
                  {grant.country_codes!.map((c) => (
                    <span key={c} className="rounded-md bg-green-50 border border-green-200 text-green-800 px-2 py-0.5 text-xs font-medium">
                      {AFRICAN_COUNTRIES.find((ac) => ac.code === c)?.name ?? c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              {grant.geographic_scope && (
                <p className="text-xs text-gray-600">
                  <span className="font-medium text-gray-500">Scope:</span>{" "}
                  <span className="capitalize">{grant.geographic_scope}</span>
                </p>
              )}
              {grant.beneficiary_type && (
                <p className="text-xs text-gray-600">
                  <span className="font-medium text-gray-500">Beneficiaries:</span>{" "}
                  {grant.beneficiary_type}
                </p>
              )}
            </div>

            {!hasClassification && (
              <p className="sm:col-span-2 text-sm text-gray-400 italic">
                No impact classification set. Click &quot;Edit classification&quot; to add sectors, SDGs and countries.
              </p>
            )}
          </div>
        )}

        {saveSuccess && (
          <p className="text-xs text-green-600 font-medium">Classification saved â€” impact page will now reflect this data.</p>
        )}
      </div>

      {/* â”€â”€ Impact indicators â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Impact Indicators</p>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="text-xs text-[#6b1a2a] hover:underline font-medium"
          >
            {showForm ? "Cancel" : "+ Add indicator"}
          </button>
        </div>

        {/* Add form */}
        {showForm && (
          <form action={handleAdd} className="mb-4 rounded-lg border border-dashed border-gray-200 p-4 space-y-3">
            <input type="hidden" name="grant_id"   value={grant.id} />
            <input type="hidden" name="awardee_id" value={awardeeId} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Metric label *</label>
                <input
                  name="label"
                  required
                  placeholder="e.g. Beneficiaries reached"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a]/30 focus:border-[#6b1a2a]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Unit *</label>
                <input
                  name="unit"
                  required
                  placeholder="e.g. people, jobs, tonnes"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a]/30 focus:border-[#6b1a2a]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Target *</label>
                <input
                  name="target_value"
                  type="number"
                  min="0"
                  required
                  placeholder="e.g. 200"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a]/30 focus:border-[#6b1a2a]"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-[#6b1a2a] text-white text-xs font-medium px-4 py-2 hover:bg-[#5a1622] disabled:opacity-50 transition-colors"
            >
              {isPending ? "Addingâ€¦" : "Add indicator"}
            </button>
          </form>
        )}

        {/* Indicator list */}
        {indicators.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No impact indicators defined yet. Add one above to start tracking.</p>
        ) : (
          <div className="space-y-3">
            {indicators.map((ind) => {
              const total = ind.impact_submissions.reduce((s, sub) => s + sub.actual_value, 0);
              const latest = ind.impact_submissions[0] ?? null;

              return (
                <div key={ind.id} className="rounded-lg border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{ind.label}</p>
                      <p className="text-xs text-gray-400">{ind.unit}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(ind.id)}
                      disabled={isPending}
                      className="text-xs text-red-400 hover:text-red-600 shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                  <ProgressBar actual={total} target={ind.target_value} />
                  {latest?.note && (
                    <p className="mt-2 text-xs text-gray-500 italic">&ldquo;{latest.note}&rdquo;</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

