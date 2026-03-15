import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type MenuRow = {
  datum: string;
  poradi: number | null;
  jidlo_id: string;
};

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

    const { data: exists, error: existsErr } = await supabaseAdmin
      .from("menu_den")
      .select("datum, poradi, jidlo_id")
      .eq("datum", datum)
      .eq("jidlo_id", jidlo_id)
      .limit(1);

    if (existsErr) {
      return NextResponse.json({ error: existsErr.message }, { status: 500 });
    }

    if ((exists ?? []).length > 0) {
      return NextResponse.json({ ok: true, exists: true });
    }

    const { data: lastRows, error: lastErr } = await supabaseAdmin
      .from("menu_den")
      .select("datum, poradi, jidlo_id")
      .eq("datum", datum)
      .order("poradi", { ascending: false })
      .limit(1);

    if (lastErr) {
      return NextResponse.json({ error: lastErr.message }, { status: 500 });
    }

    const last = (lastRows?.[0] as MenuRow | undefined) ?? null;
    const nextPoradi = last ? Number(last.poradi ?? 0) + 1 : 1;

    const { error: insertErr } = await supabaseAdmin.from("menu_den").insert({
      datum,
      poradi: nextPoradi,
      jidlo_id,
    });

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, poradi: nextPoradi });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Chyba serveru." },
      { status: 500 }
    );
  }
}