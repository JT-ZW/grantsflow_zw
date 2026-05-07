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

  const { data: expenses } = await supabase
    .from("expenses")
    .select(
      "expense_date, category, description, amount, currency_code, status, review_notes, reviewed_at, receipt_url, grants(title, awardees(full_name, email))"
    )
    .order("expense_date", { ascending: false });

  const rows = (expenses ?? []).map((e) => {
    const grant = e.grants as unknown as { title: string; awardees: { full_name: string; email: string } } | null;
    return {
      "Expense Date": e.expense_date,
      "Awardee Name": grant?.awardees?.full_name ?? "",
      "Awardee Email": grant?.awardees?.email ?? "",
      "Grant Title": grant?.title ?? "",
      Category: e.category,
      Description: e.description,
      Amount: e.amount,
      Currency: e.currency_code,
      Status: e.status,
      "Reviewed At": e.reviewed_at ? new Date(e.reviewed_at).toISOString().slice(0, 10) : "",
      "Review Notes": e.review_notes ?? "",
      "Receipt URL": e.receipt_url ?? "",
    };
  });

  const csv = toCsv(rows);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="expenses-${today()}.csv"`,
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
