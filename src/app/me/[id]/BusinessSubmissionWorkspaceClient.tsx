"use client";

import dynamic from "next/dynamic";
import type { PersistedSubmission } from "@/lib/submission-types";

const BusinessSubmissionWorkspace = dynamic(() => import("./BusinessSubmissionWorkspace"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-zinc-50 text-sm text-zinc-500">
      正在打开业务方案...
    </div>
  ),
});

export default function BusinessSubmissionWorkspaceClient({ item }: { item: PersistedSubmission }) {
  return <BusinessSubmissionWorkspace item={item} />;
}
