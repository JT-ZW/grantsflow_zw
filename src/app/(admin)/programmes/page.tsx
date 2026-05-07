import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { CreateProgrammeForm } from "./CreateProgrammeForm";

type Programme = {
  id: string;
  name: string;
  description: string | null;
  total_budget: number | null;
  currency_code: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

export default async function ProgrammesPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("programmes")
    .select("id, name, description, total_budget, currency_code, start_date, end_date, created_at")
    .order("created_at", { ascending: false });

  const programmes = (data ?? []) as Programme[];

  // Get grant counts per programme
  const { data: grantCounts } = await supabase
    .from("grants")
    .select("programme_id")
    .not("programme_id", "is", null);

  const countMap: Record<string, number> = {};
  (grantCounts ?? []).forEach((g: { programme_id: string | null }) => {
    if (g.programme_id) countMap[g.programme_id] = (countMap[g.programme_id] ?? 0) + 1;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Programmes</h1>
          <p className="text-sm text-gray-500 mt-1">
            {programmes.length} programme{programmes.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Create form */}
      <CreateProgrammeForm />

      {/* List */}
      {programmes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">No programmes yet. Create the first one above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programmes.map((p) => {
            const grantCount = countMap[p.id] ?? 0;
            return (
              <div key={p.id} className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">{p.name}</h2>
                  {p.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {p.total_budget && (
                    <div>
                      <p className="text-gray-400">Budget</p>
                      <p className="font-medium text-gray-900">
                        {p.currency_code} {Number(p.total_budget).toLocaleString()}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-400">Grants</p>
                    <p className="font-medium text-gray-900">{grantCount}</p>
                  </div>
                  {p.start_date && (
                    <div>
                      <p className="text-gray-400">Start</p>
                      <p className="font-medium text-gray-900">
                        {new Date(p.start_date).toLocaleDateString("en-ZA")}
                      </p>
                    </div>
                  )}
                  {p.end_date && (
                    <div>
                      <p className="text-gray-400">End</p>
                      <p className="font-medium text-gray-900">
                        {new Date(p.end_date).toLocaleDateString("en-ZA")}
                      </p>
                    </div>
                  )}
                </div>
                <Link
                  href={`/awardees?programme=${p.id}`}
                  className="text-xs text-[#6b1a2a] font-medium hover:underline"
                >
                  View grants →
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
