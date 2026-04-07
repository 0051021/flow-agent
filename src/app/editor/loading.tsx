import { Skeleton } from "@/components/ui/skeleton";

export default function EditorLoading() {
  return (
    <div className="h-screen flex flex-col bg-white">
      {/* TopBar skeleton */}
      <div className="h-14 border-b border-zinc-200 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-24 h-6" />
          <Skeleton className="w-16 h-5 rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="w-20 h-8 rounded-md" />
          <Skeleton className="w-20 h-8 rounded-md" />
        </div>
      </div>
      {/* Body */}
      <div className="flex-1 flex">
        {/* Chat panel skeleton */}
        <div className="w-[340px] border-r border-zinc-200 p-4 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="w-4 h-4 rounded" />
            <Skeleton className="w-20 h-4" />
          </div>
          <div className="flex gap-2.5">
            <Skeleton className="w-7 h-7 rounded-full shrink-0" />
            <Skeleton className="w-48 h-16 rounded-xl" />
          </div>
          <div className="flex gap-2.5 flex-row-reverse">
            <Skeleton className="w-7 h-7 rounded-full shrink-0" />
            <Skeleton className="w-36 h-10 rounded-xl" />
          </div>
          <div className="flex gap-2.5">
            <Skeleton className="w-7 h-7 rounded-full shrink-0" />
            <Skeleton className="w-52 h-20 rounded-xl" />
          </div>
        </div>
        {/* Canvas skeleton */}
        <div className="flex-1 p-8">
          <div className="flex flex-col items-center gap-4 mt-16">
            <Skeleton className="w-64 h-20 rounded-xl" />
            <Skeleton className="w-0.5 h-8" />
            <Skeleton className="w-64 h-20 rounded-xl" />
            <Skeleton className="w-0.5 h-8" />
            <Skeleton className="w-64 h-20 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
