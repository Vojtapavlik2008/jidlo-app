"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import L, { LatLngExpression } from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";

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
  lat: number | null;
  lng: number | null;
  driver_note: string | null;
  delivered_at: string | null;
};

type DeliveryStatus = "waiting" | "on_route" | "delivered";

type OrderForUi = {
  id: string;
  created_at: string;
  full_name: string;
  phone: string;
  address: string;
  total: number;
  delivery_mode: string;
  delivery_status: DeliveryStatus;
  delivery_order: number | null;
  lat: number | null;
  lng: number | null;
  driver_note: string;
  delivered_at: string | null;
};

const JIRKA_BASE = {
  label: "Jiřka",
  address: "Havlíčkova 72, 29001 Poděbrady",
  lat: 50.1434,
  lng: 15.1188,
};

const DEFAULT_CENTER: LatLngExpression = [JIRKA_BASE.lat, JIRKA_BASE.lng];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizePhone(phone: string) {
  const trimmed = phone.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) return trimmed.replace(/\s+/g, "");
  return trimmed.replace(/\s+/g, "");
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatTime(dateLike: string | null) {
  if (!dateLike) return "";
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function buildCustomerMessage(order: OrderForUi, etaMinutes?: number | null) {
  const etaText =
    typeof etaMinutes === "number" && Number.isFinite(etaMinutes)
      ? `za ${Math.max(1, Math.round(etaMinutes))} minut jsme u Vás.`
      : "za chvíli jsme u Vás.";

  return `Dobrý den, ${etaText} Jiřka`;
}

function makeStopIcon(index: number, active: boolean, done: boolean) {
  return L.divIcon({
    className: "",
    html: `<div class="delivery-stop-marker ${active ? "active" : ""} ${
      done ? "done" : ""
    }">${index}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -28],
  });
}

const homeIcon = L.divIcon({
  className: "",
  html: `<div class="delivery-home-marker">🏠</div>`,
  iconSize: [42, 42],
  iconAnchor: [21, 40],
  popupAnchor: [0, -34],
});

function FitAllMarkers({
  points,
}: {
  points: Array<{ lat: number; lng: number }>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) {
      map.setView(DEFAULT_CENTER, 13);
      return;
    }

    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 15);
      return;
    }

    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, points]);

  return null;
}

function FlyToSelected({
  order,
}: {
  order: OrderForUi | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!order?.lat || !order?.lng) return;
    map.flyTo([order.lat, order.lng], Math.max(map.getZoom(), 16), {
      duration: 0.6,
    });
  }, [map, order]);

  return null;
}

export default function RozvozyPage() {
  const [orders, setOrders] = useState<OrderForUi[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"mapa" | "seznam">("mapa");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [etaMap, setEtaMap] = useState<Record<string, number>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const geocodingNowRef = useRef<Set<string>>(new Set());

  async function loadOrders() {
    setLoading(true);
    setErrorMsg("");

    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, created_at, full_name, phone, address, total, delivery_mode, delivery_status, delivery_order, lat, lng, driver_note, delivered_at"
      )
      .eq("delivery_mode", "ano")
      .neq("delivery_status", "delivered")
      .order("delivery_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (error) {
      setErrorMsg("Nepodařilo se načíst rozvozy.");
      setLoading(false);
      return;
    }

export default function RozvozyPage() {
  return <div style={{ padding: 20 }}>ROZVOZY TEST</div>;
}

    const rows = (data ?? []) as OrderRow[];

    const normalized: OrderForUi[] = rows.map((row) => ({
      id: row.id,
      created_at: row.created_at,
      full_name: row.full_name?.trim() || "Bez jména",
      phone: row.phone?.trim() || "",
      address: row.address?.trim() || "",
      total: Number(row.total ?? 0),
      delivery_mode: row.delivery_mode ?? "",
      delivery_status: (row.delivery_status as DeliveryStatus) || "waiting",
      delivery_order: row.delivery_order ?? null,
      lat: row.lat ?? null,
      lng: row.lng ?? null,
      driver_note: row.driver_note ?? "",
      delivered_at: row.delivered_at ?? null,
    }));

    setOrders(normalized);

    setNoteDrafts((prev) => {
      const next = { ...prev };
      for (const order of normalized) {
        if (!(order.id in next)) next[order.id] = order.driver_note || "";
      }
      return next;
    });

    if (!selectedId && normalized.length > 0) {
      setSelectedId(normalized[0].id);
    } else if (selectedId && !normalized.some((o) => o.id === selectedId)) {
      setSelectedId(normalized[0]?.id ?? null);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function geocodeAddress(address: string) {
    const q = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=cz&q=${q}`;

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) throw new Error("Geocoding selhal.");

    const json = await res.json();

    if (!Array.isArray(json) || !json[0]) return null;

    const first = json[0];
    const lat = Number(first.lat);
    const lng = Number(first.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng };
  }

  async function ensureCoordsForMissingOrders() {
    const missing = orders.filter(
      (o) =>
        o.address &&
        (o.lat === null || o.lng === null) &&
        !geocodingNowRef.current.has(o.id)
    );

    for (const order of missing) {
      try {
        geocodingNowRef.current.add(order.id);
        const found = await geocodeAddress(order.address);
        if (!found) continue;

        const { error } = await supabase
          .from("orders")
          .update({ lat: found.lat, lng: found.lng })
          .eq("id", order.id);

        if (!error) {
          setOrders((prev) =>
            prev.map((p) =>
              p.id === order.id ? { ...p, lat: found.lat, lng: found.lng } : p
            )
          );
        }
      } catch {
        // jen přeskočit
      } finally {
        geocodingNowRef.current.delete(order.id);
      }
    }
  }

  useEffect(() => {
    if (!orders.length) return;
    ensureCoordsForMissingOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders.length]);

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const ao = a.delivery_order ?? 999999;
      const bo = b.delivery_order ?? 999999;
      if (ao !== bo) return ao - bo;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [orders]);

  const selectedOrder = useMemo(
    () => sortedOrders.find((o) => o.id === selectedId) ?? null,
    [sortedOrders, selectedId]
  );

  const routePoints = useMemo(() => {
    const deliveryPoints = sortedOrders
      .filter((o) => o.lat !== null && o.lng !== null)
      .map((o) => [o.lat!, o.lng!] as [number, number]);

    return [[JIRKA_BASE.lat, JIRKA_BASE.lng] as [number, number], ...deliveryPoints];
  }, [sortedOrders]);

  const fitPoints = useMemo(() => {
    const pts = [{ lat: JIRKA_BASE.lat, lng: JIRKA_BASE.lng }];
    for (const o of sortedOrders) {
      if (o.lat !== null && o.lng !== null) {
        pts.push({ lat: o.lat, lng: o.lng });
      }
    }
    return pts;
  }, [sortedOrders]);

  useEffect(() => {
    const nextEta: Record<string, number> = {};
    let running = 0;

    for (const order of sortedOrders) {
      if (order.lat === null || order.lng === null) continue;

      // jednoduchý odhad podle vzdálenosti vzdušnou čarou
      // 1 km ~ 3 min ve městě
      const prev =
        sortedOrders.find(
          (p) =>
            (p.delivery_order ?? 999999) === ((order.delivery_order ?? 999999) - 1) &&
            p.lat !== null &&
            p.lng !== null
        ) ?? null;

      const fromLat = prev?.lat ?? JIRKA_BASE.lat;
      const fromLng = prev?.lng ?? JIRKA_BASE.lng;

      const km = haversineKm(fromLat, fromLng, order.lat, order.lng);
      const minutes = Math.max(3, Math.round(km * 3.2));
      running += minutes;
      nextEta[order.id] = running;
    }

    setEtaMap(nextEta);
  }, [sortedOrders]);

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
      setSelectedId((prev) => {
        if (prev !== orderId) return prev;
        const next = sortedOrders.find((o) => o.id !== orderId);
        return next?.id ?? null;
      });
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

  async function autoAssignOrderNumbers() {
    if (!sortedOrders.length) return;

    setBusyId("reorder");

    for (let i = 0; i < sortedOrders.length; i++) {
      const order = sortedOrders[i];
      await supabase
        .from("orders")
        .update({ delivery_order: i + 1 })
        .eq("id", order.id);
    }

    await loadOrders();
    setBusyId(null);
  }

  function openNavigation(order: OrderForUi) {
    if (order.lat !== null && order.lng !== null) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${order.lat},${order.lng}`,
        "_blank"
      );
      return;
    }

    if (order.address) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          order.address
        )}`,
        "_blank"
      );
    }
  }

  function callCustomer(order: OrderForUi) {
    const phone = normalizePhone(order.phone);
    if (!phone) return;
    window.location.href = `tel:${phone}`;
  }

  function smsCustomer(order: OrderForUi) {
    const phone = normalizePhone(order.phone);
    if (!phone) return;

    const message = buildCustomerMessage(order, etaMap[order.id] ?? null);
    window.location.href = `sms:${phone}?body=${encodeURIComponent(message)}`;
  }

  const waitingCount = sortedOrders.filter((o) => o.delivery_status === "waiting").length;
  const onRouteCount = sortedOrders.filter((o) => o.delivery_status === "on_route").length;
  const totalToday = sortedOrders.length;

  return (
    <div className="min-h-screen bg-[#f7faf7] text-[#123b1f]">
      <div className="mx-auto max-w-[1600px] px-3 py-3 md:px-5 md:py-5">
        <div className="mb-4 flex flex-col gap-3 rounded-[28px] border border-[#d7eadb] bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.05)] md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[28px] font-extrabold leading-none text-[#00a63e] md:text-[36px]">
              Rozvozy
            </div>
            <div className="mt-1 text-sm text-[#577165] md:text-base">
              Přehled rozvozových objednávek, mapa, kontakt na zákazníka a stav doručení
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/staff/reporty"
              className="rounded-full border border-[#bfe5c9] bg-white px-4 py-2 text-sm font-semibold text-[#0f5d2a] transition hover:bg-[#f4fbf5]"
            >
              Zpět na reporty
            </Link>

            <button
              onClick={loadOrders}
              className="rounded-full bg-[#00a63e] px-4 py-2 text-sm font-bold text-white transition hover:brightness-95"
            >
              Obnovit
            </button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-[24px] border border-[#d7eadb] bg-white p-4 shadow-sm">
            <div className="text-sm text-[#5e7568]">Dnes rozvozů</div>
            <div className="mt-1 text-3xl font-extrabold text-[#103f20]">{totalToday}</div>
          </div>

          <div className="rounded-[24px] border border-[#d7eadb] bg-white p-4 shadow-sm">
            <div className="text-sm text-[#5e7568]">Čeká</div>
            <div className="mt-1 text-3xl font-extrabold text-[#103f20]">{waitingCount}</div>
          </div>

          <div className="rounded-[24px] border border-[#d7eadb] bg-white p-4 shadow-sm">
            <div className="text-sm text-[#5e7568]">Na cestě</div>
            <div className="mt-1 text-3xl font-extrabold text-[#103f20]">{onRouteCount}</div>
          </div>

          <div className="rounded-[24px] border border-[#d7eadb] bg-white p-4 shadow-sm">
            <div className="text-sm text-[#5e7568]">Start</div>
            <div className="mt-1 text-base font-bold text-[#103f20]">{JIRKA_BASE.label}</div>
            <div className="text-xs text-[#5e7568]">{JIRKA_BASE.address}</div>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2 md:hidden">
          <button
            onClick={() => setActiveTab("mapa")}
            className={cx(
              "rounded-full px-4 py-2 text-sm font-bold transition",
              activeTab === "mapa"
                ? "bg-[#00a63e] text-white"
                : "border border-[#bfe5c9] bg-white text-[#0f5d2a]"
            )}
          >
            Mapa
          </button>
          <button
            onClick={() => setActiveTab("seznam")}
            className={cx(
              "rounded-full px-4 py-2 text-sm font-bold transition",
              activeTab === "seznam"
                ? "bg-[#00a63e] text-white"
                : "border border-[#bfe5c9] bg-white text-[#0f5d2a]"
            )}
          >
            Seznam
          </button>
        </div>

        {errorMsg ? (
          <div className="mb-4 rounded-[22px] border border-[#ffd6d6] bg-[#fff5f5] p-4 text-[#9f1d1d]">
            {errorMsg}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_0.95fr]">
          <div className={cx(activeTab !== "mapa" && "hidden md:block")}>
            <div className="rounded-[30px] border border-[#d7eadb] bg-white p-3 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
                <div>
                  <div className="text-[22px] font-extrabold text-[#103f20]">
                    Mapa rozvozů
                  </div>
                  <div className="text-sm text-[#5e7568]">
                    Klikni na bod nebo objednávku v seznamu
                  </div>
                </div>

                <button
                  onClick={autoAssignOrderNumbers}
                  disabled={busyId === "reorder"}
                  className="rounded-full bg-[#0b4a8f] px-4 py-2 text-sm font-bold text-white transition hover:brightness-95 disabled:opacity-60"
                >
                  {busyId === "reorder" ? "Přepočítávám..." : "Nastavit pořadí 1,2,3..."}
                </button>
              </div>

              <div className="delivery-map-wrap overflow-hidden rounded-[24px] border border-[#deefe1]">
                <div className="h-[62vh] min-h-[420px] w-full">
                  <MapContainer
                    center={DEFAULT_CENTER}
                    zoom={13}
                    style={{ height: "100%", width: "100%" }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    <FitAllMarkers points={fitPoints} />
                    <FlyToSelected order={selectedOrder} />

                    <Marker position={[JIRKA_BASE.lat, JIRKA_BASE.lng]} icon={homeIcon}>
                      <Popup>
                        <div className="min-w-[180px]">
                          <div className="text-base font-extrabold text-[#103f20]">
                            {JIRKA_BASE.label}
                          </div>
                          <div className="mt-1 text-sm text-[#556d62]">{JIRKA_BASE.address}</div>
                        </div>
                      </Popup>
                    </Marker>

                    {routePoints.length >= 2 ? (
                      <Polyline
                        positions={routePoints}
                        pathOptions={{
                          color: "#0b4a8f",
                          weight: 5,
                          opacity: 0.82,
                        }}
                      />
                    ) : null}

                    {sortedOrders.map((order, idx) => {
                      if (order.lat === null || order.lng === null) return null;

                      const active = selectedId === order.id;
                      const done = order.delivery_status === "delivered";

                      return (
                        <Marker
                          key={order.id}
                          position={[order.lat, order.lng]}
                          icon={makeStopIcon(idx + 1, active, done)}
                          eventHandlers={{
                            click: () => {
                              setSelectedId(order.id);
                              setActiveTab("mapa");
                            },
                          }}
                        >
                          <Popup>
                            <div className="min-w-[220px]">
                              <div className="text-lg font-extrabold text-[#103f20]">
                                {order.full_name}
                              </div>

                              <div className="mt-1 text-sm text-[#556d62]">{order.address}</div>

                              {order.phone ? (
                                <div className="mt-1 text-sm font-semibold text-[#103f20]">
                                  {order.phone}
                                </div>
                              ) : null}

                              <div className="mt-2 grid grid-cols-2 gap-2">
                                <button
                                  onClick={() => openNavigation(order)}
                                  className="rounded-xl bg-[#0b4a8f] px-3 py-2 text-sm font-bold text-white"
                                >
                                  Navigovat
                                </button>
                                <button
                                  onClick={() => callCustomer(order)}
                                  className="rounded-xl border border-[#cfe5d5] bg-white px-3 py-2 text-sm font-bold text-[#103f20]"
                                >
                                  Zavolat
                                </button>
                                <button
                                  onClick={() => smsCustomer(order)}
                                  className="rounded-xl border border-[#cfe5d5] bg-white px-3 py-2 text-sm font-bold text-[#103f20]"
                                >
                                  SMS
                                </button>
                                <button
                                  onClick={() => markDelivered(order.id)}
                                  className="rounded-xl bg-[#00a63e] px-3 py-2 text-sm font-bold text-white"
                                >
                                  Vyřízeno
                                </button>
                              </div>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MapContainer>
                </div>
              </div>
            </div>
          </div>

          <div className={cx(activeTab !== "seznam" && "hidden md:block")}>
            <div className="rounded-[30px] border border-[#d7eadb] bg-white p-3 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
              <div className="mb-3 px-1">
                <div className="text-[22px] font-extrabold text-[#103f20]">
                  Seznam objednávek
                </div>
                <div className="text-sm text-[#5e7568]">
                  Kliknutí na kartu tě přesune na bod v mapě
                </div>
              </div>

              <div className="max-h-[75vh] space-y-3 overflow-y-auto pr-1">
                {loading ? (
                  <div className="rounded-[24px] border border-[#deefe1] bg-[#fbfefb] p-5 text-[#567164]">
                    Načítám rozvozy...
                  </div>
                ) : null}

                {!loading && sortedOrders.length === 0 ? (
                  <div className="rounded-[24px] border border-[#deefe1] bg-[#fbfefb] p-5 text-[#567164]">
                    Teď tu nejsou žádné aktivní rozvozy.
                  </div>
                ) : null}

                {sortedOrders.map((order, idx) => {
                  const selected = selectedId === order.id;
                  const eta = etaMap[order.id];
                  const noteDraft = noteDrafts[order.id] ?? order.driver_note ?? "";

                  return (
                    <div
                      key={order.id}
                      onClick={() => {
                        setSelectedId(order.id);
                        setActiveTab("mapa");
                      }}
                      className={cx(
                        "cursor-pointer rounded-[26px] border p-4 transition",
                        selected
                          ? "border-[#9fdbb0] bg-[#f4fbf5] shadow-sm"
                          : "border-[#deefe1] bg-white hover:bg-[#f9fcf9]"
                      )}
                    >
                      <div className="mb-3 flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#00a63e] text-base font-extrabold text-white">
                          {idx + 1}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-[20px] font-extrabold text-[#103f20]">
                              {order.full_name}
                            </div>

                            <span
                              className={cx(
                                "rounded-full px-2.5 py-1 text-xs font-bold",
                                order.delivery_status === "waiting" &&
                                  "bg-[#fff6db] text-[#8a6610]",
                                order.delivery_status === "on_route" &&
                                  "bg-[#e6f0ff] text-[#0b4a8f]",
                                order.delivery_status === "delivered" &&
                                  "bg-[#e8f8ec] text-[#0f6c2a]"
                              )}
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
                            <div>Objednávka: {formatTime(order.created_at)}</div>
                            {eta ? <div>ETA: {eta} min</div> : null}
                          </div>

                          {(order.lat === null || order.lng === null) && order.address ? (
                            <div className="mt-2 text-xs font-semibold text-[#a35b00]">
                              Adresa ještě nemá souřadnice. Systém je zkusí dopočítat.
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(order.id);
                            setActiveTab("mapa");
                          }}
                          className="rounded-2xl border border-[#cfe5d5] bg-white px-3 py-2 text-sm font-bold text-[#103f20]"
                        >
                          Mapa
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openNavigation(order);
                          }}
                          className="rounded-2xl bg-[#0b4a8f] px-3 py-2 text-sm font-bold text-white"
                        >
                          Navigovat
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            callCustomer(order);
                          }}
                          className="rounded-2xl border border-[#cfe5d5] bg-white px-3 py-2 text-sm font-bold text-[#103f20]"
                        >
                          Zavolat
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            smsCustomer(order);
                          }}
                          className="rounded-2xl border border-[#cfe5d5] bg-white px-3 py-2 text-sm font-bold text-[#103f20]"
                        >
                          Poslat zprávu
                        </button>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto]">
                        <input
                          value={noteDraft}
                          onClick={(e) => e.stopPropagation()}
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
                          onClick={(e) => {
                            e.stopPropagation();
                            saveDriverNote(order.id);
                          }}
                          disabled={busyId === order.id}
                          className="rounded-2xl border border-[#cfe5d5] bg-white px-4 py-2 text-sm font-bold text-[#103f20] disabled:opacity-60"
                        >
                          Uložit poznámku
                        </button>

                        {order.delivery_status === "waiting" ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markOnRoute(order.id);
                            }}
                            disabled={busyId === order.id}
                            className="rounded-2xl bg-[#0b4a8f] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                          >
                            Na cestě
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markDelivered(order.id);
                            }}
                            disabled={busyId === order.id}
                            className="rounded-2xl bg-[#00a63e] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                          >
                            Vyřízeno
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}