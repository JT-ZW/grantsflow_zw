import { type SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns the awardee_id for the given authenticated user.
 * Checks both:
 *   - primary contact link: awardees.user_id = userId
 *   - team member link:     awardee_members.profile_id = userId
 *
 * Returns null if the user is not linked to any awardee record.
 */
export async function getAwardeeId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  // Primary contact check
  const { data: awardee } = await supabase
    .from("awardees")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (awardee?.id) return awardee.id;

  // Team member check
  const { data: member } = await supabase
    .from("awardee_members")
    .select("awardee_id")
    .eq("profile_id", userId)
    .maybeSingle();

  return member?.awardee_id ?? null;
}
