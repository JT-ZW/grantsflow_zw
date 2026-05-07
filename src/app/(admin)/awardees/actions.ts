"use server";

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
  // Grant
  grant_title: z.string().min(3, "Grant title is required"),
  grant_description: z.string().optional(),
  grant_type: z.string().min(1, "Grant type is required"),
  amount_awarded: z.coerce.number().positive("Amount must be greater than 0"),
  currency_code: z.string().length(3),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
  // Milestones (up to 5, delivered as JSON string)
  milestones_json: z.string().optional(),
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
      created_by: user.id,
    })
    .select("id")
    .single();

  if (grantError) {
    return { message: "Awardee created but failed to create grant. Please try again." };
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

  redirect(`/awardees/${awardee.id}`);
}
