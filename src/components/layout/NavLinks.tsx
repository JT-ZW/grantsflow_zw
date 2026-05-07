"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Programmes", href: "/programmes" },
  { label: "Awardees", href: "/awardees" },
  { label: "Finances", href: "/finances" },
  { label: "Analytics", href: "/analytics" },
  { label: "Reports", href: "/reports" },
  { label: "Audit Log", href: "/audit" },
  { label: "Users", href: "/users" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1">
      {navItems.map((item) => {
        const isActive =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-[#6b1a2a] text-white"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
