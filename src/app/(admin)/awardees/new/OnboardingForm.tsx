"use client";

import { useActionState, useState } from "react";
import { createAwardeeAndGrant, type OnboardingState } from "../actions";
import { cn } from "@/lib/utils";

const initialState: OnboardingState = {};

const GRANT_TYPES = [
  "Research Grant",
  "Innovation & Entrepreneurship",
  "Conference & Travel",
  "Equipment & Infrastructure",
  "Postgraduate Bursary",
  "Community Engagement",
  "Other",
];

const CURRENCIES = ["ZiG", "USD", "ZAR", "EUR", "GBP"];

const SECTORS = [
  "Climate & Environment",
  "Agriculture & Food Security",
  "Health & Wellbeing",
  "Education & Skills",
  "Technology & Innovation",
  "Economic Development",
  "Arts, Culture & Heritage",
  "Water & Sanitation",
  "Energy",
  "Gender & Inclusion",
  "Governance & Peace",
  "Other",
];

const SDG_GOALS = [
  { n: 1,  label: "No Poverty" },
  { n: 2,  label: "Zero Hunger" },
  { n: 3,  label: "Good Health & Well-being" },
  { n: 4,  label: "Quality Education" },
  { n: 5,  label: "Gender Equality" },
  { n: 6,  label: "Clean Water & Sanitation" },
  { n: 7,  label: "Affordable & Clean Energy" },
  { n: 8,  label: "Decent Work & Economic Growth" },
  { n: 9,  label: "Industry, Innovation & Infrastructure" },
  { n: 10, label: "Reduced Inequalities" },
  { n: 11, label: "Sustainable Cities & Communities" },
  { n: 12, label: "Responsible Consumption & Production" },
  { n: 13, label: "Climate Action" },
  { n: 14, label: "Life Below Water" },
  { n: 15, label: "Life on Land" },
  { n: 16, label: "Peace, Justice & Strong Institutions" },
  { n: 17, label: "Partnerships for the Goals" },
];

const AFRICAN_COUNTRIES: { code: string; name: string }[] = [
  { code: "DZA", name: "Algeria" }, { code: "AGO", name: "Angola" },
  { code: "BEN", name: "Benin" }, { code: "BWA", name: "Botswana" },
  { code: "BFA", name: "Burkina Faso" }, { code: "BDI", name: "Burundi" },
  { code: "CPV", name: "Cabo Verde" }, { code: "CMR", name: "Cameroon" },
  { code: "CAF", name: "Central African Republic" }, { code: "TCD", name: "Chad" },
  { code: "COM", name: "Comoros" }, { code: "COD", name: "DR Congo" },
  { code: "COG", name: "Republic of Congo" }, { code: "CIV", name: "Côte d'Ivoire" },
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
  { code: "STP", name: "São Tomé & Príncipe" }, { code: "SEN", name: "Senegal" },
  { code: "SLE", name: "Sierra Leone" }, { code: "SOM", name: "Somalia" },
  { code: "ZAF", name: "South Africa" }, { code: "SSD", name: "South Sudan" },
  { code: "SDN", name: "Sudan" }, { code: "TZA", name: "Tanzania" },
  { code: "TGO", name: "Togo" }, { code: "TUN", name: "Tunisia" },
  { code: "UGA", name: "Uganda" }, { code: "ZMB", name: "Zambia" },
  { code: "ZWE", name: "Zimbabwe" },
];

type Milestone = { title: string; due_date: string; deliverables: string };

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-1 text-xs text-red-600">{errors[0]}</p>;
}

function Label({ htmlFor, children, required }: { htmlFor: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function Input({
  id, name, type = "text", placeholder, required, defaultValue, className,
}: {
  id: string; name: string; type?: string; placeholder?: string;
  required?: boolean; defaultValue?: string; className?: string;
}) {
  return (
    <input
      id={id} name={name} type={type} placeholder={placeholder}
      required={required} defaultValue={defaultValue}
      className={cn(
        "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400",
        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
        className
      )}
    />
  );
}

export default function OnboardingForm() {
  const [state, formAction, pending] = useActionState(createAwardeeAndGrant, initialState);
  const [milestones, setMilestones] = useState<Milestone[]>([
    { title: "", due_date: "", deliverables: "" },
  ]);
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedSdgs, setSelectedSdgs] = useState<number[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);

  function toggleSector(s: string) {
    setSelectedSectors((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }
  function toggleSdg(n: number) {
    setSelectedSdgs((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]
    );
  }
  function toggleCountry(code: string) {
    setSelectedCountries((prev) =>
      prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code]
    );
  }

  function addMilestone() {
    if (milestones.length < 8) {
      setMilestones([...milestones, { title: "", due_date: "", deliverables: "" }]);
    }
  }

  function removeMilestone(i: number) {
    setMilestones(milestones.filter((_, idx) => idx !== i));
  }

  function updateMilestone(i: number, field: keyof Milestone, value: string) {
    const updated = milestones.map((m, idx) =>
      idx === i ? { ...m, [field]: value } : m
    );
    setMilestones(updated);
  }

  const sectionClass = "rounded-xl border border-gray-200 bg-white p-6 space-y-4";
  const sectionTitle = "text-base font-semibold text-gray-900 mb-4";

  return (
    <form action={formAction} className="space-y-6">
      {/* Hidden milestones JSON */}
      <input type="hidden" name="milestones_json" value={JSON.stringify(milestones)} />
      {/* Hidden impact classification */}
      <input type="hidden" name="sectors_json"   value={JSON.stringify(selectedSectors)} />
      <input type="hidden" name="sdg_goals_json" value={JSON.stringify(selectedSdgs)} />
      <input type="hidden" name="country_codes_json" value={JSON.stringify(selectedCountries)} />

      {state.message && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {state.message}
        </div>
      )}

      {/* ── AWARDEE DETAILS ───────────────────────────────── */}
      <div className={sectionClass}>
        <h2 className={sectionTitle}>Awardee Details</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="full_name" required>Full name</Label>
            <Input id="full_name" name="full_name" placeholder="Dr. Jane Dlamini" required />
            <FieldError errors={state.errors?.full_name} />
          </div>
          <div>
            <Label htmlFor="email" required>Email address</Label>
            <Input id="email" name="email" type="email" placeholder="johndoe@gmail.com" required />
            <FieldError errors={state.errors?.email} />
          </div>
          <div>
            <Label htmlFor="phone">Phone number</Label>
            <Input id="phone" name="phone" type="tel" placeholder="+27 71 000 0000" />
          </div>
          <div>
            <Label htmlFor="awardee_type" required>Awardee type</Label>
            <select
              id="awardee_type"
              name="awardee_type"
              defaultValue="individual"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="individual">Individual</option>
              <option value="team">Team</option>
              <option value="organization">Organization</option>
            </select>
          </div>
          <div>
            <Label htmlFor="gender">Gender</Label>
            <select
              id="gender"
              name="gender"
              defaultValue=""
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Not specified</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="non_binary">Non-binary</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
            <p className="mt-1 text-xs text-gray-400">Used for gender-disaggregated impact reporting.</p>
          </div>
          <div>
            <Label htmlFor="student_number">Student / Staff number</Label>
            <Input id="student_number" name="student_number" placeholder="e.g. 12345678" />
          </div>
          <div>
            <Label htmlFor="faculty">Faculty</Label>
            <Input id="faculty" name="faculty" placeholder="e.g. Engineering & the Built Environment" />
          </div>
          <div>
            <Label htmlFor="department">Department</Label>
            <Input id="department" name="department" placeholder="e.g. Computer Science" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-gray-100">
          <div>
            <Label htmlFor="supervisor_name">Supervisor / Line manager</Label>
            <Input id="supervisor_name" name="supervisor_name" placeholder="Prof. John Mokoena" />
          </div>
          <div>
            <Label htmlFor="supervisor_email">Supervisor email</Label>
            <Input id="supervisor_email" name="supervisor_email" type="email" placeholder="supervisor@gmail.com" />
            <FieldError errors={state.errors?.supervisor_email} />
          </div>
        </div>
      </div>

      {/* ── GRANT DETAILS ────────────────────────────────── */}
      <div className={sectionClass}>
        <h2 className={sectionTitle}>Grant Details</h2>

        <div>
          <Label htmlFor="grant_title" required>Grant title</Label>
          <Input id="grant_title" name="grant_title" placeholder="e.g. AI-Assisted Crop Disease Detection" required />
          <FieldError errors={state.errors?.grant_title} />
        </div>

        <div>
          <Label htmlFor="grant_description">Description</Label>
          <textarea
            id="grant_description"
            name="grant_description"
            rows={3}
            placeholder="Brief description of the project or research..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="grant_type" required>Grant type</Label>
            <select
              id="grant_type"
              name="grant_type"
              defaultValue=""
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="" disabled>Select type…</option>
              {GRANT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <FieldError errors={state.errors?.grant_type} />
          </div>

          <div>
            <Label htmlFor="amount_awarded" required>Amount awarded</Label>
            <div className="flex gap-2">
              <select
                name="currency_code"
                defaultValue="ZiG"
                className="rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <Input
                id="amount_awarded"
                name="amount_awarded"
                type="number"
                placeholder="50000"
                required
                className="flex-1"
              />
            </div>
            <FieldError errors={state.errors?.amount_awarded} />
          </div>

          <div>
            <Label htmlFor="start_date" required>Start date</Label>
            <Input id="start_date" name="start_date" type="date" required />
            <FieldError errors={state.errors?.start_date} />
          </div>

          <div>
            <Label htmlFor="end_date" required>End date</Label>
            <Input id="end_date" name="end_date" type="date" required />
            <FieldError errors={state.errors?.end_date} />
          </div>
        </div>
      </div>

      {/* ── MILESTONES ──────────────────────────────────── */}
      <div className={sectionClass}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={cn(sectionTitle, "mb-0")}>Milestones</h2>
          <button
            type="button"
            onClick={addMilestone}
            disabled={milestones.length >= 8}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-40"
          >
            + Add milestone
          </button>
        </div>

        <div className="space-y-4">
          {milestones.map((m, i) => (
            <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Milestone {i + 1}
                </span>
                {milestones.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMilestone(i)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`ms_title_${i}`}>Title</Label>
                  <input
                    id={`ms_title_${i}`}
                    value={m.title}
                    onChange={(e) => updateMilestone(i, "title", e.target.value)}
                    placeholder="e.g. Literature review completed"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <Label htmlFor={`ms_date_${i}`}>Due date</Label>
                  <input
                    id={`ms_date_${i}`}
                    type="date"
                    value={m.due_date}
                    onChange={(e) => updateMilestone(i, "due_date", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor={`ms_del_${i}`}>Deliverables</Label>
                  <input
                    id={`ms_del_${i}`}
                    value={m.deliverables}
                    onChange={(e) => updateMilestone(i, "deliverables", e.target.value)}
                    placeholder="e.g. Submitted 20-page review document"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── IMPACT CLASSIFICATION ──────────────────────── */}
      <div className={sectionClass}>
        <h2 className={sectionTitle}>Impact Classification</h2>
        <p className="text-xs text-gray-500 -mt-2 mb-4">
          Used for impact reporting, donor dashboards, and the Africa grant map.
        </p>

        {/* Sectors */}
        <div>
          <Label htmlFor="sectors">Sectors <span className="font-normal text-gray-400">(select all that apply)</span></Label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {SECTORS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSector(s)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  selectedSectors.includes(s)
                    ? "border-[#6b1a2a] bg-[#6b1a2a] text-white"
                    : "border-gray-300 bg-white text-gray-600 hover:border-[#6b1a2a] hover:text-[#6b1a2a]"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* SDG Goals */}
        <div className="pt-3 border-t border-gray-100">
          <Label htmlFor="sdgs">UN SDG Alignment <span className="font-normal text-gray-400">(select all that apply)</span></Label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {SDG_GOALS.map(({ n, label }) => (
              <button
                key={n}
                type="button"
                onClick={() => toggleSdg(n)}
                title={label}
                className={cn(
                  "w-9 h-9 rounded-lg border text-xs font-bold transition-colors",
                  selectedSdgs.includes(n)
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-gray-300 bg-white text-gray-500 hover:border-blue-500 hover:text-blue-600"
                )}
              >
                {n}
              </button>
            ))}
          </div>
          {selectedSdgs.length > 0 && (
            <p className="mt-2 text-xs text-gray-500">
              {selectedSdgs.sort((a, b) => a - b).map((n) => `SDG ${n}: ${SDG_GOALS[n - 1].label}`).join(" · ")}
            </p>
          )}
        </div>

        {/* Geographic scope + countries */}
        <div className="pt-3 border-t border-gray-100 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="geographic_scope">Geographic scope</Label>
            <select
              id="geographic_scope"
              name="geographic_scope"
              defaultValue=""
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Not specified</option>
              <option value="local">Local</option>
              <option value="national">National</option>
              <option value="regional">Regional</option>
              <option value="continental">Continental (Africa)</option>
              <option value="international">International</option>
            </select>
          </div>
          <div>
            <Label htmlFor="beneficiary_type">Beneficiary type</Label>
            <input
              id="beneficiary_type"
              name="beneficiary_type"
              placeholder="e.g. smallholder farmers, youth, communities…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Country picker */}
        <div className="pt-3 border-t border-gray-100">
          <Label htmlFor="countries">Countries of impact <span className="font-normal text-gray-400">(select all active)</span></Label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {AFRICAN_COUNTRIES.map(({ code, name }) => (
              <button
                key={code}
                type="button"
                onClick={() => toggleCountry(code)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  selectedCountries.includes(code)
                    ? "border-green-600 bg-green-600 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-green-500 hover:text-green-700"
                )}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── SUBMIT ──────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3">
        <a
          href="/awardees"
          className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {pending ? "Saving…" : "Create Awardee & Grant"}
        </button>
      </div>
    </form>
  );
}
