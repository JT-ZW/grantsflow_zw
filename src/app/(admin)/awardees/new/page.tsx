import OnboardingForm from "./OnboardingForm";

export default function NewAwardeePage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Add Awardee & Grant</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manually onboard a grant recipient and set up their project.
        </p>
      </div>
      <OnboardingForm />
    </div>
  );
}
