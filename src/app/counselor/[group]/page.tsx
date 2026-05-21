import CounselorPage from "@/components/counselor/CounselorPage";

export default async function CounselorGroupPage({
  params,
}: {
  params: Promise<{ group: string }>;
}) {
  const { group } = await params;
  return <CounselorPage group={group.toUpperCase()} />;
}
