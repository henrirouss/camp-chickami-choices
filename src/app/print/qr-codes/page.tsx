"use client";

import { QRCodeSVG } from "qrcode.react";
import { useState, useEffect } from "react";
import LeadershipNav from "@/components/LeadershipNav";
import { createClient } from "@/lib/supabase/client";

const C = {
  bg:     "#F4F6F3", white:  "#FFFFFF",
  text:   "#1A2318", muted:  "#7A8A76", border: "#DDE5DA",
  sage:   "#7A9E75", sageDk: "#4A6E45", sageLt: "#EAF2E8",
};
const font = "var(--font-figtree), Figtree, sans-serif";

export default function QRCodesPage() {
  const [origin, setOrigin] = useState("");
  const [groups, setGroups] = useState<string[]>([]);

  useEffect(() => {
    setOrigin(window.location.origin);
    const supabase = createClient();
    supabase.from("groups").select("name").order("name").then(({ data }) => {
      if (data) setGroups(data.map((g: { name: string }) => g.name));
    });
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font }}>

      {/* Nav — hidden on print */}
      <div className="no-print">
        <LeadershipNav />
      </div>

      {/* Print bar — hidden on print */}
      <div className="no-print" style={{
        background: C.sageDk, color: "white",
        padding: "10px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 16,
      }}>
        <div>
          <span style={{ fontWeight: 900, fontSize: 15 }}>Counselor QR Codes</span>
          <span style={{ fontSize: 12, opacity: 0.7, marginLeft: 10 }}>
            Print and cut out — one per group folder
          </span>
        </div>
        <button
          onClick={() => window.print()}
          style={{
            background: C.white, color: C.sageDk, border: "none",
            borderRadius: 8, padding: "7px 22px",
            fontFamily: font, fontSize: 13, fontWeight: 800,
            cursor: "pointer", flexShrink: 0,
          }}
        >
          Print All
        </button>
      </div>

      {/* Grid */}
      <div style={{
        maxWidth: 900, margin: "0 auto", padding: "28px 24px 56px",
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 20,
      }}>
        {groups.map(group => {
          const url = origin ? `${origin}/counselor/${encodeURIComponent(group)}` : "";
          return (
            <div
              key={group}
              className="qr-card"
              style={{
                background: C.white,
                border: `1.5px solid ${C.border}`,
                borderRadius: 14,
                padding: "20px 16px 16px",
                display: "flex", flexDirection: "column",
                alignItems: "center", gap: 14,
                boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
              }}
            >
              {/* QR code */}
              <div style={{
                background: C.white, padding: 10,
                borderRadius: 10, border: `1px solid ${C.border}`,
              }}>
                {url ? (
                  <QRCodeSVG
                    value={url}
                    size={140}
                    bgColor={C.white}
                    fgColor={C.text}
                    level="M"
                    includeMargin={false}
                  />
                ) : (
                  <div style={{ width: 140, height: 140, background: C.bg, borderRadius: 6 }} />
                )}
              </div>

              {/* Label */}
              <div style={{ textAlign: "center" }}>
                <div style={{
                  fontSize: 22, fontWeight: 900, color: C.sageDk,
                  letterSpacing: "-0.3px", lineHeight: 1,
                }}>
                  {group}
                </div>
                <div style={{
                  fontSize: 10, fontWeight: 600, color: C.muted,
                  marginTop: 4, wordBreak: "break-all",
                }}>
                  {url ? url.replace(/^https?:\/\//, "") : "—"}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .qr-card {
            border: 1px solid #ccc !important;
            box-shadow: none !important;
            break-inside: avoid;
          }
        }
        @media print {
          /* 4-up grid on letter paper */
          div[style*="grid-template-columns"] {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 12px !important;
            padding: 16px !important;
            max-width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
