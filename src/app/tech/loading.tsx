import { Skeleton } from "@/components/ui/skeleton";

export default function TechLoading() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="w-5 h-5 rounded bg-slate-800" />
          <Skeleton className="w-40 h-6 bg-slate-800" />
        </div>
        <Skeleton className="w-24 h-8 rounded-md bg-slate-800" />
      </div>
      {/* Stats */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <Skeleton className="w-16 h-3 mb-3 bg-slate-800" />
              <Skeleton className="w-12 h-7 bg-slate-800" />
            </div>
          ))}
        </div>
        {/* Review list */}
        <Skeleton className="w-32 h-6 mb-4 bg-slate-800" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="w-full h-24 rounded-xl bg-slate-800" />
          ))}
        </div>
      </div>
    </div>
  );
}
