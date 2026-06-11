import Link from "next/link";
import Image from "next/image";
import AwardeeMobileNav from "./AwardeeMobileNav";
import AwardeeDesktopNav from "./AwardeeDesktopNav";

export default function AwardeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="border-b border-gray-200 bg-white sticky top-0 z-30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/portal" className="flex-shrink-0">
              <Image src="/logo.png" alt="GrantsFlow" width={120} height={32} className="h-8 w-auto" priority />
            </Link>

            {/* Desktop nav — lg+ only (sufficient width for all items) */}
            <AwardeeDesktopNav />

            {/* Mobile / tablet hamburger */}
            <AwardeeMobileNav />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
