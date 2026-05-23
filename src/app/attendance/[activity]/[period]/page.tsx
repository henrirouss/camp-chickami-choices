import AttendancePage from "@/components/attendance/AttendancePage";

export default async function Page({
  params,
}: {
  params: Promise<{ activity: string; period: string }>;
}) {
  const { activity, period } = await params;
  return <AttendancePage activitySlug={activity} periodStr={period} />;
}
