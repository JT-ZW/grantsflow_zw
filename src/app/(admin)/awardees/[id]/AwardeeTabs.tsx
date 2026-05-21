"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AwardeeTabs({ id }: { id: string }) {
  const pathname = usePathname();

  const tabs = [
    { label: "Overview",      href: `/awardees/${id}` },
    { label: "Finances",      href: `/awardees/${id}/finances` },
    { label: "Documents",     href: `/awardees/${id}/documents` },
    { label: "Messages",      href: `/awardees/${id}/messages` },
    { label: "Reports",       href: `/awardees/${id}/reports` },
    { label: "Print Report",  href: `/awardees/${id}/report` },
  ];

  return (
    <div className="mb-6 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <nav className="flex border-b border-gray-200 min-w-max sm:min-w-0">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
