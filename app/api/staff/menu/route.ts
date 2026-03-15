import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type DbMenuRow = {
  datum: string;
  poradi: number | null;
  jidlo_id: string;
  jidla: {
    nazev: string | null;
    cena: number | null;
    kategorie: string | null;
    aktivni?: boolean | null;
  } | null;
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
      .select("datum, poradi, jidlo_id, jidla:jidlo_id(nazev, cena, kategorie, aktivni)")
      .gte("datum", from)
      .lte("datum", to)
      .order("datum", { ascending: true })
      .order("poradi", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as unknown as DbMenuRow[];

    const safe = rows
      .filter((r) => r.jidla && (r.jidla.aktivni ?? true))
      .map((r) => ({
        datum: r.datum,
        poradi: Number(r.poradi ?? 0),
        jidlo_id: r.jidlo_id,
        jidla: {
          nazev: r.jidla?.nazev ?? "",
          cena: r.jidla?.cena ?? null,
          kategorie: r.jidla?.kategorie ?? "",
        },
      }));

    return NextResponse.json({ data: safe });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Nepodařilo se načíst menu." },
      { status: 500 }
    );
  }
}