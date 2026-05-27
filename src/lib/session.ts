// Shared session types and helpers used by all pages.

export type SessionPeriod = {
  label:      string;
  start_time: string;
  end_time:   string;
};

export type SessionActivity = {
  name:         string;
  abbreviation: string;
  capacity_p1:  number | null;
  capacity_p2:  number | null;
  capacity_p3:  number | null;
};

export type ActiveSession = {
  id:           string;
  name:         string;
  date:         string;
  period_count: number;
  periods:      SessionPeriod[];
  activities:   SessionActivity[];
};

export const DEFAULT_PERIODS: SessionPeriod[] = [
  { label: "Period 1", start_time: "1:00 PM",  end_time: "1:45 PM"  },
  { label: "Period 2", start_time: "1:50 PM",  end_time: "2:35 PM"  },
  { label: "Period 3", start_time: "2:40 PM",  end_time: "3:25 PM"  },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadActiveSession(supabase: any): Promise<ActiveSession | null> {
  const { data } = await supabase
    .from("sessions")
    .select("id, name, date, period_count, periods, activities")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return (data as ActiveSession | null);
}

export function getPeriodLabel(session: ActiveSession | null, pi: number): string {
  if (session && session.periods[pi]) return session.periods[pi].label;
  return DEFAULT_PERIODS[pi]?.label ?? `Period ${pi + 1}`;
}

export function getPeriodTime(session: ActiveSession | null, pi: number): string {
  if (session && session.periods[pi]) {
    const p = session.periods[pi];
    return `${p.start_time}–${p.end_time}`;
  }
  const dp = DEFAULT_PERIODS[pi];
  return dp ? `${dp.start_time}–${dp.end_time}` : "";
}

export function getPeriodCount(session: ActiveSession | null): number {
  return session?.period_count ?? 3;
}

// Parse "1:00 PM" → minutes-since-midnight for auto period detection.
export function parseTimeMins(timeStr: string): number {
  const m = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return 0;
  let h = parseInt(m[1]);
  const min = parseInt(m[2]);
  const pm = m[3].toUpperCase() === "PM";
  if (pm && h !== 12) h += 12;
  if (!pm && h === 12) h = 0;
  return h * 60 + min;
}

export function detectPeriodFromSession(
  session: ActiveSession | null,
  nowMinutes: number,
): number {
  const periods = session?.periods ?? DEFAULT_PERIODS;
  // Return the last period whose start time has been reached.
  let detected = 1;
  for (let i = 0; i < periods.length; i++) {
    const startMins = parseTimeMins(periods[i].start_time);
    if (nowMinutes >= startMins) detected = i + 1;
  }
  return Math.min(detected, periods.length);
}

export function periodEndedFromSession(
  session: ActiveSession | null,
  p: number,            // 1-based
  nowMinutes: number,
): boolean {
  const periods = session?.periods ?? DEFAULT_PERIODS;
  const period  = periods[p - 1];
  if (!period) return false;
  const endMins = parseTimeMins(period.end_time);
  return nowMinutes > endMins;
}
