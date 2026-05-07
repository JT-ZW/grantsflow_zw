"use client";

import { deleteUser } from "./actions";

export function DeleteUserButton({ profileId, displayName }: { profileId: string; displayName: string }) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!confirm(`Permanently delete ${displayName}? This cannot be undone.`)) {
      e.preventDefault();
    }
  }

  return (
    <form action={deleteUser} onSubmit={handleSubmit}>
      <input type="hidden" name="profile_id" value={profileId} />
      <button
        type="submit"
        className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
      >
        Delete
      </button>
    </form>
  );
}
