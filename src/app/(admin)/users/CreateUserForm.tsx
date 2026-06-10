"use client";

import { useActionState, useState } from "react";
import { createUser, type CreateUserState } from "./actions";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "program_manager", label: "Program Manager" },
  { value: "finance_officer", label: "Finance Officer" },
  { value: "auditor", label: "Auditor" },
  { value: "awardee", label: "Awardee" },
];

export function CreateUserForm() {
  const [state, action, pending] = useActionState<CreateUserState, FormData>(
    createUser,
    null
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="px-6 pb-6 pt-3 space-y-4 border-t border-green-100 bg-white">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Full name *
          </label>
          <input
            type="text"
            name="full_name"
            required
            placeholder="Jane Smith"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
            placeholder="johndoe@gmail.com"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Role *
          </label>
          <select
            name="role"
            defaultValue="awardee"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Password * <span className="text-gray-400 font-normal">(min 8 characters)</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              required
              minLength={8}
              placeholder="Set a temporary password"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 pr-16"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 px-1"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {pending ? "Creating…" : "Create user"}
        </button>
        <p className="text-xs text-gray-400">
          No email is sent. The user can sign in immediately with the password you set.
        </p>
      </div>
    </form>
  );
}
