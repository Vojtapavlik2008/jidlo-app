import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const jidlo_id = String(body?.jidlo_id ?? "").trim();
    const datum = String(body?.datum ?? "").trim();

    if (!jidlo_id || !datum) {
      return NextResponse.json({ error: "Chybí jidlo_id nebo datum." }, { status: 400 });
    }

    if (!isIsoDate(datum)) {
      return NextResponse.json({ error: "Datum musí být ve formátu YYYY-MM-DD." }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("menu_den")
      .delete()
      .eq("jidlo_id", jidlo_id)
      .eq("datum", datum);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Chyba serveru." },
      { status: 500 }
    );
  }
}