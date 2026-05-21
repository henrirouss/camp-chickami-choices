import LeadershipNav from "@/components/LeadershipNav";

export default function LeadershipLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <LeadershipNav />
      <main style={{ flex: 1, display: "flex", overflow: "hidden" }}>{children}</main>
    </div>
  );
}
