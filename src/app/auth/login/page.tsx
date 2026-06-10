import { login } from "@/app/auth/actions";
import { PasswordInput } from "@/components/ui/PasswordInput";
import Link from "next/link";

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f4f3f1" }}>
      <div className="w-full max-w-md px-4">
        {/* Logo */}
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
        <div className="rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign in</h2>

          {error && (
            <div className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form action={login} className="space-y-5" suppressHydrationWarning>
            <div suppressHydrationWarning>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent"
                placeholder="you@example.com"
                suppressHydrationWarning
              />
            </div>

            <div suppressHydrationWarning>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs font-medium text-[#6b1a2a] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{ background: "linear-gradient(135deg,#6b1a2a 0%,#3d0f19 100%)" } as React.CSSProperties}
            >
              Sign in
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

