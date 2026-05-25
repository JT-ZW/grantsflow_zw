"use client";

import { useActionState, useRef, useState } from "react";
import {
  sendAwardeePortalInvite,
  createAwardeePortalAccount,
  type AwardeePortalState,
} from "./actions";
import { changeUserPassword, type ChangePasswordState } from "./actions";

export type AwardeePortalStatus = "not_invited" | "invited_pending" | "registered";

export type AwardeePortalItem = {
  id: string;
  full_name: string;
  email: string;
  status: AwardeePortalStatus;
  user_id: string | null;
};

// ── Send / Resend invite button ───────────────────────────────────────────────
function InviteButton({
  awardeeId,
  isResend,
}: {
  awardeeId: string;
  isResend: boolean;
}) {
  const [state, action, pending] = useActionState<AwardeePortalState, FormData>(
    sendAwardeePortalInvite,
    null,
  );
  const [done, setDone] = useState(false);

  if (done && state?.success) {
    return <span className="text-xs text-green-600 font-medium">Sent ✓</span>;
  }

  return (
    <form
      action={action}
      onSubmit={() => {
        // Mark done after first success (state is set asynchronously)
        setTimeout(() => setDone(true), 600);
      }}
    >
      <input type="hidden" name="awardee_id" value={awardeeId} />
      {state?.error && (
        <p className="text-xs text-red-600 mb-1">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
      >
        {pending ? "Sending…" : isResend ? "Resend invite" : "Send invite"}
      </button>
    </form>
  );
}

// ── Create account (admin sets password) popover ──────────────────────────────
function CreateAccountButton({ awardeeId, displayName }: { awardeeId: string; displayName: string }) {
  const [open, setOpen] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [state, action, pending] = useActionState<AwardeePortalState, FormData>(
    createAwardeePortalAccount,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

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
        className="rounded-md border border-[#6b1a2a] px-3 py-1.5 text-xs font-medium text-[#6b1a2a] hover:bg-[#6b1a2a]/5 transition-colors"
      >
        Create account
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-20 w-72 rounded-xl border border-gray-200 bg-white shadow-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-700">
            Set portal password for{" "}
            <span className="text-gray-900">{displayName}</span>
          </p>
          <p className="text-xs text-gray-500">
            They will be able to sign in immediately with this password.
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
              <input type="hidden" name="awardee_id" value={awardeeId} />
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  name="password"
                  required
                  minLength={8}
                  placeholder="Min 8 characters"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a]/40 pr-14"
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
                  className="flex-1 rounded-lg bg-[#6b1a2a] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5a1623] disabled:opacity-50 transition-colors"
                >
                  {pending ? "Creating…" : "Create account"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setShowPw(false);
                  }}
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => {
            setOpen(false);
            setShowPw(false);
          }}
        />
      )}
    </div>
  );
}

// ── Change password (for registered awardees) ─────────────────────────────────
function AwardeeChangePasswordButton({
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
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

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
            New password for{" "}
            <span className="text-gray-900">{displayName}</span>
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
                  onClick={() => {
                    setOpen(false);
                    setShowPw(false);
                  }}
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => {
            setOpen(false);
            setShowPw(false);
          }}
        />
      )}
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: AwardeePortalStatus }) {
  if (status === "registered") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        Registered
      </span>
    );
  }
  if (status === "invited_pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Invite sent — pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
      Not invited
    </span>
  );
}

// ── Main row ──────────────────────────────────────────────────────────────────
export function AwardeePortalRow({ awardee }: { awardee: AwardeePortalItem }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 py-4 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{awardee.full_name}</p>
        <p className="text-xs text-gray-500 truncate">{awardee.email}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <StatusBadge status={awardee.status} />

        {awardee.status === "registered" && awardee.user_id && (
          <AwardeeChangePasswordButton
            profileId={awardee.user_id}
            displayName={awardee.full_name}
          />
        )}

        {awardee.status === "invited_pending" && (
          <>
            <InviteButton awardeeId={awardee.id} isResend={true} />
            <CreateAccountButton awardeeId={awardee.id} displayName={awardee.full_name} />
          </>
        )}

        {awardee.status === "not_invited" && (
          <>
            <InviteButton awardeeId={awardee.id} isResend={false} />
            <CreateAccountButton awardeeId={awardee.id} displayName={awardee.full_name} />
          </>
        )}
      </div>
    </div>
  );
}
