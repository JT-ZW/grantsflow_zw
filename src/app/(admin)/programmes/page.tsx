import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { CreateProgrammeForm } from "./CreateProgrammeForm";
import { ProgrammeActions } from "./ProgrammeActions";

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

function getProgrammeStatus(start_date: string | null, end_date: string | null) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!start_date && !end_date) return { label: "Ongoing", color: "bg-blue-100 text-blue-700" };
  const start = start_date ? new Date(start_date) : null;
  const end = end_date ? new Date(end_date) : null;
  if (start && start > today) return { label: "Upcoming", color: "bg-purple-100 text-purple-700" };
  if (end && end < today) return { label: "Ended", color: "bg-gray-100 text-gray-500" };
  return { label: "Active", color: "bg-green-100 text-green-700" };
}

function getDaysRemaining(end_date: string | null): number | null {
  if (!end_date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(end_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function ProgrammesPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("programmes")
    .select("id, name, description, total_budget, currency_code, start_date, end_date, created_at")
    .order("created_at", { ascending: false });

  const programmes = (data ?? []) as Programme[];

  const [{ data: grantData }, { data: categoryData }] = await Promise.all([
    supabase
      .from("grants")
      .select("programme_id, amount_awarded, currency_code, status")
      .not("programme_id", "is", null),
    supabase
      .from("programme_categories")
      .select("programme_id")
      .not("programme_id", "is", null),
  ]);

  const categoryCountMap: Record<string, number> = {};
  (categoryData ?? []).forEach((c: { programme_id: string }) => {
    categoryCountMap[c.programme_id] = (categoryCountMap[c.programme_id] ?? 0) + 1;
  });

  const countMap: Record<string, number> = {};
  const allocatedMap: Record<string, number> = {};
  const activeGrantsMap: Record<string, number> = {};
  (grantData ?? []).forEach(
    (g: { programme_id: string | null; amount_awarded: number; currency_code: string; status: string }) => {
      if (!g.programme_id) return;
      countMap[g.programme_id] = (countMap[g.programme_id] ?? 0) + 1;
      allocatedMap[g.programme_id] = (allocatedMap[g.programme_id] ?? 0) + Number(g.amount_awarded);
      if (g.status === "active")
        activeGrantsMap[g.programme_id] = (activeGrantsMap[g.programme_id] ?? 0) + 1;
    }
  );

  const totalGrants = Object.values(countMap).reduce((a, b) => a + b, 0);
  const activeProgrammes = programmes.filter(
    (p) => getProgrammeStatus(p.start_date, p.end_date).label === "Active"
  ).length;
  const totalProgrammeBudget = programmes.reduce((s, p) => s + (p.total_budget ?? 0), 0);
  const totalAllocated = Object.values(allocatedMap).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Programmes</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage grant cohorts and track budget utilisation across all programmes.
        </p>
      </div>

      {/* Summary metrics */}
      {programmes.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-[#6b1a2a] px-5 py-4 text-white">
            <p className="text-xs font-medium text-white/70 uppercase tracking-wide">Programmes</p>
            <p className="text-3xl font-bold mt-1">{programmes.length}</p>
            <p className="text-xs text-white/60 mt-1">{activeProgrammes} currently active</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total Grants</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{totalGrants}</p>
            <p className="text-xs text-gray-400 mt-1">across all programmes</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Allocated</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {totalAllocated > 0 ? totalAllocated.toLocaleString() : "—"}
            </p>
            <p className="text-xs text-gray-400 mt-1">total disbursed</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Capacity Left</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {totalProgrammeBudget > 0 ? (totalProgrammeBudget - totalAllocated).toLocaleString() : "—"}
            </p>
            <p className="text-xs text-gray-400 mt-1">unallocated budget</p>
          </div>
        </div>
      )}

      {/* Create form */}
      <CreateProgrammeForm />

      {/* Programme cards */}
      {programmes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#6b1a2a]/10">
            <svg className="h-6 w-6 text-[#6b1a2a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-700">No programmes yet</p>
          <p className="text-xs text-gray-400 mt-1">Create your first programme using the form above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {programmes.map((p) => {
            const grantCount = countMap[p.id] ?? 0;
            const allocated = allocatedMap[p.id] ?? 0;
            const activeGrants = activeGrantsMap[p.id] ?? 0;
            const categoryCount = categoryCountMap[p.id] ?? 0;
            const remaining = p.total_budget ? p.total_budget - allocated : null;
            const pctUsed =
              p.total_budget && p.total_budget > 0
                ? Math.min(100, (allocated / p.total_budget) * 100)
                : 0;
            const status = getProgrammeStatus(p.start_date, p.end_date);
            const daysRemaining = getDaysRemaining(p.end_date);
            const isOverBudget = remaining !== null && remaining < 0;
            const isNearlyFull = !isOverBudget && pctUsed >= 80;
            const isExpiringSoon =
              daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 14;
            const hasNoGrants = grantCount === 0 && status.label === "Active";

            const accentColor =
              status.label === "Active"
                ? "bg-[#6b1a2a]"
                : status.label === "Upcoming"
                ? "bg-purple-400"
                : status.label === "Ended"
                ? "bg-gray-300"
                : "bg-blue-400";

            return (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-2xl border bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow ${
                  isOverBudget ? "border-red-200" : "border-gray-200"
                }`}
              >
                {/* Colour accent bar */}
                <div className={`h-1.5 w-full ${accentColor}`} />

                <div className="flex flex-col flex-1 gap-4 p-6">
                  {/* Title + status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-gray-900 text-base leading-snug">{p.name}</h2>
                      {p.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description}</p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  {/* Smart alerts */}
                  {(isOverBudget || isNearlyFull || isExpiringSoon || hasNoGrants) && (
                    <div className="space-y-1.5">
                      {isOverBudget && (
                        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">
                          <span>&#9888;</span> Over budget — {p.currency_code}{" "}
                          {Math.abs(remaining!).toLocaleString()} exceeded
                        </div>
                      )}
                      {isNearlyFull && (
                        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-700">
                          <span>&#9685;</span> {Math.round(pctUsed)}% allocated — nearing full capacity
                        </div>
                      )}
                      {isExpiringSoon && (
                        <div className="flex items-center gap-2 rounded-lg bg-orange-50 border border-orange-100 px-3 py-2 text-xs text-orange-700">
                          <span>&#8987;</span> Closes{" "}
                          {daysRemaining === 0
                            ? "today"
                            : `in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}`}
                        </div>
                      )}
                      {hasNoGrants && (
                        <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
                          <span>&#8505;</span> No grants assigned yet — consider adding awardees
                        </div>
                      )}
                    </div>
                  )}

                  {/* Budget bar */}
                  {p.total_budget ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400 font-medium">Budget utilisation</span>
                        <span
                          className={`font-bold ${
                            isOverBudget
                              ? "text-red-600"
                              : pctUsed >= 75
                              ? "text-amber-600"
                              : "text-gray-700"
                          }`}
                        >
                          {Math.round(pctUsed)}%
                        </span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isOverBudget
                              ? "bg-red-500"
                              : pctUsed >= 75
                              ? "bg-amber-400"
                              : "bg-[#6b1a2a]"
                          }`}
                          style={{ width: `${pctUsed}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">
                          <span className="font-semibold text-gray-800">
                            {p.currency_code} {allocated.toLocaleString()}
                          </span>{" "}
                          of {p.currency_code} {Number(p.total_budget).toLocaleString()}
                        </span>
                        <span
                          className={`font-semibold ${
                            isOverBudget ? "text-red-600" : "text-green-700"
                          }`}
                        >
                          {remaining !== null &&
                            `${p.currency_code} ${Number(remaining).toLocaleString()} left`}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-gray-50 border border-dashed border-gray-200 px-3 py-2.5 text-xs text-gray-400 text-center">
                      No budget ceiling set
                    </div>
                  )}

                  {/* Stats strip */}
                  <div className="grid grid-cols-3 divide-x divide-gray-100 rounded-xl border border-gray-100 bg-gray-50/80 overflow-hidden text-center">
                    <div className="px-3 py-3">
                      <p className="text-xl font-bold text-gray-900">{grantCount}</p>
                      <p className="text-[10px] uppercase tracking-wide text-gray-400 mt-0.5">
                        Total grants
                      </p>
                    </div>
                    <div className="px-3 py-3">
                      <p className="text-xl font-bold text-green-700">{activeGrants}</p>
                      <p className="text-[10px] uppercase tracking-wide text-gray-400 mt-0.5">Active</p>
                    </div>
                    <div className="px-3 py-3">
                      {daysRemaining !== null ? (
                        <>
                          <p
                            className={`text-xl font-bold ${
                              daysRemaining < 0
                                ? "text-gray-300"
                                : daysRemaining <= 14
                                ? "text-orange-500"
                                : "text-gray-900"
                            }`}
                          >
                            {daysRemaining < 0 ? "—" : daysRemaining}
                          </p>
                          <p className="text-[10px] uppercase tracking-wide text-gray-400 mt-0.5">
                            {daysRemaining < 0 ? "Ended" : "Days left"}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-xl font-bold text-gray-300">&#8734;</p>
                          <p className="text-[10px] uppercase tracking-wide text-gray-400 mt-0.5">
                            No end date
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Date range */}
                  {(p.start_date || p.end_date) && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <svg
                        className="h-3.5 w-3.5 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <span>
                        {p.start_date
                          ? new Date(p.start_date).toLocaleDateString("en-ZA")
                          : "—"}
                      </span>
                      <span>&#8594;</span>
                      <span>
                        {p.end_date
                          ? new Date(p.end_date).toLocaleDateString("en-ZA")
                          : "Open-ended"}
                      </span>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="mt-auto space-y-2 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/awardees?programme=${p.id}`}
                        className="flex-1 rounded-lg bg-[#6b1a2a] px-3 py-2 text-center text-xs font-semibold text-white hover:bg-[#5a1522] transition-colors"
                      >
                        View Awardees
                      </Link>
                      <Link
                        href="/awardees/new"
                        className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        + Add Awardee
                      </Link>
                    </div>
                    <Link
                      href={`/programmes/${p.id}/categories`}
                      className="flex w-full items-center justify-between rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                    >
                      <span>Manage categories</span>
                      <span className="inline-flex items-center rounded-full bg-white border border-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                        {categoryCount} {categoryCount === 1 ? "category" : "categories"}
                      </span>
                    </Link>
                    <ProgrammeActions
                      programme={{
                        id: p.id,
                        name: p.name,
                        description: p.description,
                        total_budget: p.total_budget,
                        currency_code: p.currency_code,
                        start_date: p.start_date,
                        end_date: p.end_date,
                        categoryCount,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
