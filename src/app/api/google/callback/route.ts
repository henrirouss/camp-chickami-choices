import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      `${origin}/leadership/settings?error=${error ?? "no_code"}`,
    );
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    const supabase = await createClient();
    await supabase
      .from("settings")
      .update({
        google_access_token: tokens.access_token ?? null,
        google_refresh_token: tokens.refresh_token ?? null,
        google_token_expiry: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
        google_email: userInfo.email ?? null,
      })
      .not("id", "is", null);

    return NextResponse.redirect(`${origin}/leadership/settings?connected=1`);
  } catch (e) {
    console.error("Google OAuth callback error:", e);
    return NextResponse.redirect(
      `${origin}/leadership/settings?error=callback_failed`,
    );
  }
}
