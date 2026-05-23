import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Group  = { id: string; name: string; submitted: boolean };
type Camper = { first_name: string; last_name: string; group_id: string; choice_p1: string | null; choice_p2: string | null; choice_p3: string | null };

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { auto?: boolean };

  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (!settings) {
    return NextResponse.json({ error: "No settings found" }, { status: 500 });
  }

  // When triggered automatically on submit, respect the auto_sync toggle
  if (body.auto && !settings.auto_sync) {
    return NextResponse.json({ skipped: true, reason: "auto_sync disabled" });
  }

  if (!settings.google_access_token) {
    return NextResponse.json({ error: "Google account not connected" }, { status: 400 });
  }
  if (!settings.sheets_url) {
    return NextResponse.json({ error: "No spreadsheet URL configured" }, { status: 400 });
  }

  const match = settings.sheets_url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    return NextResponse.json({ error: "Invalid spreadsheet URL" }, { status: 400 });
  }
  const spreadsheetId = match[1];

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
  oauth2Client.setCredentials({
    access_token:  settings.google_access_token,
    refresh_token: settings.google_refresh_token ?? undefined,
    expiry_date:   settings.google_token_expiry
      ? new Date(settings.google_token_expiry).getTime()
      : undefined,
  });

  oauth2Client.on("tokens", async (tokens) => {
    const updates: Record<string, string> = {};
    if (tokens.access_token) updates.google_access_token = tokens.access_token;
    if (tokens.expiry_date)  updates.google_token_expiry = new Date(tokens.expiry_date).toISOString();
    await supabase.from("settings").update(updates).eq("id", settings.id);
  });

  const [{ data: groups }, { data: campers }] = await Promise.all([
    supabase.from("groups").select("id, name, submitted").order("name"),
    supabase
      .from("campers")
      .select("first_name, last_name, group_id, choice_p1, choice_p2, choice_p3")
      .order("last_name")
      .order("first_name"),
  ]);

  const gMap = new Map((groups as Group[] ?? []).map(g => [g.id, g]));

  const rows: string[][] = [
    ["Group", "First Name", "Last Name", "Period 1", "Period 2", "Period 3", "Group Submitted"],
    ...(campers as Camper[] ?? []).map(c => {
      const g = gMap.get(c.group_id);
      return [
        g?.name ?? "",
        c.first_name,
        c.last_name,
        c.choice_p1 ?? "",
        c.choice_p2 ?? "",
        c.choice_p3 ?? "",
        g?.submitted ? "Yes" : "No",
      ];
    }),
  ];

  try {
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: "Sheet1" });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Sheet1!A1",
      valueInputOption: "RAW",
      requestBody: { values: rows },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: `Sheets API error: ${msg}` }, { status: 500 });
  }

  const now = new Date().toISOString();
  await supabase.from("settings").update({ last_synced_at: now }).eq("id", settings.id);

  return NextResponse.json({ success: true, rows: rows.length - 1, syncedAt: now });
}
