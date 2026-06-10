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
const logoPath = path.join(process.cwd(), "public", "logo.png");
const logoDataUri = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;

// ── Styles ─────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page:          { padding: 48, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  coverPage:     { padding: 48, fontSize: 10, fontFamily: "Helvetica", color: "#fff", backgroundColor: "#6b1a2a" },
  coverLogo:     { width: 120, height: 33, objectFit: "contain", marginBottom: 32 },
  coverTitle:    { fontSize: 28, fontFamily: "Helvetica-Bold", color: "#fff", marginBottom: 8 },
  coverSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 40 },
  coverStat:     { flexDirection: "row", gap: 24, marginTop: 8 },
  coverStatBox:  { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 8, padding: "12pt 20pt", flex: 1 },
  coverStatVal:  { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#fff" },
  coverStatLbl:  { fontSize: 9, color: "rgba(255,255,255,0.6)", marginTop: 2 },
  coverDate:     { position: "absolute", bottom: 48, left: 48, fontSize: 9, color: "rgba(255,255,255,0.5)" },

  header:       { marginBottom: 18, borderBottom: "2pt solid #6b1a2a", paddingBottom: 10 },
  headerRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle:  { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#6b1a2a" },
  headerSub:    { fontSize: 9, color: "#888", marginTop: 2 },

  section:      { marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#6b1a2a", marginBottom: 5, borderBottom: "0.5pt solid #e5e7eb", paddingBottom: 3 },

  row:    { flexDirection: "row", marginBottom: 3 },
  label:  { width: 140, color: "#555", fontSize: 9 },
  value:  { flex: 1, color: "#1a1a1a", fontSize: 9 },

  tableHeader: { flexDirection: "row", backgroundColor: "#f9fafb", padding: "4pt 6pt", marginBottom: 1 },
  tableRow:    { flexDirection: "row", padding: "3pt 6pt", borderBottom: "0.5pt solid #f3f4f6" },
  colTitle:    { flex: 3 },
  colDate:     { flex: 2 },
  colStatus:   { flex: 2 },
  colAmount:   { flex: 2 },

  badge:  { padding: "1pt 5pt", borderRadius: 3, fontSize: 8 },
  footer: { position: "absolute", bottom: 24, left: 48, right: 48, fontSize: 8, color: "#bbb", textAlign: "center" },

  divider: { borderBottom: "1pt solid #f3f4f6", marginVertical: 10 },

  progressBg:   { backgroundColor: "#f3f4f6", borderRadius: 3, height: 5, width: "100%", marginTop: 2 },
  progressFill: { backgroundColor: "#6b1a2a", borderRadius: 3, height: 5 },
});

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(n: number | null, currency = "USD") {
  if (!n) return "—";
  return `${currency} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
}
function badgeColor(status: string) {
  const s = status?.toLowerCase();
  if (s === "active" || s === "approved" || s === "completed") return "#16a34a";
  if (s === "pending" || s === "submitted" || s === "in_progress") return "#d97706";
  if (s === "overdue" || s === "rejected") return "#dc2626";
  return "#6b7280";
}
function cap(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : "—";
}

// ── Types ──────────────────────────────────────────────────────────────────
type Milestone    = { id: string; grant_id: string; title: string; due_date: string | null; status: string };
type Disbursement = { id: string; grant_id: string; amount: number; currency_code: string; disbursement_date: string | null; notes: string | null };
type GrantReport  = { id: string; grant_id: string; period_label: string | null; due_date: string; status: string; submitted_at: string | null };
type Grant = {
  id: string; title: string; status: string; amount_awarded: number;
  currency_code: string; start_date: string | null; end_date: string | null;
  approval_status: string | null;
  milestones: Milestone[];
  disbursements: Disbursement[];
  grant_reports: GrantReport[];
};
type Awardee = {
  id: string; full_name: string; email: string;
  awardee_type: string | null; faculty: string | null; department: string | null;
  gender: string | null;
  grants: Grant[];
};

// ── PDF document ──────────────────────────────────────────────────────────
function PortfolioPDF({ awardees, generatedAt }: { awardees: Awardee[]; generatedAt: string }) {
  const totalGranted   = awardees.flatMap((a) => a.grants).reduce((s, g) => s + (g.amount_awarded ?? 0), 0);
  const totalDisbursed = awardees.flatMap((a) => a.grants.flatMap((g) => g.disbursements)).reduce((s, d) => s + Number(d.amount), 0);
  const activeGrants   = awardees.flatMap((a) => a.grants).filter((g) => g.status === "active").length;

  return (
    <Document>
      {/* ── Cover Page ─────────────────────────────────────────────── */}
      <Page size="A4" style={S.coverPage}>
        <Image src={logoDataUri} style={S.coverLogo} />
        <Text style={S.coverTitle}>Portfolio Summary</Text>
        <Text style={S.coverSubtitle}>Comprehensive grant portfolio report — generated {fmtDate(generatedAt)}</Text>

        <View style={S.coverStat}>
          <View style={S.coverStatBox}>
            <Text style={S.coverStatVal}>{awardees.length}</Text>
            <Text style={S.coverStatLbl}>Total Awardees</Text>
          </View>
          <View style={S.coverStatBox}>
            <Text style={S.coverStatVal}>{activeGrants}</Text>
            <Text style={S.coverStatLbl}>Active Grants</Text>
          </View>
          <View style={S.coverStatBox}>
            <Text style={S.coverStatVal}>{fmt(totalGranted, "USD").replace("USD ", "")}</Text>
            <Text style={S.coverStatLbl}>Total Awarded</Text>
          </View>
          <View style={S.coverStatBox}>
            <Text style={S.coverStatVal}>{fmt(totalDisbursed, "USD").replace("USD ", "")}</Text>
            <Text style={S.coverStatLbl}>Total Disbursed</Text>
          </View>
        </View>

        <Text style={S.coverDate}>GrantsFlow — Confidential — {generatedAt}</Text>
      </Page>

      {/* ── Table of Contents ──────────────────────────────────────── */}
      <Page size="A4" style={S.page}>
        <View style={S.header}>
          <View style={S.headerRow}>
            <Image src={logoDataUri} style={{ width: 80, height: 22, objectFit: "contain" }} />
            <Text style={S.headerSub}>Generated {fmtDate(generatedAt)}</Text>
          </View>
        </View>

        <View style={S.section}>
          <Text style={S.sectionTitle}>Awardee Index</Text>
          {awardees.map((a, idx) => {
            const g = a.grants[0];
            return (
              <View key={a.id} style={[S.row, { paddingVertical: 4, borderBottom: "0.5pt solid #f3f4f6" }]}>
                <Text style={{ width: 20, color: "#aaa", fontSize: 9 }}>{idx + 1}.</Text>
                <Text style={{ flex: 3, fontFamily: "Helvetica-Bold", fontSize: 9 }}>{a.full_name}</Text>
                <Text style={{ flex: 3, color: "#555", fontSize: 9 }}>{g?.title ?? "No grant"}</Text>
                <Text style={{ flex: 1.5, color: badgeColor(g?.status ?? ""), fontSize: 9, textAlign: "right" }}>{cap(g?.status ?? "")}</Text>
                <Text style={{ flex: 2, color: "#555", fontSize: 9, textAlign: "right" }}>{fmt(g?.amount_awarded ?? null, g?.currency_code)}</Text>
              </View>
            );
          })}
        </View>

        <Text style={S.footer}>GrantsFlow — Confidential Portfolio Summary — {fmtDate(generatedAt)}</Text>
      </Page>

      {/* ── Per-Awardee Pages ──────────────────────────────────────── */}
      {awardees.map((awardee) => {
        const grant = awardee.grants[0];
        if (!grant) return null;

        const milestones    = grant.milestones    ?? [];
        const disbursements = grant.disbursements ?? [];
        const grantReports  = grant.grant_reports ?? [];

        const totalDisbursedForGrant = disbursements.reduce((s, d) => s + Number(d.amount), 0);
        const msCompleted = milestones.filter((m) => m.status === "completed").length;
        const msPct = milestones.length > 0 ? Math.round((msCompleted / milestones.length) * 100) : 0;

        const overdue = grantReports.filter(
          (r) => new Date(r.due_date) < new Date() && r.status !== "submitted" && r.status !== "approved"
        ).length;

        return (
          <Page key={awardee.id} size="A4" style={S.page}>
            {/* Page header */}
            <View style={S.header}>
              <View style={S.headerRow}>
                <Image src={logoDataUri} style={{ width: 80, height: 22, objectFit: "contain" }} />
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={S.headerTitle}>{awardee.full_name}</Text>
                  <Text style={S.headerSub}>{grant.title}</Text>
                </View>
              </View>
            </View>

            {/* Awardee details */}
            <View style={S.section}>
              <Text style={S.sectionTitle}>Awardee Details</Text>
              <View style={S.row}><Text style={S.label}>Name</Text><Text style={S.value}>{awardee.full_name}</Text></View>
              <View style={S.row}><Text style={S.label}>Email</Text><Text style={S.value}>{awardee.email}</Text></View>
              {awardee.awardee_type && <View style={S.row}><Text style={S.label}>Type</Text><Text style={S.value}>{cap(awardee.awardee_type)}</Text></View>}
              {awardee.faculty     && <View style={S.row}><Text style={S.label}>Faculty</Text><Text style={S.value}>{awardee.faculty}</Text></View>}
              {awardee.department  && <View style={S.row}><Text style={S.label}>Department</Text><Text style={S.value}>{awardee.department}</Text></View>}
              {awardee.gender      && <View style={S.row}><Text style={S.label}>Gender</Text><Text style={S.value}>{cap(awardee.gender)}</Text></View>}
            </View>

            {/* Grant summary */}
            <View style={S.section}>
              <Text style={S.sectionTitle}>Grant Summary</Text>
              <View style={S.row}><Text style={S.label}>Title</Text><Text style={S.value}>{grant.title}</Text></View>
              <View style={S.row}><Text style={S.label}>Status</Text>
                <Text style={[S.value, { color: badgeColor(grant.status) }]}>{cap(grant.status)}</Text>
              </View>
              <View style={S.row}><Text style={S.label}>Amount Awarded</Text><Text style={S.value}>{fmt(grant.amount_awarded, grant.currency_code)}</Text></View>
              <View style={S.row}><Text style={S.label}>Total Disbursed</Text><Text style={S.value}>{fmt(totalDisbursedForGrant, grant.currency_code)}</Text></View>
              <View style={S.row}><Text style={S.label}>Start Date</Text><Text style={S.value}>{fmtDate(grant.start_date)}</Text></View>
              <View style={S.row}><Text style={S.label}>End Date</Text><Text style={S.value}>{fmtDate(grant.end_date)}</Text></View>
              <View style={S.row}><Text style={S.label}>Milestone Progress</Text>
                <View style={{ flex: 1 }}>
                  <Text style={S.value}>{msCompleted} / {milestones.length} completed ({msPct}%)</Text>
                  <View style={S.progressBg}>
                    <View style={[S.progressFill, { width: `${msPct}%` as unknown as number }]} />
                  </View>
                </View>
              </View>
              {overdue > 0 && (
                <View style={S.row}><Text style={S.label}>Overdue Reports</Text>
                  <Text style={[S.value, { color: "#dc2626", fontFamily: "Helvetica-Bold" }]}>{overdue} overdue</Text>
                </View>
              )}
            </View>

            {/* Milestones */}
            {milestones.length > 0 && (
              <View style={S.section}>
                <Text style={S.sectionTitle}>Milestones</Text>
                <View style={S.tableHeader}>
                  <Text style={[S.colTitle, { fontSize: 9, color: "#888" }]}>Title</Text>
                  <Text style={[S.colDate,  { fontSize: 9, color: "#888" }]}>Due Date</Text>
                  <Text style={[S.colStatus,{ fontSize: 9, color: "#888" }]}>Status</Text>
                </View>
                {milestones.map((m) => (
                  <View key={m.id} style={S.tableRow}>
                    <Text style={[S.colTitle,  { fontSize: 9 }]}>{m.title}</Text>
                    <Text style={[S.colDate,   { fontSize: 9, color: "#555" }]}>{fmtDate(m.due_date)}</Text>
                    <Text style={[S.colStatus, { fontSize: 9, color: badgeColor(m.status) }]}>{cap(m.status)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Disbursements */}
            {disbursements.length > 0 && (
              <View style={S.section}>
                <Text style={S.sectionTitle}>Disbursements</Text>
                <View style={S.tableHeader}>
                  <Text style={[S.colTitle,  { fontSize: 9, color: "#888" }]}>Notes</Text>
                  <Text style={[S.colDate,   { fontSize: 9, color: "#888" }]}>Date</Text>
                  <Text style={[S.colAmount, { fontSize: 9, color: "#888", textAlign: "right" }]}>Amount</Text>
                </View>
                {disbursements.map((d) => (
                  <View key={d.id} style={S.tableRow}>
                    <Text style={[S.colTitle,  { fontSize: 9 }]}>{d.notes ?? "—"}</Text>
                    <Text style={[S.colDate,   { fontSize: 9, color: "#555" }]}>{fmtDate(d.disbursement_date)}</Text>
                    <Text style={[S.colAmount, { fontSize: 9, textAlign: "right" }]}>{fmt(d.amount, d.currency_code)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Grant Reports */}
            {grantReports.length > 0 && (
              <View style={S.section}>
                <Text style={S.sectionTitle}>Report Submissions</Text>
                <View style={S.tableHeader}>
                  <Text style={[S.colTitle,  { fontSize: 9, color: "#888" }]}>Period</Text>
                  <Text style={[S.colDate,   { fontSize: 9, color: "#888" }]}>Due</Text>
                  <Text style={[S.colDate,   { fontSize: 9, color: "#888" }]}>Submitted</Text>
                  <Text style={[S.colStatus, { fontSize: 9, color: "#888" }]}>Status</Text>
                </View>
                {grantReports.map((r) => (
                  <View key={r.id} style={S.tableRow}>
                    <Text style={[S.colTitle,  { fontSize: 9 }]}>{r.period_label ?? "—"}</Text>
                    <Text style={[S.colDate,   { fontSize: 9, color: "#555" }]}>{fmtDate(r.due_date)}</Text>
                    <Text style={[S.colDate,   { fontSize: 9, color: "#555" }]}>{r.submitted_at ? fmtDate(r.submitted_at) : "Not submitted"}</Text>
                    <Text style={[S.colStatus, { fontSize: 9, color: badgeColor(r.status) }]}>{cap(r.status)}</Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={S.footer}>GrantsFlow — Confidential — {fmtDate(generatedAt)}</Text>
          </Page>
        );
      })}
    </Document>
  );
}

// ── Route handler ─────────────────────────────────────────────────────────
export async function GET() {
  // Auth check via session client
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

  // Use admin client to bypass RLS for full portfolio read
  const admin = createAdminClient();

  const [awardeesRes, grantsRes, milestonesRes, disbursementsRes, grantReportsRes] = await Promise.all([
    admin.from("awardees").select("id, full_name, email, awardee_type, faculty, department, gender").order("full_name"),
    admin.from("grants").select("id, awardee_id, title, status, amount_awarded, currency_code, start_date, end_date, approval_status"),
    admin.from("milestones").select("id, grant_id, title, due_date, status"),
    admin.from("disbursements").select("id, grant_id, amount, currency_code, disbursement_date, notes"),
    admin.from("grant_reports").select("id, grant_id, period_label, due_date, status, submitted_at"),
  ]);

  type RawAwardee = { id: string; full_name: string; email: string; awardee_type: string | null; faculty: string | null; department: string | null; gender: string | null };
  type RawGrant   = { id: string; awardee_id: string; title: string; status: string; amount_awarded: number; currency_code: string; start_date: string | null; end_date: string | null; approval_status: string | null };

  const rawAwardees     = (awardeesRes.data     ?? []) as RawAwardee[];
  const rawGrants       = (grantsRes.data        ?? []) as RawGrant[];
  const rawMilestones   = (milestonesRes.data    ?? []) as Milestone[];
  const rawDisb         = (disbursementsRes.data ?? []) as Disbursement[];
  const rawReports      = (grantReportsRes.data  ?? []) as GrantReport[];

  // Build lookup maps
  const msMap:   Record<string, Milestone[]>    = {};
  const disbMap: Record<string, Disbursement[]> = {};
  const rptMap:  Record<string, GrantReport[]>  = {};
  for (const m of rawMilestones)   (msMap[m.grant_id]   ??= []).push(m);
  for (const d of rawDisb)         (disbMap[d.grant_id]  ??= []).push(d);
  for (const r of rawReports)      (rptMap[r.grant_id]   ??= []).push(r);

  // Assemble awardees with their grants
  const grantsByAwardee: Record<string, Grant[]> = {};
  for (const g of rawGrants) {
    const grant: Grant = {
      ...g,
      milestones:    msMap[g.id]   ?? [],
      disbursements: disbMap[g.id] ?? [],
      grant_reports: rptMap[g.id]  ?? [],
    };
    (grantsByAwardee[g.awardee_id] ??= []).push(grant);
  }

  const awardees: Awardee[] = rawAwardees.map((a) => ({
    ...a,
    grants: grantsByAwardee[a.id] ?? [],
  }));

  const generatedAt = new Date().toISOString();

  const pdfBuffer = await renderToBuffer(
    <PortfolioPDF awardees={awardees} generatedAt={generatedAt} />
  );

  const dateStr = new Date().toISOString().split("T")[0];

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="portfolio-summary-${dateStr}.pdf"`,
    },
  });
}
