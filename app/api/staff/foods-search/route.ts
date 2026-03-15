import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";

  const { data, error } = await supabase
    .from("jidla")
    .select("id, legacy_id, nazev, cena, kategorie")
    .or(`nazev.ilike.%${q}%,legacy_id.eq.${q}`)
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}