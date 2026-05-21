import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/flag-documents
 *
 * Checks for compliance documents that have expired or are expiring within 30 days
 * and sends notifications to the relevant awardee.
 *
 * Protect with CRON_SECRET env var when called from an external scheduler.
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

  const supabase = createAdminClient();

  // Fetch compliance documents expiring within 30 days or already expired
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 30);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const { data: docs, error } = await supabase
    .from("documents")
    .select(
      "id, name, expires_at, document_type, grants(id, title, awardee_id)"
    )
    .eq("is_compliance", true)
    .not("expires_at", "is", null)
    .lte("expires_at", cutoffStr);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!docs || docs.length === 0) {
    return NextResponse.json({ ok: true, notified: 0 });
  }

  let notified = 0;

  for (const doc of docs) {
    const grant = Array.isArray(doc.grants) ? doc.grants[0] : doc.grants;
    if (!grant?.awardee_id) continue;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date((doc.expires_at as string) + "T00:00:00");
    const daysLeft = Math.ceil(
      (exp.getTime() - today.getTime()) / 86_400_000
    );

    const isExpired = daysLeft < 0;
    const message = isExpired
      ? `Compliance document "${doc.name}" expired ${Math.abs(daysLeft)} day(s) ago. Please upload a renewed version.`
      : `Compliance document "${doc.name}" expires in ${daysLeft} day(s). Please renew it before the deadline.`;

    const { error: notifError } = await supabase
      .from("notifications")
      .insert({
        user_id:      grant.awardee_id,
        title:        isExpired ? "Compliance Document Expired" : "Compliance Document Expiring Soon",
        message,
        type:         isExpired ? "error" : "warning",
        entity_type:  "document",
        entity_id:    doc.id,
      });

    if (!notifError) notified++;
  }

  return NextResponse.json({ ok: true, notified, flaggedAt: new Date().toISOString() });
}
