import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  Font,
} from "@react-pdf/renderer";
import React from "react";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { marginBottom: 24, borderBottom: "2pt solid #6b1a2a", paddingBottom: 12 },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#6b1a2a" },
  subtitle: { fontSize: 11, color: "#555", marginTop: 2 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#6b1a2a", marginBottom: 6, borderBottom: "1pt solid #e5e7eb", paddingBottom: 3 },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: 130, color: "#555" },
  value: { flex: 1, color: "#1a1a1a" },
  tableHeader: { flexDirection: "row", backgroundColor: "#f3f4f6", padding: "4pt 6pt", marginBottom: 2 },
  tableRow: { flexDirection: "row", padding: "3pt 6pt", borderBottom: "0.5pt solid #e5e7eb" },
  col1: { flex: 2 },
  col2: { flex: 1 },
  col3: { flex: 1 },
  footer: { position: "absolute", bottom: 24, left: 48, right: 48, fontSize: 8, color: "#aaa", textAlign: "center" },
  badge: { padding: "2pt 6pt", borderRadius: 4, backgroundColor: "#f3f4f6" },
});

function fmt(n: number | null, currency = "USD") {
  if (!n) return "—";
  return `${currency} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: awardeeId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch all data needed for the report
  const [awardeeRes, grantRes] = await Promise.all([
    supabase.from("awardees").select("id, full_name, email, awardee_type, faculty, department").eq("id", awardeeId).single(),
    supabase.from("grants").select("id, title, status, amount_awarded, currency_code, start_date, end_date, approval_status").eq("awardee_id", awardeeId).single(),
  ]);

  const awardee = awardeeRes.data as { id: string; full_name: string; email: string; awardee_type: string | null; faculty: string | null; department: string | null } | null;
  const grant = grantRes.data as { id: string; title: string; status: string; amount_awarded: number; currency_code: string; start_date: string | null; end_date: string | null; approval_status: string | null } | null;

  if (!awardee || !grant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [milestonesRes, expensesRes, disbursementsRes] = await Promise.all([
    supabase.from("milestones").select("id, title, due_date, status").eq("grant_id", grant.id).order("due_date"),
    supabase.from("expenses").select("id, description, amount, currency_code, status, expense_date").eq("grant_id", grant.id).order("expense_date"),
    supabase.from("disbursements").select("id, amount, currency_code, disbursement_date, notes").eq("grant_id", grant.id).order("disbursement_date"),
  ]);

  const milestones = (milestonesRes.data ?? []) as { id: string; title: string; due_date: string | null; status: string }[];
  const expenses = (expensesRes.data ?? []) as { id: string; description: string; amount: number; currency_code: string; status: string; expense_date: string | null }[];
  const disbursements = (disbursementsRes.data ?? []) as { id: string; amount: number; currency_code: string; disbursement_date: string | null; notes: string | null }[];

  const totalDisbursed = disbursements.reduce((s, d) => s + Number(d.amount), 0);
  const totalExpenses = expenses.filter((e) => e.status === "approved").reduce((s, e) => s + Number(e.amount), 0);

  const pdfDoc = (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Grant Report</Text>
          <Text style={styles.subtitle}>Generated {fmtDate(new Date().toISOString())}</Text>
        </View>

        {/* Awardee Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Awardee Details</Text>
          <View style={styles.row}><Text style={styles.label}>Name</Text><Text style={styles.value}>{awardee.full_name}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Email</Text><Text style={styles.value}>{awardee.email}</Text></View>
          {awardee.awardee_type && <View style={styles.row}><Text style={styles.label}>Type</Text><Text style={styles.value}>{awardee.awardee_type}</Text></View>}
          {awardee.faculty && <View style={styles.row}><Text style={styles.label}>Faculty</Text><Text style={styles.value}>{awardee.faculty}</Text></View>}
          {awardee.department && <View style={styles.row}><Text style={styles.label}>Department</Text><Text style={styles.value}>{awardee.department}</Text></View>}
        </View>

        {/* Grant Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Grant Details</Text>
          <View style={styles.row}><Text style={styles.label}>Title</Text><Text style={styles.value}>{grant.title}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Status</Text><Text style={styles.value}>{grant.status}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Approval Status</Text><Text style={styles.value}>{grant.approval_status ?? "—"}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Amount Awarded</Text><Text style={styles.value}>{fmt(grant.amount_awarded, grant.currency_code)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Start Date</Text><Text style={styles.value}>{fmtDate(grant.start_date)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>End Date</Text><Text style={styles.value}>{fmtDate(grant.end_date)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Total Disbursed</Text><Text style={styles.value}>{fmt(totalDisbursed, grant.currency_code)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Approved Expenses</Text><Text style={styles.value}>{fmt(totalExpenses, grant.currency_code)}</Text></View>
        </View>

        {/* Milestones */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Milestones ({milestones.length})</Text>
          {milestones.length === 0 ? <Text style={{ color: "#aaa" }}>No milestones.</Text> : (
            <>
              <View style={styles.tableHeader}>
                <Text style={styles.col1}>Title</Text>
                <Text style={styles.col2}>Due Date</Text>
                <Text style={styles.col3}>Status</Text>
              </View>
              {milestones.map((m) => (
                <View key={m.id} style={styles.tableRow}>
                  <Text style={styles.col1}>{m.title}</Text>
                  <Text style={styles.col2}>{fmtDate(m.due_date)}</Text>
                  <Text style={styles.col3}>{m.status}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Disbursements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Disbursements ({disbursements.length})</Text>
          {disbursements.length === 0 ? <Text style={{ color: "#aaa" }}>No disbursements.</Text> : (
            <>
              <View style={styles.tableHeader}>
                <Text style={styles.col1}>Notes</Text>
                <Text style={styles.col2}>Date</Text>
                <Text style={styles.col3}>Amount</Text>
              </View>
              {disbursements.map((d) => (
                <View key={d.id} style={styles.tableRow}>
                  <Text style={styles.col1}>{d.notes ?? "—"}</Text>
                  <Text style={styles.col2}>{fmtDate(d.disbursement_date)}</Text>
                  <Text style={styles.col3}>{fmt(d.amount, d.currency_code)}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Expenses */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expenses ({expenses.length})</Text>
          {expenses.length === 0 ? <Text style={{ color: "#aaa" }}>No expenses.</Text> : (
            <>
              <View style={styles.tableHeader}>
                <Text style={styles.col1}>Description</Text>
                <Text style={styles.col2}>Date</Text>
                <Text style={styles.col3}>Amount</Text>
              </View>
              {expenses.map((e) => (
                <View key={e.id} style={styles.tableRow}>
                  <Text style={styles.col1}>{e.description}</Text>
                  <Text style={styles.col2}>{fmtDate(e.expense_date)}</Text>
                  <Text style={styles.col3}>{fmt(e.amount, e.currency_code)}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        <Text style={styles.footer}>GrantsFlow — Confidential report — {fmtDate(new Date().toISOString())}</Text>
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(pdfDoc);

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="grant-report-${awardeeId}.pdf"`,
    },
  });
}
