"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
  lat: number | null;
  lng: number | null;
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
  lat: number | null;
  lng: number | null;
  driver_note: string;
  delivered_at: string | null;
};

const JIRKA_BASE = {
  name: "Jiřka",
  address: "Havlíčkova 72, 29001 Poděbrady",
  lat: 50.1434,
  lng: 15.1188,
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

function estimateMinutesFromRoute(
  orders: OrderUi[]
): Record<string, number> {
  const result: Record<string, number> = {};
  let running = 0;

  let prevLat = JIRKA_BASE.lat;
  let prevLng = JIRKA_BASE.lng;

  for (const order of orders) {
    if (order.lat == null || order.lng == null) continue;

    const km = haversineKm(prevLat, prevLng, order.lat, order.lng);
    const minutes = Math.max(3, Math.round(km * 3.2));
    running += minutes;
    result[order.id] = running;

    prevLat = order.lat;
    prevLng = order.lng;
  }

  return result;
}

async function geocodeAddress(address: string) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=cz&q=${encodeURIComponent(
    address
  )}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!res.ok) return null;

  const json = await res.json();
  if (!Array.isArray(json) || !json[0]) return null;

  const first = json[0];
  const lat = Number(first.lat);
  const lng = Number(first.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
}

export default function RozvozyPage() {
  const [orders, setOrders] = useState<OrderUi[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"mapa" | "seznam">("mapa");
  const [leafletReady, setLeafletReady] = useState(false);

  const geocodingIdsRef = useRef<Set<string>>(new Set());

  const mapWrapRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);

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
      lat: row.lat ?? null,
      lng: row.lng ?? null,
      driver_note: row.driver_note ?? "",
      delivered_at: row.delivered_at ?? null,
    }));

    setOrders(mapped);

    const nextDrafts: Record<string, string> = {};
    for (const order of mapped) {
      nextDrafts[order.id] = order.driver_note || "";
    }
    setNoteDrafts(nextDrafts);

    setSelectedId((prev) => prev ?? mapped[0]?.id ?? null);
    setLoading(false);
  }

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initLeaflet() {
      const L = await import("leaflet");
      if (cancelled) return;
      leafletRef.current = L;
      setLeafletReady(true);
    }

    initLeaflet();

    return () => {
      cancelled = true;
    };
  }, []);

  async function ensureMissingCoords() {
    const missing = orders.filter(
      (o) =>
        o.address &&
        (o.lat == null || o.lng == null) &&
        !geocodingIdsRef.current.has(o.id)
    );

    for (const order of missing) {
      try {
        geocodingIdsRef.current.add(order.id);

        const found = await geocodeAddress(order.address);
        if (!found) continue;

        const { error } = await supabase
          .from("orders")
          .update({
            lat: found.lat,
            lng: found.lng,
          })
          .eq("id", order.id);

        if (!error) {
          setOrders((prev) =>
            prev.map((p) =>
              p.id === order.id
                ? { ...p, lat: found.lat, lng: found.lng }
                : p
            )
          );
        }
      } finally {
        geocodingIdsRef.current.delete(order.id);
      }
    }
  }

  useEffect(() => {
    if (!orders.length) return;
    ensureMissingCoords();
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

  const etaMap = useMemo(() => estimateMinutesFromRoute(sortedOrders), [sortedOrders]);

  const waitingCount = useMemo(
    () => sortedOrders.filter((o) => o.delivery_status === "waiting").length,
    [sortedOrders]
  );

  const onRouteCount = useMemo(
    () => sortedOrders.filter((o) => o.delivery_status === "on_route").length,
    [sortedOrders]
  );

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

  async function assignOrderNumbers() {
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

  function openNavigation(order: OrderUi) {
    if (order.lat != null && order.lng != null) {
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

  function callCustomer(order: OrderUi) {
    if (!order.phone) return;
    const phone = normalizePhone(order.phone);
    window.location.href = `tel:${phone}`;
  }

  function smsCustomer(order: OrderUi) {
    if (!order.phone) return;
    const phone = normalizePhone(order.phone);
    const eta = etaMap[order.id];
    const text =
      typeof eta === "number"
        ? `Dobrý den, za ${Math.max(1, Math.round(eta))} minut jsme u Vás. Jiřka`
        : "Dobrý den, za chvíli jsme u Vás. Jiřka";

    window.location.href = `sms:${phone}?body=${encodeURIComponent(text)}`;
  }

  useEffect(() => {
    if (!leafletReady || !mapWrapRef.current || mapRef.current) return;

    const L = leafletRef.current;
    if (!L) return;

    const map = L.map(mapWrapRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([JIRKA_BASE.lat, JIRKA_BASE.lng], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [leafletReady]);

  useEffect(() => {
    if (!leafletReady || !mapRef.current || !markersLayerRef.current || !routeLayerRef.current) {
      return;
    }

    const L = leafletRef.current;
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;
    const routeLayer = routeLayerRef.current;

    markersLayer.clearLayers();
    routeLayer.clearLayers();

    const allPoints: Array<[number, number]> = [[JIRKA_BASE.lat, JIRKA_BASE.lng]];

    const homeIcon = L.divIcon({
      className: "",
      html: `
        <div style="
          width:42px;
          height:42px;
          border-radius:14px;
          background:#fff;
          border:2px solid #d7eadb;
          display:flex;
          align-items:center;
          justify-content:center;
          box-shadow:0 8px 18px rgba(0,0,0,.14);
          font-size:20px;
        ">🏠</div>
      `,
      iconSize: [42, 42],
      iconAnchor: [21, 40],
      popupAnchor: [0, -34],
    });

    L.marker([JIRKA_BASE.lat, JIRKA_BASE.lng], { icon: homeIcon })
      .addTo(markersLayer)
      .bindPopup(
        `<div style="min-width:180px">
          <div style="font-weight:800;font-size:16px;color:#103f20">${JIRKA_BASE.name}</div>
          <div style="margin-top:4px;font-size:13px;color:#556d62">${JIRKA_BASE.address}</div>
        </div>`
      );

    sortedOrders.forEach((order, idx) => {
      if (order.lat == null || order.lng == null) return;

      allPoints.push([order.lat, order.lng]);

      const isActive = selectedId === order.id;
      const bg =
        order.delivery_status === "on_route"
          ? "#0b4a8f"
          : isActive
          ? "#146c2e"
          : "#00a63e";

      const icon = L.divIcon({
        className: "",
        html: `
          <div style="
            width:36px;
            height:36px;
            border-radius:999px;
            background:${bg};
            color:#fff;
            border:3px solid #fff;
            display:flex;
            align-items:center;
            justify-content:center;
            box-shadow:0 8px 18px rgba(0,0,0,.18);
            font-weight:800;
            font-size:14px;
          ">${order.delivery_order ?? idx + 1}</div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -28],
      });

      const marker = L.marker([order.lat, order.lng], { icon }).addTo(markersLayer);

      marker.bindPopup(
        `<div style="min-width:210px">
          <div style="font-weight:800;font-size:17px;color:#103f20">${order.full_name}</div>
          <div style="margin-top:6px;font-size:13px;color:#556d62">${order.address}</div>
          ${
            order.phone
              ? `<div style="margin-top:6px;font-size:13px;font-weight:700;color:#103f20">${order.phone}</div>`
              : ""
          }
          ${
            etaMap[order.id]
              ? `<div style="margin-top:6px;font-size:13px;color:#0b4a8f;font-weight:700">ETA: ${etaMap[order.id]} min</div>`
              : ""
          }
        </div>`
      );

      marker.on("click", () => {
        setSelectedId(order.id);
        setMobileTab("mapa");
      });
    });

    if (allPoints.length >= 2) {
      L.polyline(allPoints, {
        color: "#0b4a8f",
        weight: 5,
        opacity: 0.8,
      }).addTo(routeLayer);
    }

    if (allPoints.length === 1) {
      map.setView([JIRKA_BASE.lat, JIRKA_BASE.lng], 13);
    } else {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [35, 35] });
    }
  }, [leafletReady, sortedOrders, selectedId, etaMap]);

  useEffect(() => {
    if (!leafletReady || !mapRef.current || !selectedOrder?.lat || !selectedOrder?.lng) return;
    mapRef.current.flyTo([selectedOrder.lat, selectedOrder.lng], 16, {
      duration: 0.7,
    });
  }, [leafletReady, selectedOrder]);

  return (
    <div className="min-h-screen bg-[#f7faf7] text-[#123b1f]">
      <div className="mx-auto max-w-[1600px] px-3 py-4 md:px-5 md:py-6">
        <div className="mb-4 rounded-[28px] border border-[#d7eadb] bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.05)] md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-[28px] font-extrabold leading-none text-[#00a63e] md:text-[36px]">
                Rozvozy
              </h1>
              <div className="mt-2 text-sm text-[#5e7568] md:text-base">
                Mapa, seznam objednávek, kontakty, stavy a poznámky řidiče
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
              {sortedOrders.length}
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

        <div className="mb-4 flex gap-2 md:hidden">
          <button
            onClick={() => setMobileTab("mapa")}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              mobileTab === "mapa"
                ? "bg-[#00a63e] text-white"
                : "border border-[#bfe5c9] bg-white text-[#0f5d2a]"
            }`}
          >
            Mapa
          </button>
          <button
            onClick={() => setMobileTab("seznam")}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              mobileTab === "seznam"
                ? "bg-[#00a63e] text-white"
                : "border border-[#bfe5c9] bg-white text-[#0f5d2a]"
            }`}
          >
            Seznam
          </button>
        </div>

        {errorMsg ? (
          <div className="mb-4 rounded-[22px] border border-[#ffd6d6] bg-[#fff5f5] p-4 text-[#9f1d1d]">
            {errorMsg}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_0.95fr]">
          <div className={mobileTab !== "mapa" ? "hidden md:block" : ""}>
            <div className="rounded-[30px] border border-[#d7eadb] bg-white p-3 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
              <div className="mb-3 px-1">
                <div className="text-[22px] font-extrabold text-[#103f20]">
                  Mapa rozvozů
                </div>
                <div className="text-sm text-[#5e7568]">
                  Klikni na objednávku v seznamu nebo na bod v mapě
                </div>
              </div>

              <div className="overflow-hidden rounded-[24px] border border-[#deefe1]">
                <div
                  ref={mapWrapRef}
                  style={{ height: "62vh", minHeight: 420, width: "100%" }}
                />
              </div>

              {selectedOrder ? (
                <div className="mt-3 rounded-[24px] border border-[#deefe1] bg-[#f9fcf9] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-[22px] font-extrabold text-[#103f20]">
                      {selectedOrder.full_name}
                    </div>
                    <span
                      className={
                        selectedOrder.delivery_status === "waiting"
                          ? "rounded-full bg-[#fff6db] px-2.5 py-1 text-xs font-bold text-[#8a6610]"
                          : "rounded-full bg-[#e6f0ff] px-2.5 py-1 text-xs font-bold text-[#0b4a8f]"
                      }
                    >
                      {selectedOrder.delivery_status === "waiting" ? "Čeká" : "Na cestě"}
                    </span>
                  </div>

                  <div className="mt-2 text-sm text-[#4f685d]">{selectedOrder.address}</div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-[#103f20]">
                    {selectedOrder.phone ? <div>{selectedOrder.phone}</div> : null}
                    <div>{formatPrice(selectedOrder.total)}</div>
                    <div>Objednávka: {formatDateTime(selectedOrder.created_at)}</div>
                    {etaMap[selectedOrder.id] ? <div>ETA: {etaMap[selectedOrder.id]} min</div> : null}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                    <button
                      onClick={() => openNavigation(selectedOrder)}
                      className="rounded-2xl bg-[#0b4a8f] px-3 py-2 text-sm font-bold text-white"
                    >
                      Navigovat
                    </button>

                    <button
                      onClick={() => callCustomer(selectedOrder)}
                      className="rounded-2xl border border-[#cfe5d5] bg-white px-3 py-2 text-sm font-bold text-[#103f20]"
                    >
                      Zavolat
                    </button>

                    <button
                      onClick={() => smsCustomer(selectedOrder)}
                      className="rounded-2xl border border-[#cfe5d5] bg-white px-3 py-2 text-sm font-bold text-[#103f20]"
                    >
                      Poslat zprávu
                    </button>

                    {selectedOrder.delivery_status === "waiting" ? (
                      <button
                        onClick={() => markOnRoute(selectedOrder.id)}
                        disabled={busyId === selectedOrder.id}
                        className="rounded-2xl bg-[#0b4a8f] px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                      >
                        Na cestě
                      </button>
                    ) : (
                      <button
                        onClick={() => markDelivered(selectedOrder.id)}
                        disabled={busyId === selectedOrder.id}
                        className="rounded-2xl bg-[#00a63e] px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                      >
                        Vyřízeno
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-[24px] border border-[#deefe1] bg-[#fbfefb] p-4 text-[#567164]">
                  Vyber objednávku v seznamu.
                </div>
              )}
            </div>
          </div>

          <div className={mobileTab !== "seznam" ? "hidden md:block" : ""}>
            <div className="rounded-[30px] border border-[#d7eadb] bg-white p-3 shadow-[0_10px_30px_rgba(0,0,0,0.05)] md:p-4">
              <div className="mb-3 px-1">
                <div className="text-[22px] font-extrabold text-[#103f20]">
                  Seznam objednávek
                </div>
                <div className="text-sm text-[#5e7568]">
                  Objednávka se ukáže i v mapě a dopočítá se orientační ETA
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
                    <div className="mt-2 text-sm">
                      Zobrazí se jen objednávky, kde je v databázi:
                      <br />
                      <span className="font-bold">delivery_mode = ano</span>
                    </div>
                  </div>
                ) : null}

                {sortedOrders.map((order, idx) => {
                  const noteDraft = noteDrafts[order.id] ?? "";
                  const selected = selectedId === order.id;

                  return (
                    <div
                      key={order.id}
                      onClick={() => {
                        setSelectedId(order.id);
                        setMobileTab("mapa");
                      }}
                      className={`cursor-pointer rounded-[26px] border p-4 transition ${
                        selected
                          ? "border-[#9fdbb0] bg-[#f4fbf5] shadow-sm"
                          : "border-[#deefe1] bg-white hover:bg-[#f9fcf9]"
                      }`}
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
                            {etaMap[order.id] ? <div>ETA: {etaMap[order.id]} min</div> : null}
                          </div>

                          {(order.lat == null || order.lng == null) && order.address ? (
                            <div className="mt-2 text-xs font-semibold text-[#a35b00]">
                              Adresa ještě nemá souřadnice. Systém je zkusí dopočítat.
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div
                        className="grid grid-cols-2 gap-2 md:grid-cols-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setSelectedId(order.id);
                            setMobileTab("mapa");
                          }}
                          className="rounded-2xl border border-[#cfe5d5] bg-white px-3 py-2 text-sm font-bold text-[#103f20]"
                        >
                          Mapa
                        </button>

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
                      </div>

                      <div
                        className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto]"
                        onClick={(e) => e.stopPropagation()}
                      >
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

                        {order.delivery_status === "waiting" ? (
                          <button
                            onClick={() => markOnRoute(order.id)}
                            disabled={busyId === order.id}
                            className="rounded-2xl bg-[#0b4a8f] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                          >
                            Na cestě
                          </button>
                        ) : (
                          <button
                            onClick={() => markDelivered(order.id)}
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