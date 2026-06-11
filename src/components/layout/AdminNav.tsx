import { logout } from "@/app/auth/actions";
import Link from "next/link";
import Image from "next/image";
import { NavLinks } from "./NavLinks";
import NotificationBell from "./NotificationBell";
import MobileNav from "./MobileNav";

export default function AdminNav() {
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-black/[0.06]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-[58px] items-center justify-between">
          {/* Left: logo + desktop nav */}
          <div className="flex items-center gap-7">
            <Link href="/dashboard" className="shrink-0">
              <Image src="/logo.png" alt="GrantsFlow" width={120} height={32} className="h-8 w-auto" priority />
            </Link>
            {/* Desktop nav — hidden on mobile */}
            <div className="hidden lg:block">
              <NavLinks />
            </div>
          </div>

          {/* Right: bell + sign out + hamburger */}
          <div className="flex items-center gap-1">
            <NotificationBell />
            <form action={logout} className="hidden sm:block">
              <button
                type="submit"
                className="rounded-xl px-3 py-1.5 text-[13px] font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
              >
                Sign out
              </button>
            </form>
            <MobileNav />
          </div>
        </div>
      </div>
    </header>
  );
}
