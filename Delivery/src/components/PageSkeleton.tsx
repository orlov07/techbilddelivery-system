export default function PageSkeleton() {
  return (
    <div className="space-y-4 rounded-3xl border border-neutral-800 bg-neutral-900/40 p-6 animate-pulse">
      <div className="h-8 w-40 rounded-full bg-neutral-800" />
      <div className="h-36 rounded-2xl bg-neutral-850" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
            <div className="h-36 rounded-xl bg-neutral-850" />
            <div className="h-4 w-2/3 rounded-full bg-neutral-800" />
            <div className="h-3 w-full rounded-full bg-neutral-850" />
            <div className="h-3 w-5/6 rounded-full bg-neutral-850" />
            <div className="flex items-center justify-between pt-2">
              <div className="h-6 w-20 rounded-full bg-neutral-800" />
              <div className="h-10 w-28 rounded-xl bg-neutral-850" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
