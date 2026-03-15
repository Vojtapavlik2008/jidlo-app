import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();

    let query = supabaseAdmin
      .from("profiles")
      .select("id, full_name, kredit")
      .not("full_name", "is", null)
      .order("full_name", { ascending: true })
      .limit(50);

    if (q) {
      query = query.ilike("full_name", `%${q}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const safe = (data ?? []).map((row) => ({
      id: row.id,
      full_name: row.full_name ?? "",
      kredit: Number(row.kredit ?? 0),
    }));

    return NextResponse.json({ data: safe });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Nepodařilo se načíst zákazníky." },
      { status: 500 }
    );
  }
}