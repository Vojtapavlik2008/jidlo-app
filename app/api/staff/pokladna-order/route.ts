import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type OrderItemInput = {
  jidlo_id: string | null;
  name: string;
  category: string;
  unit_price: number;
  qty: number;
  line_total: number;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const datum = String(body?.datum ?? "").trim();
    const mode = String(body?.mode ?? "tady").trim(); // tady | sebou
    const delivery = String(body?.delivery ?? "ne").trim(); // ano | ne
    const packaging = String(body?.packaging ?? "plast").trim(); // plast | rekrabicka
    const paymentMethod = String(body?.paymentMethod ?? "cash").trim(); // cash | card | credit
    const customerId = body?.customerId ? String(body.customerId) : null;
    const rawItems = Array.isArray(body?.items) ? (body.items as OrderItemInput[]) : [];
    const packagingFeeInput = Number(body?.packagingFee ?? 0);

    if (!datum) {
      return NextResponse.json({ error: "Chybí datum." }, { status: 400 });
    }

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return NextResponse.json({ error: "Objednávka je prázdná." }, { status: 400 });
    }

    const items = rawItems
      .map((it) => {
        const name = String(it?.name ?? "").trim();
        const category = String(it?.category ?? "").trim();
        const unit_price = Number(it?.unit_price ?? 0);
        const qty = Number(it?.qty ?? 0);
        const line_total = round2(Number(it?.line_total ?? unit_price * qty));

        return {
          jidlo_id: it?.jidlo_id ? String(it.jidlo_id) : null,
          name,
          category,
          unit_price: round2(unit_price),
          qty,
          line_total,
        };
      })
      .filter(
        (it) =>
          !!it.name &&
          Number.isFinite(it.unit_price) &&
          it.unit_price >= 0 &&
          Number.isFinite(it.qty) &&
          Number.isInteger(it.qty) &&
          it.qty > 0 &&
          Number.isFinite(it.line_total) &&
          it.line_total >= 0
      );

    if (items.length === 0) {
      return NextResponse.json({ error: "Objednávka neobsahuje žádné platné položky." }, { status: 400 });
    }

    const subtotal = round2(items.reduce((sum, it) => sum + round2(it.unit_price * it.qty), 0));
    const packagingFee = Math.max(0, round2(packagingFeeInput));
    const total = round2(subtotal + packagingFee);

    const payment_method =
      paymentMethod === "card"
        ? "card_delivery"
        : paymentMethod === "credit"
        ? "credit"
        : "cash";

    const delivery_mode = mode === "sebou" && delivery === "ano" ? "delivery" : "pickup";

    const packaging_mode = packaging === "rekrabicka" ? "rekrabicka" : "plastic";

    let kredit = 0;

    if (paymentMethod === "credit") {
      if (!customerId) {
        return NextResponse.json({ error: "Pro kredit musí být vybraný zákazník." }, { status: 400 });
      }

      const { data: profile, error: profErr } = await supabaseAdmin
        .from("profiles")
        .select("id, kredit")
        .eq("id", customerId)
        .single();

      if (profErr || !profile) {
        return NextResponse.json({ error: "Zákazníka pro kredit se nepodařilo načíst." }, { status: 400 });
      }

      kredit = Number(profile.kredit ?? 0);

      if (kredit < total) {
        return NextResponse.json({ error: "Nedostatečný kredit zákazníka." }, { status: 400 });
      }
    }

    const cart = items.map((it) => ({
      name: it.name,
      qty: it.qty,
      unit_price: it.unit_price,
      line_total: it.line_total,
      datum,
      jidlo_id: it.jidlo_id,
      category: it.category,
    }));

    const noteParts: string[] = [];
    if (packagingFee > 0) noteParts.push(`Balení/Rekr: ${packagingFee} Kč`);
    if (mode === "tady") noteParts.push("Pokladna: Tady");
    if (mode === "sebou") noteParts.push(`Pokladna: Sebou${delivery === "ano" ? " • rozvoz" : ""}`);
    if (paymentMethod === "credit" && customerId) noteParts.push(`Kredit zákazníka: ${customerId}`);

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        created_at: new Date().toISOString(),
        full_name: paymentMethod === "credit" ? "Platba kreditem" : "Pokladna",
        phone: "",
        address: "",
        note: noteParts.join(" | "),
        delivery_mode,
        packaging_mode,
        payment_method,
        cart,
        total,
        status: "done",
        source: "pokladna",
        datum,
      })
      .select("id")
      .single();

    if (orderErr || !order) {
      return NextResponse.json(
        { error: orderErr?.message || "Nepodařilo se uložit objednávku." },
        { status: 500 }
      );
    }

    const orderItems = items.map((it) => ({
      order_id: order.id,
      datum,
      jidlo_id: it.jidlo_id,
      name: it.name,
      unit_price: it.unit_price,
      qty: it.qty,
      line_total: it.line_total,
    }));

    if (orderItems.length > 0) {
      const { error: itemsErr } = await supabaseAdmin.from("order_items").insert(orderItems);

      if (itemsErr) {
        await supabaseAdmin.from("orders").delete().eq("id", order.id);
        return NextResponse.json({ error: itemsErr.message }, { status: 500 });
      }
    }

    if (paymentMethod === "credit" && customerId) {
      const { error: creditErr } = await supabaseAdmin
        .from("profiles")
        .update({ kredit: round2(kredit - total) })
        .eq("id", customerId);

      if (creditErr) {
        await supabaseAdmin.from("order_items").delete().eq("order_id", order.id);
        await supabaseAdmin.from("orders").delete().eq("id", order.id);

        return NextResponse.json(
          { error: "Objednávka byla vrácena zpět, protože se nepodařilo odečíst kredit." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      subtotal,
      packagingFee,
      total,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Nepodařilo se uložit objednávku." },
      { status: 500 }
    );
  }
}