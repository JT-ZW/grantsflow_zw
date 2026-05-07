import { logout } from "@/app/auth/actions";
import Link from "next/link";
import { NavLinks } from "./NavLinks";
import NotificationBell from "./NotificationBell";

export default function AdminNav() {
  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard">
              <img src="/logo.png" alt="GrantsFlow" className="h-8 w-auto" />
            </Link>
            <NavLinks />
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
