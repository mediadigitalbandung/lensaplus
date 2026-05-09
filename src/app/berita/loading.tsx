export default function Loading() {
  return (
    <div className="container-main py-8">
      {/* Page title skeleton */}
      <div className="skeleton h-10 w-64 mb-8" />

      {/* Article grid skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="card p-0 overflow-hidden">
            <div className="skeleton h-48 w-full rounded-none" />
            <div className="p-4 space-y-3">
              <div className="skeleton h-4 w-20" />
              <div className="skeleton h-5 w-full" />
              <div className="skeleton h-5 w-3/4" />
              <div className="flex items-center gap-2 pt-2">
                <div className="skeleton h-6 w-6 rounded-full" />
                <div className="skeleton h-3 w-24" />
                <div className="skeleton h-3 w-16 ml-auto" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
