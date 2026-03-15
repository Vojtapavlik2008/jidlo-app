import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : "";

    if (!token) {
      return NextResponse.json({ error: "Chybí přihlášení." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const pin = String(body?.pin ?? "").trim();

    if (!/^\d{4}$/.test(pin)) {
  return NextResponse.json({ error: "PIN musí mít přesně 4 číslice." }, { status: 400 });
}

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: authUser, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authUser?.user) {
      return NextResponse.json({ error: "Neplatné přihlášení." }, { status: 401 });
    }

    const userId = authUser.user.id;

    const { data: staffRow, error: staffError } = await supabaseAdmin
      .from("staff_users")
      .select("user_id, pin_code, pin_enabled")
      .eq("user_id", userId)
      .single();

    if (staffError || !staffRow) {
      return NextResponse.json({ error: "Staff účet nebyl nalezen." }, { status: 403 });
    }

    if (!staffRow.pin_enabled) {
      return NextResponse.json({ error: "PIN není povolený." }, { status: 403 });
    }

    if (String(staffRow.pin_code ?? "") !== pin) {
      return NextResponse.json({ error: "Nesprávný PIN." }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Chyba při ověřování PINu." },
      { status: 500 }
    );
  }
}