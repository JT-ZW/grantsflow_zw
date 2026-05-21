import { createClient } from "@/lib/supabase/server";
import { ChangePasswordButton } from "./ChangePasswordButton";
import { DeleteUserButton } from "./DeleteUserButton";
import { UserFormPanel } from "./UserFormPanel";
import { changeUserRole, toggleUserActive } from "./actions";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
};

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "program_manager", label: "Program Manager" },
  { value: "finance_officer", label: "Finance Officer" },
  { value: "auditor", label: "Auditor" },
  { value: "awardee", label: "Awardee" },
];

const ROLE_STYLES: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  program_manager: "bg-blue-100 text-blue-700",
  finance_officer: "bg-green-100 text-green-700",
  auditor: "bg-purple-100 text-purple-700",
  awardee: "bg-gray-100 text-gray-700",
};

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active, created_at")
    .order("created_at", { ascending: false });

  const profiles = (data ?? []) as Profile[];
  const active = profiles.filter((p) => p.is_active);
  const inactive = profiles.filter((p) => !p.is_active);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          {active.length} active · {inactive.length} inactive
        </p>
      </div>

      {/* Add user — invite or create directly */}
      <UserFormPanel />

      {/* Active users */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Active Users</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {active.length === 0 && (
            <p className="px-6 py-4 text-sm text-gray-400 italic">No active users.</p>
          )}
          {active.map((profile) => (
            <UserRow key={profile.id} profile={profile} isSelf={profile.id === currentUser?.id} />
          ))}
        </div>
      </div>

      {/* Inactive / deactivated users */}
      {inactive.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden opacity-75">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-500">Deactivated Users</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {inactive.map((profile) => (
              <UserRow key={profile.id} profile={profile} isSelf={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UserRow({ profile, isSelf }: { profile: Profile; isSelf: boolean }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
      {/* Avatar initials */}
      <div className="h-9 w-9 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
        <span className="text-sm font-semibold text-gray-600">
          {(profile.full_name ?? profile.email)[0].toUpperCase()}
        </span>
      </div>

      {/* Name + email */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-gray-900 truncate">
            {profile.full_name ?? "—"}
          </p>
          {isSelf && <span className="text-xs text-gray-400 italic">(you)</span>}
          {!profile.is_active && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>
          )}
        </div>
        <p className="text-xs text-gray-400 truncate">{profile.email}</p>
        <p className="text-xs text-gray-300 mt-0.5">
          Joined {new Date(profile.created_at).toLocaleDateString()}
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Current role badge */}
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_STYLES[profile.role] ?? "bg-gray-100 text-gray-600"}`}>
          {ROLE_OPTIONS.find((r) => r.value === profile.role)?.label ?? profile.role}
        </span>

        {!isSelf && (
          <>
            {/* Change role */}
            <form action={changeUserRole} className="flex items-center gap-1">
              <input type="hidden" name="profile_id" value={profile.id} />
              <select
                name="role"
                defaultValue={profile.role}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <button type="submit" className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50">
                Save
              </button>
            </form>

            {/* Deactivate / Reactivate */}
            <form action={toggleUserActive}>
              <input type="hidden" name="profile_id" value={profile.id} />
              <input type="hidden" name="active" value={profile.is_active ? "false" : "true"} />
              <button
                type="submit"
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  profile.is_active
                    ? "border border-orange-200 text-orange-600 hover:bg-orange-50"
                    : "border border-green-200 text-green-600 hover:bg-green-50"
                }`}
              >
                {profile.is_active ? "Deactivate" : "Reactivate"}
              </button>
            </form>

            {/* Change password */}
            <ChangePasswordButton
              profileId={profile.id}
              displayName={profile.full_name ?? profile.email}
            />

            {/* Delete permanently */}
            <DeleteUserButton
              profileId={profile.id}
              displayName={profile.full_name ?? profile.email}
            />
          </>
        )}
      </div>
    </div>
  );
}
