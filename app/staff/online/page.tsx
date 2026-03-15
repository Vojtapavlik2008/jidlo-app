"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { printReceipt } from "@/lib/printReceipt";

type DayTime = { from: string; to: string } | null;

type OrderRow = {
  id: string;
  created_at: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  note: string | null;
  total: number | null;
  status: string | null;
  delivery_mode: string | null;
  packaging_mode: string | null;
  payment_method: string | null;
  times_by_day?: Record<string, DayTime> | null;
  cart?: any[] | null;
};

type OrderItemRow = {
  id?: string;
  order_id?: string;
  name: string;
  qty: number;
  unit_price?: number | null;
  line_total?: number | null;
};

type FilterMode = "now" | "scheduled" | "all";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(mins: number) {
  const normalized = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function shiftSlotBackOneHour(slot: DayTime): DayTime {
  if (!slot || !isTime(slot.from) || !isTime(slot.to)) return null;
  return {
    from: fromMinutes(toMinutes(slot.from) - 60),
    to: fromMinutes(toMinutes(slot.to) - 60),
  };
}

function slotLabel(slot: DayTime) {
  if (!slot) return "Bez času";
  return `${slot.from}–${slot.to}`;
}

function dayLabel(iso: string) {
  try {
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString("cs-CZ", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
    });
  } catch {
    return iso;
  }
}

function dateTimeLabel(value: string) {
  try {
    return new Date(value).toLocaleString("cs-CZ");
  } catch {
    return value;
  }
}

function todayIsoLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function getPreferredSlotForToday(order: OrderRow): DayTime {
  const map = order.times_by_day ?? {};
  const today = todayIsoLocal();

  if (map[today]) return map[today] ?? null;

  const validDays = Object.keys(map).filter((d) => isIsoDate(d)).sort();
  if (validDays.length > 0) {
    const first = validDays[0];
    return map[first] ?? null;
  }

  return null;
}

function getPreferredDayForToday(order: OrderRow): string | null {
  const map = order.times_by_day ?? {};
  const today = todayIsoLocal();

  if (map[today] !== undefined) return today;

  const validDays = Object.keys(map).filter((d) => isIsoDate(d)).sort();
  return validDays.length > 0 ? validDays[0] : null;
}

function nowPreparationSlot() {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const from = Math.floor(mins / 30) * 30;
  const to = from + 30;

  return {
    from: fromMinutes(from),
    to: fromMinutes(to),
  };
}

export default function OnlineOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [selectedPrepSlot, setSelectedPrepSlot] = useState<string>("");

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("loadOrders error", error);
        setOrders([]);
        return;
      }

      const normalized = (data ?? []).filter((o) => {
        return (
          o &&
          typeof o === "object" &&
          o.status !== "cancelled"
        );
      }) as OrderRow[];

      setOrders(normalized);
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(order: OrderRow) {
    setSelected(order);

    const { data, error } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", order.id);

    if (!error && data && data.length > 0) {
      setItems(
        data.map((it: any) => ({
          id: it.id,
          order_id: it.order_id,
          name: it.name ?? it.nazev ?? "Položka",
          qty: Number(it.qty ?? 0),
          unit_price: Number(it.unit_price ?? it.price ?? 0),
          line_total: Number(it.line_total ?? 0),
        }))
      );
      return;
    }

    const cartItems = Array.isArray(order.cart) ? order.cart : [];
    setItems(
      cartItems.map((it: any, idx: number) => ({
        id: `cart-${idx}`,
        name: String(it.nazev ?? it.name ?? "Položka"),
        qty: Number(it.qty ?? 0),
        unit_price: Number(it.cena ?? it.unit_price ?? 0),
        line_total: Number(
          it.line_total ?? Number(it.qty ?? 0) * Number(it.cena ?? it.unit_price ?? 0)
        ),
      }))
    );
  }

  const enrichedOrders = useMemo(() => {
    return orders.map((order) => {
      const preferredDay = getPreferredDayForToday(order);
      const customerSlot = getPreferredSlotForToday(order);
      const prepSlot = shiftSlotBackOneHour(customerSlot);

      return {
        ...order,
        preferredDay,
        customerSlot,
        prepSlot,
        customerSlotLabel: slotLabel(customerSlot),
        prepSlotLabel: slotLabel(prepSlot),
      };
    });
  }, [orders]);

  const preparationSlotOptions = useMemo(() => {
    const slots = Array.from(
      new Set(
        enrichedOrders
          .map((o) => o.prepSlotLabel)
          .filter((x) => x && x !== "Bez času")
      )
    ).sort();

    return slots;
  }, [enrichedOrders]);

  useEffect(() => {
    if (filterMode === "now") {
      setSelectedPrepSlot(slotLabel(nowPreparationSlot()));
      return;
    }

    if (filterMode === "scheduled") {
      if (!selectedPrepSlot && preparationSlotOptions.length > 0) {
        setSelectedPrepSlot(preparationSlotOptions[0]);
      }
      return;
    }

    setSelectedPrepSlot("");
  }, [filterMode, preparationSlotOptions, selectedPrepSlot]);

  const visibleOrders = useMemo(() => {
    if (filterMode === "all") return enrichedOrders;

    if (filterMode === "now") {
      const nowSlot = slotLabel(nowPreparationSlot());
      return enrichedOrders.filter((o) => o.prepSlotLabel === nowSlot);
    }

    if (filterMode === "scheduled") {
      if (!selectedPrepSlot) return enrichedOrders.filter((o) => o.prepSlotLabel !== "Bez času");
      return enrichedOrders.filter((o) => o.prepSlotLabel === selectedPrepSlot);
    }

    return enrichedOrders;
  }, [enrichedOrders, filterMode, selectedPrepSlot]);

  const modeBtn = (active: boolean) =>
    [
      "rounded-2xl px-4 py-3 text-sm font-extrabold ring-1 transition",
      active
        ? "bg-green-600 text-white ring-green-600"
        : "bg-white text-gray-900 ring-black/10 hover:bg-gray-50",
    ].join(" ");

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">Online objednávky</h1>
          <div className="mt-1 text-sm font-semibold text-gray-500">
            Zákaznický čas se ve staffu počítá o 1 hodinu dřív pro přípravu a rozvoz.
          </div>
        </div>

        <button
          type="button"
          onClick={loadOrders}
          className="rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-gray-900 ring-1 ring-black/10 hover:bg-gray-50"
        >
          Obnovit
        </button>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setFilterMode("now")}
              className={modeBtn(filterMode === "now")}
            >
              Teď
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("scheduled")}
              className={modeBtn(filterMode === "scheduled")}
            >
              V určitý čas
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={modeBtn(filterMode === "all")}
            >
              Všechny objednávky
            </button>
          </div>

          <div>
            {filterMode === "scheduled" ? (
              <select
                value={selectedPrepSlot}
                onChange={(e) => setSelectedPrepSlot(e.target.value)}
                className="w-full rounded-2xl bg-gray-50 px-4 py-3 text-sm font-bold outline-none ring-1 ring-black/10"
              >
                {preparationSlotOptions.length === 0 ? (
                  <option value="">Žádné časované objednávky</option>
                ) : (
                  preparationSlotOptions.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))
                )}
              </select>
            ) : filterMode === "now" ? (
              <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700 ring-1 ring-black/10">
                Aktuální přípravný slot: {slotLabel(nowPreparationSlot())}
              </div>
            ) : (
              <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700 ring-1 ring-black/10">
                Zobrazeny jsou všechny objednávky
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-white p-4 text-sm font-semibold text-gray-600 ring-1 ring-black/5">
          Načítám objednávky…
        </div>
      ) : visibleOrders.length === 0 ? (
        <div className="rounded-2xl bg-white p-4 text-sm font-semibold text-gray-600 ring-1 ring-black/5">
          Žádné objednávky pro tento filtr.
        </div>
      ) : (
        <div className="grid gap-3">
          {visibleOrders.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => openDetail(o)}
              className="flex w-full items-start justify-between gap-4 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-black/5 transition hover:bg-gray-50"
            >
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-gray-900">{o.full_name || "Bez jména"}</div>

                <div className="mt-1 text-sm text-gray-500">
                  Vytvořeno: {dateTimeLabel(o.created_at)}
                </div>

                <div className="mt-2 grid gap-1 text-sm">
                  <div className="font-semibold text-gray-700">
                    Zákaznický čas:{" "}
                    <span className="text-gray-900">
                      {o.preferredDay ? `${dayLabel(o.preferredDay)} · ${o.customerSlotLabel}` : "Bez času"}
                    </span>
                  </div>

                  <div className="font-semibold text-green-700">
                    Interní čas přípravy: <span>{o.prepSlotLabel}</span>
                  </div>

                  <div className="text-gray-600">
                    {o.delivery_mode === "pickup" ? "Osobní odběr" : "Doručení"}
                    {o.payment_method ? ` · ${o.payment_method}` : ""}
                    {o.status ? ` · ${o.status}` : ""}
                  </div>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="text-lg font-extrabold text-gray-900">{o.total ?? 0} Kč</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="mt-6 rounded-2xl bg-gray-50 p-6">
          <h2 className="mb-3 text-lg font-extrabold">Detail objednávky</h2>

          <div className="grid gap-1 text-sm">
            <div>Jméno: {selected.full_name || "—"}</div>
            <div>Telefon: {selected.phone || "—"}</div>
            <div>Adresa: {selected.address || "—"}</div>
            <div>Poznámka: {selected.note || "—"}</div>

            <div className="mt-2 font-semibold text-gray-700">
              Zákaznický čas:{" "}
              <span className="text-gray-900">
                {(() => {
                  const preferredDay = getPreferredDayForToday(selected);
                  const customerSlot = getPreferredSlotForToday(selected);
                  if (!preferredDay) return "Bez času";
                  return `${dayLabel(preferredDay)} · ${slotLabel(customerSlot)}`;
                })()}
              </span>
            </div>

            <div className="font-semibold text-green-700">
              Interní čas přípravy:{" "}
              <span>
                {slotLabel(shiftSlotBackOneHour(getPreferredSlotForToday(selected)))}
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-1">
            {items.length === 0 ? (
              <div className="text-sm text-gray-500">Bez položek.</div>
            ) : (
              items.map((it) => (
                <div key={it.id ?? `${it.name}-${it.qty}`} className="flex justify-between gap-4">
                  <div>
                    {it.qty}× {it.name}
                  </div>
                  <div>{Number(it.line_total ?? 0)} Kč</div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 text-lg font-bold">
            Celkem: {selected.total ?? 0} Kč
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => printReceipt(selected, items)}
              className="rounded-xl bg-green-600 px-4 py-2 text-white"
            >
              🖨 Tisknout
            </button>

            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setItems([]);
              }}
              className="rounded-xl bg-white px-4 py-2 text-gray-900 ring-1 ring-black/10"
            >
              Zavřít detail
            </button>
          </div>
        </div>
      )}
    </div>
  );
}