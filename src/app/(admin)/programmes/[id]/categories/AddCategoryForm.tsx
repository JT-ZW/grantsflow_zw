"use client";

import { useActionState } from "react";
import { addProgrammeCategory, type CategoryActionState } from "../../actions";

export function AddCategoryForm({ programmeId }: { programmeId: string }) {
  const [state, action, pending] = useActionState<CategoryActionState, FormData>(
    addProgrammeCategory,
    null,
  );

  return (
    <form action={action} className="flex items-end gap-2">
      <input type="hidden" name="programme_id" value={programmeId} />
      <div className="flex-1">
        <label className="block text-xs font-medium text-gray-600 mb-1">New category name</label>
        <input
          type="text"
          name="name"
          required
          placeholder="e.g. Agritech"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b1a2a]"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[#6b1a2a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5a1522] disabled:opacity-50 transition-colors"
      >
        {pending ? "Adding…" : "Add"}
      </button>
      {state?.error && (
        <p className="text-xs text-red-600 mt-1">{state.error}</p>
      )}
    </form>
  );
}
