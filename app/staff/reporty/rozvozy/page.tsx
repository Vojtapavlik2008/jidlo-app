"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type DeliveryStatus = "waiting" | "on_route" | "delivered";

type OrderRow = {
  id: string;
  created_at: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  total: number | null;
  delivery_mode: string | null;
  delivery_status: string | null;
  delivery_order: number | null;
  driver_note: string | null;
  delivered_at: string | null;
};

type OrderUi = {
  id: string;
  created_at: string;
  full_name: string;
  phone: string;
  address: string;
  total: number;
  delivery_mode: string;
  delivery_status: DeliveryStatus;
  delivery_order: number | null;
  driver_note: string;
  delivered_at: string | null;
};

function formatPrice(value: number) {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function normalizePhone(phone: string) {
  return phone.trim().replace(/\s+/g, "");
}

export default function RozvozyPage() {
  const [orders, setOrders] = useState<OrderUi[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  async function loadOrders() {
    setLoading(true);
    setErrorMsg("");

    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, created_at, full_name, phone, address, total, delivery_mode, delivery_status, delivery_order, driver_note, delivered_at"
      )
      .eq("delivery_mode", "ano")
      .neq("delivery_status", "delivered")
      .order("delivery_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      setErrorMsg("Nepodařilo se načíst rozvozové objednávky.");
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as OrderRow[];

    const mapped: OrderUi[] = rows.map((row) => ({
      id: row.id,
      created_at: row.created_at,
      full_name: row.full_name?.trim() || "Bez jména",
      phone: row.phone?.trim() || "",
      address: row.address?.trim() || "",
      total: Number(row.total ?? 0),
      delivery_mode: row.delivery_mode ?? "",
      delivery_status: (row.delivery_status as DeliveryStatus) || "waiting",
      delivery_order: row.delivery_order ?? null,
      driver_note: row.driver_note ?? "",
      delivered_at: row.delivered_at ?? null,
    }));

    setOrders(mapped);

    const nextDrafts: Record<string, string> = {};
    for (const order of mapped) {
      nextDrafts[order.id] = order.driver_note || "";
    }
    setNoteDrafts(nextDrafts);

    setLoading(false);
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function markOnRoute(orderId: string) {
    setBusyId(orderId);

    const { error } = await supabase
      .from("orders")
      .update({ delivery_status: "on_route" })
      .eq("id", orderId);

    if (!error) {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, delivery_status: "on_route" } : o
        )
      );
    }

    setBusyId(null);
  }

  async function markDelivered(orderId: string) {
    setBusyId(orderId);

    const deliveredAt = new Date().toISOString();

    const { error } = await supabase
      .from("orders")
      .update({
        delivery_status: "delivered",
        delivered_at: deliveredAt,
      })
      .eq("id", orderId);

    if (!error) {
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    }

    setBusyId(null);
  }

  async function saveDriverNote(orderId: string) {
    setBusyId(orderId);

    const note = noteDrafts[orderId] ?? "";

    const { error } = await supabase
      .from("orders")
      .update({ driver_note: note })
      .eq("id", orderId);

    if (!error) {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, driver_note: note } : o))
      );
    }

    setBusyId(null);
  }

  async function assignOrderNumbers() {
    setBusyId("reorder");

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      await supabase
        .from("orders")
        .update({ delivery_order: i + 1 })
        .eq("id", order.id);
    }

    await loadOrders();
    setBusyId(null);
  }

  function openNavigation(order: OrderUi) {
    if (!order.address) return;
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        order.address
      )}`,
      "_blank"
    );
  }

  function callCustomer(order: OrderUi) {
    if (!order.phone) return;
    const phone = normalizePhone(order.phone);
    window.location.href = `tel:${phone}`;
  }

  function smsCustomer(order: OrderUi) {
    if (!order.phone) return;
    const phone = normalizePhone(order.phone);
    const text = "Dobrý den, za chvíli jsme u Vás. Jiřka";
    window.location.href = `sms:${phone}?body=${encodeURIComponent(text)}`;
  }

  const waitingCount = useMemo(
    () => orders.filter((o) => o.delivery_status === "waiting").length,
    [orders]
  );

  const onRouteCount = useMemo(
    () => orders.filter((o) => o.delivery_status === "on_route").length,
    [orders]
  );

  return (
    <div className="min-h-screen bg-[#f7faf7] text-[#123b1f]">
      <div className="mx-auto max-w-[1300px] px-3 py-4 md:px-5 md:py-6">
        <div className="mb-4 rounded-[28px] border border-[#d7eadb] bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.05)] md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-[28px] font-extrabold leading-none text-[#00a63e] md:text-[36px]">
                Rozvozy
              </h1>
              <div className="mt-2 text-sm text-[#5e7568] md:text-base">
                První verze rozvozového panelu
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/staff/reporty"
                className="rounded-full border border-[#bfe5c9] bg-white px-4 py-2 text-sm font-semibold text-[#0f5d2a] hover:bg-[#f4fbf5]"
              >
                Zpět
              </Link>

              <button
                onClick={loadOrders}
                className="rounded-full bg-[#00a63e] px-4 py-2 text-sm font-bold text-white hover:brightness-95"
              >
                Obnovit
              </button>

              <button
                onClick={assignOrderNumbers}
                disabled={busyId === "reorder"}
                className="rounded-full bg-[#0b4a8f] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {busyId === "reorder" ? "Nastavuji pořadí..." : "Nastavit pořadí"}
              </button>
            </div>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-[24px] border border-[#d7eadb] bg-white p-4 shadow-sm">
            <div className="text-sm text-[#5e7568]">Celkem aktivních</div>
            <div className="mt-1 text-3xl font-extrabold text-[#103f20]">
              {orders.length}
            </div>
          </div>

          <div className="rounded-[24px] border border-[#d7eadb] bg-white p-4 shadow-sm">
            <div className="text-sm text-[#5e7568]">Čeká</div>
            <div className="mt-1 text-3xl font-extrabold text-[#103f20]">
              {waitingCount}
            </div>
          </div>

          <div className="rounded-[24px] border border-[#d7eadb] bg-white p-4 shadow-sm">
            <div className="text-sm text-[#5e7568]">Na cestě</div>
            <div className="mt-1 text-3xl font-extrabold text-[#103f20]">
              {onRouteCount}
            </div>
          </div>

          <div className="rounded-[24px] border border-[#d7eadb] bg-white p-4 shadow-sm">
            <div className="text-sm text-[#5e7568]">Start</div>
            <div className="mt-1 text-base font-bold text-[#103f20]">Jiřka</div>
            <div className="text-xs text-[#5e7568]">Havlíčkova 72, Poděbrady</div>
          </div>
        </div>

        {errorMsg ? (
          <div className="mb-4 rounded-[22px] border border-[#ffd6d6] bg-[#fff5f5] p-4 text-[#9f1d1d]">
            {errorMsg}
          </div>
        ) : null}

        <div className="rounded-[30px] border border-[#d7eadb] bg-white p-3 shadow-[0_10px_30px_rgba(0,0,0,0.05)] md:p-4">
          <div className="mb-3 px-1">
            <div className="text-[22px] font-extrabold text-[#103f20]">
              Seznam objednávek
            </div>
            <div className="text-sm text-[#5e7568]">
              Tahle verze zatím řeší seznam, kontakty a stavy. Hned potom přidáme mapu.
            </div>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="rounded-[24px] border border-[#deefe1] bg-[#fbfefb] p-5 text-[#567164]">
                Načítám rozvozy...
              </div>
            ) : null}

            {!loading && orders.length === 0 ? (
              <div className="rounded-[24px] border border-[#deefe1] bg-[#fbfefb] p-5 text-[#567164]">
                Teď tu nejsou žádné aktivní rozvozy.
              </div>
            ) : null}

            {orders.map((order, idx) => {
              const noteDraft = noteDrafts[order.id] ?? "";

              return (
                <div
                  key={order.id}
                  className="rounded-[26px] border border-[#deefe1] bg-white p-4 transition hover:bg-[#f9fcf9]"
                >
                  <div className="mb-3 flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#00a63e] text-base font-extrabold text-white">
                      {order.delivery_order ?? idx + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-[20px] font-extrabold text-[#103f20]">
                          {order.full_name}
                        </div>

                        <span
                          className={
                            order.delivery_status === "waiting"
                              ? "rounded-full bg-[#fff6db] px-2.5 py-1 text-xs font-bold text-[#8a6610]"
                              : order.delivery_status === "on_route"
                              ? "rounded-full bg-[#e6f0ff] px-2.5 py-1 text-xs font-bold text-[#0b4a8f]"
                              : "rounded-full bg-[#e8f8ec] px-2.5 py-1 text-xs font-bold text-[#0f6c2a]"
                          }
                        >
                          {order.delivery_status === "waiting" && "Čeká"}
                          {order.delivery_status === "on_route" && "Na cestě"}
                          {order.delivery_status === "delivered" && "Vyřízeno"}
                        </span>
                      </div>

                      <div className="mt-1 text-sm text-[#4f685d]">{order.address}</div>

                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-[#103f20]">
                        {order.phone ? <div>{order.phone}</div> : null}
                        <div>{formatPrice(order.total)}</div>
                        <div>Objednávka: {formatDateTime(order.created_at)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    <button
                      onClick={() => openNavigation(order)}
                      className="rounded-2xl bg-[#0b4a8f] px-3 py-2 text-sm font-bold text-white"
                    >
                      Navigovat
                    </button>

                    <button
                      onClick={() => callCustomer(order)}
                      className="rounded-2xl border border-[#cfe5d5] bg-white px-3 py-2 text-sm font-bold text-[#103f20]"
                    >
                      Zavolat
                    </button>

                    <button
                      onClick={() => smsCustomer(order)}
                      className="rounded-2xl border border-[#cfe5d5] bg-white px-3 py-2 text-sm font-bold text-[#103f20]"
                    >
                      Poslat zprávu
                    </button>

                    {order.delivery_status === "waiting" ? (
                      <button
                        onClick={() => markOnRoute(order.id)}
                        disabled={busyId === order.id}
                        className="rounded-2xl bg-[#0b4a8f] px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                      >
                        Na cestě
                      </button>
                    ) : (
                      <button
                        onClick={() => markDelivered(order.id)}
                        disabled={busyId === order.id}
                        className="rounded-2xl bg-[#00a63e] px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                      >
                        Vyřízeno
                      </button>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
                    <input
                      value={noteDraft}
                      onChange={(e) =>
                        setNoteDrafts((prev) => ({
                          ...prev,
                          [order.id]: e.target.value,
                        }))
                      }
                      placeholder="Poznámka řidiče..."
                      className="h-11 rounded-2xl border border-[#cfe5d5] bg-white px-4 text-sm outline-none transition focus:border-[#8bc79a]"
                    />

                    <button
                      onClick={() => saveDriverNote(order.id)}
                      disabled={busyId === order.id}
                      className="rounded-2xl border border-[#cfe5d5] bg-white px-4 py-2 text-sm font-bold text-[#103f20] disabled:opacity-60"
                    >
                      Uložit poznámku
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}