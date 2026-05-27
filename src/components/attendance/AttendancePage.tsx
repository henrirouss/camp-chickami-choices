"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadActiveSession, getPeriodLabel, getPeriodTime, type ActiveSession } from "@/lib/session";

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  bg:      "#F4F6F3",
  white:   "#FFFFFF",
  text:    "#1A2318",
  muted:   "#7A8A76",
  border:  "#DDE5DA",
  sage:    "#7A9E75",
  sageDk:  "#4A6E45",
  sageLt:  "#EAF2E8",
  green:   "#22C55E",
  greenLt: "#DCFCE7",
  greenDk: "#15803D",
  grey:    "#F3F4F6",
  greyBd:  "#D1D5DB",
  greyTx:  "#6B7280",
};

const font = "var(--font-figtree), Figtree, sans-serif";

const PERIOD_COLORS = [
  { bg: "#E8F5E4", bd: "#9DC894", tx: "#3A6635" },
  { bg: "#FEF4E2", bd: "#F0C06A", tx: "#8A5E10" },
  { bg: "#FCE8E8", bd: "#EAA0A0", tx: "#8A3535" },
  { bg: "#E0F2FE", bd: "#7DD3FC", tx: "#0369A1" },
  { bg: "#FDF4FF", bd: "#E879F9", tx: "#86198F" },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type Activity = {
  id:           string;
  name:         string;
  abbreviation: string;
};

type Camper = {
  id:         string;
  first_name: string;
  last_name:  string;
  group_id:   string;
  group_name: string;
};

type DBCamper = {
  id:         string;
  first_name: string;
  last_name:  string;
  group_id:   string;
  groups:     { name: string } | null;
};

type AttRec = {
  id:          string;
  camper_id:   string;
  activity_id: string;
  status:      string;
  location:    string | null;
  logged_by:   string | null;
};

type ElseRec = AttRec & { activities: { name: string } | null };

// ── Component ─────────────────────────────────────────────────────────────────

export default function AttendancePage({
  activitySlug,
  periodStr,
}: {
  activitySlug: string;
  periodStr:    string;
}) {
  const supabase   = useMemo(() => createClient(), []);
  const actName    = decodeURIComponent(activitySlug);
  const periodNum  = Math.max(1, Math.min(5, parseInt(periodStr, 10) || 1));
  const periodC    = PERIOD_COLORS[Math.min(periodNum - 1, PERIOD_COLORS.length - 1)];
  const choiceCol  = `choice_p${periodNum}` as "choice_p1" | "choice_p2" | "choice_p3" | "choice_p4" | "choice_p5";

  const [session, setSession] = useState<ActiveSession | null>(null);

  const [loading,          setLoading]          = useState(true);
  const [activity,         setActivity]         = useState<Activity | null>(null);
  const [expectedCampers,  setExpectedCampers]  = useState<Camper[]>([]);
  const [allCampers,       setAllCampers]        = useState<Camper[]>([]);

  // Map<camper_id, record_id> for expected campers checked in here
  const [checkedInMap,  setCheckedInMap]  = useState<Map<string, string>>(new Map());
  // Map<camper_id, { recordId, location }> for expected campers elsewhere
  const [elsewhereMap,  setElsewhereMap]  = useState<Map<string, { recordId: string; location: string }>>(new Map());
  // Map<camper_id, record_id> for unexpected arrivals
  const [unexpectedMap, setUnexpectedMap] = useState<Map<string, string>>(new Map());

  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      // 0. Load active session for period label/time display
      const sess = await loadActiveSession(supabase);
      setSession(sess);

      // 1. Resolve activity by name
      const { data: act } = await supabase
        .from("activities")
        .select("id, name, abbreviation")
        .eq("name", actName)
        .maybeSingle();
      if (!act) { setLoading(false); return; }
      setActivity(act as Activity);
      const actId = (act as Activity).id;

      // 2. Expected campers + all campers + attendance at this activity (parallel)
      const [
        { data: expRaw },
        { data: allRaw },
        { data: attHere },
      ] = await Promise.all([
        supabase
          .from("campers")
          .select("id, first_name, last_name, group_id, groups(name)")
          .eq(choiceCol, actName)
          .eq("absent", false)
          .order("last_name"),
        supabase
          .from("campers")
          .select("id, first_name, last_name, group_id, groups(name)")
          .eq("absent", false)
          .order("last_name"),
        supabase
          .from("attendance")
          .select("id, camper_id, activity_id, status, location, logged_by")
          .eq("activity_id", actId)
          .eq("period", periodNum),
      ]);

      const mapC = (c: DBCamper): Camper => ({
        id: c.id, first_name: c.first_name, last_name: c.last_name,
        group_id: c.group_id, group_name: c.groups?.name ?? "",
      });

      const expected = (expRaw as DBCamper[] | null ?? []).map(mapC);
      setExpectedCampers(expected);
      setAllCampers((allRaw as DBCamper[] | null ?? []).map(mapC));

      // Parse attendance at this activity
      const recs = (attHere as AttRec[] | null) ?? [];
      const expIdSet  = new Set(expected.map(c => c.id));
      const newCIn    = new Map<string, string>();
      const newUnexp  = new Map<string, string>();

      for (const r of recs) {
        if (r.status === "checkedin") {
          if (expIdSet.has(r.camper_id)) newCIn.set(r.camper_id, r.id);
          else newUnexp.set(r.camper_id, r.id);
        }
      }
      setCheckedInMap(newCIn);
      setUnexpectedMap(newUnexp);

      // 3. Elsewhere: expected campers checked in at a different activity this period
      if (expected.length > 0) {
        const expIds = expected.map(c => c.id);

        const [{ data: elseCheckedIn }, { data: elseStatus }] = await Promise.all([
          // Checked-in records at OTHER activities this period
          supabase
            .from("attendance")
            .select("id, camper_id, activity_id, status, location, logged_by, activities(name)")
            .eq("period", periodNum)
            .in("camper_id", expIds)
            .neq("activity_id", actId)
            .eq("status", "checkedin"),
          // Explicit "elsewhere" records at THIS activity (set by leadership)
          supabase
            .from("attendance")
            .select("id, camper_id, activity_id, status, location, logged_by")
            .eq("activity_id", actId)
            .eq("period", periodNum)
            .eq("status", "elsewhere")
            .in("camper_id", expIds),
        ]);

        const newElse = new Map<string, { recordId: string; location: string }>();
        for (const r of (elseCheckedIn as ElseRec[] | null ?? [])) {
          newElse.set(r.camper_id, {
            recordId: r.id,
            location: r.activities?.name ?? r.location ?? "Elsewhere",
          });
        }
        for (const r of (elseStatus as AttRec[] | null ?? [])) {
          if (!newElse.has(r.camper_id)) {
            newElse.set(r.camper_id, {
              recordId: r.id,
              location: r.location ?? "Elsewhere",
            });
          }
        }
        setElsewhereMap(newElse);
      }

      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actName, periodNum]);

  // ── Toggle check-in for expected camper ───────────────────────────────────
  const toggleCheckIn = useCallback(async (camper: Camper) => {
    if (!activity || elsewhereMap.has(camper.id)) return;

    if (checkedInMap.has(camper.id)) {
      const recId = checkedInMap.get(camper.id)!;
      setCheckedInMap(prev => { const m = new Map(prev); m.delete(camper.id); return m; });
      await supabase.from("attendance").delete().eq("id", recId);
    } else {
      // Optimistically update
      const tmpId = `tmp-${camper.id}`;
      setCheckedInMap(prev => new Map(prev).set(camper.id, tmpId));
      const { data } = await supabase
        .from("attendance")
        .insert({
          camper_id:   camper.id,
          activity_id: activity.id,
          period:      periodNum,
          status:      "checkedin",
          logged_at:   new Date().toISOString(),
          logged_by:   "counselor",
        })
        .select("id")
        .single();
      if (data) {
        setCheckedInMap(prev => {
          const m = new Map(prev);
          m.set(camper.id, (data as { id: string }).id);
          return m;
        });
      }
    }
  }, [activity, checkedInMap, elsewhereMap, periodNum, supabase]);

  // ── Add unexpected arrival ────────────────────────────────────────────────
  const addUnexpected = useCallback(async (camper: Camper) => {
    if (!activity) return;
    if (checkedInMap.has(camper.id) || unexpectedMap.has(camper.id)) {
      setSearchQuery(""); return;
    }
    const tmpId = `tmp-${camper.id}`;
    setUnexpectedMap(prev => new Map(prev).set(camper.id, tmpId));
    setSearchQuery("");
    setSearchFocused(false);
    const { data } = await supabase
      .from("attendance")
      .insert({
        camper_id:   camper.id,
        activity_id: activity.id,
        period:      periodNum,
        status:      "checkedin",
        logged_at:   new Date().toISOString(),
        logged_by:   "counselor_unexpected",
      })
      .select("id")
      .single();
    if (data) {
      setUnexpectedMap(prev => {
        const m = new Map(prev);
        m.set(camper.id, (data as { id: string }).id);
        return m;
      });
    }
  }, [activity, checkedInMap, unexpectedMap, periodNum, supabase]);

  // ── Search results ────────────────────────────────────────────────────────
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q       = searchQuery.toLowerCase();
    const expIds  = new Set(expectedCampers.map(c => c.id));
    return allCampers
      .filter(c => !expIds.has(c.id))
      .filter(c =>
        c.first_name.toLowerCase().includes(q) ||
        c.last_name.toLowerCase().includes(q) ||
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
        `${c.last_name}, ${c.first_name}`.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [searchQuery, allCampers, expectedCampers]);

  // ── Derived counts ────────────────────────────────────────────────────────
  const elsewhereCount  = useMemo(
    () => expectedCampers.filter(c => elsewhereMap.has(c.id)).length,
    [expectedCampers, elsewhereMap]
  );
  const checkedInCount  = checkedInMap.size + unexpectedMap.size;
  const allAccounted    =
    expectedCampers.length > 0 &&
    expectedCampers.every(c => checkedInMap.has(c.id) || elsewhereMap.has(c.id));

  // Unexpected arrivals as Camper objects (for display)
  const unexpectedCampers = useMemo(() => {
    const cMap = new Map(allCampers.map(c => [c.id, c]));
    return [...unexpectedMap.keys()].map(id => cMap.get(id)).filter(Boolean) as Camper[];
  }, [unexpectedMap, allCampers]);

  // ── Loading / not found ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, fontFamily: font, color: C.muted, fontSize: 14, fontWeight: 600 }}>
        Loading…
      </div>
    );
  }
  if (!activity) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, fontFamily: font, color: C.muted, fontSize: 14, fontWeight: 600 }}>
        Activity not found
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: font, color: C.text }}>
      <div style={{ maxWidth: 520, margin: "0 auto", paddingBottom: 56 }}>

        {/* ── Header ── */}
        <div style={{ background: C.sageDk, padding: "20px 20px 20px", color: "white" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.65, marginBottom: 6 }}>
            Camp Chickami · Attendance
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.1, marginBottom: 10 }}>
            {activity.name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <span style={{
              background: periodC.bg, color: periodC.tx, border: `1px solid ${periodC.bd}`,
              borderRadius: 99, padding: "3px 12px", fontSize: 12, fontWeight: 800,
            }}>
              {getPeriodLabel(session, periodNum - 1)}
            </span>
            <span style={{ fontSize: 12, opacity: 0.75, fontWeight: 600 }}>{getPeriodTime(session, periodNum - 1)}</span>
          </div>

          {/* Count pills */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <CountPill label="Checked In" value={checkedInCount}    bg={C.greenLt}               fg={C.greenDk} />
            <CountPill label="Expected"   value={expectedCampers.length} bg="rgba(255,255,255,0.15)" fg="white" />
            <CountPill label="Elsewhere"  value={elsewhereCount}    bg="rgba(255,255,255,0.1)"   fg="rgba(255,255,255,0.75)" />
          </div>
        </div>

        {/* ── All accounted banner ── */}
        {allAccounted && (
          <div style={{
            margin: "12px 16px 0",
            background: C.greenLt, border: `1.5px solid ${C.green}`, borderRadius: 12,
            padding: "12px 16px", display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>✓</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: C.greenDk }}>All campers accounted for</span>
          </div>
        )}

        {/* ── Expected campers ── */}
        <div style={{ padding: "16px 16px 0" }}>
          <SectionLabel text={`Expected · ${expectedCampers.length} camper${expectedCampers.length !== 1 ? "s" : ""}`} />
          <div style={{ background: C.white, borderRadius: 14, border: `1.5px solid ${C.border}`, overflow: "hidden" }}>
            {expectedCampers.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center", color: C.muted, fontSize: 13, fontWeight: 600 }}>
                No campers signed up for this activity this period
              </div>
            ) : (
              expectedCampers.map((camper, i) => {
                const isChecked    = checkedInMap.has(camper.id);
                const isElsewhere  = elsewhereMap.has(camper.id);
                const elseInfo     = elsewhereMap.get(camper.id);
                const isLast       = i === expectedCampers.length - 1;
                return (
                  <CamperRow
                    key={camper.id}
                    camper={camper}
                    isChecked={isChecked}
                    isElsewhere={isElsewhere}
                    elsewhereLocation={elseInfo?.location}
                    isLast={isLast}
                    onTap={() => toggleCheckIn(camper)}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* ── Unexpected arrivals ── */}
        {unexpectedCampers.length > 0 && (
          <div style={{ padding: "16px 16px 0" }}>
            <SectionLabel text={`Unexpected Arrivals · ${unexpectedCampers.length}`} />
            <div style={{ background: C.white, borderRadius: 14, border: `1.5px solid ${C.border}`, overflow: "hidden" }}>
              {unexpectedCampers.map((camper, i) => (
                <div
                  key={camper.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "13px 16px",
                    background: C.greenLt,
                    borderBottom: i < unexpectedCampers.length - 1 ? `1px solid ${C.border}` : "none",
                  }}
                >
                  <CheckCircle checked />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                      {camper.last_name}, {camper.first_name}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, fontWeight: 500, marginTop: 1 }}>
                      Group {camper.group_name} · Unexpected arrival
                    </div>
                  </div>
                  <GroupBadge name={camper.group_name} checked />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Unexpected arrival search ── */}
        <div style={{ padding: "16px 16px 0" }}>
          <SectionLabel text="Add Unexpected Arrival" />
          <div style={{ position: "relative" }}>
            <div style={{
              background: C.white, borderRadius: 12,
              border: `1.5px solid ${searchFocused ? C.sage : C.border}`,
              display: "flex", alignItems: "center", gap: 10,
              padding: "11px 14px", transition: "border-color 0.15s",
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="5" stroke={C.muted} strokeWidth="1.5" />
                <path d="M11 11l3 3" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                placeholder="Search camper by name…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                style={{
                  flex: 1, border: "none", outline: "none", background: "transparent",
                  fontFamily: font, fontSize: 14, fontWeight: 600, color: C.text,
                  minWidth: 0,
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{ border: "none", background: "none", cursor: "pointer", color: C.muted, fontSize: 18, padding: 0, lineHeight: 1, flexShrink: 0 }}
                >
                  ×
                </button>
              )}
            </div>

            {/* Dropdown */}
            {searchResults.length > 0 && (searchFocused || !!searchQuery) && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                background: C.white, border: `1.5px solid ${C.border}`,
                borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                zIndex: 100, overflow: "hidden",
              }}>
                {searchResults.map((camper, i) => {
                  const alreadyPresent = checkedInMap.has(camper.id) || unexpectedMap.has(camper.id);
                  return (
                    <button
                      key={camper.id}
                      onMouseDown={() => addUnexpected(camper)}
                      disabled={alreadyPresent}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 12,
                        padding: "11px 14px",
                        background: alreadyPresent ? C.grey : C.white,
                        border: "none",
                        borderBottom: i < searchResults.length - 1 ? `1px solid ${C.border}` : "none",
                        cursor: alreadyPresent ? "default" : "pointer",
                        textAlign: "left", fontFamily: font,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: alreadyPresent ? C.greyTx : C.text }}>
                          {camper.last_name}, {camper.first_name}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>
                          Group {camper.group_name}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: alreadyPresent ? C.muted : C.sage, flexShrink: 0 }}>
                        {alreadyPresent ? "Already here" : "+ Add"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CountPill({ label, value, bg, fg }: { label: string; value: number; bg: string; fg: string }) {
  return (
    <div style={{ background: bg, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 24, fontWeight: 900, color: fg, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: fg, opacity: 0.85, marginTop: 2, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {label}
      </div>
    </div>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: 8 }}>
      {text}
    </div>
  );
}

function CheckCircle({ checked, elsewhere }: { checked?: boolean; elsewhere?: boolean }) {
  const bg = checked ? C.green : elsewhere ? C.greyBd : C.grey;
  return (
    <div style={{
      width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: bg,
      border: checked || elsewhere ? "none" : `1.5px solid ${C.border}`,
    }}>
      {checked && <span style={{ color: "white", fontSize: 15, fontWeight: 900, lineHeight: 1 }}>✓</span>}
      {elsewhere && <span style={{ color: C.greyTx, fontSize: 13, fontWeight: 700 }}>→</span>}
    </div>
  );
}

function GroupBadge({ name, checked }: { name: string; checked?: boolean }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 800,
      color:       checked ? C.greenDk : C.muted,
      background:  checked ? "rgba(34,197,94,0.15)" : C.grey,
      borderRadius: 99, padding: "2px 8px", flexShrink: 0,
    }}>
      {name}
    </span>
  );
}

function CamperRow({
  camper, isChecked, isElsewhere, elsewhereLocation, isLast, onTap,
}: {
  camper:             Camper;
  isChecked:          boolean;
  isElsewhere:        boolean;
  elsewhereLocation?: string;
  isLast:             boolean;
  onTap:              () => void;
}) {
  const bg = isChecked ? C.greenLt : isElsewhere ? "#F9FAFB" : C.white;
  return (
    <button
      onClick={onTap}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 12,
        padding: "13px 16px",
        background: bg,
        border: "none",
        borderBottom: isLast ? "none" : `1px solid ${C.border}`,
        cursor: isElsewhere ? "default" : "pointer",
        textAlign: "left", fontFamily: font,
        transition: "background 0.12s",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <CheckCircle checked={isChecked} elsewhere={isElsewhere && !isChecked} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: isElsewhere ? C.greyTx : C.text }}>
          {camper.last_name}, {camper.first_name}
        </div>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 500, marginTop: 1 }}>
          {isElsewhere ? `At: ${elsewhereLocation}` : `Group ${camper.group_name}`}
        </div>
      </div>
      {!isElsewhere && <GroupBadge name={camper.group_name} checked={isChecked} />}
    </button>
  );
}
