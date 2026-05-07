import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function ReportsPage() {
  const supabase = await createClient();

  // Get awardees for per-grant report links
  const { data: awardees } = await supabase
    .from("awardees")
    .select("id, full_name, grants(id, title, status)")
    .order("full_name");

  const exports = [
    {
      title: "All Grants",
      description: "Awardee details, grant status, amounts, and dates",
      href: "/api/exports/grants",
      icon: "📋",
    },
    {
      title: "Disbursements",
      description: "All payments made to awardees with dates and methods",
      href: "/api/exports/disbursements",
      icon: "💸",
    },
    {
      title: "Expenses",
      description: "All submitted expense reports with approval status",
      href: "/api/exports/expenses",
      icon: "🧾",
    },
    {
      title: "Budget Allocations",
      description: "All budget lines with approval status per grant",
      href: "/api/exports/budgets",
      icon: "📊",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Export data as CSV or generate printable grant reports
        </p>
      </div>

      {/* CSV Exports */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">CSV Exports</h2>
        <p className="text-sm text-gray-400 mb-5">
          Download data as spreadsheet-compatible CSV files
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {exports.map((e) => (
            <a
              key={e.href}
              href={e.href}
              download
              className="flex items-start gap-4 rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
            >
              <span className="text-2xl">{e.icon}</span>
              <div>
                <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700">
                  {e.title} <span className="text-gray-400 font-normal">.csv</span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{e.description}</p>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Per-Grant Printable Reports */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Printable Grant Reports</h2>
        <p className="text-sm text-gray-400 mb-5">
          Full grant reports — open, then use your browser&apos;s Print / Save as PDF function
        </p>
        {!awardees || awardees.length === 0 ? (
          <p className="text-sm text-gray-400">No awardees yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {awardees.map((a) => {
              const grants = a.grants as { id: string; title: string; status: string }[] | null;
              const grant = grants?.[0];
              return (
                <div key={a.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{a.full_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {grant?.title ?? "No grant linked"}
                    </p>
                  </div>
                  {grant ? (
                    <Link
                      href={`/awardees/${a.id}/report`}
                      target="_blank"
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-blue-300 hover:text-blue-700 transition-colors"
                    >
                      Open Report →
                    </Link>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
