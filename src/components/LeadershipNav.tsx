"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { label: "Morning Signup", href: "/leadership" },
  { label: "Live Attendance", href: "/leadership/attendance" },
  { label: "Print", href: "/print" },
  { label: "Settings", href: "/leadership/settings" },
];

export default function LeadershipNav() {
  const pathname = usePathname();

  return (
    <nav className="w-full bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 flex items-center h-14 gap-1">
        <span className="font-semibold text-gray-800 mr-4 shrink-0">
          Camp Chickami
        </span>
        {navLinks.map(({ label, href }) => {
          const isActive =
            href === "/leadership"
              ? pathname === "/leadership"
              : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
