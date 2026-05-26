"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  bg:       "#F4F6F3", white:    "#FFFFFF",
  text:     "#1A2318", muted:    "#7A8A76", border:   "#DDE5DA",
  sage:     "#7A9E75", sageDk:   "#4A6E45", sageLt:   "#EAF2E8",
  green:    "#22C55E", greenLt:  "#DCFCE7", greenDk:  "#15803D",
  yellow:   "#F59E0B", yellowLt: "#FEF3C7", yellowDk: "#92400E",
  red:      "#EF4444", redLt:    "#FEE2E2", redDk:    "#991B1B",
  blue:     "#3B82F6", blueLt:   "#DBEAFE",
  purple:   "#8B5CF6", purpleLt: "#EDE9FE",
  grey:     "#F3F4F6", greyBd:   "#D1D5DB", greyTx:   "#6B7280",
};
const font = "var(--font-figtree), Figtree, sans-serif";

// ── Constants ─────────────────────────────────────────────────────────────────

const PERIODS = [
  { label: "Period 1", time: "1:00–1:45 PM",  endMins: 825 },
  { label: "Period 2", time: "1:50–2:35 PM",  endMins: 875 },
  { label: "Period 3", time: "2:40–3:25 PM",  endMins: 925 },
];
const EXTRA_LOCS = ["Nurse", "With Brass"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function nowMins() { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); }
function detectPeriod(): 1 | 2 | 3 { const m = nowMins(); return m >= 880 ? 3 : m >= 830 ? 2 : 1; }
function periodEnded(p: 1 | 2 | 3) { return nowMins() > PERIODS[p - 1].endMins; }
function fmtTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Activity  = { id: string; name: string; abbreviation: string };
type Camper    = { id: string; firstName: string; lastName: string; groupName: string; choiceP1: string; choiceP2: string; choiceP3: string };
type AttRec    = { id: string; camperId: string; activityId: string; period: number; status: string; location: string | null; loggedBy: string | null; loggedAt: string | null };
type LocateCtx = { camper: Camper; expectedActivityId: string | null };

type ActivityStats = {
  activity:   Activity;
  expected:   Camper[];
  checkedIn:  Camper[];
  elsewhere:  { camper: Camper; location: string }[];
  pickup:     Camper[];
  missing:    Camper[];
  unexpected: Camper[];
  cardStatus: "none" | "grey" | "inprogress" | "complete" | "alert";
};

type FeedEvent = {
  id:           string;
  type:         "checkin" | "elsewhere" | "pickup" | "unexpected" | "missing";
  camperName:   string;
  groupName:    string;
  activityName: string;
  detail:       string;
  loggedAt:     string | null;
  period:       number;
  dismissible:  boolean;
};

// ── DB row types ──────────────────────────────────────────────────────────────

type DBActivity = { id: string; name: string; abbreviation: string };
type DBCamper   = { id: string; first_name: string; last_name: string; group_id: string; absent: boolean; choice_p1: string | null; choice_p2: string | null; choice_p3: string | null; groups: { name: string } | null };
type DBAttRec   = { id: string; camper_id: string; activity_id: string; period: number; status: string; location: string | null; logged_by: string | null; logged_at: string | null };

// ── Account-For Modal ─────────────────────────────────────────────────────────

function AccountForModal({
  ctx, activities, onConfirm, onClose,
}: {
  ctx:        LocateCtx;
  activities: Activity[];
  onConfirm:  (location: string, isPickup: boolean) => Promise<void>;
  onClose:    () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [pickup,   setPickup]   = useState(false);
  const [saving,   setSaving]   = useState(false);

  async function confirm() {
    if (!pickup && !selected) return;
    setSaving(true);
    await onConfirm(selected ?? "", pickup);
    onClose();
  }

  const btnBase: React.CSSProperties = {
    border: "none", borderRadius: 8, padding: "8px 12px", fontFamily: font,
    fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.12s", textAlign: "center",
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div style={{ background: C.white, borderRadius: 16, width: 520, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.22)", fontFamily: font }}>
        <div style={{ padding: "22px 24px 0" }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: C.text, marginBottom: 2 }}>Account For Camper</div>
          <div style={{ fontSize: 13, color: C.muted, fontWeight: 500, marginBottom: 18 }}>
            {ctx.camper.lastName}, {ctx.camper.firstName} · Group {ctx.camper.groupName}
          </div>

          {/* Activity buttons */}
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>
            Activity Location
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 14 }}>
            {activities.map(a => {
              const sel = selected === a.name && !pickup;
              return (
                <button key={a.id} onClick={() => { setSelected(a.name); setPickup(false); }}
                  style={{ ...btnBase, background: sel ? C.sageDk : C.grey, color: sel ? "white" : C.text }}>
                  {a.name}
                </button>
              );
            })}
          </div>

          {/* Extra locations */}
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>
            Other Location
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {EXTRA_LOCS.map(loc => {
              const sel = selected === loc && !pickup;
              return (
                <button key={loc} onClick={() => { setSelected(loc); setPickup(false); }}
                  style={{ ...btnBase, background: sel ? C.sageDk : C.grey, color: sel ? "white" : C.text, flex: 1 }}>
                  {loc}
                </button>
              );
            })}
          </div>

          {/* Pickup */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginBottom: 20 }}>
            <button
              onClick={() => { setPickup(p => !p); setSelected(null); }}
              style={{ ...btnBase, background: pickup ? C.purple : C.purpleLt, color: pickup ? "white" : C.purple, width: "100%", padding: "10px 12px", fontSize: 13 }}
            >
              {pickup ? "✓ Early Pickup selected" : "Early Pickup"}
            </button>
          </div>
        </div>

        <div style={{ padding: "0 24px 22px", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose}
            style={{ ...btnBase, background: C.grey, color: C.muted, padding: "10px 20px" }}>
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={saving || (!pickup && !selected)}
            style={{ ...btnBase, background: C.sageDk, color: "white", padding: "10px 24px", opacity: saving || (!pickup && !selected) ? 0.5 : 1 }}>
            {saving ? "Saving…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Activity Card ─────────────────────────────────────────────────────────────

function ActivityCard({
  stats, period, isExpanded, onToggle, onLocate, onPickup, onEditSchedule, cardRef,
}: {
  stats:           ActivityStats;
  period:          1 | 2 | 3;
  isExpanded:      boolean;
  onToggle:        () => void;
  onLocate:        (camper: Camper) => void;
  onPickup:        (camper: Camper) => void;
  onEditSchedule:  (camper: Camper) => void;
  cardRef:         (el: HTMLDivElement | null) => void;
}) {
  const { activity, expected, checkedIn, elsewhere, pickup, missing, unexpected, cardStatus } = stats;

  const dotColor =
    cardStatus === "complete"   ? C.green  :
    cardStatus === "alert"      ? C.red    :
    cardStatus === "inprogress" ? C.yellow :
    C.greyBd;

  const accounted = checkedIn.length + elsewhere.length + pickup.length;

  return (
    <div
      ref={cardRef}
      style={{
        background: C.white, border: `1.5px solid ${isExpanded ? C.sageDk : C.border}`,
        borderRadius: 12, overflow: "hidden",
        boxShadow: isExpanded ? `0 0 0 2px ${C.sageLt}` : "none",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
    >
      {/* Card header */}
      <button
        onClick={onToggle}
        style={{
          width: "100%", textAlign: "left", border: "none", background: "transparent",
          padding: "12px 14px", cursor: "pointer", fontFamily: font, display: "block",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, marginTop: 5, flexShrink: 0, boxShadow: cardStatus !== "none" && cardStatus !== "grey" ? `0 0 6px ${dotColor}` : "none" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text, lineHeight: 1.2 }}>{activity.name}</div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginTop: 2 }}>
              {expected.length === 0 ? "No signups" : `${accounted}/${expected.length} accounted`}
            </div>
          </div>
        </div>

        {expected.length > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            <StatChip val={checkedIn.length} label="in" color={C.green} bg={C.greenLt} />
            {missing.length > 0 && <StatChip val={missing.length} label="missing" color={C.red} bg={C.redLt} />}
            {elsewhere.length > 0 && <StatChip val={elsewhere.length} label="elsewhere" color={C.greyTx} bg={C.grey} />}
            {pickup.length > 0 && <StatChip val={pickup.length} label="pickup" color={C.purple} bg={C.purpleLt} />}
            {unexpected.length > 0 && <StatChip val={unexpected.length} label="unexp." color={C.blue} bg={C.blueLt} />}
          </div>
        )}
      </button>

      {/* Expanded camper list */}
      {isExpanded && expected.length > 0 && (
        <div style={{ borderTop: `1px solid ${C.border}` }}>
          {/* Expected campers */}
          {[
            ...checkedIn.map(c  => ({ camper: c, type: "checkin"  as const, detail: "" })),
            ...elsewhere.map(e  => ({ camper: e.camper, type: "elsewhere" as const, detail: e.location })),
            ...pickup.map(c     => ({ camper: c, type: "pickup"   as const, detail: "" })),
            ...missing.map(c    => ({ camper: c, type: "missing"  as const, detail: "" })),
          ].sort((a, b) => a.camper.lastName.localeCompare(b.camper.lastName))
           .map(({ camper, type, detail }, i, arr) => {
            const isLast = i === arr.length - 1 && unexpected.length === 0;
            const rowBg =
              type === "checkin"   ? C.greenLt :
              type === "missing"   ? C.redLt   :
              type === "elsewhere" ? C.grey     :
              type === "pickup"    ? C.purpleLt : C.white;
            const txColor =
              type === "checkin"   ? C.greenDk :
              type === "missing"   ? C.redDk   :
              type === "elsewhere" ? C.greyTx  :
              type === "pickup"    ? C.purple   : C.text;
            return (
              <div key={camper.id} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                background: rowBg, borderBottom: isLast ? "none" : `1px solid ${C.border}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: txColor }}>
                    {camper.lastName}, {camper.firstName}
                  </span>
                  <span style={{ fontSize: 11, color: C.muted, fontWeight: 500, marginLeft: 6 }}>Gr.{camper.groupName}</span>
                  {detail && <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginLeft: 6 }}>→ {detail}</span>}
                </div>
                {type === "missing" && (
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <MiniBtn label="Edit" color={C.sage} onClick={() => onEditSchedule(camper)} />
                    <MiniBtn label="Locate" color={C.yellow} onClick={() => onLocate(camper)} />
                    <MiniBtn label="Pickup" color={C.purple} onClick={() => onPickup(camper)} />
                  </div>
                )}
                {type === "checkin" && (
                  <span style={{ fontSize: 10, fontWeight: 800, color: C.greenDk }}>✓</span>
                )}
                {type === "elsewhere" && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: C.greyTx }}>→</span>
                )}
                {type === "pickup" && (
                  <span style={{ fontSize: 10, fontWeight: 800, color: C.purple }}>↑</span>
                )}
              </div>
            );
          })}

          {/* Unexpected arrivals */}
          {unexpected.map((camper, i) => (
            <div key={`unexp-${camper.id}`} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
              background: C.blueLt, borderBottom: i < unexpected.length - 1 ? `1px solid ${C.border}` : "none",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.blue }}>
                  {camper.lastName}, {camper.firstName}
                </span>
                <span style={{ fontSize: 11, color: C.muted, fontWeight: 500, marginLeft: 6 }}>Gr.{camper.groupName}</span>
              </div>
              <span style={{ fontSize: 10, fontWeight: 800, color: C.blue, background: C.blueLt, border: `1px solid ${C.blue}`, borderRadius: 99, padding: "1px 6px" }}>
                unexpected
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Empty period for this activity */}
      {isExpanded && expected.length === 0 && (
        <div style={{ padding: "12px 14px", borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.muted, fontWeight: 500 }}>
          No campers signed up for {PERIODS[period - 1].label}
        </div>
      )}
    </div>
  );
}

function StatChip({ val, label, color, bg }: { val: number; label: string; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 800, color, background: bg, borderRadius: 99, padding: "2px 7px" }}>
      {val} {label}
    </span>
  );
}

function MiniBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      style={{
        border: `1px solid ${color}`, borderRadius: 6, padding: "2px 8px",
        fontFamily: font, fontSize: 10, fontWeight: 800, color, background: "white",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LiveAttendancePage() {
  const supabase = useMemo(() => createClient(), []);

  const [activities,   setActivities]   = useState<Activity[]>([]);
  const [campers,      setCampers]      = useState<Camper[]>([]);
  const [attendance,   setAttendance]   = useState<AttRec[]>([]);
  const [loading,      setLoading]      = useState(true);

  const [period,        setPeriod]        = useState<1 | 2 | 3>(() => detectPeriod());
  const [expandedAct,   setExpandedAct]   = useState<string | null>(null);
  const [rightTab,      setRightTab]      = useState<"feed" | "changes" | "unaccounted">("feed");
  const [showAll,          setShowAll]          = useState(false);
  const [locateCtx,        setLocateCtx]        = useState<LocateCtx | null>(null);
  const [editCamper,       setEditCamper]       = useState<Camper | null>(null);
  const [editChoices,      setEditChoices]      = useState<[string, string, string]>(["", "", ""]);
  const [dismissed,        setDismissed]        = useState<Set<string>>(new Set());
  const [searchQuery,      setSearchQuery]      = useState("");
  const [searchFocused,    setSearchFocused]    = useState(false);
  const [periodManuallySet,setPeriodManuallySet] = useState(false);
  const searchRef  = useRef<HTMLInputElement>(null);
  const cardRefs   = useRef<Map<string, HTMLDivElement>>(new Map());
  // Stable refs so callbacks don't re-create on every camper/activity state change
  const campersRef    = useRef<Camper[]>([]);
  const activitiesRef = useRef<Activity[]>([]);
  useEffect(() => { campersRef.current    = campers;    }, [campers]);
  useEffect(() => { activitiesRef.current = activities; }, [activities]);

  // ── Load helpers ──────────────────────────────────────────────────────────
  const mapAttRec = (r: DBAttRec): AttRec => ({
    id: r.id, camperId: r.camper_id, activityId: r.activity_id,
    period: r.period, status: r.status, location: r.location,
    loggedBy: r.logged_by, loggedAt: r.logged_at,
  });

  const fetchAttendance = useCallback(async (): Promise<AttRec[]> => {
    const { data } = await supabase
      .from("attendance")
      .select("id, camper_id, activity_id, period, status, location, logged_by, logged_at")
      .order("logged_at", { ascending: false });
    return (data as DBAttRec[] | null ?? []).map(mapAttRec);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // Write missing flags for ended periods; auto-clear when camper is now accounted for
  const syncMissingFlags = useCallback(async (freshAtt: AttRec[]) => {
    const cs = campersRef.current;
    const as_ = activitiesRef.current;
    if (!cs.length || !as_.length) return;

    let didWrite = false;

    for (let p = 1; p <= 3; p++) {
      const pNum = p as 1 | 2 | 3;
      if (!periodEnded(pNum)) continue;

      const pKey  = `choiceP${p}` as "choiceP1" | "choiceP2" | "choiceP3";
      const pAtt  = freshAtt.filter(r => r.period === p);
      // Campers with a real (non-missing) record
      const realIds    = new Set(pAtt.filter(r => r.status !== "missing").map(r => r.camperId));
      // Existing missing records: camperId → recordId
      const missingRec = new Map(pAtt.filter(r => r.status === "missing").map(r => [r.camperId, r.id]));

      // 1. Auto-clear missing records for campers who are now accounted for
      const toClear = [...missingRec.entries()].filter(([cid]) => realIds.has(cid));
      for (const [, recId] of toClear) {
        await supabase.from("attendance").delete().eq("id", recId);
        didWrite = true;
      }

      // 2. Insert missing flags for newly missing campers
      const expected = cs.filter(c => c[pKey]);
      const toFlag   = expected.filter(c => !realIds.has(c.id) && !missingRec.has(c.id));
      if (toFlag.length > 0) {
        const inserts = toFlag
          .map(c => ({
            camper_id:   c.id,
            activity_id: as_.find(a => a.name === c[pKey])?.id ?? null,
            period:      p,
            status:      "missing",
            logged_at:   new Date().toISOString(),
            logged_by:   "system",
          }))
          .filter(r => r.activity_id);
        if (inserts.length > 0) {
          await supabase.from("attendance").insert(inserts);
          didWrite = true;
        }
      }
    }
    return didWrite;
  }, [supabase]);

  const refreshAndSync = useCallback(async () => {
    const freshAtt = await fetchAttendance();
    setAttendance(freshAtt);
    const wrote = await syncMissingFlags(freshAtt);
    // Re-fetch only when missing flags were written/cleared so new records appear
    if (wrote) {
      const updatedAtt = await fetchAttendance();
      setAttendance(updatedAtt);
    }
  }, [fetchAttendance, syncMissingFlags]);

  useEffect(() => {
    async function init() {
      const [aRes, cRes] = await Promise.all([
        supabase.from("activities").select("id, name, abbreviation").order("name"),
        supabase.from("campers")
          .select("id, first_name, last_name, group_id, absent, choice_p1, choice_p2, choice_p3, groups(name)")
          .eq("absent", false).order("last_name"),
      ]);
      if (aRes.data) {
        setActivities((aRes.data as DBActivity[]).map(a => ({ id: a.id, name: a.name, abbreviation: a.abbreviation })));
      }
      if (cRes.data) {
        setCampers((cRes.data as unknown as DBCamper[]).map(c => ({
          id: c.id, firstName: c.first_name, lastName: c.last_name,
          groupName: c.groups?.name ?? "",
          choiceP1: c.choice_p1 ?? "", choiceP2: c.choice_p2 ?? "", choiceP3: c.choice_p3 ?? "",
        })));
      }
      await refreshAndSync();
      setLoading(false);
    }
    init();
  // refreshAndSync is stable once campers/activities are loaded; init runs once
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // 10-second attendance refresh + missing-flag sync
  useEffect(() => {
    const t = setInterval(refreshAndSync, 10_000);
    return () => clearInterval(t);
  }, [refreshAndSync]);

  // 1-minute period auto-detection
  useEffect(() => {
    const t = setInterval(() => {
      if (!periodManuallySet) setPeriod(detectPeriod());
    }, 60_000);
    return () => clearInterval(t);
  }, [periodManuallySet]);

  // ── Derived: per-activity stats ───────────────────────────────────────────
  const actMap    = useMemo(() => new Map(activities.map(a => [a.id, a])),  [activities]);
  const camperMap = useMemo(() => new Map(campers.map(c => [c.id, c])),      [campers]);

  const choiceKey = useMemo(
    () => `choiceP${period}` as "choiceP1" | "choiceP2" | "choiceP3",
    [period]
  );

  const periodAtt = useMemo(
    () => attendance.filter(r => r.period === period),
    [attendance, period]
  );

  const stats = useMemo<ActivityStats[]>(() => {
    const ended = periodEnded(period);
    return activities.map(activity => {
      const expected  = campers.filter(c => c[choiceKey] === activity.name);
      const expIdSet  = new Set(expected.map(c => c.id));
      const expRecs   = periodAtt.filter(r => expIdSet.has(r.camperId));
      const hereRecs  = periodAtt.filter(r => r.activityId === activity.id);

      const checkedIn: Camper[]                          = [];
      const elsewhere: { camper: Camper; location: string }[] = [];
      const pickup:    Camper[]                          = [];
      const doneIds = new Set<string>();

      for (const camper of expected) {
        const recs    = expRecs.filter(r => r.camperId === camper.id);
        if (!recs.length) continue;
        const pRec    = recs.find(r => r.status === "pickup");
        if (pRec)  { pickup.push(camper);   doneIds.add(camper.id); continue; }
        const ciRec   = recs.find(r => r.status === "checkedin" && r.activityId === activity.id);
        if (ciRec) { checkedIn.push(camper); doneIds.add(camper.id); continue; }
        const elCi    = recs.find(r => r.status === "checkedin" && r.activityId !== activity.id);
        if (elCi)  {
          elsewhere.push({ camper, location: actMap.get(elCi.activityId)?.name ?? "Elsewhere" });
          doneIds.add(camper.id); continue;
        }
        const elRec   = recs.find(r => r.status === "elsewhere");
        if (elRec) {
          elsewhere.push({ camper, location: elRec.location ?? "Elsewhere" });
          doneIds.add(camper.id); continue;
        }
      }

      const missing    = expected.filter(c => !doneIds.has(c.id));
      const unexpected = hereRecs
        .filter(r => r.status === "checkedin" && !expIdSet.has(r.camperId))
        .map(r => camperMap.get(r.camperId))
        .filter(Boolean) as Camper[];

      const accounted   = checkedIn.length + elsewhere.length + pickup.length;
      const anyAction   = accounted > 0;
      const allDone     = expected.length > 0 && accounted >= expected.length;

      let cardStatus: ActivityStats["cardStatus"];
      if (expected.length === 0) cardStatus = "none";
      else if (!anyAction)       cardStatus = "grey";
      else if (allDone)          cardStatus = "complete";
      else if (ended && missing.length > 0) cardStatus = "alert";
      else                       cardStatus = "inprogress";

      return { activity, expected, checkedIn, elsewhere, pickup, missing, unexpected, cardStatus };
    });
  }, [activities, campers, periodAtt, choiceKey, actMap, camperMap, period]);

  // ── Derived: unaccounted ──────────────────────────────────────────────────
  const unaccounted = useMemo<Camper[]>(() => {
    // Exclude "missing" records — those campers are still unaccounted for
    const accountedIds = new Set(
      periodAtt.filter(r => r.status !== "missing").map(r => r.camperId)
    );
    return campers
      .filter(c => c[choiceKey] && !accountedIds.has(c.id))
      .sort((a, b) => a.lastName.localeCompare(b.lastName));
  }, [campers, periodAtt, choiceKey]);

  // Auto-snap back to feed when unaccounted hits zero
  useEffect(() => {
    if (rightTab === "unaccounted" && unaccounted.length === 0) setRightTab("feed");
  }, [unaccounted.length, rightTab]);

  // ── Derived: feed events ──────────────────────────────────────────────────
  const feedEvents = useMemo<FeedEvent[]>(() => {
    const events: FeedEvent[] = [];
    for (const r of attendance) {
      const camper  = camperMap.get(r.camperId);
      const actName = actMap.get(r.activityId)?.name ?? "Unknown";
      const name    = camper ? `${camper.lastName}, ${camper.firstName}` : "Unknown";
      const group   = camper?.groupName ?? "";
      // Missing flags come from DB records written by syncMissingFlags
      if (r.status === "missing") {
        if (!dismissed.has(r.id)) {
          events.push({ id: r.id, type: "missing", camperName: name, groupName: group, activityName: actName, detail: "not accounted for", loggedAt: r.loggedAt, period: r.period, dismissible: true });
        }
      } else if (r.loggedBy === "counselor_unexpected") {
        events.push({ id: r.id, type: "unexpected", camperName: name, groupName: group, activityName: actName, detail: "unexpected arrival", loggedAt: r.loggedAt, period: r.period, dismissible: false });
      } else if (r.status === "pickup") {
        events.push({ id: r.id, type: "pickup", camperName: name, groupName: group, activityName: actName, detail: "early pickup", loggedAt: r.loggedAt, period: r.period, dismissible: false });
      } else if (r.status === "elsewhere") {
        events.push({ id: r.id, type: "elsewhere", camperName: name, groupName: group, activityName: actName, detail: `→ ${r.location ?? "elsewhere"}`, loggedAt: r.loggedAt, period: r.period, dismissible: false });
      } else if (r.status === "checkedin") {
        events.push({ id: r.id, type: "checkin", camperName: name, groupName: group, activityName: actName, detail: "checked in", loggedAt: r.loggedAt, period: r.period, dismissible: false });
      }
    }
    return events.sort((a, b) => {
      if (!a.loggedAt && !b.loggedAt) return 0;
      if (!a.loggedAt) return -1;
      if (!b.loggedAt) return 1;
      return new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime();
    });
  }, [attendance, actMap, camperMap, dismissed]);

  const checkInsCount = useMemo(
    () => periodAtt.filter(r => r.status === "checkedin").length,
    [periodAtt]
  );

  // Changes tab: all non-checkin events across all periods
  const changesEvents = useMemo<FeedEvent[]>(
    () => feedEvents.filter(e => e.type !== "checkin" && e.type !== "missing"),
    [feedEvents]
  );

  // Visible feed (exceptions by default, all if showAll)
  const visibleFeed = useMemo(
    () => showAll ? feedEvents.filter(e => e.type !== "missing" || !dismissed.has(e.id))
                  : feedEvents.filter(e => e.type !== "checkin"),
    [feedEvents, showAll, dismissed]
  );

  // ── Search ────────────────────────────────────────────────────────────────
  type SearchHit = { camper: Camper; status: string; location: string; expectedActivity: string };
  const searchHits = useMemo<SearchHit[]>(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return campers
      .filter(c =>
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        `${c.lastName} ${c.firstName}`.toLowerCase().includes(q)
      )
      .map(camper => {
        const expectedActivity = camper[choiceKey];
        const rec = periodAtt.find(r => r.camperId === camper.id && r.status !== "missing");
        let status = "missing", location = expectedActivity || "—";
        if (rec) {
          status   = rec.status;
          location = rec.status === "checkedin" ? (actMap.get(rec.activityId)?.name ?? location)
                   : rec.status === "elsewhere" ? (rec.location ?? location)
                   : rec.status === "pickup"    ? "Picked up"
                   : location;
        }
        return { camper, status, location, expectedActivity: expectedActivity || "—" };
      })
      .slice(0, 8);
  }, [searchQuery, campers, choiceKey, periodAtt, actMap]);

  // ── Actions ───────────────────────────────────────────────────────────────
  async function handleLocateConfirm(location: string, isPickup: boolean) {
    if (!locateCtx) return;
    const { camper, expectedActivityId } = locateCtx;
    const actId = expectedActivityId ?? activities[0]?.id ?? "";
    // Clear existing records for this camper+period
    const existing = periodAtt.filter(r => r.camperId === camper.id);
    for (const r of existing) {
      await supabase.from("attendance").delete().eq("id", r.id);
    }
    await supabase.from("attendance").insert({
      camper_id:   camper.id,
      activity_id: actId,
      period,
      status:      isPickup ? "pickup" : "elsewhere",
      location:    isPickup ? null : location,
      logged_at:   new Date().toISOString(),
      logged_by:   "leadership",
    });
    await refreshAndSync();
  }

  async function directPickup(camper: Camper) {
    const actId = activities.find(a => a.name === camper[choiceKey])?.id ?? activities[0]?.id ?? "";
    const existing = periodAtt.filter(r => r.camperId === camper.id);
    for (const r of existing) {
      await supabase.from("attendance").delete().eq("id", r.id);
    }
    await supabase.from("attendance").insert({
      camper_id: camper.id, activity_id: actId, period,
      status: "pickup", logged_at: new Date().toISOString(), logged_by: "leadership",
    });
    await refreshAndSync();
  }

  function openEditCamper(camper: Camper) {
    setEditCamper(camper);
    setEditChoices([camper.choiceP1, camper.choiceP2, camper.choiceP3]);
  }

  async function saveEditCamper() {
    if (!editCamper) return;
    const [p1, p2, p3] = editChoices;
    setCampers(prev => prev.map(c => c.id !== editCamper.id ? c : {
      ...c, choiceP1: p1, choiceP2: p2, choiceP3: p3,
    }));
    await supabase.from("campers").update({
      choice_p1: p1 || null,
      choice_p2: p2 || null,
      choice_p3: p3 || null,
    }).eq("id", editCamper.id);
    setEditCamper(null);
    refreshAndSync();
  }

  function openLocate(camperOrCtx: Camper | LocateCtx) {
    if ("expectedActivityId" in camperOrCtx) {
      setLocateCtx(camperOrCtx);
    } else {
      const actId = activities.find(a => a.name === camperOrCtx[choiceKey])?.id ?? null;
      setLocateCtx({ camper: camperOrCtx, expectedActivityId: actId });
    }
  }

  function jumpToActivity(actName: string) {
    const act = activities.find(a => a.name === actName);
    if (!act) return;
    setExpandedAct(act.id);
    setTimeout(() => {
      const el = cardRefs.current.get(act.id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
    setSearchQuery("");
    setSearchFocused(false);
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, fontFamily: font, color: C.muted, fontSize: 14, fontWeight: 600 }}>
        Loading…
      </div>
    );
  }

  const currentPeriodDetected = detectPeriod();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: C.bg, fontFamily: font }}>

      {/* ── Attendance top bar ── */}
      <div style={{ background: C.sageDk, padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, borderBottom: `1px solid rgba(255,255,255,0.1)` }}>
        <span style={{ fontSize: 13, fontWeight: 900, color: "white", opacity: 0.9, marginRight: 4 }}>Live Attendance</span>

        {/* Period switcher */}
        <div style={{ display: "flex", gap: 4, background: "rgba(0,0,0,0.2)", borderRadius: 8, padding: 3 }}>
          {([1, 2, 3] as const).map(p => (
            <button key={p} onClick={() => { setPeriod(p); setPeriodManuallySet(true); }} style={{
              border: "none", borderRadius: 6, padding: "4px 14px", fontFamily: font,
              fontSize: 12, fontWeight: 800, cursor: "pointer", position: "relative",
              background: period === p ? C.white : "transparent",
              color:      period === p ? C.sageDk : "rgba(255,255,255,0.7)",
              transition: "all 0.15s",
            }}>
              P{p}
              {currentPeriodDetected === p && (
                <span style={{ position: "absolute", top: 3, right: 3, width: 5, height: 5, borderRadius: "50%", background: C.green, border: "1px solid white" }} />
              )}
            </button>
          ))}
        </div>

        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>{PERIODS[period - 1].time}</span>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Search bar */}
        <div style={{ position: "relative" }}>
          <div style={{
            background: "rgba(255,255,255,0.12)", border: `1px solid ${searchFocused ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)"}`,
            borderRadius: 8, display: "flex", alignItems: "center", gap: 8, padding: "6px 12px",
            transition: "border-color 0.15s", width: 240,
          }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
              <path d="M11 11l3 3" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search camper…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: font, fontSize: 12, fontWeight: 600, color: "white", minWidth: 0 }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} style={{ border: "none", background: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)", fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
            )}
          </div>

          {/* Search dropdown */}
          {searchHits.length > 0 && (searchFocused || !!searchQuery) && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", right: 0,
              background: C.white, border: `1.5px solid ${C.border}`,
              borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.16)", zIndex: 300,
              width: 340, overflow: "hidden",
            }}>
              {searchHits.map((hit, i) => {
                const statusColor =
                  hit.status === "checkedin"   ? C.green  :
                  hit.status === "elsewhere"   ? C.yellow :
                  hit.status === "pickup"      ? C.purple :
                  C.red;
                return (
                  <button key={hit.camper.id}
                    onMouseDown={() => jumpToActivity(hit.expectedActivity)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                      background: C.white, border: "none",
                      borderBottom: i < searchHits.length - 1 ? `1px solid ${C.border}` : "none",
                      cursor: "pointer", textAlign: "left", fontFamily: font,
                    }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                        {hit.camper.lastName}, {hit.camper.firstName}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>
                        Group {hit.camper.groupName} · Expected: {hit.expectedActivity}
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 800, color: statusColor, flexShrink: 0 }}>
                      {hit.status === "checkedin" ? "✓ In" : hit.status === "pickup" ? "↑ Pickup" : hit.location}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Split view ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── Left: activity grid ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 32px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {stats.map(s => (
              <ActivityCard
                key={s.activity.id}
                stats={s}
                period={period}
                isExpanded={expandedAct === s.activity.id}
                onToggle={() => setExpandedAct(prev => prev === s.activity.id ? null : s.activity.id)}
                onLocate={openLocate}
                onPickup={directPickup}
                onEditSchedule={openEditCamper}
                cardRef={el => {
                  if (el) cardRefs.current.set(s.activity.id, el);
                  else cardRefs.current.delete(s.activity.id);
                }}
              />
            ))}
          </div>
        </div>

        {/* ── Right: feed panel ── */}
        <div style={{
          width: 360, flexShrink: 0, borderLeft: `1.5px solid ${C.border}`,
          display: "flex", flexDirection: "column", overflow: "hidden", background: C.white,
        }}>

          {/* Panel header */}
          <div style={{ flexShrink: 0, padding: "12px 14px", borderBottom: `1px solid ${C.border}`, background: C.white }}>
            {/* Check-in counter */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                <span style={{ fontSize: 22, fontWeight: 900, color: C.text }}>{checkInsCount}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginLeft: 6 }}>check-ins · {PERIODS[period - 1].label}</span>
              </div>
              {rightTab === "feed" && (
                <button
                  onClick={() => setShowAll(s => !s)}
                  style={{
                    border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 10px",
                    fontFamily: font, fontSize: 10, fontWeight: 800, cursor: "pointer",
                    background: showAll ? C.sageDk : C.white,
                    color:      showAll ? "white"   : C.muted,
                  }}>
                  {showAll ? "Exceptions only" : "Show all"}
                </button>
              )}
            </div>

            {/* Tab buttons */}
            <div style={{ display: "flex", gap: 6 }}>
              {(["feed", "changes", "unaccounted"] as const).map(tab => {
                const label =
                  tab === "feed"         ? "Live Feed" :
                  tab === "changes"      ? "Changes" :
                  `Unaccounted ${unaccounted.length > 0 ? `(${unaccounted.length})` : ""}`;
                const isActive = rightTab === tab;
                const bg = tab === "unaccounted" && unaccounted.length > 0 && !isActive ? C.redLt : undefined;
                return (
                  <button key={tab} onClick={() => setRightTab(tab)} style={{
                    border: "none", borderRadius: 6, padding: "5px 10px", fontFamily: font,
                    fontSize: 11, fontWeight: 800, cursor: "pointer",
                    background: isActive ? C.sageDk : (bg ?? C.grey),
                    color:      isActive ? "white"   : (tab === "unaccounted" && unaccounted.length > 0 && !isActive ? C.red : C.muted),
                    transition: "all 0.15s",
                  }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Panel content */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {rightTab === "feed" && <FeedTab events={visibleFeed} onDismiss={id => setDismissed(prev => new Set(prev).add(id))} />}
            {rightTab === "changes" && <FeedTab events={changesEvents} onDismiss={() => {}} />}
            {rightTab === "unaccounted" && (
              <UnaccountedTab
                campers={unaccounted}
                activities={activities}
                choiceKey={choiceKey}
                onLocate={openLocate}
                onPickup={directPickup}
                onEditSchedule={openEditCamper}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Account For modal ── */}
      {locateCtx && (
        <AccountForModal
          ctx={locateCtx}
          activities={activities}
          onConfirm={handleLocateConfirm}
          onClose={() => setLocateCtx(null)}
        />
      )}

      {/* ── Edit schedule modal ── */}
      {editCamper && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setEditCamper(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div style={{ background: C.white, borderRadius: 16, width: 420, boxShadow: "0 24px 64px rgba(0,0,0,0.22)", fontFamily: font }}>
            <div style={{ padding: "22px 24px 0" }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: C.text, marginBottom: 2 }}>Edit Schedule</div>
              <div style={{ fontSize: 13, color: C.muted, fontWeight: 500, marginBottom: 20 }}>
                {editCamper.lastName}, {editCamper.firstName} · Group {editCamper.groupName}
              </div>
              {(["Period 1", "Period 2", "Period 3"] as const).map((label, pi) => (
                <div key={pi} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: 6 }}>{label}</div>
                  <select
                    value={editChoices[pi]}
                    onChange={e => { const v = e.target.value; setEditChoices(prev => prev.map((c, i) => i === pi ? v : c) as [string, string, string]); }}
                    style={{ width: "100%", background: C.grey, border: `1.5px solid ${C.greyBd}`, borderRadius: 8, padding: "10px 12px", fontFamily: font, fontSize: 13, fontWeight: 600, color: C.text, outline: "none", cursor: "pointer" }}
                  >
                    <option value="">— No choice —</option>
                    {activities.map(a => (
                      <option key={a.id} value={a.name}>{a.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div style={{ padding: "12px 24px 22px", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setEditCamper(null)}
                style={{ border: "none", borderRadius: 8, padding: "10px 20px", fontFamily: font, fontSize: 12, fontWeight: 700, cursor: "pointer", background: C.grey, color: C.greyTx }}>
                Cancel
              </button>
              <button onClick={saveEditCamper}
                style={{ border: "none", borderRadius: 8, padding: "10px 24px", fontFamily: font, fontSize: 12, fontWeight: 700, cursor: "pointer", background: C.sageDk, color: "white" }}>
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Feed tab ──────────────────────────────────────────────────────────────────

function FeedTab({
  events, onDismiss,
}: {
  events:    FeedEvent[];
  onDismiss: (id: string) => void;
}) {
  if (events.length === 0) {
    return (
      <div style={{ padding: "32px 16px", textAlign: "center", color: C.muted, fontSize: 13, fontWeight: 600 }}>
        No events yet
      </div>
    );
  }
  return (
    <div>
      {events.map(ev => {
        const borderColor =
          ev.type === "missing"     ? C.red    :
          ev.type === "pickup"      ? C.purple :
          ev.type === "elsewhere"   ? C.yellow :
          ev.type === "unexpected"  ? C.blue   :
          C.green;
        const bgColor =
          ev.type === "missing"     ? C.redLt    :
          ev.type === "pickup"      ? C.purpleLt :
          ev.type === "elsewhere"   ? C.yellowLt :
          ev.type === "unexpected"  ? C.blueLt   :
          C.greenLt;
        return (
          <div key={ev.id} style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            padding: "10px 14px", borderBottom: `1px solid ${C.border}`,
            background: bgColor, borderLeft: `3px solid ${borderColor}`,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{ev.camperName}</div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 500, marginTop: 1 }}>
                Gr.{ev.groupName} · {ev.activityName} P{ev.period} · {ev.detail}
              </div>
              {ev.loggedAt && (
                <div style={{ fontSize: 10, color: C.muted, fontWeight: 500, marginTop: 2 }}>{fmtTime(ev.loggedAt)}</div>
              )}
            </div>
            {ev.dismissible && (
              <button onClick={() => onDismiss(ev.id)} style={{ border: "none", background: "none", cursor: "pointer", color: C.muted, fontSize: 16, padding: 0, flexShrink: 0, lineHeight: 1 }}>×</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Unaccounted tab ───────────────────────────────────────────────────────────

function UnaccountedTab({
  campers, activities, choiceKey, onLocate, onPickup, onEditSchedule,
}: {
  campers:         Camper[];
  activities:      Activity[];
  choiceKey:       "choiceP1" | "choiceP2" | "choiceP3";
  onLocate:        (camper: Camper) => void;
  onPickup:        (camper: Camper) => void;
  onEditSchedule:  (camper: Camper) => void;
}) {
  if (campers.length === 0) {
    return (
      <div style={{ padding: "32px 16px", textAlign: "center" }}>
        <div style={{ fontSize: 20, marginBottom: 8 }}>✓</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.greenDk }}>All campers accounted for</div>
      </div>
    );
  }
  return (
    <div>
      {campers.map((camper, i) => {
        const expAct = camper[choiceKey];
        const actId  = activities.find(a => a.name === expAct)?.id ?? null;
        return (
          <div key={camper.id} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
            borderBottom: i < campers.length - 1 ? `1px solid ${C.border}` : "none",
            background: C.white,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
                {camper.lastName}, {camper.firstName}
              </div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 500, marginTop: 1 }}>
                Gr.{camper.groupName} · {expAct || "No choice"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              <MiniBtn label="Edit" color={C.sage} onClick={() => onEditSchedule(camper)} />
              <MiniBtn label="Locate" color={C.yellow}  onClick={() => onLocate(camper)} />
              <MiniBtn label="Pickup" color={C.purple}  onClick={() => onPickup(camper)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
