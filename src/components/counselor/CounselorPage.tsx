"use client";

import { useState, useEffect, useRef } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────

const CAMPERS = [
  "Emma M.", "Jake L.", "Sofia R.", "Marcus T.", "Lily C.", "Deon W.",
];

const ACTIVITIES = [
  "Field", "Pool", "Arts & Crafts", "Pav", "Gaga",
  "Front Lawn", "Building", "Courts", "Chowderhouse",
  "Nature", "Archery", "Ropes", "Loch Lodge", "New Games",
];

const ABBREV: Record<string, string> = {
  "Field": "F", "Pool": "Pool", "Arts & Crafts": "A/C", "Pav": "Pav",
  "Gaga": "Gaga", "Front Lawn": "FL", "Building": "B", "Courts": "C",
  "Chowderhouse": "CH", "Nature": "N", "Archery": "Arch",
  "Ropes": "R", "Loch Lodge": "LL", "New Games": "NG",
};

const PERIOD_LABELS = ["Period 1", "Period 2", "Period 3"];

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  sage:    "#7A9E75", sageDk: "#4A6E45", sageLt: "#EAF2E8",
  cream:   "#FAF7F2", sand:   "#F0EAE0",
  text:    "#2C3529", muted:  "#8A9487",
  white:   "#FFFFFF", border: "#DDE5DB",
  absBg:   "#F3E8FF", absBd:  "#C084FC", absTx:  "#7E22CE",
  p1Bg: "#E8F5E4", p1Bd: "#9DC894", p1Tx: "#3A6635",
  p2Bg: "#FEF4E2", p2Bd: "#F0C06A", p2Tx: "#8A5E10",
  p3Bg: "#FCE8E8", p3Bd: "#EAA0A0", p3Tx: "#8A3535",
};

const PERIOD_C = [
  { bg: C.p1Bg, bd: C.p1Bd, tx: C.p1Tx },
  { bg: C.p2Bg, bd: C.p2Bd, tx: C.p2Tx },
  { bg: C.p3Bg, bd: C.p3Bd, tx: C.p3Tx },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type Choices = [string, string, string];
type CamperState = { choices: Choices; absent: boolean };

// ── Helpers ───────────────────────────────────────────────────────────────────

function abbrev(act: string) { return ABBREV[act] ?? act; }

function actBtnStyle(selPeriods: number[]): React.CSSProperties {
  if (selPeriods.length === 0)
    return { background: C.white, borderColor: C.border, color: C.text };
  if (selPeriods.length === 1) {
    const p = PERIOD_C[selPeriods[0]];
    return { background: p.bg, borderColor: p.bd, color: p.tx };
  }
  if (selPeriods.length === 2) {
    const [a, b] = selPeriods;
    return {
      background: `linear-gradient(to bottom, ${PERIOD_C[a].bg} 50%, ${PERIOD_C[b].bg} 50%)`,
      borderColor: PERIOD_C[a].bd, color: C.text,
    };
  }
  return {
    background: `linear-gradient(to bottom, ${C.p1Bg} 0% 33.3%, ${C.p2Bg} 33.3% 66.6%, ${C.p3Bg} 66.6% 100%)`,
    borderColor: C.p1Bd, color: C.text,
  };
}

const font = "var(--font-figtree), Figtree, sans-serif";

// ── Component ─────────────────────────────────────────────────────────────────

export default function CounselorPage({ group }: { group: string }) {
  const [camperData, setCamperData] = useState<CamperState[]>(
    () => CAMPERS.map(() => ({ choices: ["", "", ""] as Choices, absent: false }))
  );
  const [camperIdx, setCamperIdx]     = useState(0);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [view, setView]               = useState<"entry" | "overview">("entry");
  const [counselorName, setCounselorName] = useState("");
  const [showNameOverlay, setShowNameOverlay] = useState(false);
  const [nameInput, setNameInput]     = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [animateKey, setAnimateKey]   = useState(0);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const todayKey = `counselor_name_${new Date().toDateString()}_group${group}`;

  useEffect(() => {
    const saved = localStorage.getItem(todayKey);
    if (saved) setCounselorName(saved);
    else setShowNameOverlay(true);
  }, [todayKey]);

  useEffect(() => {
    if (showNameOverlay)
      setTimeout(() => nameInputRef.current?.focus(), 100);
  }, [showNameOverlay]);

  // ── Actions ───────────────────────────────────────────────────────────────

  function saveName() {
    const val = nameInput.trim();
    if (!val) return;
    localStorage.setItem(todayKey, val);
    setCounselorName(val);
    setShowNameOverlay(false);
    setNameInput("");
  }

  function openNamePrompt() {
    setNameInput(counselorName);
    setShowNameOverlay(true);
  }

  const d  = camperData[camperIdx];

  function currentChoiceIdx(): number {
    if (editingSlot !== null) return editingSlot;
    if (d.absent) return -1;
    for (let i = 0; i < 3; i++) if (!d.choices[i]) return i;
    return 3;
  }

  const ci          = currentChoiceIdx();
  const canAdvance  = d.absent || d.choices.every(v => v);
  const allDone     = CAMPERS.every((_, i) => camperData[i].absent || camperData[i].choices.every(v => v));

  function patchCamper(idx: number, patch: Partial<CamperState>) {
    setCamperData(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
  }

  function selectActivity(act: string) {
    if (d.absent) return;
    const slot = editingSlot ?? ci;
    if (slot < 0 || slot >= 3) return;
    patchCamper(camperIdx, {
      choices: d.choices.map((v, j) => j === slot ? act : v) as Choices,
    });
    if (editingSlot !== null) setEditingSlot(null);
  }

  function clearSlot(i: number) {
    patchCamper(camperIdx, {
      choices: d.choices.map((v, j) => j === i ? "" : v) as Choices,
    });
  }

  function editSlot(i: number) {
    if (d.absent) return;
    setEditingSlot(prev => prev === i ? null : i);
  }

  function toggleAbsent() {
    patchCamper(camperIdx, d.absent
      ? { absent: false }
      : { absent: true, choices: ["", "", ""] as Choices }
    );
    setEditingSlot(null);
  }

  function navigate(to: number) {
    setEditingSlot(null);
    setCamperIdx(to);
    setAnimateKey(k => k + 1);
  }

  function goBack() {
    if (camperIdx > 0) navigate(camperIdx - 1);
  }

  function goNext() {
    if (allDone) { setSubmitted(true); return; }
    for (let c = camperIdx + 1; c < CAMPERS.length; c++) {
      if (!camperData[c].absent && !camperData[c].choices.every(v => v)) { navigate(c); return; }
    }
    for (let c = 0; c < camperIdx; c++) {
      if (!camperData[c].absent && !camperData[c].choices.every(v => v)) { navigate(c); return; }
    }
  }

  // ── Shared styles ─────────────────────────────────────────────────────────

  const hbtn = (active: boolean): React.CSSProperties => ({
    background: active ? C.sageDk : C.sageLt,
    color: active ? C.white : C.sageDk,
    border: "none", borderRadius: 20,
    padding: "6px 11px",
    fontFamily: font, fontSize: 11, fontWeight: 700, cursor: "pointer",
    whiteSpace: "nowrap" as const,
  });

  // ── Submitted screen ─────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.cream, fontFamily: font, color: C.text, textAlign: "center", padding: "40px 28px" }}>
        <div style={{ fontSize: 56, marginBottom: 14 }}>🌿</div>
        <div style={{ fontSize: 26, fontWeight: 900, marginBottom: 8 }}>Submitted!</div>
        <div style={{ fontSize: 14, color: C.muted, fontWeight: 600, lineHeight: 1.7 }}>
          Group {group}&apos;s choices are in.<br />Leadership has been notified.
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden", background: C.cream, fontFamily: font, color: C.text, userSelect: "none" }}>

      {/* ── Name overlay ── */}
      {showNameOverlay && (
        <div style={{ position: "fixed", inset: 0, background: C.cream, zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 28px", textAlign: "center", fontFamily: font }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👋</div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.3px", marginBottom: 6 }}>What&apos;s your name?</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.muted, marginBottom: 24, lineHeight: 1.5 }}>
            This will be saved as today&apos;s counselor<br />for Group {group}
          </div>
          <input
            ref={nameInputRef}
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && nameInput.trim() && saveName()}
            placeholder="First name + last initial…"
            style={{ width: "100%", maxWidth: 340, background: C.white, border: `2px solid ${nameInput ? C.sage : C.border}`, borderRadius: 12, padding: "14px 16px", fontFamily: font, fontSize: 16, fontWeight: 700, color: C.text, outline: "none", textAlign: "center", marginBottom: 12, transition: "border-color 0.15s" }}
          />
          <button
            onClick={saveName}
            disabled={!nameInput.trim()}
            style={{ width: "100%", maxWidth: 340, background: C.sage, border: "none", borderRadius: 12, padding: 14, fontFamily: font, fontSize: 15, fontWeight: 800, color: C.white, cursor: nameInput.trim() ? "pointer" : "not-allowed", opacity: nameInput.trim() ? 1 : 0.3, transition: "opacity 0.15s" }}
          >Continue →</button>
        </div>
      )}

      {/* ── Schedule overlay ── */}
      {showSchedule && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowSchedule(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 400, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <button onClick={() => setShowSchedule(false)} style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 36, height: 36, fontSize: 18, color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          <div style={{ width: "80vw", height: "50vh", background: C.white, borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: C.muted }}>
            <div style={{ fontSize: 40 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Schedule not uploaded yet</div>
            <div style={{ fontSize: 12, fontWeight: 500 }}>Leadership will upload today&apos;s schedule here</div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ background: C.white, borderBottom: `1.5px solid ${C.border}`, padding: "10px 14px 8px", flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>
            Group {group}&nbsp;·&nbsp;{counselorName || "—"}
            <button onClick={openNamePrompt} title="Edit name" style={{ background: "none", border: "none", fontSize: 11, cursor: "pointer", color: C.muted, padding: "2px 4px", borderRadius: 4, fontFamily: font, fontWeight: 600, display: "inline-flex", alignItems: "center", verticalAlign: "middle", marginLeft: 4 }}>✏</button>
          </div>
          <div style={{ display: "flex", gap: 3 }}>
            {CAMPERS.map((_, i) => {
              const cd = camperData[i];
              let bg = C.border;
              if (view === "entry" && i === camperIdx) bg = C.sageDk;
              else if (cd.absent) bg = C.absBd;
              else if (cd.choices.every(v => v)) bg = C.sage;
              return <div key={i} style={{ height: 5, flex: 1, borderRadius: 99, background: bg, transition: "background 0.3s" }} />;
            })}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button onClick={() => setShowSchedule(true)} style={hbtn(false)}>📋</button>
          <button onClick={() => { setView("entry"); setEditingSlot(null); }} style={hbtn(view === "entry")}>Entry</button>
          <button onClick={() => setView("overview")} style={hbtn(view === "overview")}>Overview</button>
        </div>
      </div>

      {/* ── Entry View ── */}
      {view === "entry" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Camper row */}
          <div style={{ padding: "10px 14px 6px", flexShrink: 0, display: "flex", alignItems: "center", gap: 8, background: C.cream }}>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.3px", lineHeight: 1, flex: 1 }}>{CAMPERS[camperIdx]}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>{camperIdx + 1} of {CAMPERS.length}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: d.absent ? C.absTx : C.sageDk, background: d.absent ? C.absBg : C.sageLt, padding: "4px 9px", borderRadius: 20, whiteSpace: "nowrap" }}>
              {d.absent ? "Marked absent" : ["Tap Period 1", "Tap Period 2", "Tap Period 3", "All done ✓"][Math.min(ci, 3)]}
            </div>
          </div>

          {/* Activity grid */}
          <div
            key={animateKey}
            style={{ flex: 1, padding: "6px 12px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(5, 1fr)", gap: 7, overflow: "hidden", animation: "fadeUp 0.18s ease" }}
          >
            {ACTIVITIES.map((act, idx) => {
              const selPeriods = d.choices.map((v, pi) => v === act ? pi : -1).filter(pi => pi !== -1);
              return (
                <button
                  key={act}
                  onClick={() => selectActivity(act)}
                  style={{
                    ...(idx === 12 ? { gridColumn: 1 } : {}),
                    ...(idx === 13 ? { gridColumn: 2 } : {}),
                    border: "2px solid", borderRadius: 12,
                    fontFamily: font, fontSize: 13, fontWeight: 700,
                    cursor: d.absent ? "default" : "pointer",
                    opacity: d.absent ? 0.35 : 1,
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    textAlign: "center", padding: "4px 6px", lineHeight: 1.2,
                    WebkitTapHighlightColor: "transparent",
                    transition: "all 0.1s",
                    ...actBtnStyle(selPeriods),
                  }}
                >
                  {act}
                  {selPeriods.length > 0 && (
                    <span style={{ fontSize: 9, fontWeight: 900, opacity: 0.7, display: "block", marginTop: 2 }}>
                      {selPeriods.map(i => ["P1", "P2", "P3"][i]).join(" ")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Scoreboard */}
          <div style={{ background: C.white, borderTop: `1.5px solid ${C.border}`, padding: "8px 12px 0", flexShrink: 0 }}>

            {/* Slots */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginBottom: 7 }}>
              {[0, 1, 2].map(i => {
                const val      = d.choices[i];
                const isEditing = editingSlot === i;
                const isActive  = !d.absent && editingSlot === null && i === ci && !val;

                let bg = C.sand, border = `1.5px dashed ${C.border}`, txPeriod = C.muted, txVal = C.muted;
                if (d.absent) {
                  bg = C.absBg; border = `1.5px solid ${C.absBd}`; txPeriod = txVal = C.absTx;
                } else if (val) {
                  bg = PERIOD_C[i].bg; border = `1.5px solid ${PERIOD_C[i].bd}`; txPeriod = txVal = PERIOD_C[i].tx;
                }
                if (isEditing) border = `1.5px solid ${C.sageDk}`;
                else if (isActive) border = `1.5px solid ${C.sage}`;

                return (
                  <div
                    key={i}
                    onClick={() => !d.absent && editSlot(i)}
                    style={{ borderRadius: 10, padding: "7px 9px", border, background: bg, minHeight: 44, display: "flex", flexDirection: "column", justifyContent: "center", transition: "all 0.2s", position: "relative", cursor: d.absent ? "default" : "pointer", boxShadow: isEditing ? "0 0 0 3px rgba(74,110,69,0.25)" : isActive ? "0 0 0 3px rgba(122,158,117,0.15)" : "none", transform: isEditing ? "scale(1.03)" : "none" }}
                  >
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", color: txPeriod, marginBottom: 2 }}>{PERIOD_LABELS[i]}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: txVal, lineHeight: 1.2 }}>
                      {d.absent ? "Absent" : val || (isEditing ? "picking…" : "—")}
                    </div>
                    {val && !isEditing && !d.absent && (
                      <span onClick={e => { e.stopPropagation(); clearSlot(i); }} style={{ position: "absolute", top: 4, right: 6, fontSize: 11, color: C.muted, cursor: "pointer", fontWeight: 900, opacity: 0.6 }}>✕</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Nav row */}
            <div style={{ display: "flex", gap: 7, paddingBottom: 18 }}>
              <button onClick={goBack} disabled={camperIdx === 0} style={{ width: 44, height: 44, borderRadius: 11, background: C.cream, border: `1.5px solid ${C.border}`, fontSize: 16, cursor: camperIdx === 0 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, flexShrink: 0, opacity: camperIdx === 0 ? 0.3 : 1 }}>←</button>
              <button onClick={toggleAbsent} style={{ height: 44, borderRadius: 11, background: d.absent ? C.absBd : C.absBg, border: `1.5px solid ${C.absBd}`, fontFamily: font, fontSize: 13, fontWeight: 800, color: d.absent ? C.white : C.absTx, cursor: "pointer", padding: "0 14px", flexShrink: 0 }}>
                {d.absent ? "Undo Absent" : "Absent"}
              </button>
              <button onClick={goNext} disabled={!canAdvance} style={{ flex: 1, height: 44, borderRadius: 11, background: allDone ? C.sageDk : C.sage, border: "none", fontFamily: font, fontSize: 14, fontWeight: 800, color: C.white, cursor: canAdvance ? "pointer" : "not-allowed", opacity: canAdvance ? 1 : 0.3, transition: "opacity 0.12s" }}>
                {allDone ? "Submit ✓" : "Next →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Overview View ── */}
      {view === "overview" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignContent: "start" }}>
          {CAMPERS.map((name, i) => {
            const cd       = camperData[i];
            const complete = !cd.absent && cd.choices.every(v => v);
            const partial  = !cd.absent && cd.choices.some(v => v) && !complete;

            let tileBg = C.white, tileBd = C.border;
            let badgeBg = C.sand, badgeTx = C.muted, badgeLabel = "Not started";
            if (complete) { tileBg = C.sageLt; tileBd = C.sage; badgeBg = C.sageLt; badgeTx = C.sageDk; badgeLabel = "✓ Done"; }
            else if (cd.absent) { tileBg = C.absBg; tileBd = C.absBd; badgeBg = C.absBg; badgeTx = C.absTx; badgeLabel = "Absent"; }
            else if (partial) { tileBg = C.p2Bg; tileBd = C.p2Bd; badgeBg = C.p2Bg; badgeTx = C.p2Tx; badgeLabel = "In progress"; }

            return (
              <div key={i} onClick={() => { setCamperIdx(i); setView("entry"); setEditingSlot(null); }} style={{ background: tileBg, border: `1.5px solid ${tileBd}`, borderRadius: 14, padding: 12, cursor: "pointer" }}>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6, color: cd.absent ? C.absTx : C.text }}>{name}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {[0, 1, 2].map(pi => (
                    <div key={pi} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", width: 20, flexShrink: 0, color: [C.p1Tx, C.p2Tx, C.p3Tx][pi] }}>P{pi + 1}</span>
                      {cd.absent
                        ? <span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>Absent</span>
                        : cd.choices[pi]
                        ? <span style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{abbrev(cd.choices[pi])}</span>
                        : <span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>—</span>
                      }
                    </div>
                  ))}
                </div>
                <span style={{ display: "inline-block", marginTop: 6, fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 99, background: badgeBg, color: badgeTx }}>{badgeLabel}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
