import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AwardeeTabs } from "./AwardeeTabs";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function AwardeeDetailLayout({
  children,
  params,
}: LayoutProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: awardee } = await supabase
    .from("awardees")
    .select("id, full_name")
    .eq("id", id)
    .single();

  if (!awardee) notFound();

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4 flex-wrap">
        <Link href="/awardees" className="hover:text-gray-700">
          Awardees
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium truncate max-w-[200px] sm:max-w-none">{awardee.full_name}</span>
      </div>
      <AwardeeTabs id={id} />
      {children}
    </div>
  );
}
