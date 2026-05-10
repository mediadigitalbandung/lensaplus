import MarketCard, { MarketCardProps } from "./MarketCard";

interface MarketGridProps {
  title: string;
  items: MarketCardProps[];
  cols?: 2 | 3 | 4 | 5;
}

const colClass: Record<number, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-2 md:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 md:grid-cols-5",
};

export default function MarketGrid({ title, items, cols = 4 }: MarketGridProps) {
  return (
    <section aria-labelledby={`market-grid-${title.replace(/\s+/g, "-").toLowerCase()}`}>
      <h2
        id={`market-grid-${title.replace(/\s+/g, "-").toLowerCase()}`}
        className="section-title mb-4"
      >
        {title}
      </h2>
      <div className={`grid gap-3 ${colClass[cols] ?? colClass[4]}`}>
        {items.map((item) => (
          <MarketCard key={item.label} {...item} />
        ))}
      </div>
    </section>
  );
}
