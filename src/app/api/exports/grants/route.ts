import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const allowed = ["admin", "program_manager", "finance_officer", "auditor"];
  if (!profile || !allowed.includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: awardees } = await supabase
    .from("awardees")
    .select(
      "full_name, email, awardee_type, faculty, department, grants(title, status, amount_awarded, currency_code, start_date, end_date, milestones(id, status))"
    )
    .order("full_name");

  const rows = (awardees ?? []).map((a) => {
    const grants = a.grants as {
      title: string;
      status: string;
      amount_awarded: number;
      currency_code: string;
      start_date: string | null;
      end_date: string | null;
      milestones: { id: string; status: string }[];
    }[];
    const g = grants?.[0];
    const milestones = g?.milestones ?? [];
    const completed = milestones.filter((m) => m.status === "completed").length;
    return {
      "Awardee Name": a.full_name,
      Email: a.email,
      Type: a.awardee_type,
      Faculty: a.faculty ?? "",
      Department: a.department ?? "",
      "Grant Title": g?.title ?? "",
      Status: g?.status ?? "",
      "Amount Awarded": g?.amount_awarded ?? "",
      Currency: g?.currency_code ?? "",
      "Start Date": g?.start_date ?? "",
      "End Date": g?.end_date ?? "",
      "Total Milestones": milestones.length,
      "Completed Milestones": completed,
    };
  });

  const csv = toCsv(rows);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="grants-${today()}.csv"`,
    },
  });
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(csvCell).join(","),
    ...rows.map((r) => headers.map((h) => csvCell(String(r[h] ?? ""))).join(",")),
  ];
  return lines.join("\r\n");
}

function csvCell(value: string): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
