"use client";

import { useActionState } from "react";
import { inviteUser, type InviteState } from "./actions";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "program_manager", label: "Program Manager" },
  { value: "finance_officer", label: "Finance Officer" },
  { value: "auditor", label: "Auditor" },
  { value: "awardee", label: "Awardee" },
];

export function InviteUserForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(
    inviteUser,
    null
  );

  return (
    <details className="rounded-xl border border-blue-200 bg-blue-50 overflow-hidden">
      <summary className="cursor-pointer select-none px-6 py-4 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-colors">
        + Invite new user
      </summary>
      <form action={action} className="px-6 pb-6 pt-3 space-y-4 border-t border-blue-100 bg-white">
        {state?.error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
            {state.error}
          </div>
        )}
        {state?.success && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-700">
            {state.success}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Full name *
            </label>
            <input
              type="text"
              name="full_name"
              required
              placeholder="Jane Smith"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Email address *
            </label>
            <input
              type="email"
              name="email"
              required
              placeholder="jane@university.ac.za"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Role *
            </label>
            <select
              name="role"
              defaultValue="awardee"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {pending ? "Sending…" : "Send invitation"}
        </button>
        <p className="text-xs text-gray-400">
          The user will receive an email with a link to set their password and access the system.
        </p>
      </form>
    </details>
  );
}
