"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const C = {
  white:  "#FFFFFF",
  text:   "#1A2318",
  muted:  "#7A8A76",
  border: "#DDE5DA",
  sage:   "#7A9E75",
  sageDk: "#4A6E45",
  sageLt: "#EAF2E8",
};
const font = "var(--font-figtree), Figtree, sans-serif";

const NAV_LINKS = [
  { label: "Morning Signup",   href: "/leadership" },
  { label: "Live Attendance",  href: "/leadership/attendance" },
  { label: "Print Sheets",     href: "/print" },
  { label: "QR Codes",         href: "/print/qr-codes" },
  { label: "Settings",         href: "/leadership/settings" },
];

function isAttendanceWindow(): boolean {
  const now  = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= 750 && mins <= 930; // 12:30 PM – 3:30 PM
}

export default function LeadershipNav() {
  const pathname = usePathname();
  const [glowActive, setGlowActive] = useState(false);

  // Evaluate once on mount, then re-check every minute
  useEffect(() => {
    setGlowActive(isAttendanceWindow());
    const t = setInterval(() => setGlowActive(isAttendanceWindow()), 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <nav style={{
      width: "100%", background: C.white,
      borderBottom: `1.5px solid ${C.border}`,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      flexShrink: 0, fontFamily: font,
    }}>
      <div style={{
        maxWidth: 1280, margin: "0 auto",
        padding: "0 20px",
        display: "flex", alignItems: "center",
        height: 52, gap: 2,
      }}>
        {/* Logo / wordmark */}
        <span style={{
          fontSize: 14, fontWeight: 900, color: C.sageDk,
          marginRight: 12, flexShrink: 0, letterSpacing: "-0.2px",
        }}>
          Camp Chickami
        </span>

        {/* Nav links */}
        {NAV_LINKS.map(({ label, href }) => {
          const isActive =
            href === "/leadership"
              ? pathname === "/leadership"
              : pathname === href || pathname.startsWith(href + "/");

          const isAttendanceLink = href === "/leadership/attendance";
          const showGlow = isAttendanceLink && glowActive && !isActive;

          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "inline-flex", alignItems: "center",
                padding: "5px 12px", borderRadius: 7,
                fontSize: 13, fontWeight: 700,
                textDecoration: "none",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
                background: isActive ? C.sageDk : showGlow ? C.sageLt : "transparent",
                color:      isActive ? C.white   : showGlow ? C.sageDk  : C.muted,
                boxShadow:  showGlow
                  ? `0 0 0 1.5px ${C.sage}, 0 0 8px rgba(122,158,117,0.35)`
                  : "none",
              }}
            >
              {label}
              {showGlow && (
                <span style={{
                  marginLeft: 5, width: 6, height: 6, borderRadius: "50%",
                  background: C.sage, display: "inline-block",
                  animation: "pulse 2s ease-in-out infinite",
                }} />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
