"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";

const onboardingSchema = z.object({
  // Awardee
  full_name: z.string().min(2, "Full name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  awardee_type: z.enum(["individual", "team", "organization"]),
  student_number: z.string().optional(),
  department: z.string().optional(),
  faculty: z.string().optional(),
  supervisor_name: z.string().optional(),
  supervisor_email: z.string().email().optional().or(z.literal("")),
  // Programme assignment (optional)
  programme_id: z.string().uuid().optional().or(z.literal("")),
  // Category within programme (optional; required when programme has categories)
  category_id: z.string().uuid().optional().or(z.literal("")),
  grant_title: z.string().min(3, "Grant title is required"),
  grant_description: z.string().optional(),
  grant_type: z.string().min(1, "Grant type is required"),
  amount_awarded: z.coerce.number().positive("Amount must be greater than 0"),
  currency_code: z.string().min(2).max(10),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
  // Milestones (up to 8, delivered as JSON string)
  milestones_json: z.string().optional(),
  // Impact classification (JSON arrays — optional, requires phase10 DB migration)
  sectors_json:       z.string().optional(),
  sdg_goals_json:     z.string().optional(),
  country_codes_json: z.string().optional(),
  geographic_scope:   z.string().optional(),
  beneficiary_type:   z.string().optional(),
  // Portal invite
  send_invite:       z.string().optional(), // "true" when checkbox checked
  team_members_json: z.string().optional(), // JSON array of additional email strings
});

export type OnboardingState = {
  errors?: Partial<Record<string, string[]>>;
  message?: string;
};

export async function createAwardeeAndGrant(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { message: "Unauthorized" };

  const raw = Object.fromEntries(formData.entries());
  const parsed = onboardingSchema.safeParse(raw);

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const d = parsed.data;

  if (d.end_date <= d.start_date) {
    return { errors: { end_date: ["End date must be after start date"] } };
  }

  // If a programme is selected, check whether it has categories — if so, category is required
  if (d.programme_id) {
    const { data: cats } = await supabase
      .from("programme_categories")
      .select("id")
      .eq("programme_id", d.programme_id)
      .limit(1);
    if (cats && cats.length > 0 && !d.category_id) {
      return { errors: { category_id: ["Please select a category for this programme"] } };
    }
  }

  // 1. Create awardee
  const { data: awardee, error: awardeeError } = await supabase
    .from("awardees")
    .insert({
      full_name: d.full_name,
      email: d.email,
      phone: d.phone || null,
      awardee_type: d.awardee_type,
      student_number: d.student_number || null,
      department: d.department || null,
      faculty: d.faculty || null,
      supervisor_name: d.supervisor_name || null,
      supervisor_email: d.supervisor_email || null,
    })
    .select("id")
    .single();

  if (awardeeError) {
    if (awardeeError.code === "23505") {
      return { errors: { email: ["An awardee with this email already exists"] } };
    }
    return { message: "Failed to create awardee. Please try again." };
  }

  // 2. Create grant
  let sectors: string[] = [];
  let sdgGoals: number[] = [];
  let countryCodes: string[] = [];
  try { sectors     = JSON.parse(d.sectors_json     ?? "[]"); } catch { /* ignore */ }
  try { sdgGoals    = JSON.parse(d.sdg_goals_json   ?? "[]"); } catch { /* ignore */ }
  try { countryCodes = JSON.parse(d.country_codes_json ?? "[]"); } catch { /* ignore */ }

  const { data: grant, error: grantError } = await supabase
    .from("grants")
    .insert({
      awardee_id: awardee.id,
      title: d.grant_title,
      description: d.grant_description || null,
      grant_type: d.grant_type,
      amount_awarded: d.amount_awarded,
      currency_code: d.currency_code.toUpperCase(),
      start_date: d.start_date,
      end_date: d.end_date,
      programme_id: d.programme_id || null,
      category_id: d.category_id || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (grantError) {
    return { message: `Awardee created but failed to create grant: ${grantError.message}` };
  }

  // Update impact classification fields separately (requires phase10 DB migration — non-fatal)
  if (sectors.length || sdgGoals.length || countryCodes.length || d.geographic_scope || d.beneficiary_type) {
    await supabase.from("grants").update({
      sectors:          sectors.length      ? sectors      : null,
      sdg_goals:        sdgGoals.length     ? sdgGoals     : null,
      country_codes:    countryCodes.length ? countryCodes : null,
      geographic_scope: d.geographic_scope  || null,
      beneficiary_type: d.beneficiary_type  || null,
    }).eq("id", grant.id);
    // Error intentionally ignored — impact fields require phase10 migration
  }

  // 3. Create milestones (if provided)
  if (d.milestones_json) {
    try {
      const milestones = JSON.parse(d.milestones_json) as Array<{
        title: string;
        due_date: string;
        deliverables?: string;
      }>;

      const validMilestones = milestones
        .filter((m) => m.title && m.due_date)
        .map((m, i) => ({
          grant_id: grant.id,
          title: m.title,
          due_date: m.due_date,
          deliverables: m.deliverables || null,
          sort_order: i,
        }));

      if (validMilestones.length > 0) {
        await supabase.from("milestones").insert(validMilestones);
      }
    } catch {
      // Non-fatal — milestones can be added later
    }
  }

  // 4. Audit log
  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "awardee.onboarded",
    entity_type: "awardee",
    entity_id: awardee.id,
    new_data: { awardee_id: awardee.id, grant_id: grant.id },
  });

  // 5. Portal invites (non-fatal — errors logged but do not block redirect)
  if (d.send_invite === "true") {
    const admin = createAdminClient();

    // Invite primary contact
    const { data: primaryInvite } = await admin.auth.admin.inviteUserByEmail(d.email, {
      data: { full_name: d.full_name },
    });

    if (primaryInvite?.user?.id) {
      // Link the new auth user back to the awardee record
      await admin
        .from("awardees")
        .update({ user_id: primaryInvite.user.id })
        .eq("id", awardee.id);

      // Record membership
      await admin.from("awardee_members").insert({
        awardee_id: awardee.id,
        profile_id: primaryInvite.user.id,
        is_primary: true,
      });
    }

    // Invite team members
    if (d.team_members_json) {
      try {
        const teamEmails = JSON.parse(d.team_members_json) as string[];
        for (const email of teamEmails.slice(0, 4)) {
          if (!email || !email.includes("@")) continue;
          const { data: teamInvite } = await admin.auth.admin.inviteUserByEmail(email, {
            data: { full_name: email },
          });
          if (teamInvite?.user?.id) {
            await admin.from("awardee_members").insert({
              awardee_id: awardee.id,
              profile_id: teamInvite.user.id,
              is_primary: false,
            });
          }
        }
      } catch {
        // Non-fatal — team member invites can be retried from the awardee profile
      }
    }
  }

  redirect(`/awardees/${awardee.id}`);
}
