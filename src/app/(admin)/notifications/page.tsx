import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { markAllRead, markNotificationRead } from "./actions";

const TYPE_ICONS: Record<string, string> = {
  milestone_due:          "⏰",
  milestone_overdue:      "🚨",
  expense_submitted:      "🧾",
  expense_reviewed:       "✅",
  disbursement_received:  "💸",
  grant_status_changed:   "📋",
};

function fmtDatetime(d: string) {
  return new Date(d).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const items = notifications ?? [];
  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <form action={markAllRead}>
            <button
              type="submit"
              className="text-sm text-blue-600 hover:underline font-medium"
            >
              Mark all as read
            </button>
          </form>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
        {items.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">
            No notifications yet. They&apos;ll appear here when milestones are due,
            expenses are submitted, or grants change status.
          </div>
        ) : (
          items.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-4 px-5 py-4 ${
                !n.read ? "bg-blue-50/40" : ""
              }`}
            >
              <span className="text-xl mt-0.5 shrink-0">
                {TYPE_ICONS[n.type] ?? "🔔"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className={`text-sm font-medium ${!n.read ? "text-gray-900" : "text-gray-700"}`}>
                      {n.title}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">{n.body}</p>
                    {n.href && (
                      <Link
                        href={n.href}
                        className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                      >
                        View →
                      </Link>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {fmtDatetime(n.created_at)}
                    </span>
                    {!n.read && (
                      <form action={markNotificationRead.bind(null, n.id)}>
                        <button
                          type="submit"
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Mark read
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
              {!n.read && (
                <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
