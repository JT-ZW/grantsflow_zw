import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

type ComplianceDoc = {
  id: string;
  name: string;
  document_type: string | null;
  expires_at: string | null;
  is_compliance: boolean;
  grants: { id: string; title: string; awardee_id: string } | null;
  profiles: { full_name: string | null; email: string } | null;
};

const DOC_TYPE_LABELS: Record<string, string> = {
  ethics_clearance:        "Ethics Clearance",
  tax_clearance:           "Tax Clearance",
  institutional_agreement: "Institutional Agreement",
  research_permit:         "Research Permit",
  financial_report:        "Financial Report",
  identity_document:       "Identity Document",
  insurance:               "Insurance",
  other:                   "Other",
};

type ExpiryStatus = "expired" | "expiring_soon" | "active" | "no_expiry";

function getExpiryStatus(expiresAt: string | null): ExpiryStatus {
  if (!expiresAt) return "no_expiry";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiresAt + "T00:00:00");
  const days = Math.ceil((exp.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return "expired";
  if (days <= 30) return "expiring_soon";
  return "active";
}

function daysUntilExpiry(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiresAt + "T00:00:00");
  return Math.ceil((exp.getTime() - today.getTime()) / 86_400_000);
}

function StatusBadge({ status, days }: { status: ExpiryStatus; days: number | null }) {
  if (status === "expired") {
    const ago = days !== null ? Math.abs(days) : "?";
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
        Expired {ago}d ago
      </span>
    );
  }
  if (status === "expiring_soon") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
        Expires in {days}d
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
        Valid
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
      No expiry set
    </span>
  );
}

export default async function CompliancePage() {
  const supabase = await createClient();

  const { data: docs } = await supabase
    .from("documents")
    .select(
      "id, name, document_type, expires_at, is_compliance, grants(id, title, awardee_id), profiles:uploaded_by(full_name, email)"
    )
    .eq("is_compliance", true)
    .order("expires_at", { ascending: true, nullsFirst: false });

  const compliance = (docs ?? []) as unknown as ComplianceDoc[];

  const expired       = compliance.filter((d) => getExpiryStatus(d.expires_at) === "expired");
  const expiringSoon  = compliance.filter((d) => getExpiryStatus(d.expires_at) === "expiring_soon");
  const active        = compliance.filter((d) => getExpiryStatus(d.expires_at) === "active");
  const noExpiry      = compliance.filter((d) => getExpiryStatus(d.expires_at) === "no_expiry");

  function DocTable({ items, emptyText }: { items: ComplianceDoc[]; emptyText: string }) {
    if (items.length === 0) {
      return <p className="text-sm text-gray-400 py-4 text-center">{emptyText}</p>;
    }
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100">
              <th className="px-4 py-2">Awardee / Grant</th>
              <th className="px-4 py-2">Document</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Expiry Date</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((doc) => {
              const status = getExpiryStatus(doc.expires_at);
              const days   = daysUntilExpiry(doc.expires_at);
              const grant  = Array.isArray(doc.grants) ? doc.grants[0] : doc.grants;
              return (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {grant ? (
                      <div>
                        <p className="font-medium text-gray-900 truncate max-w-[180px]">{grant.title}</p>
                        {doc.profiles && (
                          <p className="text-xs text-gray-400">{doc.profiles.full_name ?? doc.profiles.email}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-800 truncate max-w-[180px] block">{doc.name}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {doc.document_type ? (DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {doc.expires_at
                      ? new Date(doc.expires_at + "T00:00:00").toLocaleDateString("en-ZA")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={status} days={days} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {grant?.awardee_id && (
                      <Link
                        href={`/awardees/${grant.awardee_id}/documents`}
                        className="text-xs text-[#6b1a2a] hover:underline font-medium"
                      >
                        View →
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Compliance Overview</h1>
        <p className="text-gray-500 text-sm mt-1">
          All compliance documents across awardees — grouped by expiry status.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Expired",       count: expired.length,      color: "text-red-600",   bg: "bg-red-50"   },
          { label: "Expiring Soon", count: expiringSoon.length,  color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Active",        count: active.length,        color: "text-green-600", bg: "bg-green-50" },
          { label: "No Expiry Set", count: noExpiry.length,      color: "text-gray-600",  bg: "bg-gray-50"  },
        ].map((s) => (
          <div key={s.label} className={`rounded-lg ${s.bg} px-4 py-4 text-center`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-xs font-medium text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Expired */}
      {expired.length > 0 && (
        <section className="rounded-xl border border-red-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-red-100 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>
            <h2 className="font-semibold text-gray-900">Expired ({expired.length})</h2>
          </div>
          <DocTable items={expired} emptyText="No expired documents." />
        </section>
      )}

      {/* Expiring soon */}
      {expiringSoon.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-amber-100 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400"></span>
            <h2 className="font-semibold text-gray-900">Expiring Soon ({expiringSoon.length})</h2>
          </div>
          <DocTable items={expiringSoon} emptyText="None expiring soon." />
        </section>
      )}

      {/* Active */}
      <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
          <h2 className="font-semibold text-gray-900">Active ({active.length})</h2>
        </div>
        <DocTable items={active} emptyText="No active compliance documents." />
      </section>

      {/* No expiry set */}
      {noExpiry.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-gray-400"></span>
            <h2 className="font-semibold text-gray-900">No Expiry Set ({noExpiry.length})</h2>
          </div>
          <DocTable items={noExpiry} emptyText="No documents without an expiry date." />
        </section>
      )}

      {compliance.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No compliance documents tracked yet.</p>
          <p className="text-sm mt-2">
            Upload documents and mark them as compliance on an awardee&apos;s Documents tab.
          </p>
        </div>
      )}
    </div>
  );
}
