import { Skeleton } from "@/components/ui/skeleton";

export default function ConsoleLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="w-32 h-7 mb-2" />
        <Skeleton className="w-48 h-4" />
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-zinc-200 p-5">
            <Skeleton className="w-20 h-3 mb-3" />
            <Skeleton className="w-16 h-8 mb-2" />
            <Skeleton className="w-24 h-3" />
          </div>
        ))}
      </div>
      {/* Content */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-3">
          <Skeleton className="w-24 h-5" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="w-full h-12 rounded-lg" />
          ))}
        </div>
        <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-3">
          <Skeleton className="w-24 h-5" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="w-full h-12 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
