import { RecordDetailScreen } from "@/features/records/record-detail";

export default async function RecordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RecordDetailScreen interviewId={id} />;
}
