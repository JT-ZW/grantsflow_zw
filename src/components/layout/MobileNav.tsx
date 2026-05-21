"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/auth/actions";

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Programmes", href: "/programmes" },
  { label: "Awardees", href: "/awardees" },
  { label: "Finances", href: "/finances" },
  { label: "Analytics", href: "/analytics" },
  { label: "Impact", href: "/impact" },
  { label: "Reports", href: "/reports" },
  { label: "Audit Log", href: "/audit" },
  { label: "Users", href: "/users" },
];

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* Hamburger button — visible below lg */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        aria-label="Open menu"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 z-50 h-full w-72 max-w-[85vw] bg-white shadow-xl transform transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4">
          <img src="/logo.png" alt="GrantsFlow" className="h-8 w-auto" />
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="Close menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex flex-col gap-1 p-3">
          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#6b1a2a] text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Sign out at bottom */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 p-3">
          <form action={logout}>
            <button
              type="submit"
              className="w-full rounded-lg px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
