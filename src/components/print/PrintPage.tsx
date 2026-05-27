"use client";

import { useState, useEffect, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import LeadershipNav from "@/components/LeadershipNav";
import { createClient } from "@/lib/supabase/client";
import { loadActiveSession, getPeriodLabel, getPeriodTime, getPeriodCount, type ActiveSession } from "@/lib/session";

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  bg:     "#F4F6F3", white:  "#FFFFFF",
  text:   "#1A2318", muted:  "#7A8A76", border: "#DDE5DA",
  sage:   "#7A9E75", sageDk: "#4A6E45", sageLt: "#EAF2E8",
};
const font = "var(--font-figtree), Figtree, sans-serif";

// ── Types ─────────────────────────────────────────────────────────────────────

type SheetCamper = {
  id:         string;
  firstName:  string;
  lastName:   string;
  groupName:  string;
  choices:    (string | null)[];   // indices 0–4 (p1–p5)
};

type Sheet = {
  activityName: string;
  period:       number;            // 1-based
  campers:      SheetCamper[];
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function PrintPage() {
  const supabase = useMemo(() => createClient(), []);

  const [session,       setSession]       = useState<ActiveSession | null>(null);
  const [sheets,        setSheets]        = useState<Sheet[]>([]);
  const [abbrevMap,     setAbbrevMap]     = useState<Record<string, string>>({});
  const [allActivities, setAllActivities] = useState<string[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [origin,        setOrigin]        = useState("");

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const periodCount = getPeriodCount(session);

  function abbr(name: string | null | undefined, fallback = "—") {
    if (!name) return fallback;
    return abbrevMap[name] ?? name;
  }

  useEffect(() => {
    setOrigin(window.location.origin);

    async function load() {
      // 1. Load session and submitted groups in parallel
      const [sess, { data: groups }] = await Promise.all([
        loadActiveSession(supabase),
        supabase.from("groups").select("id, name").eq("submitted", true).order("name"),
      ]);
      setSession(sess);
      const pc = sess?.period_count ?? 3;

      // 2. Load activities (scoped to session if active)
      let actsQuery = supabase
        .from("activities")
        .select("name, abbreviation")
        .eq("is_active", true)
        .order("name");
      if (sess) {
        actsQuery = actsQuery.eq("session_id", sess.id);
      } else {
        actsQuery = actsQuery.is("session_id", null);
      }
      const { data: activities } = await actsQuery;
      const aMap: Record<string, string> = {};
      for (const a of (activities ?? []) as { name: string; abbreviation: string }[]) {
        aMap[a.name] = a.abbreviation;
      }
      setAbbrevMap(aMap);
      setAllActivities(Object.keys(aMap));

      if (!groups || groups.length === 0) { setLoading(false); return; }

      const typedGroups = groups as { id: string; name: string }[];
      const gMap = new Map(typedGroups.map(g => [g.id, g.name]));

      // 3. Load campers (up to 5 choice columns)
      const { data: campers } = await supabase
        .from("campers")
        .select("id, first_name, last_name, group_id, choice_p1, choice_p2, choice_p3, choice_p4, choice_p5")
        .in("group_id", typedGroups.map(g => g.id))
        .eq("absent", false);

      // 4. Build activity → per-period camper lists
      type DBCamper = {
        id: string; first_name: string; last_name: string; group_id: string;
        choice_p1: string | null; choice_p2: string | null; choice_p3: string | null;
        choice_p4: string | null; choice_p5: string | null;
      };

      const actMap = new Map<string, SheetCamper[][]>();   // actName → [p0[], p1[], …, p(pc-1)[]]

      for (const c of (campers as DBCamper[] | null) ?? []) {
        const allChoices = [c.choice_p1, c.choice_p2, c.choice_p3, c.choice_p4, c.choice_p5];
        const sc: SheetCamper = {
          id: c.id, firstName: c.first_name, lastName: c.last_name,
          groupName: gMap.get(c.group_id) ?? "",
          choices: allChoices,
        };
        for (let pi = 0; pi < pc; pi++) {
          const choice = allChoices[pi];
          if (!choice) continue;
          if (!actMap.has(choice)) actMap.set(choice, Array.from({ length: pc }, () => []));
          actMap.get(choice)![pi].push(sc);
        }
      }

      // 5. Build sheet list — activities alphabetical, periods 1→pc
      const sheetList: Sheet[] = [];
      for (const actName of [...actMap.keys()].sort()) {
        const periodLists = actMap.get(actName)!;
        periodLists.forEach((list, pi) => {
          if (list.length > 0) {
            sheetList.push({
              activityName: actName,
              period: pi + 1,
              campers: [...list].sort((a, b) => a.lastName.localeCompare(b.lastName)),
            });
          }
        });
      }

      setSheets(sheetList);
      setLoading(false);
    }

    load();
  }, [supabase]);

  // Activities with zero signups across all periods
  const signedUpActs = new Set(sheets.map(s => s.activityName));
  const zeroSignups  = allActivities.filter(a => !signedUpActs.has(a));

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: font }}>
        <div className="no-print"><LeadershipNav /></div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 14, fontWeight: 600, background: C.bg }}>
          Loading…
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: font, background: C.bg }}>

      {/* Top nav — hidden on print */}
      <div className="no-print"><LeadershipNav /></div>

      {/* Print preview bar — hidden on print */}
      <div className="no-print" style={{ background: C.sageDk, color: "white", padding: "11px 24px", display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 800, fontSize: 14 }}>
            {sheets.length === 0 ? "No sheets to print" : `${sheets.length} sheet${sheets.length !== 1 ? "s" : ""} will be generated`}
          </span>
          {zeroSignups.length > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, background: "rgba(255,255,255,0.15)", padding: "4px 10px", borderRadius: 99, letterSpacing: "0.01em" }}>
              ⚠ Zero signups: {zeroSignups.join(", ")}
            </span>
          )}
        </div>
        <button
          onClick={() => window.print()}
          disabled={sheets.length === 0}
          style={{ background: "white", color: C.sageDk, border: "none", borderRadius: 8, padding: "8px 22px", fontFamily: font, fontSize: 13, fontWeight: 800, cursor: sheets.length === 0 ? "not-allowed" : "pointer", opacity: sheets.length === 0 ? 0.5 : 1, flexShrink: 0 }}>
          Print All
        </button>
      </div>

      {/* Sheet area */}
      <div style={{ padding: "24px 0 48px" }}>
        {sheets.length === 0 ? (
          <div style={{ textAlign: "center", padding: "72px 24px", color: C.muted, fontSize: 14, fontWeight: 600 }}>
            No submitted groups yet — groups must submit before sheets can be generated.
          </div>
        ) : (
          sheets.map((sheet, idx) => {
            const isLast   = idx === sheets.length - 1;
            const twoCol   = sheet.campers.length >= 40;
            const periodLabel = getPeriodLabel(session, sheet.period - 1);
            const periodTime  = getPeriodTime(session, sheet.period - 1);
            const qrUrl    = origin ? `${origin}/attendance/${encodeURIComponent(sheet.activityName)}/${sheet.period}` : "";

            // Next-pick column: show if not two-col and not the last period
            const nextPeriod = sheet.period < periodCount ? sheet.period : null; // next period index (0-based) = sheet.period
            const showNext   = !twoCol && nextPeriod !== null;
            const nextLabel  = showNext ? getPeriodLabel(session, nextPeriod!).replace("Period ", "P") : "";

            // Two-column split
            const half       = Math.ceil(sheet.campers.length / 2);
            const leftList   = twoCol ? sheet.campers.slice(0, half)  : sheet.campers;
            const rightList  = twoCol ? sheet.campers.slice(half)      : [];

            // Table header cell style
            const th: React.CSSProperties = {
              textAlign: "left", padding: "5px 7px", fontWeight: 800,
              fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase",
              color: "#374151", borderBottom: "1.5px solid #1A2318",
            };
            const td: React.CSSProperties = {
              padding: "5px 7px", fontSize: 11, borderBottom: "0.5px solid #E5E7EB",
            };

            return (
              <div
                key={`${sheet.activityName}-${sheet.period}`}
                className={`print-sheet${!isLast ? " print-break" : ""}`}
                style={{
                  width: 760, margin: "0 auto 28px", background: "white",
                  boxShadow: "0 1px 8px rgba(0,0,0,0.09)", borderRadius: 6,
                  padding: "32px 40px 28px",
                }}>

                {/* ── Sheet header ── */}
                <div style={{ borderBottom: "2px solid #1A2318", paddingBottom: 14, marginBottom: 18 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted, marginBottom: 5 }}>
                    Camp Chickami &nbsp;·&nbsp; {today}
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 900, color: C.text, lineHeight: 1, marginBottom: 8 }}>
                    {sheet.activityName}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: C.sageDk }}>{periodLabel}</span>
                    <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{periodTime}</span>
                    <span style={{ fontSize: 10, fontWeight: 800, background: C.sageLt, color: C.sageDk, padding: "2px 9px", borderRadius: 99, letterSpacing: "0.04em" }}>
                      {sheet.campers.length} camper{sheet.campers.length !== 1 ? "s" : ""}
                    </span>
                    {twoCol && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: "#F3F4F6", color: "#6B7280", padding: "2px 8px", borderRadius: 99 }}>
                        2-column layout
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Camper table ── */}
                {twoCol ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                    {[leftList, rightList].map((col, ci) => (
                      <table key={ci} style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            <th style={{ ...th, width: 24 }}>#</th>
                            <th style={{ ...th }}>Name</th>
                            <th style={{ ...th, width: 38 }}>Grp</th>
                            <th style={{ ...th, width: 24, textAlign: "center" }}>✓</th>
                          </tr>
                        </thead>
                        <tbody>
                          {col.map((c, i) => {
                            const num = ci === 0 ? i + 1 : half + i + 1;
                            return (
                              <tr key={c.id}>
                                <td style={{ ...td, color: C.muted, fontWeight: 600 }}>{num}</td>
                                <td style={{ ...td, fontWeight: 600, color: C.text }}>{c.lastName}, {c.firstName}</td>
                                <td style={{ ...td, color: C.muted, fontWeight: 600 }}>{c.groupName}</td>
                                <td style={{ ...td, textAlign: "center" }}>
                                  <div style={{ width: 13, height: 13, border: "1.5px solid #9CA3AF", borderRadius: 2, margin: "0 auto" }} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ))}
                  </div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ ...th, width: 28 }}>#</th>
                        <th style={{ ...th }}>Name</th>
                        <th style={{ ...th, width: 52 }}>Group</th>
                        {showNext && <th style={{ ...th, width: 52, textAlign: "center" }}>→ {nextLabel}</th>}
                        <th style={{ ...th, width: 28, textAlign: "center" }}>✓</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leftList.map((c, i) => (
                        <tr key={c.id}>
                          <td style={{ ...td, color: C.muted, fontWeight: 600 }}>{i + 1}</td>
                          <td style={{ ...td, fontWeight: 600, color: C.text }}>{c.lastName}, {c.firstName}</td>
                          <td style={{ ...td, color: C.muted, fontWeight: 600 }}>{c.groupName}</td>
                          {showNext && (
                            <td style={{ ...td, textAlign: "center", fontWeight: 700, color: C.sageDk }}>
                              {abbr(c.choices[nextPeriod!] ?? null)}
                            </td>
                          )}
                          <td style={{ ...td, textAlign: "center" }}>
                            <div style={{ width: 13, height: 13, border: "1.5px solid #9CA3AF", borderRadius: 2, margin: "0 auto" }} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* ── Sheet footer ── */}
                <div style={{ marginTop: 20, borderTop: "1px solid #E5E7EB", paddingTop: 14, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 14 }}>
                      Total: {sheet.campers.length} camper{sheet.campers.length !== 1 ? "s" : ""}
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, whiteSpace: "nowrap" }}>Counselor signature:</span>
                      <div style={{ borderBottom: "1px solid #9CA3AF", width: 220, marginBottom: 2 }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
                    {qrUrl && <QRCodeSVG value={qrUrl} size={80} />}
                    <div style={{ fontSize: 9, fontFamily: "monospace", color: "#9CA3AF", textAlign: "right" }}>
                      Scan to mark attendance
                    </div>
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
