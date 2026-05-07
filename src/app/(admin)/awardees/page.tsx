import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
  suspended: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-red-100 text-red-700",
};

function riskBadge(score: number) {
  if (score >= 60) return <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">High {score}</span>;
  if (score >= 30) return <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">Med {score}</span>;
  return <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Low {score}</span>;
}

export default async function AwardeesPage() {
  const supabase = await createClient();

  const { data: awardees } = await supabase
    .from("awardees")
    .select(`
      id,
      full_name,
      email,
      awardee_type,
      faculty,
      department,
      grants (
        id,
        title,
        status,
        amount_awarded,
        currency_code
      )
    `)
    .order("created_at", { ascending: false });

  // Risk scoring — fetch milestones + expenses per grant
  const grantIds = (awardees ?? []).flatMap((a) => (a.grants ?? []).map((g: { id: string }) => g.id));

  const [{ data: milestoneData }, { data: expenseData }] = await Promise.all([
    supabase.from("milestones").select("grant_id, status").in("grant_id", grantIds.length ? grantIds : [""]),
    supabase.from("expenses").select("grant_id, status").in("grant_id", grantIds.length ? grantIds : [""]),
  ]);

  // Build per-grant risk score
  const riskByGrant: Record<string, number> = {};
  for (const gid of grantIds) {
    const ms = (milestoneData ?? []).filter((m: { grant_id: string; status: string }) => m.grant_id === gid);
    const es = (expenseData ?? []).filter((e: { grant_id: string; status: string }) => e.grant_id === gid);
    const delayedMs = ms.filter((m: { status: string }) => m.status === "delayed").length;
    const rejectedEs = es.filter((e: { status: string }) => e.status === "rejected").length;
    const msScore = ms.length > 0 ? (delayedMs / ms.length) * 60 : 0;
    const esScore = es.length > 0 ? (rejectedEs / es.length) * 40 : 0;
    riskByGrant[gid] = Math.round(msScore + esScore);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Awardees</h1>
          <p className="mt-1 text-sm text-gray-500">
            {awardees?.length ?? 0} total awardee{(awardees?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/awardees/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          + Add Awardee
        </Link>
      </div>

      {!awardees?.length ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">No awardees yet.</p>
          <Link
            href="/awardees/new"
            className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline"
          >
            Add the first one →
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Awardee</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Faculty / Dept</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Grants</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Risk</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {awardees.map((a) => {
                const grant = (a.grants as unknown as { id: string; title: string; status: string; amount_awarded: number; currency_code: string }[])?.[0];
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
                            {grant.currency_code}{" "}
                            {Number(grant.amount_awarded).toLocaleString()}
                          </p>
                        </>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {grant ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                            STATUS_STYLES[grant.status] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {grant.status}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {grant ? riskBadge(riskScore) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/awardees/${a.id}`}
                        className="text-blue-600 hover:underline text-xs font-medium"
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
      )}
    </div>
  );
}
