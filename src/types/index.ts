export type UserRole = "admin" | "program_manager" | "finance_officer" | "auditor" | "awardee";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
}

export type AwardeeType = "individual" | "team" | "organization";

export interface Awardee {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  awardee_type: AwardeeType;
  student_number: string | null;
  department: string | null;
  faculty: string | null;
  supervisor_name: string | null;
  supervisor_email: string | null;
  created_at: string;
  updated_at: string;
}

export type GrantStatus = "active" | "completed" | "suspended" | "cancelled";

export interface Grant {
  id: string;
  awardee_id: string;
  title: string;
  description: string | null;
  grant_type: string;
  status: GrantStatus;
  amount_awarded: number;
  currency_code: string;
  start_date: string;
  end_date: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type MilestoneStatus = "not_started" | "in_progress" | "completed" | "delayed";

export interface Milestone {
  id: string;
  grant_id: string;
  title: string;
  description: string | null;
  deliverables: string | null;
  due_date: string;
  status: MilestoneStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Joined view types
export interface AwardeeWithGrants extends Awardee {
  grants: Grant[];
}

export interface GrantWithMilestones extends Grant {
  milestones: Milestone[];
  awardee: Awardee;
}
