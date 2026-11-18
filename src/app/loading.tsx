export default function Loading() {
  return (
    <div className="container-main py-5 sm:py-8">
      {/* Hero skeleton */}
      <div className="skeleton h-[210px] sm:h-[320px] lg:h-[400px] w-full rounded-xl sm:rounded-2xl mb-6 sm:mb-8" />

      {/* Section title */}
      <div className="skeleton h-7 sm:h-8 w-40 sm:w-48 mb-4 sm:mb-6" />

      {/* Article row skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-0 overflow-hidden">
            <div className="skeleton aspect-[16/10] w-full rounded-none" />
            <div className="p-2.5 sm:p-4 space-y-2">
              <div className="skeleton h-3 sm:h-4 w-16" />
              <div className="skeleton h-4 sm:h-5 w-full" />
              <div className="skeleton h-4 sm:h-5 w-2/3" />
              <div className="skeleton h-3 w-20 sm:w-24 mt-2" />
            </div>
          </div>
        ))}
      </div>

      {/* Second section */}
      <div className="skeleton h-7 sm:h-8 w-36 sm:w-40 mt-8 sm:mt-10 mb-4 sm:mb-6" />
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-0 overflow-hidden">
            <div className="skeleton aspect-[16/10] w-full rounded-none" />
            <div className="p-2.5 sm:p-4 space-y-2">
              <div className="skeleton h-3 sm:h-4 w-16" />
              <div className="skeleton h-4 sm:h-5 w-full" />
              <div className="skeleton h-3 w-20 sm:w-24 mt-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
