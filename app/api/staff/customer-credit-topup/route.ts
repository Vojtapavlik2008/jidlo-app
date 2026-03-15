import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const customerId = String(body?.customerId ?? "").trim();
    const amount = Number(body?.amount ?? 0);

    if (!customerId) {
      return NextResponse.json({ error: "Chybí customerId." }, { status: 400 });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Neplatná částka." }, { status: 400 });
    }

    const safeAmount = round2(amount);

    const { data: profile, error: loadErr } = await supabase
      .from("profiles")
      .select("id, kredit")
      .eq("id", customerId)
      .single();

    if (loadErr || !profile) {
      return NextResponse.json({ error: "Zákazník nebyl nalezen." }, { status: 404 });
    }

    const current = round2(Number(profile.kredit ?? 0));
    const nextCredit = round2(current + safeAmount);

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ kredit: nextCredit })
      .eq("id", customerId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      customerId,
      added: safeAmount,
      kredit: nextCredit,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Neznámá chyba." },
      { status: 500 }
    );
  }
}