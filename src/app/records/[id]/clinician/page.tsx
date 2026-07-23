import { ClinicianViewScreen } from "@/features/records/clinician-view";

export default async function ClinicianPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClinicianViewScreen interviewId={id} />;
}
