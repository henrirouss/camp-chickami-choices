"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  bg:       "#F4F6F3", white:   "#FFFFFF",
  text:     "#1A2318", muted:   "#7A8A76", border: "#DDE5DA",
  sage:     "#7A9E75", sageDk:  "#4A6E45", sageLt: "#EAF2E8",
  green:    "#22C55E", greenLt: "#DCFCE7",
  red:      "#EF4444", redLt:   "#FEE2E2",
};
const font = "var(--font-figtree), Figtree, sans-serif";

// ── DB type ───────────────────────────────────────────────────────────────────

type Settings = {
  id:                 string;
  schedule_image_url: string | null;
  sync_peak_start:    string | null;
  sync_peak_end:      string | null;
  sync_fast_interval: number | null;
  sync_slow_interval: number | null;
  auto_sync:          boolean | null;
  two_col_cutoff:     number;
  show_next_picks:    boolean;
  show_sig_line:      boolean;
  paper_size:         string;
  sheets_url:         string | null;
  sort_order:         string | null;
  last_synced_at:     string | null;
  google_email:       string | null;
};

// ── Sub-components ────────────────────────────────────────────────────────────

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{ width: 40, height: 22, borderRadius: 99, border: "none", cursor: "pointer", position: "relative", background: on ? C.sage : "#D1D5DB", transition: "background 0.2s", flexShrink: 0 }}>
      <span style={{ position: "absolute", width: 16, height: 16, borderRadius: "50%", background: "white", top: 3, left: on ? 21 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", display: "block" }} />
    </button>
  );
}

function Card({ title, desc, danger, children }: { title: string; desc?: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ background: C.white, border: `1.5px solid ${danger ? "#FECACA" : C.border}`, borderRadius: 16, padding: "20px 24px", marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: danger ? C.red : C.text, marginBottom: desc ? 4 : 20 }}>{title}</div>
      {desc && <div style={{ fontSize: 12, color: C.muted, fontWeight: 500, marginBottom: 20, lineHeight: 1.5 }}>{desc}</div>}
      {children}
    </div>
  );
}

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "11px 0", borderBottom: `1px solid ${C.border}`, gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: C.muted, fontWeight: 500, marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LeadershipSettings() {
  const supabase = useMemo(() => createClient(), []);

  const [s,              setS]             = useState<Settings | null>(null);
  const [loading,        setLoading]       = useState(true);
  const [loadErr,        setLoadErr]       = useState<string | null>(null);
  const [confirm,        setConfirm]       = useState<"submissions" | "roster" | null>(null);
  const [csvMsg,         setCsvMsg]        = useState<string | null>(null);
  const [syncing,        setSyncing]       = useState(false);
  const [syncLog,        setSyncLog]       = useState<string[]>([]);
  const [connectedBanner,setConnectedBanner] = useState(false);

  const schedRef = useRef<HTMLInputElement>(null);
  const csvRef   = useRef<HTMLInputElement>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from("settings")
      .select("id, schedule_image_url, sync_peak_start, sync_peak_end, sync_fast_interval, sync_slow_interval, auto_sync, two_col_cutoff, show_next_picks, show_sig_line, paper_size, sheets_url, sort_order, last_synced_at, google_email")
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setLoadErr(error.message);
        if (data) setS(data as Settings);
        setLoading(false);
      });
  }, [supabase]);

  // ── Check for OAuth redirect ───────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.search.includes("connected=1")) {
      setConnectedBanner(true);
      window.history.replaceState({}, "", "/leadership/settings");
      setTimeout(() => setConnectedBanner(false), 4000);
    }
  }, []);

  // ── Save helper ───────────────────────────────────────────────────────────
  function save(updates: Partial<Settings>) {
    if (!s) return;
    setS(prev => prev ? { ...prev, ...updates } : prev);
    supabase.from("settings").update(updates as Record<string, unknown>).eq("id", s.id).then();
  }

  // ── Google Sheets helpers ─────────────────────────────────────────────────
  async function syncNow() {
    setSyncing(true);
    const started = Date.now();
    try {
      const res  = await fetch("/api/google/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json() as { success?: boolean; rows?: number; syncedAt?: string; error?: string };
      const secs = ((Date.now() - started) / 1000).toFixed(1);
      if (data.success) {
        setSyncLog(prev => [`[${new Date().toLocaleString()}] ✓ Synced ${data.rows} campers (${secs}s)`, ...prev]);
        setS(prev => prev ? { ...prev, last_synced_at: data.syncedAt ?? prev.last_synced_at } : prev);
      } else {
        setSyncLog(prev => [`[${new Date().toLocaleString()}] ✗ ${data.error ?? "Unknown error"}`, ...prev]);
      }
    } catch {
      setSyncLog(prev => [`[${new Date().toLocaleString()}] ✗ Network error`, ...prev]);
    } finally {
      setSyncing(false);
    }
  }

  async function disconnectGoogle() {
    await fetch("/api/google/disconnect", { method: "POST" });
    setS(prev => prev ? { ...prev, google_email: null } : prev);
    setSyncLog([]);
  }

  // ── Shared input/select styles ────────────────────────────────────────────
  const inp: React.CSSProperties = {
    background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 8,
    padding: "7px 12px", fontFamily: font, fontSize: 12, fontWeight: 600,
    color: C.text, outline: "none",
  };

  // ── Schedule photo ────────────────────────────────────────────────────────
  async function uploadSchedule(file: File) {
    const id  = s?.id;
    if (!id) return;
    const ext = file.name.split(".").pop() ?? "jpg";
    const { data, error } = await supabase.storage
      .from("schedules").upload(`schedule.${ext}`, file, { upsert: true });
    if (error) { alert("Upload failed: " + error.message); return; }
    const { data: { publicUrl } } = supabase.storage.from("schedules").getPublicUrl(data.path);
    save({ schedule_image_url: publicUrl });
  }

  // ── CSV helpers ───────────────────────────────────────────────────────────
  async function parseCsv(text: string) {
    function stripGroupPrefix(raw: string) { return raw.trim().replace(/^group\s+/i, "").trim(); }

    setCsvMsg(null);
    const lines = text.trim().split("\n").filter(l => l.trim());
    const hdr   = lines[0]?.toLowerCase() ?? "";
    if (!hdr.includes("first") || !hdr.includes("group")) {
      setCsvMsg("Unrecognized format — expected columns: first_name, last_name, group"); return;
    }
    const rows = lines.slice(1).map(line => {
      const [fn, ln, grp] = line.split(",").map(v => v.trim());
      return { fn, ln: ln ?? "", grp: stripGroupPrefix(grp ?? "") };
    }).filter(r => r.fn && r.grp);

    const { data: dbGroups } = await supabase.from("groups").select("id, name");
    // Case-insensitive lookup: lowercase → {id, name}
    const gLookup = new Map(
      (dbGroups as { id: string; name: string }[] | null ?? []).map(g => [g.name.toLowerCase(), { id: g.id, name: g.name }])
    );

    const missingNorms = [...new Set(rows.map(r => r.grp.toLowerCase()))].filter(n => !gLookup.has(n));
    if (missingNorms.length) {
      const canonicals = missingNorms.map(n => rows.find(r => r.grp.toLowerCase() === n)!.grp);
      const { data: newGs } = await supabase.from("groups").insert(canonicals.map(name => ({ name }))).select("id, name");
      (newGs as { id: string; name: string }[] | null)?.forEach(g => gLookup.set(g.name.toLowerCase(), { id: g.id, name: g.name }));
    }

    const allIds = [...gLookup.values()].map(g => g.id);
    if (allIds.length > 0) await supabase.from("campers").delete().in("group_id", allIds);

    const toInsert = rows
      .map(r => {
        const entry = gLookup.get(r.grp.toLowerCase());
        return entry ? { first_name: r.fn, last_name: r.ln, group_id: entry.id, absent: false } : null;
      })
      .filter(Boolean) as { first_name: string; last_name: string; group_id: string; absent: boolean }[];
    if (toInsert.length) await supabase.from("campers").insert(toInsert);

    const groupCount = new Set(rows.map(r => r.grp.toLowerCase())).size;
    setCsvMsg(`✓ Imported ${toInsert.length} campers across ${groupCount} groups`);
  }

  async function exportCsv() {
    const [{ data: groups }, { data: campers }] = await Promise.all([
      supabase.from("groups").select("id, name").order("name"),
      supabase.from("campers").select("first_name, last_name, group_id, absent, choice_p1, choice_p2, choice_p3"),
    ]);
    if (!groups || !campers) return;
    const gMap = new Map((groups as { id: string; name: string }[]).map(g => [g.id, g.name]));
    type C = { first_name: string; last_name: string; group_id: string; absent: boolean; choice_p1: string | null; choice_p2: string | null; choice_p3: string | null };
    const lines = [
      "first_name,last_name,group,absent,period_1,period_2,period_3",
      ...(campers as C[]).map(c =>
        `${c.first_name},${c.last_name},${gMap.get(c.group_id) ?? ""},${c.absent},${c.choice_p1 ?? ""},${c.choice_p2 ?? ""},${c.choice_p3 ?? ""}`
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: `camp-chickami-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Danger zone ───────────────────────────────────────────────────────────
  async function clearSubmissions() {
    await Promise.all([
      supabase.from("groups").update({ submitted: false, submitted_at: null }).not("id", "is", null),
      supabase.from("campers").update({ choice_p1: null, choice_p2: null, choice_p3: null }).not("id", "is", null),
    ]);
    setConfirm(null);
  }

  async function clearRoster() {
    await supabase.from("campers").delete().not("id", "is", null);
    setConfirm(null);
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font, color: C.muted, fontSize: 14, fontWeight: 600, background: C.bg }}>
        Loading…
      </div>
    );
  }

  if (loadErr || !s) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: font, color: C.muted, fontSize: 14, fontWeight: 600, background: C.bg, gap: 8 }}>
        <div style={{ color: C.red }}>Failed to load settings</div>
        {loadErr && <div style={{ fontSize: 12, color: C.muted, maxWidth: 400, textAlign: "center" }}>{loadErr}</div>}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, overflowY: "auto", background: C.bg, fontFamily: font, color: C.text }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "28px 32px 56px" }}>

        {/* Connected banner */}
        {connectedBanner && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.greenLt, border: `1.5px solid ${C.green}`, borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
            <span style={{ fontSize: 16 }}>✓</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#15803D" }}>Google Account connected — you can now sync to Sheets.</span>
          </div>
        )}

        {/* Page header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, color: C.text }}>Settings</h1>
          <p style={{ fontSize: 13, color: C.muted, margin: "4px 0 0", fontWeight: 500 }}>Configure sync, printing, and roster management · Changes save automatically</p>
        </div>

        {/* ── Google Sheets Sync ── */}
        <Card title="Google Sheets Sync" desc="Sync submitted choices to a Google Sheet for live reporting and attendance tracking.">

          {/* Connection status */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: C.bg, borderRadius: 10, marginBottom: 20, border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.google_email ? C.green : "#D1D5DB", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                  {s.google_email ? "Google Account Connected" : "Google Account"}
                </div>
                <div style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>
                  {s.google_email ?? "Not connected"}
                </div>
              </div>
            </div>
            {s.google_email ? (
              <button
                onClick={disconnectGoogle}
                style={{ background: C.redLt, border: `1.5px solid #FCA5A5`, borderRadius: 8, padding: "7px 16px", fontFamily: font, fontSize: 12, fontWeight: 700, color: C.red, cursor: "pointer" }}>
                Disconnect
              </button>
            ) : (
              <button
                onClick={() => { window.location.href = "/api/google/connect"; }}
                style={{ background: C.sageDk, border: "none", borderRadius: 8, padding: "7px 16px", fontFamily: font, fontSize: 12, fontWeight: 700, color: "white", cursor: "pointer" }}>
                Connect Google Account
              </button>
            )}
          </div>

          <Row label="Spreadsheet URL" sub="Paste the URL of your Google Sheet">
            <input
              type="url"
              defaultValue={s.sheets_url ?? ""}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              onBlur={e => save({ sheets_url: e.target.value.trim() || null })}
              style={{ ...inp, width: 300 }}
              onFocus={e => (e.target.style.borderColor = C.sage)}
            />
          </Row>

          <Row label="Auto-sync" sub="Automatically push data when a group submits">
            <Toggle on={s.auto_sync ?? false} onToggle={() => save({ auto_sync: !(s.auto_sync ?? false) })} />
          </Row>

          {/* Peak hours */}
          <div style={{ padding: "14px 0 4px" }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>Peak Hours (fast sync window)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "Start time", field: "sync_peak_start" as const, val: s.sync_peak_start },
                { label: "End time",   field: "sync_peak_end"   as const, val: s.sync_peak_end   },
              ].map(({ label, field, val }) => (
                <div key={field}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4 }}>{label}</div>
                  <input type="time" defaultValue={val?.slice(0, 5) ?? ""}
                    onBlur={e => save({ [field]: e.target.value || null })}
                    style={{ ...inp, width: "100%" }}
                    onFocus={e => (e.target.style.borderColor = C.sage)} />
                </div>
              ))}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4 }}>Fast interval</div>
                <select value={s.sync_fast_interval ?? 30} onChange={e => save({ sync_fast_interval: Number(e.target.value) })}
                  style={{ ...inp, width: "100%", cursor: "pointer" }}>
                  <option value={15}>15 seconds</option>
                  <option value={30}>30 seconds</option>
                  <option value={60}>1 minute</option>
                  <option value={120}>2 minutes</option>
                  <option value={300}>5 minutes</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4 }}>Slow interval</div>
                <select value={s.sync_slow_interval ?? 300} onChange={e => save({ sync_slow_interval: Number(e.target.value) })}
                  style={{ ...inp, width: "100%", cursor: "pointer" }}>
                  <option value={300}>5 minutes</option>
                  <option value={600}>10 minutes</option>
                  <option value={1800}>30 minutes</option>
                  <option value={3600}>1 hour</option>
                </select>
              </div>
            </div>
          </div>

          {/* Sync log */}
          <div style={{ marginTop: 18, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ background: C.bg, padding: "8px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted }}>Sync Log</span>
              <button
                onClick={syncNow}
                disabled={syncing || !s.google_email || !s.sheets_url}
                style={{ background: C.sage, border: "none", borderRadius: 6, padding: "4px 14px", fontFamily: font, fontSize: 11, fontWeight: 700, color: "white", cursor: (syncing || !s.google_email || !s.sheets_url) ? "not-allowed" : "pointer", opacity: (syncing || !s.google_email || !s.sheets_url) ? 0.5 : 1, transition: "opacity 0.15s" }}>
                {syncing ? "Syncing…" : "Sync Now"}
              </button>
            </div>
            <div style={{ padding: 14, background: "white", minHeight: 60, maxHeight: 160, overflowY: "auto", fontFamily: "monospace", fontSize: 11, color: C.muted, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
              {syncLog.length > 0
                ? syncLog.join("\n")
                : s.last_synced_at
                ? `[${new Date(s.last_synced_at).toLocaleString()}] Last sync completed`
                : "No sync history. Connect a Google Account to begin syncing."}
            </div>
          </div>
        </Card>

        {/* ── Schedule Photo ── */}
        <Card title="Today's Schedule" desc="Upload a photo of today's whiteboard schedule. Counselors can view it from the signup screen.">
          {s.schedule_image_url ? (
            <div>
              <img src={s.schedule_image_url} alt="Schedule" style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 10, border: `1.5px solid ${C.border}`, display: "block", marginBottom: 12 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => schedRef.current?.click()} style={{ background: C.sage, border: "none", borderRadius: 8, padding: "8px 16px", fontFamily: font, fontSize: 12, fontWeight: 700, color: "white", cursor: "pointer" }}>Replace Photo</button>
                <button onClick={() => save({ schedule_image_url: null })} style={{ background: C.redLt, border: `1.5px solid #FCA5A5`, borderRadius: 8, padding: "8px 16px", fontFamily: font, fontSize: 12, fontWeight: 700, color: C.red, cursor: "pointer" }}>Remove</button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => schedRef.current?.click()}
              style={{ border: `2px dashed ${C.border}`, borderRadius: 10, padding: "28px 20px", textAlign: "center", cursor: "pointer", background: C.bg, transition: "all 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.sage; (e.currentTarget as HTMLDivElement).style.background = C.sageLt; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.border; (e.currentTarget as HTMLDivElement).style.background = C.bg; }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>No schedule photo uploaded</div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>JPG, PNG, or HEIC — visible to all counselors</div>
              <button onClick={e => { e.stopPropagation(); schedRef.current?.click(); }} style={{ background: C.sage, border: "none", borderRadius: 8, padding: "8px 20px", fontFamily: font, fontSize: 12, fontWeight: 700, color: "white", cursor: "pointer" }}>Upload Photo</button>
            </div>
          )}
          <input ref={schedRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadSchedule(f); }} />
        </Card>

        {/* ── Print Settings ── */}
        <Card title="Print Settings" desc="Configure how attendance sheets are generated for printing.">
          <Row label="Two-column cutoff" sub="Switch to two columns when a group exceeds this many campers">
            <input type="number" min={1} max={200} value={s.two_col_cutoff}
              onChange={e => save({ two_col_cutoff: Number(e.target.value) })}
              style={{ ...inp, width: 72, textAlign: "center" }}
              onFocus={e => (e.target.style.borderColor = C.sage)}
              onBlur={e => (e.target.style.borderColor = C.border)} />
          </Row>
          <Row label="Show next-period picks" sub="Display upcoming choices on the printed sheet">
            <Toggle on={s.show_next_picks} onToggle={() => save({ show_next_picks: !s.show_next_picks })} />
          </Row>
          <Row label="Sort order" sub="How campers are ordered on printed sheets">
            <select value={s.sort_order ?? "last_name"} onChange={e => save({ sort_order: e.target.value })}
              style={{ ...inp, cursor: "pointer" }}>
              <option value="last_name">Last name A–Z</option>
              <option value="first_name">First name A–Z</option>
              <option value="default">Group default</option>
            </select>
          </Row>
          <Row label="Paper size">
            <select value={s.paper_size} onChange={e => save({ paper_size: e.target.value })}
              style={{ ...inp, cursor: "pointer" }}>
              <option value="letter">Letter (8.5 × 11)</option>
              <option value="a4">A4</option>
              <option value="legal">Legal (8.5 × 14)</option>
            </select>
          </Row>
          <div style={{ display: "flex", alignItems: "center", padding: "11px 0", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Signature line</div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 500, marginTop: 2 }}>Include a counselor signature line at the bottom</div>
            </div>
            <Toggle on={s.show_sig_line} onToggle={() => save({ show_sig_line: !s.show_sig_line })} />
          </div>
        </Card>

        {/* ── Roster & Data ── */}
        <Card title="Roster & Data" desc="Upload a new roster CSV or export current camper data.">

          {/* CSV upload */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>Upload Weekly Roster</div>
            <div
              onClick={() => csvRef.current?.click()}
              onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor = C.sageDk; (e.currentTarget as HTMLDivElement).style.background = C.sageLt; }}
              onDragLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.border; (e.currentTarget as HTMLDivElement).style.background = C.bg; }}
              onDrop={e => {
                e.preventDefault();
                (e.currentTarget as HTMLDivElement).style.borderColor = C.border;
                (e.currentTarget as HTMLDivElement).style.background = C.bg;
                const f = e.dataTransfer.files[0];
                if (f?.name.endsWith(".csv")) { const r = new FileReader(); r.onload = ev => parseCsv(ev.target!.result as string); r.readAsText(f); }
              }}
              style={{ border: `2px dashed ${C.border}`, borderRadius: 10, padding: "14px 18px", cursor: "pointer", background: C.bg, display: "flex", alignItems: "center", gap: 14, transition: "all 0.15s" }}>
              <div style={{ fontSize: 22, flexShrink: 0 }}>📄</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Drop CSV here or click to browse</div>
                <div style={{ fontSize: 11, color: C.muted }}>Columns: first_name, last_name, group — group can be &quot;Birch&quot; or &quot;Group Birch&quot;</div>
              </div>
              <button onClick={e => { e.stopPropagation(); csvRef.current?.click(); }}
                style={{ background: C.sage, border: "none", borderRadius: 8, padding: "7px 14px", fontFamily: font, fontSize: 11, fontWeight: 700, color: "white", cursor: "pointer", flexShrink: 0 }}>Browse</button>
            </div>
            <input ref={csvRef} type="file" accept=".csv" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = ev => parseCsv(ev.target!.result as string); r.readAsText(f); } }} />
            {csvMsg && (
              <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: csvMsg.startsWith("✓") ? C.sage : C.red }}>{csvMsg}</div>
            )}
          </div>

          {/* Export */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderTop: `1px solid ${C.border}` }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Export camper data</div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 500, marginTop: 2 }}>Download all campers with group assignments and choices as CSV</div>
            </div>
            <button onClick={exportCsv}
              style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "8px 16px", fontFamily: font, fontSize: 12, fontWeight: 700, color: C.text, cursor: "pointer", flexShrink: 0 }}>
              Export CSV ↓
            </button>
          </div>

          {/* Sync status */}
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "12px 0 0", borderTop: `1px solid ${C.border}` }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.last_synced_at ? C.green : "#D1D5DB", flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>
              {s.last_synced_at ? `Last synced: ${new Date(s.last_synced_at).toLocaleString()}` : "Not yet synced with Google Sheets"}
            </span>
          </div>
        </Card>

        {/* ── Danger Zone ── */}
        <Card title="Danger Zone" danger>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ border: `1.5px solid #FECACA`, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Clear All Submissions</div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 500, marginBottom: 14, lineHeight: 1.5 }}>
                Resets submitted status and clears all camper activity choices. The roster is preserved.
              </div>
              <button onClick={() => setConfirm("submissions")}
                style={{ background: C.redLt, border: `1px solid #FCA5A5`, borderRadius: 8, padding: "7px 14px", fontFamily: font, fontSize: 11, fontWeight: 700, color: C.red, cursor: "pointer" }}>
                Clear Submissions
              </button>
            </div>
            <div style={{ border: `1.5px solid #FECACA`, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Clear Entire Roster</div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 500, marginBottom: 14, lineHeight: 1.5 }}>
                Permanently deletes every camper from every group. Groups themselves will remain.
              </div>
              <button onClick={() => setConfirm("roster")}
                style={{ background: C.red, border: "none", borderRadius: 8, padding: "7px 14px", fontFamily: font, fontSize: 11, fontWeight: 700, color: "white", cursor: "pointer" }}>
                Delete All Campers
              </button>
            </div>
          </div>
        </Card>

      </div>

      {/* ── Confirm modal ── */}
      {confirm && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setConfirm(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: C.white, borderRadius: 16, width: 420, padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", fontFamily: font }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 10, color: C.text }}>
              {confirm === "submissions" ? "Clear All Submissions?" : "Delete Entire Roster?"}
            </div>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, margin: "0 0 24px" }}>
              {confirm === "submissions"
                ? "This will reset submitted=false for all 16 groups and clear every camper's activity choices. The roster is preserved. This cannot be undone."
                : "This will permanently delete every camper from every group. Groups themselves will remain intact. This cannot be undone."}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirm(null)}
                style={{ background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "9px 18px", fontFamily: font, fontSize: 13, fontWeight: 700, color: C.muted, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={confirm === "submissions" ? clearSubmissions : clearRoster}
                style={{ background: C.red, border: "none", borderRadius: 8, padding: "9px 18px", fontFamily: font, fontSize: 13, fontWeight: 700, color: "white", cursor: "pointer" }}>
                {confirm === "submissions" ? "Yes, Clear Submissions" : "Yes, Delete All Campers"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
