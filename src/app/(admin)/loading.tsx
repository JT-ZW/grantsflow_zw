export default function AdminPageLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-lg bg-gray-200" />
        <div className="h-4 w-80 rounded-lg bg-gray-100" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-gray-200" />
        ))}
      </div>
      <div className="h-96 rounded-2xl bg-gray-200" />
    </div>
  );
}
