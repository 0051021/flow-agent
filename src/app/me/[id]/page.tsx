import { notFound } from "next/navigation";
import { getSubmissionById } from "@/lib/server/submission-store";
import BusinessSubmissionWorkspaceClient from "./BusinessSubmissionWorkspaceClient";

export const dynamic = "force-dynamic";

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await getSubmissionById(id);
  if (!item) notFound();

  return <BusinessSubmissionWorkspaceClient item={item} />;
}
