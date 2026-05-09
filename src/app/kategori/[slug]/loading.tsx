export default function Loading() {
  return (
    <div className="container-main py-8">
      <div className="skeleton h-10 w-56 mb-2" />
      <div className="skeleton h-5 w-96 mb-8" />
      <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card p-0 overflow-hidden">
            <div className="skeleton h-48 w-full rounded-none" />
            <div className="p-4 space-y-3">
              <div className="skeleton h-4 w-20" />
              <div className="skeleton h-5 w-full" />
              <div className="skeleton h-5 w-3/4" />
              <div className="skeleton h-3 w-24 mt-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
