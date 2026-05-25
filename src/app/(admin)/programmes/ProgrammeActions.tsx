"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { updateProgramme, deleteProgramme, type UpdateProgrammeState } from "./actions";

const CURRENCIES = [
  { code: "USD", label: "USD – US Dollar" },
  { code: "ZIG", label: "ZIG – Zimbabwe Gold" },
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
  { code: "EUR", label: "EUR – Euro" },
  { code: "GBP", label: "GBP – British Pound" },
  { code: "CHF", label: "CHF – Swiss Franc" },
  { code: "CAD", label: "CAD – Canadian Dollar" },
  { code: "AUD", label: "AUD – Australian Dollar" },
  { code: "JPY", label: "JPY – Japanese Yen" },
  { code: "CNY", label: "CNY – Chinese Yuan" },
  { code: "INR", label: "INR – Indian Rupee" },
  { code: "AED", label: "AED – UAE Dirham" },
];

export type ProgrammeForActions = {
  id: string;
  name: string;
  description: string | null;
  total_budget: number | null;
  currency_code: string;
  start_date: string | null;
  end_date: string | null;
  categoryCount: number;
};

export function ProgrammeActions({ programme }: { programme: ProgrammeForActions }) {
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  const boundUpdate = updateProgramme.bind(null, programme.id);
  const [editState, formAction, updating] = useActionState<UpdateProgrammeState, FormData>(
    boundUpdate,
    null,
  );

  // Close edit modal on success
  useEffect(() => {
    if (editState?.success) {
      setShowEdit(false);
    }
  }, [editState?.success]);

  function handleDelete() {
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteProgramme(programme.id);
      if (result.error) {
        setDeleteError(result.error);
      }
    });
  }

  return (
    <>
      {/* Trigger row */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowEdit(true)}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors text-center"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => { setDeleteError(null); setShowDeleteConfirm(true); }}
          className="rounded-lg border border-red-100 px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
        >
          Delete
        </button>
      </div>

      {/* ── Edit modal ─────────────────────────────────────────────────────── */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-base font-semibold text-gray-900">Edit programme</h2>
              <button
                type="button"
                onClick={() => setShowEdit(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form action={formAction} className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {editState?.error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
                  {editState.error}
                </div>
              )}

              {/* Name */}
              <div>
                <label htmlFor="edit-name" className="block text-xs font-medium text-gray-700 mb-1">
                  Programme name *
                </label>
                <input
                  id="edit-name"
                  type="text"
                  name="name"
                  required
                  defaultValue={programme.name}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a]"
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="edit-description" className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  id="edit-description"
                  name="description"
                  rows={2}
                  defaultValue={programme.description ?? ""}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a] resize-none"
                />
              </div>

              {/* Budget + Currency */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label htmlFor="edit-budget" className="block text-xs font-medium text-gray-700 mb-1">
                    Total budget
                  </label>
                  <input
                    id="edit-budget"
                    type="number"
                    name="total_budget"
                    step="0.01"
                    min="0"
                    defaultValue={programme.total_budget ?? ""}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a]"
                  />
                </div>
                <div className="w-44">
                  <label htmlFor="edit-currency" className="block text-xs font-medium text-gray-700 mb-1">Currency</label>
                  <select
                    id="edit-currency"
                    name="currency_code"
                    defaultValue={programme.currency_code}
                    className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a]"
                  >
                    {CURRENCIES.map(({ code, label }) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-start" className="block text-xs font-medium text-gray-700 mb-1">Start date</label>
                  <input
                    id="edit-start"
                    type="date"
                    name="start_date"
                    defaultValue={programme.start_date ?? ""}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a]"
                  />
                </div>
                <div>
                  <label htmlFor="edit-end" className="block text-xs font-medium text-gray-700 mb-1">End date</label>
                  <input
                    id="edit-end"
                    type="date"
                    name="end_date"
                    defaultValue={programme.end_date ?? ""}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a]"
                  />
                </div>
              </div>

              {/* Categories link */}
              <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-700">Categories</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {programme.categoryCount} categor{programme.categoryCount !== 1 ? "ies" : "y"} — add or remove on the categories page
                  </p>
                </div>
                <Link
                  href={`/programmes/${programme.id}/categories`}
                  onClick={() => setShowEdit(false)}
                  className="text-xs font-semibold text-[#6b1a2a] hover:underline whitespace-nowrap ml-3"
                >
                  Manage →
                </Link>
              </div>

              {/* Footer buttons */}
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowEdit(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="rounded-lg bg-[#6b1a2a] px-5 py-2 text-sm font-semibold text-white hover:bg-[#5a1522] disabled:opacity-50 transition-colors"
                >
                  {updating ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ─────────────────────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Delete programme?</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    <span className="font-medium text-gray-700">{programme.name}</span> will be permanently removed. This cannot be undone.
                  </p>
                </div>
              </div>

              {deleteError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-xs text-red-700">
                  {deleteError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowDeleteConfirm(false); setDeleteError(null); }}
                  disabled={isDeleting}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {isDeleting ? "Deleting…" : "Yes, delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
