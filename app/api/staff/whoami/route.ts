import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!token) return NextResponse.json({ ok: false, error: "Chybí token." }, { status: 401 });

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return NextResponse.json({ ok: false, error: "Neplatný token." }, { status: 401 });
  }

  const uid = userData.user.id;
  const email = userData.user.email;

  const { data: staffRow, error: staffErr } = await admin
    .from("staff_users")
    .select("user_id")
    .eq("user_id", uid)
    .maybeSingle();

  if (staffErr) return NextResponse.json({ ok: false, error: staffErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    uid,
    email,
    is_staff: !!staffRow,
  });
}