import { setPassword } from "@/app/auth/actions";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

interface Props {
  searchParams: Promise<{ error?: string; reset?: string }>;
}

export default async function SetPasswordPage({ searchParams }: Props) {
  const { error, reset } = await searchParams;
  const isReset = reset === "1";

  // Guard: must have a valid session (established by invite-callback or reset-callback)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      isReset
        ? "/auth/forgot-password?error=Reset+link+has+expired.+Please+request+a+new+one."
        : "/auth/login?error=Your+invite+link+has+expired.+Please+contact+an+admin."
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f4f3f1" }}>
      <div className="w-full max-w-md px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="GrantsFlow" className="mx-auto h-28 w-auto mb-4" />
          <p className="mt-2 text-xs font-semibold tracking-widest text-gray-400 uppercase">
            Funding. Transparency. Impact.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] p-8">
          {/* Context banner */}
          <div
            className="rounded-xl px-4 py-3 mb-6 text-white"
            style={{ background: "linear-gradient(135deg,#6b1a2a 0%,#3d0f19 100%)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-0.5">
              {isReset ? "Password reset" : "Welcome"}
            </p>
            <p className="text-sm font-medium text-white">
              {isReset
                ? "Choose a new password for your account."
                : "You're almost there — set a password to activate your account."}
            </p>
          </div>

          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            {isReset ? "Reset your password" : "Create your password"}
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            {isReset
              ? "Enter a new password below. You'll use this to sign in going forward."
              : "Choose a secure password (8+ characters). You'll use this every time you sign in."}
          </p>

          {error && (
            <div className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form action={setPassword} className="space-y-5">
            {/* Pass the reset flag so setPassword can read it if needed */}
            <input type="hidden" name="reset" value={isReset ? "1" : "0"} />

            <div suppressHydrationWarning>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                {isReset ? "New password" : "Password"}
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
              <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 mb-1.5">
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
              className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{ background: "linear-gradient(135deg,#6b1a2a 0%,#3d0f19 100%)" } as React.CSSProperties}
            >
              {isReset ? "Save new password →" : "Activate account & sign in →"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          {isReset ? (
            <>
              Remembered it?{" "}
              <a href="/auth/login" className="text-[#6b1a2a] hover:underline font-medium">
                Back to sign in
              </a>
            </>
          ) : (
            <>
              Having trouble? Contact{" "}
              <a href="mailto:support@grantsflow.com" className="text-[#6b1a2a] hover:underline font-medium">
                your grants administrator
              </a>
              .
            </>
          )}
        </p>
      </div>
    </div>
  );
}


