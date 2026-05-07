"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AwardeeTabs({ id }: { id: string }) {
  const pathname = usePathname();

  const tabs = [
    { label: "Overview", href: `/awardees/${id}` },
    { label: "Finances", href: `/awardees/${id}/finances` },
    { label: "Documents", href: `/awardees/${id}/documents` },
    { label: "Messages", href: `/awardees/${id}/messages` },
    { label: "Report", href: `/awardees/${id}/report` },
  ];

  return (
    <nav className="flex border-b border-gray-200 mb-6">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
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
  );
}
