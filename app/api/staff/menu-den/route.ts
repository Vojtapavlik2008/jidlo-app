import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type MenuDenRow = {
  datum: string;
  poradi: number | null;
  jidlo_id: string;
};

function isIsoDate(value: string | null) {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    if (!isIsoDate(from) || !isIsoDate(to)) {
      return NextResponse.json(
        { error: "Neplatné nebo chybějící from/to. Očekávám YYYY-MM-DD." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("menu_den")
      .select("datum, poradi, jidlo_id")
      .gte("datum", from)
      .lte("datum", to)
      .order("datum", { ascending: true })
      .order("poradi", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const safe = ((data ?? []) as MenuDenRow[]).map((r) => ({
      datum: r.datum,
      poradi: Number(r.poradi ?? 0),
      jidlo_id: r.jidlo_id,
    }));

    return NextResponse.json({ data: safe });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Nepodařilo se načíst menu_den." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const datum = String(body?.datum ?? "").trim();
    const rawLegacyIds = Array.isArray(body?.legacyIds) ? body.legacyIds : [];

    if (!isIsoDate(datum) || !Array.isArray(rawLegacyIds)) {
      return NextResponse.json({ error: "Bad payload" }, { status: 400 });
    }

    const legacyIds = Array.from(
      new Set(
        rawLegacyIds
          .map((x: any) => Number(x))
          .filter((x: number) => Number.isInteger(x) && x > 0)
      )
    );

    let uuidByLegacy = new Map<number, string>();

    if (legacyIds.length) {
      const { data: foods, error: foodsErr } = await supabaseAdmin
        .from("jidla")
        .select("id, legacy_id")
        .in("legacy_id", legacyIds);

      if (foodsErr) {
        return NextResponse.json({ error: foodsErr.message }, { status: 500 });
      }

      for (const f of foods ?? []) {
        uuidByLegacy.set(Number(f.legacy_id), String(f.id));
      }
    }

    const missing = legacyIds.filter((id) => !uuidByLegacy.has(id));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Některá jídla neexistují: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    const del = await supabaseAdmin.from("menu_den").delete().eq("datum", datum);
    if (del.error) {
      return NextResponse.json({ error: del.error.message }, { status: 500 });
    }

    const uuids = legacyIds.map((n) => uuidByLegacy.get(n)).filter(Boolean) as string[];

    if (uuids.length) {
      const rows = uuids.map((jidlo_id, i) => ({
        datum,
        poradi: i + 1,
        jidlo_id,
      }));

      const ins = await supabaseAdmin.from("menu_den").insert(rows);
      if (ins.error) {
        return NextResponse.json({ error: ins.error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, count: uuids.length });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Nepodařilo se uložit menu_den." },
      { status: 500 }
    );
  }
}