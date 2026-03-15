import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function normalizeEmail(value: unknown) {
  const s = String(value ?? "").trim().toLowerCase();
  return s || null;
}

function isValidEmail(email: string | null) {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function requireStaff(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!token) {
    return { ok: false as const, status: 401, message: "Chybí token." };
  }

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return { ok: false as const, status: 401, message: "Neplatný token." };
  }

  const uid = userData.user.id;

  const { data: staffRow, error: staffErr } = await admin
    .from("staff_users")
    .select("user_id")
    .eq("user_id", uid)
    .maybeSingle();

  if (staffErr) {
    return { ok: false as const, status: 500, message: staffErr.message };
  }

  if (!staffRow) {
    return { ok: false as const, status: 403, message: "Nemáš práva (nejseš staff)." };
  }

  return { ok: true as const, uid };
}

export async function GET(req: NextRequest) {
  const gate = await requireStaff(req);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: gate.status });
  }

  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, address, phone, email, kredit")
    .order("full_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rows: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const gate = await requireStaff(req);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: gate.status });
  }

  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "").trim();

  if (!id) {
    return NextResponse.json({ error: "Chybí id." }, { status: 400 });
  }

  const kreditRaw = Number(String(body?.kredit ?? 0).replace(",", "."));
  if (!Number.isFinite(kreditRaw)) {
    return NextResponse.json({ error: "Neplatná hodnota kreditu." }, { status: 400 });
  }

  const email = normalizeEmail(body?.email);
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Neplatný e-mail." }, { status: 400 });
  }

  const payload = {
    full_name: String(body?.full_name ?? "").trim() || null,
    phone: String(body?.phone ?? "").trim() || null,
    address: String(body?.address ?? "").trim() || null,
    email,
    kredit: round2(kreditRaw),
  };

  const { error } = await admin.from("profiles").update(payload).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, profile: { id, ...payload } });
}

export async function DELETE(req: NextRequest) {
  const gate = await requireStaff(req);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: gate.status });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id")?.trim();

  if (!id) {
    return NextResponse.json({ error: "Chybí id." }, { status: 400 });
  }

  const { data: profile, error: loadErr } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", id)
    .maybeSingle();

  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: "Zákazník nebyl nalezen." }, { status: 404 });
  }

  const { data: linkedOrders, error: ordersErr } = await admin
    .from("orders")
    .select("id")
    .eq("full_name", profile.full_name ?? "")
    .limit(1);

  if (ordersErr) {
    return NextResponse.json({ error: ordersErr.message }, { status: 500 });
  }

  if ((linkedOrders ?? []).length > 0) {
    return NextResponse.json(
      { error: "Zákazníka nelze smazat, protože má navázané objednávky." },
      { status: 400 }
    );
  }

  const { error } = await admin.from("profiles").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}