export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-live="polite" aria-busy="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="animate-pulse rounded-2xl border border-[#dbe6de] bg-white p-5">
          <div className="flex gap-4">
            <div className="size-12 shrink-0 rounded-xl bg-[#eef1f5]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 rounded bg-[#eef1f5]" />
              <div className="h-3 w-60 rounded bg-[#eef1f5]" />
              <div className="h-3 w-32 rounded bg-[#eef1f5]" />
            </div>
            <div className="hidden w-32 space-y-2 sm:block">
              <div className="ml-auto h-5 w-24 rounded bg-[#eef1f5]" />
              <div className="ml-auto h-3 w-20 rounded bg-[#eef1f5]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
