import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
  suspended: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-red-100 text-red-700",
};

function riskBadge(score: number) {
  if (score >= 60)
    return <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">High {score}</span>;
  if (score >= 30)
    return <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">Med {score}</span>;
  return <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Low {score}</span>;
}

type Grant = {
  id: string;
  title: string;
  status: string;
  amount_awarded: number;
  currency_code: string;
  programme_id: string | null;
  category_id: string | null;
};

type Awardee = {
  id: string;
  full_name: string;
  email: string;
  awardee_type: string;
  faculty: string | null;
  department: string | null;
  grants: Grant[];
};

function AwardeeCards({
  awardees,
  riskByGrant,
}: {
  awardees: Awardee[];
  riskByGrant: Record<string, number>;
}) {
  return (
    <>
      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {awardees.map((a) => {
          const grant = a.grants?.[0];
          const riskScore = grant ? (riskByGrant[grant.id] ?? 0) : 0;
          return (
            <Link
              key={a.id}
              href={`/awardees/${a.id}`}
              className="block rounded-xl border border-gray-200 bg-white p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{a.full_name}</p>
                  <p className="text-xs text-gray-400 truncate">{a.email}</p>
                </div>
                {grant && (
                  <span
                    className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[grant.status] ?? "bg-gray-100 text-gray-600"}`}
                  >
                    {grant.status}
                  </span>
                )}
              </div>
              {grant && (
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-gray-500 truncate mr-2">{grant.title}</span>
                  <span className="shrink-0 font-semibold text-gray-700">
                    {grant.currency_code} {Number(grant.amount_awarded).toLocaleString()}
                  </span>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                <span>{[a.faculty, a.department].filter(Boolean).join(" · ") || "—"}</span>
                {grant ? riskBadge(riskScore) : null}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Awardee</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Faculty / Dept</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Grant</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Risk</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {awardees.map((a) => {
                const grant = a.grants?.[0];
                const riskScore = grant ? (riskByGrant[grant.id] ?? 0) : 0;
                return (
                  <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{a.full_name}</p>
                      <p className="text-xs text-gray-400">{a.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {[a.faculty, a.department].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {grant ? (
                        <>
                          <p className="text-gray-900">{grant.title}</p>
                          <p className="text-xs text-gray-400">
                            {grant.currency_code} {Number(grant.amount_awarded).toLocaleString()}
                          </p>
                        </>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {grant ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[grant.status] ?? "bg-gray-100 text-gray-600"}`}
                        >
                          {grant.status}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">{grant ? riskBadge(riskScore) : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/awardees/${a.id}`}
                        className="text-[#6b1a2a] hover:underline text-xs font-medium"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default async function AwardeesPage({
  searchParams,
}: {
  searchParams: Promise<{ programme?: string }>;
}) {
  const { programme: programmeFilter } = await searchParams;
  const supabase = await createClient();

  const { data: programmesData } = await supabase
    .from("programmes")
    .select("id, name")
    .order("created_at", { ascending: false });
  const programmes = (programmesData ?? []) as { id: string; name: string }[];
  const activeProgramme = programmeFilter
    ? programmes.find((p) => p.id === programmeFilter)
    : null;

  // Fetch categories for all programmes
  const { data: categoriesData } = await supabase
    .from("programme_categories")
    .select("id, name, programme_id, sort_order")
    .order("sort_order");
  const allCategories = (categoriesData ?? []) as {
    id: string;
    name: string;
    programme_id: string;
    sort_order: number;
  }[];

  const { data: awardeesRaw } = await supabase
    .from("awardees")
    .select(`
      id, full_name, email, awardee_type, faculty, department,
      grants (id, title, status, amount_awarded, currency_code, programme_id, category_id)
    `)
    .order("created_at", { ascending: false });

  let awardees = (awardeesRaw ?? []) as unknown as Awardee[];

  if (programmeFilter) {
    awardees = awardees.filter((a) =>
      a.grants.some((g) => g.programme_id === programmeFilter)
    );
  }

  const grantIds = awardees.flatMap((a) => a.grants.map((g) => g.id));
  const [{ data: milestoneData }, { data: expenseData }] = await Promise.all([
    supabase.from("milestones").select("grant_id, status").in("grant_id", grantIds.length ? grantIds : [""]),
    supabase.from("expenses").select("grant_id, status").in("grant_id", grantIds.length ? grantIds : [""]),
  ]);
  const riskByGrant: Record<string, number> = {};
  for (const gid of grantIds) {
    const ms = (milestoneData ?? []).filter((m: { grant_id: string; status: string }) => m.grant_id === gid);
    const es = (expenseData ?? []).filter((e: { grant_id: string; status: string }) => e.grant_id === gid);
    riskByGrant[gid] = Math.round(
      (ms.length > 0 ? (ms.filter((m: { status: string }) => m.status === "delayed").length / ms.length) * 60 : 0) +
      (es.length > 0 ? (es.filter((e: { status: string }) => e.status === "rejected").length / es.length) * 40 : 0)
    );
  }

  type CategoryGroup = { id: string; name: string; awardees: Awardee[] };
  type ProgrammeGroup = {
    id: string | null;
    name: string;
    categoryGroups: CategoryGroup[];
    uncategorized: Awardee[];
  };

  const groups: ProgrammeGroup[] = [];
  if (!programmeFilter) {
    for (const prog of programmes) {
      const progCategories = allCategories.filter((c) => c.programme_id === prog.id);
      const members = awardees.filter((a) => a.grants.some((g) => g.programme_id === prog.id));
      if (members.length === 0) continue;

      const categoryGroups: CategoryGroup[] = progCategories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        awardees: members.filter((a) =>
          a.grants.some((g) => g.programme_id === prog.id && g.category_id === cat.id)
        ),
      })).filter((cg) => cg.awardees.length > 0);

      const categorizedIds = new Set(
        categoryGroups.flatMap((cg) => cg.awardees.map((a) => a.id))
      );
      const uncategorized = members.filter((a) => !categorizedIds.has(a.id));

      groups.push({ id: prog.id, name: prog.name, categoryGroups, uncategorized });
    }
    const unassigned = awardees.filter(
      (a) => a.grants.length === 0 || a.grants.every((g) => !g.programme_id)
    );
    if (unassigned.length > 0) {
      groups.push({ id: null, name: "No Programme", categoryGroups: [], uncategorized: unassigned });
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Awardees</h1>
          <div className="flex items-center gap-2 mt-1">
            {activeProgramme ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#6b1a2a]/10 px-3 py-0.5 text-xs font-medium text-[#6b1a2a]">
                  {activeProgramme.name}
                  <Link href="/awardees" className="ml-1 hover:text-[#5a1522]" aria-label="Clear filter">✕</Link>
                </span>
                <span className="text-sm text-gray-500">
                  {awardees.length} awardee{awardees.length !== 1 ? "s" : ""}
                </span>
              </>
            ) : (
              <p className="text-sm text-gray-500">
                {awardees.length} total awardee{awardees.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
        <Link
          href="/awardees/new"
          className="self-start rounded-lg bg-[#6b1a2a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5a1522] transition-colors"
        >
          + Add Awardee
        </Link>
      </div>

      {awardees.length === 0 ? (
        <EmptyState
          title={activeProgramme ? `No awardees in "${activeProgramme.name}" yet.` : "No awardees yet."}
          description={activeProgramme ? undefined : "Onboard your first grant recipient to get started."}
          action={!activeProgramme ? (
            <Link href="/awardees/new" className="inline-block rounded-xl bg-[#6b1a2a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5a1522] transition-colors">
              Add First Awardee
            </Link>
          ) : undefined}
        />
      ) : programmeFilter ? (
        <AwardeeCards awardees={awardees} riskByGrant={riskByGrant} />
      ) : (
        <div className="space-y-8">
          {groups.map((group) => {
            const totalInGroup = group.categoryGroups.reduce(
              (s, cg) => s + cg.awardees.length, 0
            ) + group.uncategorized.length;
            return (
              <div key={group.id ?? "none"}>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
                    {group.name}
                  </h2>
                  <span className="text-xs text-gray-400">
                    {totalInGroup} awardee{totalInGroup !== 1 ? "s" : ""}
                  </span>
                  {group.id && (
                    <Link
                      href={`/awardees?programme=${group.id}`}
                      className="ml-auto text-xs text-[#6b1a2a] hover:underline"
                    >
                      Filter by this programme →
                    </Link>
                  )}
                </div>

                {/* Categories */}
                {group.categoryGroups.length > 0 && (
                  <div className="space-y-5 ml-4 border-l-2 border-gray-100 pl-4">
                    {group.categoryGroups.map((cg) => (
                      <div key={cg.id}>
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            {cg.name}
                          </h3>
                          <span className="text-xs text-gray-400">
                            {cg.awardees.length}
                          </span>
                        </div>
                        <AwardeeCards awardees={cg.awardees} riskByGrant={riskByGrant} />
                      </div>
                    ))}
                    {group.uncategorized.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                            Uncategorized
                          </h3>
                          <span className="text-xs text-gray-400">{group.uncategorized.length}</span>
                        </div>
                        <AwardeeCards awardees={group.uncategorized} riskByGrant={riskByGrant} />
                      </div>
                    )}
                  </div>
                )}

                {/* No categories — flat list */}
                {group.categoryGroups.length === 0 && (
                  <AwardeeCards awardees={group.uncategorized} riskByGrant={riskByGrant} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
