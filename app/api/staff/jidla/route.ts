import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type FoodRow = {
  id: string;
  legacy_id: number;
  kategorie: string | null;
  nazev: string;
  cena: number | null;
  aktivni: boolean | null;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function normalizePrice(value: unknown) {
  if (value === "" || value == null) return null;
  const n = Number(String(value).replace(",", "."));
  if (!Number.isFinite(n)) return NaN;
  return round2(n);
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("jidla")
      .select("id, legacy_id, kategorie, nazev, cena, aktivni")
      .order("legacy_id", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const safe = ((data ?? []) as FoodRow[]).map((r) => ({
      id: r.id,
      legacy_id: Number(r.legacy_id ?? 0),
      kategorie: r.kategorie ?? null,
      nazev: String(r.nazev ?? "").trim(),
      cena: r.cena == null ? null : round2(Number(r.cena)),
      aktivni: r.aktivni ?? true,
    }));

    return NextResponse.json({ data: safe });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Nepodařilo se načíst jídla." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const items = Array.isArray(body) ? body : body?.items ?? body;
    const payload = Array.isArray(items) ? items : [items];

    if (!payload?.length) {
      return NextResponse.json({ error: "Bad payload" }, { status: 400 });
    }

    const rows = payload.map((x: any) => ({
      legacy_id: Number(x?.legacy_id),
      nazev: String(x?.nazev ?? "").trim(),
      cena: normalizePrice(x?.cena),
      kategorie: String(x?.kategorie ?? "").trim() || null,
      aktivni: x?.aktivni == null ? true : Boolean(x.aktivni),
    }));

    for (const r of rows) {
      if (!Number.isFinite(r.legacy_id) || r.legacy_id <= 0) {
        return NextResponse.json({ error: "legacy_id musí být kladné číslo." }, { status: 400 });
      }
      if (!r.nazev) {
        return NextResponse.json({ error: "Název nesmí být prázdný." }, { status: 400 });
      }
      if (Number.isNaN(r.cena)) {
        return NextResponse.json({ error: "Cena musí být číslo nebo prázdná." }, { status: 400 });
      }
      if (r.cena != null && r.cena < 0) {
        return NextResponse.json({ error: "Cena nesmí být záporná." }, { status: 400 });
      }
    }

    const { data, error } = await supabaseAdmin.from("jidla").insert(rows).select("*");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Nepodařilo se uložit jídlo." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const id = String(body?.id ?? "").trim();

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const patch: Partial<FoodRow> = {};

    if ("nazev" in body) {
      const nazev = String(body?.nazev ?? "").trim();
      if (!nazev) {
        return NextResponse.json({ error: "Název nesmí být prázdný." }, { status: 400 });
      }
      patch.nazev = nazev;
    }

    if ("cena" in body) {
      const cena = normalizePrice(body?.cena);
      if (Number.isNaN(cena)) {
        return NextResponse.json({ error: "Cena musí být číslo nebo prázdná." }, { status: 400 });
      }
      if (cena != null && cena < 0) {
        return NextResponse.json({ error: "Cena nesmí být záporná." }, { status: 400 });
      }
      patch.cena = cena;
    }

    if ("kategorie" in body) {
      patch.kategorie = String(body?.kategorie ?? "").trim() || null;
    }

    if ("aktivni" in body) {
      patch.aktivni = Boolean(body?.aktivni);
    }

    const { error } = await supabaseAdmin.from("jidla").update(patch).eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Nepodařilo se upravit jídlo." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id")?.trim();

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const { data: inMenu, error: menuErr } = await supabaseAdmin
      .from("menu_den")
      .select("jidlo_id")
      .eq("jidlo_id", id)
      .limit(1);

    if (menuErr) {
      return NextResponse.json({ error: menuErr.message }, { status: 500 });
    }

    if ((inMenu ?? []).length > 0) {
      return NextResponse.json(
        { error: "Jídlo nelze smazat, protože je použité v menu." },
        { status: 400 }
      );
    }

    const { data: inOrders, error: orderErr } = await supabaseAdmin
      .from("order_items")
      .select("jidlo_id")
      .eq("jidlo_id", id)
      .limit(1);

    if (orderErr) {
      return NextResponse.json({ error: orderErr.message }, { status: 500 });
    }

    if ((inOrders ?? []).length > 0) {
      return NextResponse.json(
        { error: "Jídlo nelze smazat, protože je použité v objednávkách." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.from("jidla").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Nepodařilo se smazat jídlo." },
      { status: 500 }
    );
  }
}