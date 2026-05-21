import { createClient } from "@/lib/supabase/server";
import OnboardingForm from "./OnboardingForm";

export default async function NewAwardeePage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("programmes")
    .select("id, name, currency_code, total_budget, programme_categories(id, name, sort_order)")
    .order("created_at", { ascending: false });

  const programmes = (data ?? []).map((p: {
    id: string;
    name: string;
    currency_code: string;
    total_budget: number | null;
    programme_categories: { id: string; name: string; sort_order: number }[] | null;
  }) => ({
    id: p.id,
    name: p.name,
    currency_code: p.currency_code,
    total_budget: p.total_budget,
    categories: (p.programme_categories ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({ id: c.id, name: c.name })),
  }));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Add Awardee & Grant</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manually onboard a grant recipient and set up their project.
        </p>
      </div>
      <OnboardingForm programmes={programmes} />
    </div>
  );
}
