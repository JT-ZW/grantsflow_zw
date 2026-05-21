import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/flag-milestones
 *
 * Calls the flag_overdue_milestones() SQL function to mark any milestone
 * whose due_date has passed and is not yet completed or already delayed.
 *
 * Can be triggered by:
 *   - An external cron service (e.g. Vercel Cron, GitHub Actions)
 *   - The "Sync overdue milestones" button on the admin dashboard
 *
 * Protect with CRON_SECRET env var when called externally.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET environment variable is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("flag_overdue_milestones");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, flaggedAt: new Date().toISOString() });
}
