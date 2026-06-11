import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProfileForm from "./ProfileForm";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: awardee } = await supabase
    .from("awardees")
    .select("id, full_name, email, phone, gender, department, faculty, student_number")
    .eq("user_id", user.id)
    .single();

  if (!awardee) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
        Your account hasn&apos;t been linked to an awardee record yet. Please contact the grants office.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="mt-1 text-sm text-gray-500">Update your contact details and demographic information.</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <ProfileForm
          currentGender={awardee.gender}
          currentPhone={awardee.phone}
          fullName={awardee.full_name}
          email={awardee.email}
        />
      </div>

      {/* Read-only academic details */}
      {(awardee.department || awardee.faculty || awardee.student_number) && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Academic Details</h2>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
            {awardee.student_number && (
              <div>
                <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Student / Staff No.</dt>
                <dd className="mt-0.5 text-gray-900">{awardee.student_number}</dd>
              </div>
            )}
            {awardee.faculty && (
              <div>
                <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Faculty</dt>
                <dd className="mt-0.5 text-gray-900">{awardee.faculty}</dd>
              </div>
            )}
            {awardee.department && (
              <div>
                <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Department</dt>
                <dd className="mt-0.5 text-gray-900">{awardee.department}</dd>
              </div>
            )}
          </dl>
          <p className="mt-4 text-xs text-gray-400">Contact the grants office to update academic details.</p>
        </div>
      )}
    </div>
  );
}
