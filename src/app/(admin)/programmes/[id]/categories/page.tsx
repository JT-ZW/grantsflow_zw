import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deleteProgrammeCategory } from "../../actions";
import { AddCategoryForm } from "./AddCategoryForm";

export default async function ProgrammeCategoriesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: programmeId } = await params;
  const supabase = await createClient();

  const [{ data: programme }, { data: categories }] = await Promise.all([
    supabase.from("programmes").select("id, name").eq("id", programmeId).single(),
    supabase
      .from("programme_categories")
      .select("id, name, sort_order")
      .eq("programme_id", programmeId)
      .order("sort_order"),
  ]);

  if (!programme) notFound();

  async function handleDelete(formData: FormData) {
    "use server";
    const categoryId = formData.get("category_id") as string;
    await deleteProgrammeCategory(categoryId, programmeId);
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/programmes"
          className="text-xs text-gray-500 hover:text-gray-700 hover:underline"
        >
          ← Back to programmes
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{programme.name}</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage categories</p>
      </div>

      {/* Current categories */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Current categories</h2>
          <span className="text-xs text-gray-400">
            {(categories ?? []).length} categor{(categories ?? []).length !== 1 ? "ies" : "y"}
          </span>
        </div>

        {!categories || categories.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <p className="text-sm text-gray-400">No categories yet.</p>
            <p className="text-xs text-gray-400 mt-1">
              All awardees in this programme are currently ungrouped.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {categories.map((cat) => (
              <li key={cat.id} className="flex items-center justify-between px-6 py-3">
                <span className="text-sm text-gray-900">{cat.name}</span>
                <form action={handleDelete}>
                  <input type="hidden" name="category_id" value={cat.id} />
                  <button
                    type="submit"
                    className="text-xs text-red-500 hover:text-red-700 hover:underline"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add category form */}
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Add a category</h2>
        <AddCategoryForm programmeId={programmeId} />
        <p className="mt-3 text-xs text-gray-400">
          Removing a category will unassign any grants that belong to it.
        </p>
      </div>
    </div>
  );
}
