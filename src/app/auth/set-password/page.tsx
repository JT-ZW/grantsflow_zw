import { setPassword } from "@/app/auth/actions";
import { PasswordInput } from "@/components/ui/PasswordInput";

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function SetPasswordPage({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="GrantsFlow"
            className="mx-auto h-28 w-auto mb-4"
          />
          <p className="mt-2 text-xs font-semibold tracking-widest text-gray-400 uppercase">
            Funding. Transparency. Impact.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Set your password
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Create a password to secure your account. You&apos;ll use this to
            sign in going forward.
          </p>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form action={setPassword} className="space-y-5">
            <div suppressHydrationWarning>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                New password
              </label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="At least 8 characters"
              />
            </div>

            <div suppressHydrationWarning>
              <label
                htmlFor="confirm_password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Confirm password
              </label>
              <PasswordInput
                id="confirm_password"
                name="confirm_password"
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="Re-enter your password"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Set password &amp; continue
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
