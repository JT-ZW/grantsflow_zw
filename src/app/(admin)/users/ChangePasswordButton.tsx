"use client";

import { useActionState, useRef, useState } from "react";
import { changeUserPassword, type ChangePasswordState } from "./actions";

export function ChangePasswordButton({
  profileId,
  displayName,
}: {
  profileId: string;
  displayName: string;
}) {
  const [open, setOpen] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [state, action, pending] = useActionState<ChangePasswordState, FormData>(
    changeUserPassword,
    null
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Close and reset after success
  function handleSuccess() {
    setOpen(false);
    setShowPw(false);
    formRef.current?.reset();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
      >
        Change password
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-20 w-72 rounded-xl border border-gray-200 bg-white shadow-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-700">
            New password for <span className="text-gray-900">{displayName}</span>
          </p>

          {state?.error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
              {state.error}
            </p>
          )}
          {state?.success && (
            <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1.5">
              {state.success}
              <button
                type="button"
                onClick={handleSuccess}
                className="ml-2 underline hover:no-underline"
              >
                Close
              </button>
            </div>
          )}

          {!state?.success && (
            <form ref={formRef} action={action} className="space-y-3">
              <input type="hidden" name="profile_id" value={profileId} />
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  name="password"
                  required
                  minLength={8}
                  placeholder="Min 8 characters"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-14"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => { setOpen(false); setShowPw(false); }}
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Backdrop to close on outside click */}
      {open && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => { setOpen(false); setShowPw(false); }}
        />
      )}
    </div>
  );
}
