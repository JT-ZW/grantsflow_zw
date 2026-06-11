"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/auth/actions";

const navItems = [
  { label: "Grant",         href: "/portal" },
  { label: "Project",       href: "/portal/project" },
  { label: "Finances",      href: "/portal/finances" },
  { label: "Amendments",    href: "/portal/amendments" },
  { label: "Disbursements", href: "/portal/disbursements" },
  { label: "Reports",       href: "/portal/reports" },
  { label: "Documents",     href: "/portal/documents" },
  { label: "Messages",      href: "/portal/messages" },
  { label: "Profile",       href: "/portal/profile" },
];

export default function AwardeeDesktopNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden lg:flex items-center gap-0.5">
      {navItems.map((item) => {
        const isActive =
          item.href === "/portal"
            ? pathname === "/portal"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-[#6b1a2a]/10 text-[#6b1a2a] font-semibold"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}

      <div className="mx-2 h-5 w-px bg-gray-200" />

      <form action={logout}>
        <button
          type="submit"
          className="rounded-md px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          Sign out
        </button>
      </form>
    </nav>
  );
}
