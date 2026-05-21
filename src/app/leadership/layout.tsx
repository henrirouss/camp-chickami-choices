import LeadershipNav from "@/components/LeadershipNav";

export default function LeadershipLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <LeadershipNav />
      <main className="flex-1">{children}</main>
    </div>
  );
}
