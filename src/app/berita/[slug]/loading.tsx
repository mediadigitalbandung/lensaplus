export default function Loading() {
  return (
    <div className="bg-surface min-h-screen">
      <div className="container-main py-8 max-w-4xl mx-auto">
        {/* Category badge */}
        <div className="skeleton h-6 w-28 rounded-full" />

        {/* Title */}
        <div className="mt-4 space-y-3">
          <div className="skeleton h-9 w-full" />
          <div className="skeleton h-9 w-3/4" />
        </div>

        {/* Author + date */}
        <div className="flex items-center gap-3 mt-6">
          <div className="skeleton h-10 w-10 rounded-full" />
          <div className="space-y-1.5">
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-3 w-48" />
          </div>
        </div>

        {/* Featured image */}
        <div className="skeleton h-[400px] w-full mt-8 rounded-lg" />

        {/* Article body */}
        <div className="mt-8 space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-4 w-full" />
          ))}
          <div className="skeleton h-4 w-2/3" />
          <div className="h-6" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-4 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
