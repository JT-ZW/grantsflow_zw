import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import {
  Document,
  Image,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import React from "react";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

// ── Logo ──────────────────────────────────────────────────────────────────
const logoPath    = path.join(process.cwd(), "public", "logo.png");
const logoDataUri = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;

// ── Styles ─────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page:         { padding: 48, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  header:       { marginBottom: 20, borderBottom: "2pt solid #6b1a2a", paddingBottom: 10 },
  headerRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle:  { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#6b1a2a" },
  headerMeta:   { fontSize: 9, color: "#888", marginTop: 2 },
  tableHeader:  { flexDirection: "row", backgroundColor: "#6b1a2a", padding: "5pt 6pt", marginBottom: 1 },
  tableHeaderTxt: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#fff" },
  tableRow:     { flexDirection: "row", padding: "4pt 6pt", borderBottom: "0.5pt solid #f3f4f6" },
  tableRowAlt:  { flexDirection: "row", padding: "4pt 6pt", backgroundColor: "#fafafa", borderBottom: "0.5pt solid #f3f4f6" },
  cell:         { fontSize: 9, color: "#1a1a1a" },
  footer:       { position: "absolute", bottom: 24, left: 48, right: 48, fontSize: 8, color: "#bbb", textAlign: "center" },
  summaryBox:   { flexDirection: "row", gap: 12, marginBottom: 20 },
  summaryCard:  { flex: 1, borderRadius: 6, backgroundColor: "#f9fafb", border: "0.5pt solid #e5e7eb", padding: "8pt 10pt" },
  summaryVal:   { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#6b1a2a" },
  summaryLbl:   { fontSize: 8, color: "#888", marginTop: 2 },
});

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
}
function fmtMoney(n: number | null, currency = "") {
  if (n === null || n === undefined) return "—";
  const prefix = currency ? `${currency} ` : "";
  return `${prefix}${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}
function cap(s: string | null) {
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}
function today() {
  return new Date().toISOString().split("T")[0];
}

// ── Per-type configs ──────────────────────────────────────────────────────

type ColDef = { header: string; flex: number; render: (row: Record<string, unknown>) => string };

const CONFIGS: Record<string, {
  label: string;
  subtitle: string;
  fetch: (admin: ReturnType<typeof createAdminClient>) => Promise<Record<string, unknown>[]>;
  summary?: (rows: Record<string, unknown>[]) => { label: string; value: string }[];
  columns: ColDef[];
}> = {
  grants: {
    label: "All Grants",
    subtitle: "Awardee details, grant status, amounts, and milestone completion",
    fetch: async (admin) => {
      const { data: awardees } = await admin
        .from("awardees")
        .select("id, full_name, email, awardee_type, faculty, grants(id, title, status, amount_awarded, currency_code, start_date, end_date, approval_status, milestones(id, status))")
        .order("full_name");
      const rows: Record<string, unknown>[] = [];
      for (const a of (awardees ?? []) as unknown as { id: string; full_name: string; email: string; awardee_type: string | null; faculty: string | null; grants: { id: string; title: string; status: string; amount_awarded: number; currency_code: string; start_date: string | null; end_date: string | null; approval_status: string | null; milestones: { id: string; status: string }[] }[] }[]) {
        const g = a.grants?.[0];
        if (!g) { rows.push({ awardee: a.full_name, email: a.email, type: a.awardee_type ?? "", faculty: a.faculty ?? "", grant: "No grant", status: "", approval: "", amount: "", currency: "", start: "", end: "", ms_completed: "", ms_total: "" }); continue; }
        const ms = g.milestones ?? [];
        const comp = ms.filter((m: { status: string }) => m.status === "completed").length;
        rows.push({ awardee: a.full_name, email: a.email, type: a.awardee_type ?? "", faculty: a.faculty ?? "", grant: g.title, status: g.status, approval: g.approval_status ?? "", amount: String(g.amount_awarded ?? ""), currency: g.currency_code ?? "", start: g.start_date ?? "", end: g.end_date ?? "", ms_completed: String(comp), ms_total: String(ms.length) });
      }
      return rows;
    },
    summary: (rows) => {
      const total = rows.length;
      const active = rows.filter((r) => r.status === "active").length;
      return [
        { label: "Total Grants", value: String(total) },
        { label: "Active", value: String(active) },
        { label: "Pending / Other", value: String(total - active) },
      ];
    },
    columns: [
      { header: "Awardee",    flex: 2.5, render: (r) => String(r.awardee ?? "") },
      { header: "Grant",      flex: 3,   render: (r) => String(r.grant ?? "") },
      { header: "Status",     flex: 1.5, render: (r) => cap(String(r.status ?? "")) },
      { header: "Amount",     flex: 2,   render: (r) => r.amount ? fmtMoney(Number(r.amount), String(r.currency ?? "")) : "—" },
      { header: "Start",      flex: 1.5, render: (r) => fmtDate(String(r.start || "")) },
      { header: "End",        flex: 1.5, render: (r) => fmtDate(String(r.end || "")) },
      { header: "Milestones", flex: 1.5, render: (r) => r.ms_total ? `${r.ms_completed}/${r.ms_total}` : "—" },
    ],
  },

  disbursements: {
    label: "Disbursements",
    subtitle: "All payments made to awardees with dates, amounts, and references",
    fetch: async (admin) => {
      const { data } = await admin
        .from("disbursements")
        .select("id, amount, currency_code, disbursement_date, notes, method, reference, grants(title, awardees(full_name))")
        .order("disbursement_date", { ascending: false });
      return ((data ?? []) as unknown as { id: string; amount: number; currency_code: string; disbursement_date: string | null; notes: string | null; method: string | null; reference: string | null; grants: { title: string; awardees: { full_name: string } | null } | null }[]).map((d) => ({
        awardee: d.grants?.awardees?.full_name ?? "—",
        grant: d.grants?.title ?? "—",
        amount: String(d.amount ?? ""),
        currency: d.currency_code ?? "",
        date: d.disbursement_date ?? "",
        method: d.method ?? "",
        reference: d.reference ?? "",
        notes: d.notes ?? "",
      }));
    },
    summary: (rows) => {
      const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
      return [
        { label: "Disbursements", value: String(rows.length) },
        { label: "Total Paid Out", value: fmtMoney(total) },
      ];
    },
    columns: [
      { header: "Awardee",   flex: 2,   render: (r) => String(r.awardee ?? "") },
      { header: "Grant",     flex: 2.5, render: (r) => String(r.grant ?? "") },
      { header: "Amount",    flex: 1.5, render: (r) => fmtMoney(Number(r.amount || 0), String(r.currency ?? "")) },
      { header: "Date",      flex: 1.5, render: (r) => fmtDate(String(r.date || "")) },
      { header: "Method",    flex: 1.5, render: (r) => cap(String(r.method || "")) },
      { header: "Reference", flex: 1.5, render: (r) => String(r.reference ?? "—") },
      { header: "Notes",     flex: 2,   render: (r) => String(r.notes ?? "") },
    ],
  },

  expenses: {
    label: "Expenses",
    subtitle: "All expense reports with approval status and dates",
    fetch: async (admin) => {
      const { data } = await admin
        .from("expenses")
        .select("id, description, amount, currency_code, status, expense_date, grants(title, awardees(full_name))")
        .order("expense_date", { ascending: false });
      return ((data ?? []) as unknown as { id: string; description: string; amount: number; currency_code: string; status: string; expense_date: string | null; grants: { title: string; awardees: { full_name: string } | null } | null }[]).map((e) => ({
        awardee: e.grants?.awardees?.full_name ?? "—",
        grant: e.grants?.title ?? "—",
        description: e.description ?? "",
        amount: String(e.amount ?? ""),
        currency: e.currency_code ?? "",
        status: e.status ?? "",
        date: e.expense_date ?? "",
      }));
    },
    summary: (rows) => {
      const approved = rows.filter((r) => r.status === "approved");
      const total = approved.reduce((s, r) => s + Number(r.amount || 0), 0);
      return [
        { label: "Total Expenses", value: String(rows.length) },
        { label: "Approved", value: String(approved.length) },
        { label: "Approved Total", value: fmtMoney(total) },
      ];
    },
    columns: [
      { header: "Awardee",     flex: 2,   render: (r) => String(r.awardee ?? "") },
      { header: "Description", flex: 3,   render: (r) => String(r.description ?? "") },
      { header: "Amount",      flex: 1.5, render: (r) => fmtMoney(Number(r.amount || 0), String(r.currency ?? "")) },
      { header: "Date",        flex: 1.5, render: (r) => fmtDate(String(r.date || "")) },
      { header: "Status",      flex: 1.5, render: (r) => cap(String(r.status ?? "")) },
    ],
  },

  budgets: {
    label: "Budget Lines",
    subtitle: "All budget allocations with approval status",
    fetch: async (admin) => {
      const { data } = await admin
        .from("budget_lines")
        .select("id, description, amount, currency_code, status, grants(title, awardees(full_name))")
        .order("created_at", { ascending: false });
      return ((data ?? []) as unknown as { id: string; description: string; amount: number; currency_code: string; status: string; grants: { title: string; awardees: { full_name: string } | null } | null }[]).map((b) => ({
        awardee: b.grants?.awardees?.full_name ?? "—",
        grant: b.grants?.title ?? "—",
        description: b.description ?? "",
        amount: String(b.amount ?? ""),
        currency: b.currency_code ?? "",
        status: b.status ?? "",
      }));
    },
    summary: (rows) => [
      { label: "Budget Lines", value: String(rows.length) },
      { label: "Approved", value: String(rows.filter((r) => r.status === "approved").length) },
    ],
    columns: [
      { header: "Awardee",     flex: 2,   render: (r) => String(r.awardee ?? "") },
      { header: "Grant",       flex: 2.5, render: (r) => String(r.grant ?? "") },
      { header: "Description", flex: 3,   render: (r) => String(r.description ?? "") },
      { header: "Amount",      flex: 1.5, render: (r) => fmtMoney(Number(r.amount || 0), String(r.currency ?? "")) },
      { header: "Status",      flex: 1.5, render: (r) => cap(String(r.status ?? "")) },
    ],
  },

  milestones: {
    label: "Milestones",
    subtitle: "All milestones with status and due dates",
    fetch: async (admin) => {
      const { data } = await admin
        .from("milestones")
        .select("id, title, due_date, status, grants(title, awardees(full_name))")
        .order("due_date", { ascending: false });
      return ((data ?? []) as unknown as { id: string; title: string; due_date: string | null; status: string; grants: { title: string; awardees: { full_name: string } | null } | null }[]).map((m) => ({
        awardee: m.grants?.awardees?.full_name ?? "—",
        grant: m.grants?.title ?? "—",
        title: m.title ?? "",
        due_date: m.due_date ?? "",
        status: m.status ?? "",
      }));
    },
    summary: (rows) => [
      { label: "Total Milestones", value: String(rows.length) },
      { label: "Completed", value: String(rows.filter((r) => r.status === "completed").length) },
      { label: "Overdue", value: String(rows.filter((r) => r.status === "overdue").length) },
    ],
    columns: [
      { header: "Awardee", flex: 2,   render: (r) => String(r.awardee ?? "") },
      { header: "Grant",   flex: 2.5, render: (r) => String(r.grant ?? "") },
      { header: "Title",   flex: 3,   render: (r) => String(r.title ?? "") },
      { header: "Due",     flex: 1.5, render: (r) => fmtDate(String(r.due_date || "")) },
      { header: "Status",  flex: 1.5, render: (r) => cap(String(r.status ?? "")) },
    ],
  },

  "grant-reports": {
    label: "Grant Reports",
    subtitle: "Reporting cycle submissions with dates and statuses",
    fetch: async (admin) => {
      const { data } = await admin
        .from("grant_reports")
        .select("id, period_label, due_date, submitted_at, status, grants(title, awardees(full_name))")
        .order("due_date", { ascending: false });
      return ((data ?? []) as unknown as { id: string; period_label: string | null; due_date: string; submitted_at: string | null; status: string; grants: { title: string; awardees: { full_name: string } | null } | null }[]).map((r) => ({
        awardee: r.grants?.awardees?.full_name ?? "—",
        grant: r.grants?.title ?? "—",
        period: r.period_label ?? "",
        due_date: r.due_date ?? "",
        submitted_at: r.submitted_at ?? "",
        status: r.status ?? "",
      }));
    },
    summary: (rows) => {
      const submitted = rows.filter((r) => r.status === "submitted" || r.status === "approved").length;
      const rate = rows.length > 0 ? Math.round((submitted / rows.length) * 100) : 0;
      return [
        { label: "Total Reports", value: String(rows.length) },
        { label: "Submitted", value: String(submitted) },
        { label: "Submission Rate", value: `${rate}%` },
      ];
    },
    columns: [
      { header: "Awardee",   flex: 2,   render: (r) => String(r.awardee ?? "") },
      { header: "Grant",     flex: 2.5, render: (r) => String(r.grant ?? "") },
      { header: "Period",    flex: 1.5, render: (r) => String(r.period ?? "—") },
      { header: "Due",       flex: 1.5, render: (r) => fmtDate(String(r.due_date || "")) },
      { header: "Submitted", flex: 1.5, render: (r) => r.submitted_at ? fmtDate(String(r.submitted_at)) : "—" },
      { header: "Status",    flex: 1.5, render: (r) => cap(String(r.status ?? "")) },
    ],
  },
};

// ── PDF Document ──────────────────────────────────────────────────────────
function TablePDF({
  label, subtitle, columns, rows, summary, generatedAt,
}: {
  label: string;
  subtitle: string;
  columns: ColDef[];
  rows: Record<string, unknown>[];
  summary?: { label: string; value: string }[];
  generatedAt: string;
}) {
  // Split into pages of ~30 rows each
  const PAGE_SIZE = 30;
  const pages: Record<string, unknown>[][] = [];
  for (let i = 0; i < rows.length; i += PAGE_SIZE) {
    pages.push(rows.slice(i, i + PAGE_SIZE));
  }
  if (pages.length === 0) pages.push([]);

  return (
    <Document>
      {pages.map((pageRows, pageIdx) => (
        <Page key={pageIdx} size="A4" orientation="landscape" style={S.page}>
          {/* Header — shown on every page */}
          <View style={S.header}>
            <View style={S.headerRow}>
              <Image src={logoDataUri} style={{ width: 80, height: 22, objectFit: "contain" }} />
              <View style={{ alignItems: "flex-end" }}>
                <Text style={S.headerTitle}>{label}</Text>
                <Text style={S.headerMeta}>{subtitle} · Generated {fmtDate(generatedAt)} · Page {pageIdx + 1} of {pages.length}</Text>
              </View>
            </View>
          </View>

          {/* Summary strip — first page only */}
          {pageIdx === 0 && summary && summary.length > 0 && (
            <View style={S.summaryBox}>
              {summary.map((s) => (
                <View key={s.label} style={S.summaryCard}>
                  <Text style={S.summaryVal}>{s.value}</Text>
                  <Text style={S.summaryLbl}>{s.label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Table */}
          <View style={S.tableHeader}>
            {columns.map((col) => (
              <Text key={col.header} style={[S.tableHeaderTxt, { flex: col.flex }]}>{col.header}</Text>
            ))}
          </View>

          {pageRows.length === 0 ? (
            <View style={{ padding: "16pt" }}>
              <Text style={{ fontSize: 10, color: "#aaa" }}>No data available.</Text>
            </View>
          ) : (
            pageRows.map((row, i) => (
              <View key={i} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                {columns.map((col) => (
                  <Text key={col.header} style={[S.cell, { flex: col.flex }]}>{col.render(row)}</Text>
                ))}
              </View>
            ))
          )}

          <Text style={S.footer}>GrantsFlow — Confidential — {fmtDate(generatedAt)}</Text>
        </Page>
      ))}
    </Document>
  );
}

// ── Route handler ─────────────────────────────────────────────────────────
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  const config = CONFIGS[type];
  if (!config) {
    return NextResponse.json({ error: `Unknown export type: ${type}` }, { status: 400 });
  }

  // Auth check
  const sessionClient = await createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await sessionClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const allowed = ["admin", "program_manager", "finance_officer", "auditor"];
  if (!profile || !allowed.includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch data via admin client (bypasses RLS)
  const admin = createAdminClient();
  const rows = await config.fetch(admin);
  const summary = config.summary ? config.summary(rows) : undefined;
  const generatedAt = new Date().toISOString();

  const pdfBuffer = await renderToBuffer(
    <TablePDF
      label={config.label}
      subtitle={config.subtitle}
      columns={config.columns}
      rows={rows}
      summary={summary}
      generatedAt={generatedAt}
    />
  );

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${type}-${today()}.pdf"`,
    },
  });
}
