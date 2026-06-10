import { requestPasswordReset } from "@/app/auth/actions";
import Link from "next/link";

interface Props {
  searchParams: Promise<{ error?: string; success?: string }>;
}

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const { error, success } = await searchParams;

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
          {success ? (
            /* ── Success state ── */
            <div className="text-center py-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl"
                style={{ background: "linear-gradient(135deg,#6b1a2a 0%,#3d0f19 100%)" }}
              >
                ✉️
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Check your email</h2>
              <p className="text-sm text-gray-500 mb-6">
                If an account exists for that email address, we&apos;ve sent a password reset link.
                Click the link in the email to choose a new password.
              </p>
              <p className="text-xs text-gray-400 mb-6">
                Didn&apos;t receive it? Check your spam folder, or{" "}
                <button
                  form="reset-form"
                  type="submit"
                  className="text-[#6b1a2a] hover:underline font-medium"
                >
                  try again
                </button>
                .
              </p>
              <Link
                href="/auth/login"
                className="text-sm font-medium text-[#6b1a2a] hover:underline"
              >
                ← Back to sign in
              </Link>
            </div>
          ) : (
            /* ── Request form ── */
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Reset your password</h2>
              <p className="text-sm text-gray-400 mb-6">
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>

              {error && (
                <div className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form id="reset-form" action={requestPasswordReset} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ focusRingColor: "#6b1a2a" } as React.CSSProperties}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2"
                  style={{ background: "linear-gradient(135deg,#6b1a2a 0%,#3d0f19 100%)" } as React.CSSProperties}
                >
                  Send reset link
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-gray-400">
                Remembered it?{" "}
                <Link href="/auth/login" className="font-medium text-[#6b1a2a] hover:underline">
                  Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
