"use client";

import { useActionState } from "react";
import { createProgramme, type ProgrammeState } from "./actions";

const CURRENCIES = ["ZAR", "USD", "EUR", "GBP"];

export function CreateProgrammeForm() {
  const [state, action, pending] = useActionState<ProgrammeState, FormData>(createProgramme, null);

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
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea
              name="description" rows={2} placeholder="What this programme funds…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a] resize-none"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Total budget</label>
              <input
                type="number" name="total_budget" placeholder="0.00" step="0.01" min="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a]"
              />
            </div>
            <div className="w-24">
              <label className="block text-xs font-medium text-gray-700 mb-1">Currency</label>
              <select name="currency_code" defaultValue="ZAR"
                className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a]">
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Start date</label>
            <input type="date" name="start_date"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">End date</label>
            <input type="date" name="end_date"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a]"
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
