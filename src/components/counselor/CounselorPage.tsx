"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadActiveSession, getPeriodLabel, getPeriodCount, type ActiveSession } from "@/lib/session";

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  sage: "#7A9E75", sageDk: "#4A6E45", sageLt: "#EAF2E8",
  cream: "#FAF7F2", sand: "#F0EAE0",
  text: "#2C3529", muted: "#8A9487",
  white: "#FFFFFF", border: "#DDE5DB",
  absBg: "#F3E8FF", absBd: "#C084FC", absTx: "#7E22CE",
  p1Bg: "#E8F5E4", p1Bd: "#9DC894", p1Tx: "#3A6635",
  p2Bg: "#FEF4E2", p2Bd: "#F0C06A", p2Tx: "#8A5E10",
  p3Bg: "#FCE8E8", p3Bd: "#EAA0A0", p3Tx: "#8A3535",
};

const PERIOD_C = [
  { bg: C.p1Bg, bd: C.p1Bd, tx: C.p1Tx },
  { bg: C.p2Bg, bd: C.p2Bd, tx: C.p2Tx },
  { bg: C.p3Bg, bd: C.p3Bd, tx: C.p3Tx },
  { bg: "#E0F2FE", bd: "#7DD3FC", tx: "#0369A1" },
  { bg: "#FDF4FF", bd: "#E879F9", tx: "#86198F" },
];

const font = "var(--font-figtree), Figtree, sans-serif";

// ── Types ─────────────────────────────────────────────────────────────────────

type Choices = string[];

type GroupRow = {
  id: string;
  name: string;
  counselor_name: string | null;
  submitted: boolean;
};

type ActivityRow = {
  id: string;
  name: string;
  abbreviation: string;
  open_p1: boolean;
  open_p2: boolean;
  open_p3: boolean;
  capacity_p1: number | null;
  capacity_p2: number | null;
  capacity_p3: number | null;
};

type SignupCounts = Record<string, [number, number, number]>;

type CamperState = {
  id: string;
  displayName: string;
  choices: Choices;
  absent: boolean;
};

// ── Style helpers ─────────────────────────────────────────────────────────────

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

const hbtn = (active: boolean): React.CSSProperties => ({
  background: active ? C.sageDk : C.sageLt,
  color: active ? C.white : C.sageDk,
  border: "none", borderRadius: 20,
  padding: "6px 11px",
  fontFamily: font, fontSize: 11, fontWeight: 700, cursor: "pointer",
  whiteSpace: "nowrap" as const,
});

// ── Component ─────────────────────────────────────────────────────────────────

export default function CounselorPage({ group }: { group: string }) {
  const supabase = useMemo(() => createClient(), []);
  const today = new Date().toISOString().split("T")[0];

  // ── Async state
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState<string | null>(null);
  const [groupRow, setGroupRow]     = useState<GroupRow | null>(null);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [scheduleUrl, setScheduleUrl] = useState<string | null>(null);
  const [session, setSession]       = useState<ActiveSession | null>(null);

  // ── UI state
  const [camperData, setCamperData]       = useState<CamperState[]>([]);
  const [camperIdx, setCamperIdx]         = useState(0);
  const [editingSlot, setEditingSlot]     = useState<number | null>(null);
  const [view, setView]                   = useState<"entry" | "overview">("entry");
  const [counselorName, setCounselorName] = useState("");
  const [showNameOverlay, setShowNameOverlay] = useState(false);
  const [isNameEdit, setIsNameEdit]       = useState(false);
  const [nameInput, setNameInput]         = useState("");
  const [showSchedule, setShowSchedule]   = useState(false);
  const [submitted, setSubmitted]         = useState(false);
  const [signupCounts, setSignupCounts]   = useState<SignupCounts>({});
  const [animateKey, setAnimateKey]       = useState(0);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // ── Session-derived period info ───────────────────────────────────────────
  const periodCount  = getPeriodCount(session);
  const periodLabels = useMemo(
    () => Array.from({ length: periodCount }, (_, i) => getPeriodLabel(session, i)),
    [session, periodCount]
  );

  // ── Abbreviation map from DB activities
  const abbrevMap = useMemo(
    () => Object.fromEntries(activities.map(a => [a.name, a.abbreviation])),
    [activities]
  );
  function abbrev(act: string) { return abbrevMap[act] ?? act; }

  // ── Initial load ──────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      // DIAGNOSTIC — remove after confirming env vars reach the browser
      console.log("[CounselorPage] NEXT_PUBLIC_SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
      console.log("[CounselorPage] NEXT_PUBLIC_SUPABASE_ANON_KEY defined:", !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "length:", (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").length);

      try {
        // 1. Load group by name
        const { data: grp, error: grpErr } = await supabase
          .from("groups")
          .select("id, name, counselor_name, submitted")
          .eq("name", group)
          .single();
        if (grpErr) throw new Error(grpErr.message ?? `Group "${group}" not found`);
        if (!grp) throw new Error(`Group "${group}" not found`);
        setGroupRow(grp);

        // If already submitted, jump straight to success
        if (grp.submitted) { setSubmitted(true); setLoading(false); return; }

        if (grp.counselor_name) setCounselorName(grp.counselor_name);

        // 2. Load active session
        const sess = await loadActiveSession(supabase);
        setSession(sess);
        const pc = sess?.period_count ?? 3;

        // 3. Load campers for this group
        const { data: campers, error: campErr } = await supabase
          .from("campers")
          .select("id, first_name, last_name, absent, choice_p1, choice_p2, choice_p3, choice_p4, choice_p5")
          .eq("group_id", grp.id)
          .order("last_name");
        if (campErr) throw new Error(campErr.message ?? "Failed to load campers");
        setCamperData((campers ?? []).map(c => ({
          id: c.id,
          displayName: `${c.first_name} ${c.last_name}`,
          choices: [
            c.choice_p1 ?? "", c.choice_p2 ?? "", c.choice_p3 ?? "",
            c.choice_p4 ?? "", c.choice_p5 ?? "",
          ].slice(0, pc) as Choices,
          absent: c.absent,
        })));

        // 4. Load activities (filter by session if active)
        let actsQuery = supabase
          .from("activities")
          .select("id, name, abbreviation, open_p1, open_p2, open_p3, capacity_p1, capacity_p2, capacity_p3")
          .eq("is_active", true);
        if (sess) {
          actsQuery = actsQuery.eq("session_id", sess.id);
        } else {
          actsQuery = actsQuery.is("session_id", null);
        }
        const { data: acts, error: actsErr } = await actsQuery;
        if (actsErr) throw new Error(actsErr.message ?? "Failed to load activities");
        setActivities(acts ?? []);

        // 5. Load signup counts + schedule image in parallel
        await refreshCounts();

        const { data: settings } = await supabase
          .from("settings")
          .select("schedule_image_url")
          .limit(1)
          .maybeSingle();
        setScheduleUrl(settings?.schedule_image_url ?? null);

        // 6. Check daily_log — if no entry for today, show name prompt
        const { data: logEntry } = await supabase
          .from("daily_log")
          .select("id")
          .eq("group_id", grp.id)
          .eq("date", today)
          .limit(1)
          .maybeSingle();
        if (!logEntry) {
          setIsNameEdit(false);
          setShowNameOverlay(true);
        }

        setLoading(false);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Failed to load data");
        setLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group]);

  useEffect(() => {
    if (showNameOverlay) setTimeout(() => nameInputRef.current?.focus(), 100);
  }, [showNameOverlay]);

  // ── Save counselor name ───────────────────────────────────────────────────

  async function saveName() {
    const val = nameInput.trim();
    if (!val || !groupRow) return;

    setCounselorName(val);
    setShowNameOverlay(false);
    setNameInput("");

    // Update groups.counselor_name
    await supabase.from("groups").update({ counselor_name: val }).eq("id", groupRow.id);

    // Write daily_log record
    await supabase.from("daily_log").insert({
      group_id: groupRow.id,
      counselor_name: val,
      date: today,
      action: isNameEdit ? "edited" : "submitted",
      logged_at: new Date().toISOString(),
    });

    setIsNameEdit(true); // subsequent saves from pencil are edits
  }

  function openNamePrompt() {
    setIsNameEdit(true);
    setNameInput(counselorName);
    setShowNameOverlay(true);
  }

  // ── Signup counts (real-time capacity enforcement) ────────────────────────

  async function refreshCounts() {
    const { data } = await supabase
      .from("campers")
      .select("choice_p1, choice_p2, choice_p3")
      .eq("absent", false);
    if (!data) return;
    const counts: SignupCounts = {};
    for (const row of data as { choice_p1: string | null; choice_p2: string | null; choice_p3: string | null }[]) {
      [row.choice_p1, row.choice_p2, row.choice_p3].forEach((act, pi) => {
        if (act) {
          if (!counts[act]) counts[act] = [0, 0, 0];
          counts[act][pi]++;
        }
      });
    }
    setSignupCounts(counts);
  }

  // Poll counts every 10 s so this group sees other groups' selections
  useEffect(() => {
    const t = setInterval(refreshCounts, 10_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Camper actions ────────────────────────────────────────────────────────

  const d = camperData[camperIdx];

  function currentChoiceIdx(): number {
    if (editingSlot !== null) return editingSlot;
    if (!d || d.absent) return -1;
    for (let i = 0; i < periodCount; i++) if (!d.choices[i]) return i;
    return periodCount;
  }

  const ci         = d ? currentChoiceIdx() : -1;
  const canAdvance = d ? (d.absent || d.choices.slice(0, periodCount).every(v => v)) : false;
  const allDone    = camperData.length > 0 && camperData.every(c => c.absent || c.choices.slice(0, periodCount).every(v => v));

  function patchCamper(idx: number, patch: Partial<CamperState>) {
    setCamperData(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));

    // Persist to DB immediately
    if (groupRow) {
      const updated = { ...camperData[idx], ...patch };
      supabase.from("campers").update({
        absent:    updated.absent,
        choice_p1: updated.choices[0] || null,
        choice_p2: updated.choices[1] || null,
        choice_p3: updated.choices[2] || null,
        choice_p4: updated.choices[3] || null,
        choice_p5: updated.choices[4] || null,
      }).eq("id", updated.id).then(({ error }) => {
        if (error) console.error("Camper save failed:", error.message);
      });
    }
  }

  function bumpCounts(oldAct: string | null, newAct: string | null, slot: number) {
    setSignupCounts(prev => {
      const next = { ...prev };
      if (oldAct) {
        const c = next[oldAct] ? ([...next[oldAct]] as [number, number, number]) : [0, 0, 0] as [number, number, number];
        c[slot] = Math.max(0, c[slot] - 1);
        next[oldAct] = c;
      }
      if (newAct) {
        const c = next[newAct] ? ([...next[newAct]] as [number, number, number]) : [0, 0, 0] as [number, number, number];
        c[slot] = c[slot] + 1;
        next[newAct] = c;
      }
      return next;
    });
  }

  function selectActivity(actName: string) {
    if (!d || d.absent) return;
    const slot = editingSlot ?? ci;
    if (slot < 0 || slot >= periodCount) return;
    const oldAct = d.choices[slot] || null;
    patchCamper(camperIdx, {
      choices: d.choices.map((v, j) => j === slot ? actName : v) as Choices,
    });
    bumpCounts(oldAct, actName, slot);
    if (editingSlot !== null) setEditingSlot(null);
  }

  function clearSlot(i: number) {
    if (!d) return;
    const oldAct = d.choices[i] || null;
    patchCamper(camperIdx, { choices: d.choices.map((v, j) => j === i ? "" : v) as Choices });
    if (oldAct) bumpCounts(oldAct, null, i);
  }

  function editSlot(i: number) {
    if (!d || d.absent) return;
    setEditingSlot(prev => prev === i ? null : i);
  }

  function toggleAbsent() {
    if (!d) return;
    patchCamper(camperIdx, d.absent
      ? { absent: false }
      : { absent: true, choices: Array.from({ length: periodCount }, () => "") as Choices }
    );
    setEditingSlot(null);
  }

  function navigate(to: number) {
    setEditingSlot(null);
    setCamperIdx(to);
    setAnimateKey(k => k + 1);
  }

  function goBack() { if (camperIdx > 0) navigate(camperIdx - 1); }

  function goNext() {
    if (allDone) { doSubmit(); return; }
    for (let c = camperIdx + 1; c < camperData.length; c++) {
      if (!camperData[c].absent && !camperData[c].choices.every(v => v)) { navigate(c); return; }
    }
    for (let c = 0; c < camperIdx; c++) {
      if (!camperData[c].absent && !camperData[c].choices.every(v => v)) { navigate(c); return; }
    }
  }

  async function doSubmit() {
    if (!groupRow) return;
    await supabase
      .from("groups")
      .update({ submitted: true, submitted_at: new Date().toISOString() })
      .eq("id", groupRow.id);
    setSubmitted(true);
    // Fire-and-forget; server checks auto_sync flag before writing
    fetch("/api/google/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auto: true }),
    }).catch(() => {});
  }

  // Slot-state helpers for the currently active period
  function activeSlot(): number { return editingSlot ?? ci; }

  function isClosedForActiveSlot(act: ActivityRow): boolean {
    if (!d || d.absent) return false;
    const slot = activeSlot();
    if (slot === 0) return !act.open_p1;
    if (slot === 1) return !act.open_p2;
    if (slot === 2) return !act.open_p3;
    return false; // periods 4-5: no closed flag, always open
  }

  function isFullForActiveSlot(act: ActivityRow): boolean {
    const slot = activeSlot();
    if (slot < 0 || slot >= 3) return false;
    const cap = [act.capacity_p1, act.capacity_p2, act.capacity_p3][slot];
    if (cap === null || cap === undefined) return false;
    return (signupCounts[act.name]?.[slot] ?? 0) >= cap;
  }

  // ── Loading / error ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: C.cream, fontFamily: font }}>
        <div style={{ color: C.muted, fontWeight: 600, fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.cream, fontFamily: font, textAlign: "center", padding: "40px 28px" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: C.text }}>Something went wrong</div>
        <div style={{ fontSize: 13, color: C.muted }}>{loadError}</div>
      </div>
    );
  }

  // ── Success screen ────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.cream, fontFamily: font, color: C.text, textAlign: "center", padding: "40px 28px" }}>
        <div style={{ fontSize: 56, marginBottom: 14 }}>🌿</div>
        <div style={{ fontSize: 26, fontWeight: 900, marginBottom: 8 }}>Submitted!</div>
        <div style={{ fontSize: 14, color: C.muted, fontWeight: 600, lineHeight: 1.7 }}>
          {group}&apos;s choices are in.<br />Leadership has been notified.
        </div>
      </div>
    );
  }

  if (camperData.length === 0) {
    return (
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.cream, fontFamily: font, textAlign: "center", padding: "40px 28px" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>👤</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: C.text }}>No campers in {group}</div>
        <div style={{ fontSize: 13, color: C.muted }}>Add campers in the Leadership settings.</div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden", background: C.cream, fontFamily: font, color: C.text, userSelect: "none" }}>

      {/* ── Name overlay ── */}
      {showNameOverlay && (
        <div style={{ position: "fixed", inset: 0, background: C.cream, zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 28px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👋</div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.3px", marginBottom: 6 }}>What&apos;s your name?</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.muted, marginBottom: 24, lineHeight: 1.5 }}>
            This will be saved as today&apos;s counselor<br />for {group}
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
          {scheduleUrl
            ? <img src={scheduleUrl} alt="Today's schedule" style={{ maxWidth: "92vw", maxHeight: "82vh", borderRadius: 12, objectFit: "contain" }} />
            : (
              <div style={{ width: "80vw", height: "50vh", background: C.white, borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: C.muted }}>
                <div style={{ fontSize: 40 }}>📋</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Schedule not uploaded yet</div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>Leadership will upload today&apos;s schedule here</div>
              </div>
            )
          }
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ background: C.white, borderBottom: `1.5px solid ${C.border}`, padding: "10px 14px 8px", flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>
            {group}&nbsp;·&nbsp;{counselorName || "—"}
            <button onClick={openNamePrompt} title="Edit name" style={{ background: "none", border: "none", fontSize: 11, cursor: "pointer", color: C.muted, padding: "2px 4px", borderRadius: 4, fontFamily: font, fontWeight: 600, display: "inline-flex", alignItems: "center", verticalAlign: "middle", marginLeft: 4 }}>✏</button>
          </div>
          <div style={{ display: "flex", gap: 3 }}>
            {camperData.map((cd, i) => {
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
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.3px", lineHeight: 1, flex: 1 }}>{d.displayName}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>{camperIdx + 1} of {camperData.length}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: d.absent ? C.absTx : C.sageDk, background: d.absent ? C.absBg : C.sageLt, padding: "4px 9px", borderRadius: 20, whiteSpace: "nowrap" }}>
              {d.absent ? "Marked absent" : ci < periodCount ? `Tap ${periodLabels[ci]}` : "All done ✓"}
            </div>
          </div>

          {/* Activity grid */}
          <div
            key={animateKey}
            style={{ flex: 1, padding: "6px 12px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: `repeat(${Math.ceil(activities.length / 3)}, 1fr)`, gap: 7, overflow: "hidden", animation: "fadeUp 0.18s ease" }}
          >
            {activities.map((act, idx) => {
              const selPeriods = d.choices.map((v, pi) => v === act.name ? pi : -1).filter(pi => pi !== -1);
              const slot       = activeSlot();
              const closedSlot = isClosedForActiveSlot(act);
              const isFull     = !d.absent && isFullForActiveSlot(act);
              const alreadyInSlot = selPeriods.includes(slot);
              const isDisabled = d.absent || (closedSlot && selPeriods.length === 0) || (isFull && !alreadyInSlot);
              const lastTwo    = activities.length % 3 === 2;
              const gridStyle: React.CSSProperties = {};
              if (lastTwo && idx === activities.length - 2) gridStyle.gridColumn = 1;
              if (lastTwo && idx === activities.length - 1) gridStyle.gridColumn = 2;

              return (
                <button
                  key={act.id}
                  onClick={() => !isDisabled && selectActivity(act.name)}
                  style={{
                    ...gridStyle,
                    border: "2px solid", borderRadius: 12,
                    fontFamily: font, fontSize: 13, fontWeight: 700,
                    cursor: isDisabled ? "default" : "pointer",
                    opacity: isDisabled ? (isFull && !closedSlot ? 0.55 : 0.35) : 1,
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    textAlign: "center", padding: "4px 6px", lineHeight: 1.2,
                    WebkitTapHighlightColor: "transparent",
                    transition: "all 0.1s",
                    ...actBtnStyle(selPeriods),
                  }}
                >
                  {act.name}
                  {selPeriods.length > 0 && (
                    <span style={{ fontSize: 9, fontWeight: 900, opacity: 0.7, display: "block", marginTop: 2 }}>
                      {selPeriods.map(i => periodLabels[i]?.replace("Period ", "P") ?? `P${i + 1}`).join(" ")}
                    </span>
                  )}
                  {isFull && !alreadyInSlot && (
                    <span style={{ fontSize: 8, fontWeight: 900, background: "rgba(0,0,0,0.08)", color: "inherit", padding: "1px 5px", borderRadius: 99, display: "block", marginTop: 2 }}>Full</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Scoreboard */}
          <div style={{ background: C.white, borderTop: `1.5px solid ${C.border}`, padding: "8px 12px 0", flexShrink: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${periodCount}, 1fr)`, gap: 7, marginBottom: 7 }}>
              {Array.from({ length: periodCount }, (_, i) => {
                const val       = d.choices[i];
                const isEditing = editingSlot === i;
                const isActive  = !d.absent && editingSlot === null && i === ci && !val;
                const pc        = PERIOD_C[i] ?? PERIOD_C[PERIOD_C.length - 1];

                let bg = C.sand, border = `1.5px dashed ${C.border}`, txPeriod = C.muted, txVal = C.muted;
                if (d.absent) {
                  bg = C.absBg; border = `1.5px solid ${C.absBd}`; txPeriod = txVal = C.absTx;
                } else if (val) {
                  bg = pc.bg; border = `1.5px solid ${pc.bd}`; txPeriod = txVal = pc.tx;
                }
                if (isEditing) border = `1.5px solid ${C.sageDk}`;
                else if (isActive) border = `1.5px solid ${C.sage}`;

                return (
                  <div
                    key={i}
                    onClick={() => !d.absent && editSlot(i)}
                    style={{ borderRadius: 10, padding: "7px 9px", border, background: bg, minHeight: 44, display: "flex", flexDirection: "column", justifyContent: "center", transition: "all 0.2s", position: "relative", cursor: d.absent ? "default" : "pointer", boxShadow: isEditing ? "0 0 0 3px rgba(74,110,69,0.25)" : isActive ? "0 0 0 3px rgba(122,158,117,0.15)" : "none", transform: isEditing ? "scale(1.03)" : "none" }}
                  >
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", color: txPeriod, marginBottom: 2 }}>{periodLabels[i]}</div>
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
          {camperData.map((cd, i) => {
            const complete = !cd.absent && cd.choices.every(v => v);
            const partial  = !cd.absent && cd.choices.some(v => v) && !complete;

            let tileBg = C.white, tileBd = C.border;
            let badgeBg = C.sand, badgeTx = C.muted, badgeLabel = "Not started";
            if (complete)  { tileBg = C.sageLt; tileBd = C.sage;  badgeBg = C.sageLt; badgeTx = C.sageDk; badgeLabel = "✓ Done"; }
            else if (cd.absent) { tileBg = C.absBg; tileBd = C.absBd; badgeBg = C.absBg; badgeTx = C.absTx; badgeLabel = "Absent"; }
            else if (partial)   { tileBg = C.p2Bg;  tileBd = C.p2Bd;  badgeBg = C.p2Bg;  badgeTx = C.p2Tx;  badgeLabel = "In progress"; }

            return (
              <div key={cd.id} onClick={() => { setCamperIdx(i); setView("entry"); setEditingSlot(null); }} style={{ background: tileBg, border: `1.5px solid ${tileBd}`, borderRadius: 14, padding: 12, cursor: "pointer" }}>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6, color: cd.absent ? C.absTx : C.text }}>{cd.displayName}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {Array.from({ length: periodCount }, (_, pi) => {
                    const pc = PERIOD_C[pi] ?? PERIOD_C[PERIOD_C.length - 1];
                    const shortLabel = periodLabels[pi]?.replace("Period ", "P") ?? `P${pi + 1}`;
                    return (
                      <div key={pi} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", width: 24, flexShrink: 0, color: pc.tx }}>{shortLabel}</span>
                        {cd.absent
                          ? <span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>Absent</span>
                          : cd.choices[pi]
                          ? <span style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{abbrev(cd.choices[pi])}</span>
                          : <span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>—</span>
                        }
                      </div>
                    );
                  })}
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
