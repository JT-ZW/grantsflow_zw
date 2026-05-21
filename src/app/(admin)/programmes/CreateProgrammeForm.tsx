"use client";

import { useActionState, useState } from "react";
import { createProgramme, type ProgrammeState } from "./actions";

const CURRENCIES = [
  // Top priorities
  { code: "USD", label: "USD – US Dollar" },
  { code: "ZIG", label: "ZIG – Zimbabwe Gold" },
  // Africa
  { code: "ZAR", label: "ZAR – South African Rand" },
  { code: "KES", label: "KES – Kenyan Shilling" },
  { code: "NGN", label: "NGN – Nigerian Naira" },
  { code: "GHS", label: "GHS – Ghanaian Cedi" },
  { code: "EGP", label: "EGP – Egyptian Pound" },
  { code: "ETB", label: "ETB – Ethiopian Birr" },
  { code: "TZS", label: "TZS – Tanzanian Shilling" },
  { code: "UGX", label: "UGX – Ugandan Shilling" },
  { code: "RWF", label: "RWF – Rwandan Franc" },
  { code: "ZMW", label: "ZMW – Zambian Kwacha" },
  { code: "BWP", label: "BWP – Botswana Pula" },
  { code: "MWK", label: "MWK – Malawian Kwacha" },
  { code: "MZN", label: "MZN – Mozambican Metical" },
  { code: "NAD", label: "NAD – Namibian Dollar" },
  { code: "MAD", label: "MAD – Moroccan Dirham" },
  { code: "TND", label: "TND – Tunisian Dinar" },
  { code: "DZD", label: "DZD – Algerian Dinar" },
  { code: "XOF", label: "XOF – West African CFA Franc" },
  { code: "XAF", label: "XAF – Central African CFA Franc" },
  // Europe
  { code: "EUR", label: "EUR – Euro" },
  { code: "GBP", label: "GBP – British Pound" },
  { code: "CHF", label: "CHF – Swiss Franc" },
  { code: "SEK", label: "SEK – Swedish Krona" },
  { code: "NOK", label: "NOK – Norwegian Krone" },
  { code: "DKK", label: "DKK – Danish Krone" },
  // Americas
  { code: "CAD", label: "CAD – Canadian Dollar" },
  { code: "BRL", label: "BRL – Brazilian Real" },
  { code: "MXN", label: "MXN – Mexican Peso" },
  // Asia-Pacific
  { code: "JPY", label: "JPY – Japanese Yen" },
  { code: "CNY", label: "CNY – Chinese Yuan" },
  { code: "INR", label: "INR – Indian Rupee" },
  { code: "AUD", label: "AUD – Australian Dollar" },
  { code: "NZD", label: "NZD – New Zealand Dollar" },
  { code: "SGD", label: "SGD – Singapore Dollar" },
  { code: "HKD", label: "HKD – Hong Kong Dollar" },
  { code: "AED", label: "AED – UAE Dirham" },
  { code: "SAR", label: "SAR – Saudi Riyal" },
];

export function CreateProgrammeForm() {
  const [state, action, pending] = useActionState<ProgrammeState, FormData>(createProgramme, null);
  const [categories, setCategories] = useState<string[]>([]);

  function addCategory() { setCategories((c) => [...c, ""]); }
  function removeCategory(i: number) { setCategories((c) => c.filter((_, idx) => idx !== i)); }
  function updateCategory(i: number, val: string) {
    setCategories((c) => c.map((v, idx) => (idx === i ? val : v)));
  }

  return (
    <details className="rounded-xl border border-[#6b1a2a]/30 bg-[#fdf6f7] overflow-hidden">
      <summary className="cursor-pointer select-none px-6 py-4 text-sm font-semibold text-[#6b1a2a] hover:bg-[#f9eaeb] transition-colors">
        + Create new programme
      </summary>
      <form action={action} className="px-6 pb-6 pt-3 border-t border-[#6b1a2a]/10 bg-white space-y-4">
        {state?.error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{state.error}</div>
        )}
        {state?.success && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-700">{state.success}</div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Programme name *</label>
            <input
              type="text" name="name" required placeholder="e.g. 2025 Innovation Fund Cohort"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a]"
              suppressHydrationWarning
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea
              name="description" rows={2} placeholder="What this programme funds…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a] resize-none"
              suppressHydrationWarning
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Total budget</label>
              <input
                type="number" name="total_budget" placeholder="0.00" step="0.01" min="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a]"
                suppressHydrationWarning
              />
            </div>
            <div className="w-48">
              <label className="block text-xs font-medium text-gray-700 mb-1">Currency</label>
              <select name="currency_code" defaultValue="USD"
                className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a]"
                suppressHydrationWarning>
                {CURRENCIES.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Start date</label>
            <input type="date" name="start_date"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a]"
              suppressHydrationWarning
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">End date</label>
            <input type="date" name="end_date"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a]"
              suppressHydrationWarning
            />
          </div>

          {/* ── Categories ── */}
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-gray-700">
                Categories <span className="text-gray-400 font-normal">(optional — e.g. Agritech, Fintech)</span>
              </label>
              <button
                type="button"
                onClick={addCategory}
                className="text-xs font-medium text-[#6b1a2a] hover:underline"
              >
                + Add category
              </button>
            </div>
            {categories.length === 0 ? (
              <p className="text-xs text-gray-400 py-1">
                No categories — all awardees in this programme will be ungrouped.
              </p>
            ) : (
              <div className="space-y-2">
                {categories.map((cat, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={cat}
                      onChange={(e) => updateCategory(i, e.target.value)}
                      placeholder={`Category ${i + 1} name`}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a]"
                    />
                    <button
                      type="button"
                      onClick={() => removeCategory(i)}
                      className="text-red-400 hover:text-red-600 text-base leading-none"
                      aria-label="Remove category"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input
              type="hidden"
              name="categories_json"
              value={JSON.stringify(categories.filter((c) => c.trim()))}
            />
          </div>
        </div>
        <button type="submit" disabled={pending}
          className="rounded-lg bg-[#6b1a2a] px-5 py-2 text-sm font-semibold text-white hover:bg-[#5a1522] disabled:opacity-50 transition-colors">
          {pending ? "Creating…" : "Create Programme"}
        </button>
      </form>
    </details>
  );
}
