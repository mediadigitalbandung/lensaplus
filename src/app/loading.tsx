export default function Loading() {
  return (
    <div className="container-main py-8">
      {/* Hero skeleton */}
      <div className="skeleton h-[400px] w-full rounded-lg mb-8" />

      {/* Section title */}
      <div className="skeleton h-8 w-48 mb-6" />

      {/* Article row skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-0 overflow-hidden">
            <div className="skeleton h-40 w-full rounded-none" />
            <div className="p-4 space-y-2">
              <div className="skeleton h-4 w-16" />
              <div className="skeleton h-5 w-full" />
              <div className="skeleton h-5 w-2/3" />
              <div className="skeleton h-3 w-24 mt-2" />
            </div>
          </div>
        ))}
      </div>

      {/* Second section */}
      <div className="skeleton h-8 w-40 mt-10 mb-6" />
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-0 overflow-hidden">
            <div className="skeleton h-40 w-full rounded-none" />
            <div className="p-4 space-y-2">
              <div className="skeleton h-4 w-16" />
              <div className="skeleton h-5 w-full" />
              <div className="skeleton h-3 w-24 mt-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
