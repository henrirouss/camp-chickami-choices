"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  bg:      "#F4F6F3", white:  "#FFFFFF",
  sidebar: "#1E2B1A", text:   "#1A2318", muted:  "#7A8A76", border: "#DDE5DA",
  sage:    "#7A9E75", sageDk: "#4A6E45", sageLt: "#EAF2E8",
  green:   "#22C55E", greenLt:"#DCFCE7",
  red:     "#EF4444", redLt:  "#FEE2E2",
  yellow:  "#F59E0B", yellowLt:"#FEF3C7",
  blue:    "#3B82F6", blueLt: "#DBEAFE",
};
const font = "var(--font-figtree), Figtree, sans-serif";

// ── Static reference data ─────────────────────────────────────────────────────

const ACTIVITY_DEFS = [
  { name: "Field",         abbreviation: "F" },
  { name: "Pool",          abbreviation: "Pool" },
  { name: "Arts & Crafts", abbreviation: "A/C" },
  { name: "Pav",           abbreviation: "Pav" },
  { name: "Gaga",          abbreviation: "Gaga" },
  { name: "Front Lawn",    abbreviation: "FL" },
  { name: "Building",      abbreviation: "B" },
  { name: "Courts",        abbreviation: "C" },
  { name: "Chowderhouse",  abbreviation: "CH" },
  { name: "Nature",        abbreviation: "N" },
  { name: "Archery",       abbreviation: "Arch" },
  { name: "Ropes",         abbreviation: "R" },
  { name: "Loch Lodge",    abbreviation: "LL" },
  { name: "New Games",     abbreviation: "NG" },
];

const GROUP_NAMES  = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P"];
const COUNSELORS   = ["Sarah K.","Mike T.","Priya L.","James R.","Lily C.","Omar S.","Grace W.","Ethan M.","Ava P.","Noah D.","Chloe B.","Liam F.","Zoe H.","Tyler N.","Maya G.","Connor J."];
const SAMPLE_NAMES = [
  ["Emma","Anderson"],["Liam","Barnes"],["Sofia","Campbell"],["Marcus","Chen"],["Lily","Davis"],
  ["Deon","Edwards"],["Priya","Foster"],["Carlos","Garcia"],["Mia","Harris"],["Noah","Jackson"],
  ["Aisha","Johnson"],["Tyler","Kim"],["Zoe","Lewis"],["Ethan","Martin"],["Chloe","Mitchell"],
  ["Mason","Moore"],["Isabella","Nelson"],["Lucas","Nguyen"],["Harper","Okafor"],["Oliver","Parker"],
  ["Ella","Patel"],["James","Perez"],["Scarlett","Quinn"],["Benjamin","Ramirez"],["Grace","Rivera"],
  ["Elijah","Robinson"],["Stella","Rodriguez"],["Alexander","Scott"],["Hazel","Smith"],["Michael","Taylor"],
  ["Aurora","Thomas"],["Daniel","Thompson"],["Luna","Torres"],["Henry","Turner"],["Savannah","Walker"],
  ["Jackson","White"],["Nora","Williams"],["Sebastian","Wilson"],["Aria","Wright"],["Caleb","Young"],
  ["Penelope","Adams"],["Owen","Baker"],["Hannah","Brooks"],["Wyatt","Butler"],["Layla","Carter"],
  ["Julian","Clark"],["Violet","Collins"],["Grayson","Cooper"],["Riley","Cox"],["Levi","Cruz"],
  ["Zoey","Diaz"],["Josiah","Evans"],["Naomi","Fleming"],["Evan","Gonzalez"],["Leah","Green"],
  ["Connor","Hall"],["Audrey","Hayes"],["Dominic","Hill"],["Claire","Howard"],["Hunter","Hughes"],
  ["Paisley","James"],["Lincoln","Jenkins"],["Savannah","King"],["Nolan","Lee"],["Addison","Long"],
  ["Eli","Lopez"],["Brooklyn","Marshall"],["Jaxon","Mason"],["Skylar","Morgan"],["Miles","Murphy"],
  ["Genesis","Murray"],["Easton","Myers"],["Mackenzie","Nelson"],["Bentley","Ortiz"],["Kennedy","Owens"],
  ["Ryker","Palmer"],["Piper","Price"],["Brayden","Reed"],["Kinsley","Ross"],["Declan","Sanchez"],
];

// ── Types ─────────────────────────────────────────────────────────────────────

type Choices = [string, string, string];
type Camper   = { id: string; firstName: string; lastName: string; choices: Choices; absent: boolean };
type Group    = { name: string; counselor: string; submitted: boolean; campers: Camper[] };
type Activity = { name: string; abbreviation: string; open: [boolean, boolean, boolean] };
type Tab      = "grid" | "activities" | "roster" | "upload";

// ── Seed helpers ──────────────────────────────────────────────────────────────

function pick(seed: number) { return ACTIVITY_DEFS[((seed % 14) + 14) % 14].name; }

function makeChoices(gi: number, ci: number): Choices {
  const s = gi * 17 + ci * 7;
  return [pick(s), pick(s + 5), pick(s + 11)];
}

// ── Initial state ─────────────────────────────────────────────────────────────

const INITIAL_GROUPS: Group[] = GROUP_NAMES.map((name, gi) => ({
  name,
  counselor: COUNSELORS[gi],
  submitted: gi < 5,
  campers: SAMPLE_NAMES.slice(gi * 5, gi * 5 + 5).map(([fn, ln], ci) => ({
    id: `${name}-${ci}`,
    firstName: fn,
    lastName: ln,
    absent: false,
    choices: (gi < 5)          ? makeChoices(gi, ci)
           : (gi < 8 && ci < 2) ? [pick(gi * 3 + ci), "", ""]
           : ["", "", ""],
  })),
}));

const INITIAL_ACTIVITIES: Activity[] = ACTIVITY_DEFS.map(a => ({
  ...a, open: [true, true, true],
}));

// ── Small components ──────────────────────────────────────────────────────────

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{ width: 40, height: 22, borderRadius: 99, border: "none", cursor: "pointer", position: "relative", background: on ? C.sage : "#D1D5DB", transition: "background 0.2s", flexShrink: 0 }}>
      <span style={{ position: "absolute", width: 16, height: 16, borderRadius: "50%", background: "white", top: 3, left: on ? 21 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", display: "block" }} />
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LeadershipDashboard() {
  const [groups, setGroups]         = useState<Group[]>(INITIAL_GROUPS);
  const [activities, setActivities] = useState<Activity[]>(INITIAL_ACTIVITIES);
  const [tab, setTab]               = useState<Tab>("grid");
  const [movingCamper, setMovingCamper] = useState<{ gi: number; ci: number } | null>(null);
  const [moveTarget, setMoveTarget] = useState(0);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [schedFileName, setSchedFileName]   = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const csvRef  = useRef<HTMLInputElement>(null);
  const schedRef = useRef<HTMLInputElement>(null);

  // ── Auto-refresh every 30 s ───────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setLastRefresh(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // ── Conflict helpers ──────────────────────────────────────────────────────
  const getConflicts = useCallback(() => {
    const out: { camper: string; group: string; act: string; period: number }[] = [];
    groups.forEach(g => g.campers.forEach(c =>
      c.choices.forEach((act, pi) => {
        if (act && activities.find(a => a.name === act) && !activities.find(a => a.name === act)!.open[pi])
          out.push({ camper: `${c.firstName} ${c.lastName}`, group: g.name, act, period: pi + 1 });
      })
    ));
    return out;
  }, [groups, activities]);

  const conflicts = getConflicts();

  function isConflict(act: string, pi: number) {
    return act && !activities.find(a => a.name === act)?.open[pi];
  }

  function abbrOf(act: string) {
    return activities.find(a => a.name === act)?.abbreviation ?? act;
  }

  function groupStatus(g: Group): "done" | "partial" | "pending" {
    if (g.submitted) return "done";
    if (g.campers.some(c => c.choices.some(v => v))) return "partial";
    return "pending";
  }

  const doneCount = groups.filter(g => g.submitted).length;
  const pendCount = groups.length - doneCount;

  // ── Activity manager ──────────────────────────────────────────────────────
  function toggleActivity(ai: number, pi: number) {
    setActivities(prev => prev.map((a, i) => i !== ai ? a : {
      ...a, open: a.open.map((v, j) => j === pi ? !v : v) as [boolean, boolean, boolean],
    }));
    setAlertDismissed(false);
  }

  function setAllPeriods(ai: number, val: boolean) {
    setActivities(prev => prev.map((a, i) => i !== ai ? a : { ...a, open: [val, val, val] }));
    setAlertDismissed(false);
  }

  // ── Roster manager ────────────────────────────────────────────────────────
  function removeCamper(gi: number, ci: number) {
    setGroups(prev => prev.map((g, i) => i !== gi ? g : {
      ...g, campers: g.campers.filter((_, j) => j !== ci),
    }));
  }

  function addCamper(gi: number, value: string, inputEl: HTMLInputElement) {
    const val = value.trim();
    if (!val) return;
    const [fn, ...rest] = val.split(" ");
    setGroups(prev => prev.map((g, i) => i !== gi ? g : {
      ...g, campers: [...g.campers, { id: `${g.name}-${Date.now()}`, firstName: fn, lastName: rest.join(" ") || "—", choices: ["", "", ""], absent: false }],
    }));
    inputEl.value = "";
  }

  function confirmMove() {
    if (!movingCamper) return;
    const { gi, ci } = movingCamper;
    setGroups(prev => {
      const next = prev.map(g => ({ ...g, campers: [...g.campers] }));
      const [camper] = next[gi].campers.splice(ci, 1);
      next[moveTarget].campers.push(camper);
      return next;
    });
    setMovingCamper(null);
  }

  // ── CSV parse ─────────────────────────────────────────────────────────────
  function parseCsv(text: string) {
    const lines = text.trim().split("\n").filter(l => l.trim());
    const hdr   = lines[0].toLowerCase();
    if (!hdr.includes("first") || !hdr.includes("group")) {
      alert("CSV format not recognized. Expected columns: first_name, last_name, group");
      return;
    }
    const newGroups = INITIAL_GROUPS.map(g => ({ ...g, campers: [] as Camper[] }));
    lines.slice(1).forEach(line => {
      const [fn, ln, grp] = line.split(",").map(s => s.trim());
      const gi = GROUP_NAMES.indexOf(grp?.toUpperCase());
      if (gi === -1 || !fn) return;
      newGroups[gi].campers.push({ id: `${grp}-${Date.now()}-${Math.random()}`, firstName: fn, lastName: ln ?? "—", choices: ["", "", ""], absent: false });
    });
    setGroups(newGroups);
  }

  // ── Print summary ─────────────────────────────────────────────────────────
  const printSheetCount = (() => {
    let n = 0;
    activities.forEach(act => [0, 1, 2].forEach(pi => {
      if (groups.some(g => g.submitted && g.campers.some(c => c.choices[pi] === act.name))) n++;
    }));
    return n;
  })();

  // ── Tab styles ────────────────────────────────────────────────────────────
  const tabBtn = (id: Tab): React.CSSProperties => ({
    padding: "14px 20px", fontSize: 13, fontWeight: 700,
    color: tab === id ? C.sageDk : C.muted,
    cursor: "pointer", background: "none", border: "none",
    borderBottom: `2.5px solid ${tab === id ? C.sageDk : "transparent"}`,
    marginBottom: -1.5, fontFamily: font, whiteSpace: "nowrap",
    display: "flex", alignItems: "center", gap: 7, transition: "color 0.15s",
  });

  // ── Sidebar dot ───────────────────────────────────────────────────────────
  function dotStyle(status: "done" | "partial" | "pending"): React.CSSProperties {
    const bg    = status === "done" ? "#4ADE80" : status === "partial" ? "#FCD34D" : "rgba(255,255,255,0.2)";
    const shadow = status === "done" ? "0 0 6px rgba(74,222,128,0.4)" : "none";
    return { width: 8, height: 8, borderRadius: "50%", background: bg, boxShadow: shadow, flexShrink: 0 };
  }

  const moveCamperName = movingCamper
    ? `${groups[movingCamper.gi]?.campers[movingCamper.ci]?.firstName ?? ""} ${groups[movingCamper.gi]?.campers[movingCamper.ci]?.lastName ?? ""}`.trim()
    : "";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: font, color: C.text, background: C.bg }}>

      {/* Alerts bar */}
      {conflicts.length > 0 && !alertDismissed && (
        <div style={{ background: "#FFF7ED", borderBottom: "1.5px solid #FED7AA", padding: "10px 24px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 14 }}>⚠️</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#92400E", flex: 1 }}>
            {conflicts.length} conflict{conflicts.length > 1 ? "s" : ""} detected — closed activities with campers signed up. See Activity Manager for details.
          </span>
          <button onClick={() => setAlertDismissed(true)} style={{ background: "none", border: "none", fontSize: 11, fontWeight: 700, color: "#D97706", cursor: "pointer", fontFamily: font }}>Dismiss</button>
        </div>
      )}

      {/* App body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── Sidebar ── */}
        <div style={{ width: 220, background: C.sidebar, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          <div style={{ padding: "16px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Group Submissions</div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, borderRadius: 6, padding: "6px 8px", textAlign: "center", background: "rgba(34,197,94,0.15)" }}>
                <span style={{ fontSize: 18, fontWeight: 900, lineHeight: 1, display: "block", color: "#4ADE80" }}>{doneCount}</span>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(74,222,128,0.7)" }}>Done</span>
              </div>
              <div style={{ flex: 1, borderRadius: 6, padding: "6px 8px", textAlign: "center", background: "rgba(245,158,11,0.15)" }}>
                <span style={{ fontSize: 18, fontWeight: 900, lineHeight: 1, display: "block", color: "#FCD34D" }}>{pendCount}</span>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(252,211,77,0.7)" }}>Pending</span>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "8px 0", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
            {groups.map(g => {
              const st = groupStatus(g);
              const stColor = st === "done" ? "#4ADE80" : st === "partial" ? "#FCD34D" : "rgba(255,255,255,0.3)";
              const stLabel = st === "done" ? "Done" : st === "partial" ? "In progress" : "Pending";
              return (
                <div key={g.name} onClick={() => setTab("grid")} style={{ display: "flex", alignItems: "center", padding: "8px 16px", gap: 10, cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <div style={dotStyle(st)} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)", flex: 1 }}>Group {g.name} · {g.counselor.split(" ")[0]}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", color: stColor }}>{stLabel}</div>
                </div>
              );
            })}
          </div>

          <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", animation: "pulse 2s infinite" }} />
              Live · updates every 30s
            </div>
          </div>
        </div>

        {/* ── Main content ── */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

          {/* Tabs */}
          <div style={{ background: C.white, borderBottom: `1.5px solid ${C.border}`, padding: "0 24px", display: "flex", flexShrink: 0 }}>
            <button onClick={() => setTab("grid")} style={tabBtn("grid")}>📋 Group Grid</button>
            <button onClick={() => setTab("activities")} style={tabBtn("activities")}>
              🔒 Activity Manager
              {conflicts.length > 0 && <span style={{ background: C.redLt, color: C.red, fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 99 }}>{conflicts.length}</span>}
            </button>
            <button onClick={() => setTab("roster")} style={tabBtn("roster")}>👥 Roster Manager</button>
            <button onClick={() => setTab("upload")} style={tabBtn("upload")}>📂 Upload & Data</button>
          </div>

          {/* Tab panels */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

            {/* ── GROUP GRID ── */}
            {tab === "grid" && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>All Groups</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: C.muted, marginTop: 1 }}>Conflicts shown in amber · Click a card to jump to Roster Manager</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  {groups.map(g => {
                    const hasConflict = g.campers.some(c => c.choices.some((act, pi) => isConflict(act, pi)));
                    const st = groupStatus(g);
                    const cardBg     = g.submitted ? "#FAFFFA" : hasConflict ? C.yellowLt : C.white;
                    const cardBorder = g.submitted ? C.sage    : hasConflict ? C.yellow   : C.border;
                    const dotBg      = st === "done" ? C.green : st === "partial" ? C.yellow : C.border;
                    const sorted     = [...g.campers].sort((a, b) => a.lastName.localeCompare(b.lastName));
                    const MAX        = 4;
                    return (
                      <div key={g.name} onClick={() => setTab("roster")} style={{ background: cardBg, border: `1.5px solid ${cardBorder}`, borderRadius: 12, padding: 12, cursor: "pointer", transition: "all 0.15s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px rgba(122,158,117,0.15)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 800 }}>Group {g.name}</div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: C.muted }}>{g.counselor || "No counselor yet"}</div>
                          </div>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: dotBg }} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {sorted.slice(0, MAX).map(c => (
                            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                              <div style={{ fontWeight: 600, flex: 1, color: C.text }}>{c.firstName} {c.lastName}</div>
                              {c.absent
                                ? <span style={{ fontSize: 9, fontWeight: 700, background: "#F3E8FF", color: "#7E22CE", padding: "1px 5px", borderRadius: 99 }}>Absent</span>
                                : <span style={{ fontSize: 10, fontWeight: 600, color: C.muted }}>
                                    {c.choices.map((act, pi) => (
                                      <span key={pi} style={{ color: isConflict(act, pi) ? C.red : undefined, fontWeight: isConflict(act, pi) ? 700 : undefined }}>
                                        {pi > 0 ? " · " : ""}{act ? abbrOf(act) : "—"}
                                      </span>
                                    ))}
                                  </span>
                              }
                            </div>
                          ))}
                        </div>
                        {sorted.length > MAX && <div style={{ fontSize: 10, fontWeight: 600, color: C.muted, marginTop: 4, textAlign: "center" }}>+{sorted.length - MAX} more</div>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── ACTIVITY MANAGER ── */}
            {tab === "activities" && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>Activity Manager</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: C.muted, marginTop: 1 }}>Toggle activities open or closed per period · Conflicts flagged automatically</div>
                </div>
                <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px 100px 120px", background: C.bg, borderBottom: `1.5px solid ${C.border}`, padding: "10px 16px" }}>
                    {["Activity", "Period 1", "Period 2", "Period 3", "Shortcuts"].map((h, i) => (
                      <div key={h} style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, textAlign: i === 0 ? "left" : "center" }}>{h}</div>
                    ))}
                  </div>
                  {activities.map((act, ai) => {
                    const actConflicts = conflicts.filter(c => c.act === act.name);
                    const allOpen      = act.open.every(v => v);
                    return (
                      <div key={act.name} style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px 100px 120px", padding: "12px 16px", borderBottom: `1px solid ${C.border}`, alignItems: "center", background: actConflicts.length ? "#FFFBEB" : undefined }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", gap: 6 }}>
                          {act.name}
                          {actConflicts.length > 0 && (
                            <span style={{ fontSize: 10, fontWeight: 700, background: C.yellowLt, color: C.yellow, padding: "2px 6px", borderRadius: 99, border: "1px solid #FCD34D" }}>
                              ⚠ {actConflicts.length} conflict{actConflicts.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        {[0, 1, 2].map(pi => (
                          <div key={pi} style={{ display: "flex", justifyContent: "center" }}>
                            <Toggle on={act.open[pi]} onToggle={() => toggleActivity(ai, pi)} />
                          </div>
                        ))}
                        <div style={{ display: "flex", justifyContent: "center" }}>
                          {allOpen
                            ? <button onClick={() => setAllPeriods(ai, false)} style={{ background: C.redLt, border: "1px solid #FCA5A5", borderRadius: 6, padding: "4px 10px", fontFamily: font, fontSize: 11, fontWeight: 700, color: C.red, cursor: "pointer" }}>Close All</button>
                            : <button onClick={() => setAllPeriods(ai, true)}  style={{ background: C.greenLt, border: "1px solid #86EFAC", borderRadius: 6, padding: "4px 10px", fontFamily: font, fontSize: 11, fontWeight: 700, color: "#166534", cursor: "pointer" }}>Open All</button>
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── ROSTER MANAGER ── */}
            {tab === "roster" && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>Roster Manager</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: C.muted, marginTop: 1 }}>Move campers between groups · Add or remove campers · Changes apply immediately</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  {groups.map((g, gi) => {
                    const sorted = [...g.campers].sort((a, b) => a.lastName.localeCompare(b.lastName));
                    return (
                      <div key={g.name} style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
                        <div style={{ background: C.sageLt, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: C.sageDk }}>Group {g.name}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: C.sage }}>{g.campers.length} campers</span>
                        </div>
                        <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 2 }}>
                          {sorted.map(c => {
                            const realIdx = g.campers.indexOf(c);
                            return (
                              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 6px", borderRadius: 6 }}
                                onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
                                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                                <span style={{ fontSize: 12, fontWeight: 600, flex: 1, color: C.text }}>{c.firstName} {c.lastName}</span>
                                <button
                                  onClick={() => { setMovingCamper({ gi, ci: realIdx }); setMoveTarget(gi === 0 ? 1 : 0); }}
                                  title="Move to another group"
                                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: C.muted, padding: "2px 4px", borderRadius: 4, fontFamily: font }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.blueLt; (e.currentTarget as HTMLButtonElement).style.color = C.blue; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; (e.currentTarget as HTMLButtonElement).style.color = C.muted; }}
                                >→</button>
                                <button
                                  onClick={() => removeCamper(gi, realIdx)}
                                  title="Remove camper"
                                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: C.muted, padding: "2px 4px", borderRadius: 4, fontFamily: font }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.redLt; (e.currentTarget as HTMLButtonElement).style.color = C.red; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; (e.currentTarget as HTMLButtonElement).style.color = C.muted; }}
                                >✕</button>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ padding: "6px 8px", borderTop: `1px solid ${C.border}` }}>
                          <input
                            placeholder="Add camper (First Last)…"
                            onKeyDown={e => { if (e.key === "Enter") addCamper(gi, (e.target as HTMLInputElement).value, e.target as HTMLInputElement); }}
                            style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 8px", fontFamily: font, fontSize: 11, fontWeight: 600, color: C.text, outline: "none" }}
                            onFocus={e => (e.target.style.borderColor = C.sage)}
                            onBlur={e => (e.target.style.borderColor = C.border)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── UPLOAD & DATA ── */}
            {tab === "upload" && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>Upload & Data</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: C.muted, marginTop: 1 }}>Upload the weekly roster CSV and today&apos;s schedule photo</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

                  {/* CSV Upload */}
                  <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Weekly Roster</div>
                    <div style={{ fontSize: 12, color: C.muted, fontWeight: 500, marginBottom: 14, lineHeight: 1.5 }}>Upload a CSV file with camper names and group assignments. This replaces the current roster for all groups.</div>
                    <div
                      onClick={() => csvRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor = C.sageDk; (e.currentTarget as HTMLDivElement).style.background = C.sageLt; }}
                      onDragLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.border; (e.currentTarget as HTMLDivElement).style.background = C.bg; }}
                      onDrop={e => {
                        e.preventDefault();
                        (e.currentTarget as HTMLDivElement).style.borderColor = C.border;
                        (e.currentTarget as HTMLDivElement).style.background = C.bg;
                        const file = e.dataTransfer.files[0];
                        if (file?.name.endsWith(".csv")) { const r = new FileReader(); r.onload = ev => parseCsv(ev.target!.result as string); r.readAsText(file); }
                      }}
                      style={{ border: `2px dashed ${C.border}`, borderRadius: 10, padding: 20, textAlign: "center", cursor: "pointer", background: C.bg, transition: "all 0.15s" }}
                    >
                      <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Drop CSV here or tap to browse</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Replaces current roster</div>
                      <button onClick={e => { e.stopPropagation(); csvRef.current?.click(); }} style={{ display: "inline-block", marginTop: 10, background: C.sage, color: "white", border: "none", borderRadius: 8, padding: "7px 16px", fontFamily: font, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Choose File</button>
                    </div>
                    <input ref={csvRef} type="file" accept=".csv" style={{ display: "none" }} onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) { const r = new FileReader(); r.onload = ev => parseCsv(ev.target!.result as string); r.readAsText(file); }
                    }} />
                    <div style={{ marginTop: 12, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 6 }}>Expected CSV Format</div>
                      <div style={{ fontFamily: "monospace", fontSize: 11, color: C.text, lineHeight: 1.6 }}>
                        first_name, last_name, group<br />
                        Emma, Anderson, A<br />
                        Jake, Barnes, A<br />
                        Sofia, Campbell, B
                      </div>
                    </div>
                  </div>

                  {/* Schedule Upload */}
                  <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Today&apos;s Schedule</div>
                    <div style={{ fontSize: 12, color: C.muted, fontWeight: 500, marginBottom: 14, lineHeight: 1.5 }}>Upload a photo of the whiteboard schedule. This will appear on all counselor screens when they tap the schedule button.</div>
                    <div
                      onClick={() => schedRef.current?.click()}
                      style={{ border: `2px dashed ${C.border}`, borderRadius: 10, padding: 20, textAlign: "center", cursor: "pointer", background: C.bg, transition: "all 0.15s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.sage; (e.currentTarget as HTMLDivElement).style.background = C.sageLt; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.border; (e.currentTarget as HTMLDivElement).style.background = C.bg; }}
                    >
                      <div style={{ fontSize: 28, marginBottom: 8 }}>{schedFileName ? "✅" : "📷"}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{schedFileName ?? "Drop image here or tap to browse"}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{schedFileName ? "Schedule uploaded · visible to all counselors" : "JPG, PNG, HEIC accepted"}</div>
                      <button onClick={e => { e.stopPropagation(); schedRef.current?.click(); }} style={{ display: "inline-block", marginTop: 10, background: C.sage, color: "white", border: "none", borderRadius: 8, padding: "7px 16px", fontFamily: font, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Choose Photo</button>
                    </div>
                    <input ref={schedRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) setSchedFileName(f.name); }} />
                  </div>
                </div>

                {/* Print summary */}
                <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Print Summary</div>
                  <div style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>
                    Based on current submissions, <strong style={{ color: C.text }}>{printSheetCount}</strong> attendance sheets will be generated. Empty activities will be skipped.
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Move camper modal ── */}
      {movingCamper && (
        <div onClick={e => { if (e.target === e.currentTarget) setMovingCamper(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: C.white, borderRadius: 16, width: 380, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", fontFamily: font }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Move {moveCamperName}</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>Currently in Group {groups[movingCamper.gi]?.name}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>Move to group</div>
            <select value={moveTarget} onChange={e => setMoveTarget(Number(e.target.value))} style={{ width: "100%", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontFamily: font, fontSize: 13, fontWeight: 600, color: C.text, outline: "none", marginBottom: 16, cursor: "pointer" }}>
              {groups.map((g, i) => i !== movingCamper.gi && (
                <option key={g.name} value={i}>Group {g.name} ({g.counselor})</option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setMovingCamper(null)} style={{ background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "8px 16px", fontFamily: font, fontSize: 13, fontWeight: 700, color: C.muted, cursor: "pointer" }}>Cancel</button>
              <button onClick={confirmMove} style={{ background: C.sage, border: "none", borderRadius: 8, padding: "8px 16px", fontFamily: font, fontSize: 13, fontWeight: 700, color: "white", cursor: "pointer" }}>Move Camper</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
