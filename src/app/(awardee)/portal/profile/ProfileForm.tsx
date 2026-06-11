"use client";

import { useActionState } from "react";
import { updateAwardeeProfile } from "./actions";

type Props = {
  currentGender: string | null;
  currentPhone: string | null;
  fullName: string;
  email: string;
};

export default function ProfileForm({ currentGender, currentPhone, fullName, email }: Props) {
  const [state, formAction, pending] = useActionState(updateAwardeeProfile, null);

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {state.success}
        </div>
      )}

      {/* Read-only fields */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
          <input
            type="text"
            value={fullName}
            disabled
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500 cursor-not-allowed"
          />
          <p className="text-xs text-gray-400 mt-1">Contact the grants office to update your name.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            disabled
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500 cursor-not-allowed"
          />
        </div>
      </div>

      {/* Editable fields */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">
            Phone Number
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={currentPhone ?? ""}
            placeholder="+263 77 000 0000"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:border-[#6b1a2a] focus:outline-none focus:ring-2 focus:ring-[#6b1a2a]/20"
          />
        </div>

        <div>
          <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1.5">
            Gender <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <select
            id="gender"
            name="gender"
            defaultValue={currentGender ?? ""}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:border-[#6b1a2a] focus:outline-none focus:ring-2 focus:ring-[#6b1a2a]/20"
          >
            <option value="">Prefer not to say</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">
            Used only for gender-disaggregated impact reporting. Never shared publicly.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[#6b1a2a] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#5a1522] disabled:opacity-60 transition-colors focus:outline-none focus:ring-2 focus:ring-[#6b1a2a] focus:ring-offset-2"
        >
          {pending ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
