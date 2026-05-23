import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  await supabase
    .from("settings")
    .update({
      google_access_token:  null,
      google_refresh_token: null,
      google_token_expiry:  null,
      google_email:         null,
    })
    .not("id", "is", null);
  return NextResponse.json({ success: true });
}
