"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type DeliveryStatus = "waiting" | "on_route" | "delivered";
type DeliveryZone = "okruh1" | "okruh2" | "skolky" | null;
type FilterKey = "okruh1" | "okruh2" | "skolky" | "vsechny";

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
  delivery_zone: string | null;
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
  delivery_zone: DeliveryZone;
};

const JIRKA_BASE = {
  name: "Jiřka",
  address: "Havlíčkova 72, 29001 Poděbrady",
  lat: 50.1434,
  lng: 15.1188,
};

// přibližná hranice železnice v Poděbradech
const RAILWAY_LAT_SPLIT = 50.1425;

function formatPrice(value: number) {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatShortTime(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("cs-CZ", {
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

function estimateMinutesFromRoute(orders: OrderUi[]): Record<string, number> {
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

function autoZoneFromLat(lat: number | null): DeliveryZone {
  if (lat == null) return null;
  return lat >= RAILWAY_LAT_SPLIT ? "okruh1" : "okruh2";
}

function zoneLabel(zone: DeliveryZone) {
  if (zone === "okruh1") return "Okruh 1";
  if (zone === "okruh2") return "Okruh 2";
  if (zone === "skolky") return "Školky";
  return "Bez okruhu";
}

function zoneBadgeClass(zone: DeliveryZone) {
  if (zone === "okruh1") return "bg-[#e8f8ec] text-[#0f6c2a]";
  if (zone === "okruh2") return "bg-[#e8f1ff] text-[#0b4a8f]";
  if (zone === "skolky") return "bg-[#fff3e6] text-[#9a5800]";
  return "bg-[#f2f4f5] text-[#5f6b73]";
}

async function geocodeAddress(address: string) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=cz&q=${encodeURIComponent(
    address
  )}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
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
  const [mobileTab, setMobileTab] = useState<"mapa" | "seznam">("seznam");
  const [filter, setFilter] = useState<FilterKey>("vsechny");
  const [showSettings, setShowSettings] = useState(false);
  const [leafletReady, setLeafletReady] = useState(false);

  const geocodingIdsRef = useRef<Set<string>>(new Set());
  const mapWrapRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);

  async function loadOrders() {
    setLoading(true);
    setErrorMsg("");

    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, created_at, full_name, phone, address, total, delivery_mode, delivery_status, delivery_order, lat, lng, driver_note, delivered_at, delivery_zone"
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

    const mapped: OrderUi[] = rows.map((row) => {
      const autoZone = autoZoneFromLat(row.lat ?? null);
      return {
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
        delivery_zone:
          (row.delivery_zone as DeliveryZone) || autoZone || null,
      };
    });

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

  async function ensureMissingCoordsAndZones() {
    const needCoords = orders.filter(
      (o) =>
        o.address &&
        (o.lat == null || o.lng == null) &&
        !geocodingIdsRef.current.has(o.id)
    );

    for (const order of needCoords) {
      try {
        geocodingIdsRef.current.add(order.id);
        const found = await geocodeAddress(order.address);
        if (!found) continue;

        const zone = autoZoneFromLat(found.lat);

        const { error } = await supabase
          .from("orders")
          .update({
            lat: found.lat,
            lng: found.lng,
            delivery_zone: order.delivery_zone ?? zone,
          })
          .eq("id", order.id);

        if (!error) {
          setOrders((prev) =>
            prev.map((p) =>
              p.id === order.id
                ? {
                    ...p,
                    lat: found.lat,
                    lng: found.lng,
                    delivery_zone: p.delivery_zone ?? zone,
                  }
                : p
            )
          );
        }
      } finally {
        geocodingIdsRef.current.delete(order.id);
      }
    }

    const needZoneOnly = orders.filter(
      (o) => o.lat != null && !o.delivery_zone
    );

    for (const order of needZoneOnly) {
      const zone = autoZoneFromLat(order.lat);
      if (!zone) continue;

      const { error } = await supabase
        .from("orders")
        .update({ delivery_zone: zone })
        .eq("id", order.id);

      if (!error) {
        setOrders((prev) =>
          prev.map((p) =>
            p.id === order.id ? { ...p, delivery_zone: zone } : p
          )
        );
      }
    }
  }

  useEffect(() => {
    if (!orders.length) return;
    ensureMissingCoordsAndZones();
  }, [orders.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const ao = a.delivery_order ?? 999999;
      const bo = b.delivery_order ?? 999999;
      if (ao !== bo) return ao - bo;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (filter === "vsechny") return sortedOrders;
    return sortedOrders.filter((o) => o.delivery_zone === filter);
  }, [sortedOrders, filter]);

  const selectedOrder = useMemo(() => {
    return filteredOrders.find((o) => o.id === selectedId) ?? null;
  }, [filteredOrders, selectedId]);

  const etaMap = useMemo(() => estimateMinutesFromRoute(filteredOrders), [filteredOrders]);

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
        const next = filteredOrders.find((o) => o.id !== orderId);
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

    for (let i = 0; i < filteredOrders.length; i++) {
      const order = filteredOrders[i];
      await supabase
        .from("orders")
        .update({ delivery_order: i + 1 })
        .eq("id", order.id);
    }

    await loadOrders();
    setBusyId(null);
  }

  async function setZone(orderId: string, zone: DeliveryZone) {
    setBusyId(orderId);

    const { error } = await supabase
      .from("orders")
      .update({ delivery_zone: zone })
      .eq("id", orderId);

    if (!error) {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, delivery_zone: zone } : o))
      );
    }

    setBusyId(null);
  }

  function openNavigation(order: OrderUi) {
    if (order.lat != null && order.lng != null) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${order.lat},${order.lng}&travelmode=driving`,
        "_blank"
      );
      return;
    }

    if (order.address) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
          order.address
        )}&travelmode=driving`,
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
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [leafletReady]);

  useEffect(() => {
    if (!leafletReady || !mapRef.current || !markersLayerRef.current) return;

    const L = leafletRef.current;
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;

    markersLayer.clearLayers();

    const points: Array<[number, number]> = [];

    const homeIcon = L.divIcon({
      className: "",
      html: `
        <div style="
          width:40px;height:40px;border-radius:12px;background:#fff;border:2px solid #d7eadb;
          display:flex;align-items:center;justify-content:center;font-size:19px;
          box-shadow:0 8px 18px rgba(0,0,0,.12);
        ">🏠</div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 38],
      popupAnchor: [0, -30],
    });

    L.marker([JIRKA_BASE.lat, JIRKA_BASE.lng], { icon: homeIcon })
      .addTo(markersLayer)
      .bindPopup(
        `<div style="min-width:160px">
          <div style="font-weight:800;font-size:16px;color:#103f20">Jiřka</div>
          <div style="margin-top:4px;font-size:13px;color:#556d62">${JIRKA_BASE.address}</div>
        </div>`
      );

    points.push([JIRKA_BASE.lat, JIRKA_BASE.lng]);

    filteredOrders.forEach((order, idx) => {
      if (order.lat == null || order.lng == null) return;

      points.push([order.lat, order.lng]);

      const isActive = selectedId === order.id;
      const bg =
        order.delivery_zone === "skolky"
          ? "#d97706"
          : order.delivery_zone === "okruh2"
          ? "#0b4a8f"
          : "#00a63e";

      const border = isActive ? "4px solid #111827" : "3px solid #fff";

      const icon = L.divIcon({
        className: "",
        html: `
          <div style="
            width:34px;height:34px;border-radius:999px;background:${bg};color:#fff;
            border:${border};display:flex;align-items:center;justify-content:center;
            font-weight:800;font-size:13px;box-shadow:0 8px 18px rgba(0,0,0,.18);
          ">${order.delivery_order ?? idx + 1}</div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
        popupAnchor: [0, -26],
      });

      const marker = L.marker([order.lat, order.lng], { icon }).addTo(markersLayer);

      marker.bindPopup(
        `<div style="min-width:210px">
          <div style="font-weight:800;font-size:16px;color:#103f20">${order.full_name}</div>
          <div style="margin-top:4px;font-size:13px;color:#556d62">${order.address}</div>
          ${
            order.phone
              ? `<div style="margin-top:5px;font-size:13px;font-weight:700;color:#103f20">${order.phone}</div>`
              : ""
          }
          <div style="margin-top:6px;font-size:12px;color:#556d62">${zoneLabel(
            order.delivery_zone
          )}</div>
        </div>`
      );

      marker.on("click", () => {
        setSelectedId(order.id);
        setMobileTab("mapa");
      });
    });

    if (points.length === 1) {
      map.setView([JIRKA_BASE.lat, JIRKA_BASE.lng], 13);
    } else {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [28, 28] });
    }
  }, [leafletReady, filteredOrders, selectedId]);

  useEffect(() => {
    if (!leafletReady || !mapRef.current || !selectedOrder?.lat || !selectedOrder?.lng) return;
    mapRef.current.flyTo([selectedOrder.lat, selectedOrder.lng], 16, {
      duration: 0.6,
    });
  }, [leafletReady, selectedOrder]);

  const filterBtn = (key: FilterKey, label: string) => (
    <button
      onClick={() => setFilter(key)}
      className={`rounded-full px-3 py-2 text-sm font-bold transition ${
        filter === key
          ? "bg-[#00a63e] text-white"
          : "border border-[#cfe5d5] bg-white text-[#103f20] hover:bg-[#f6fbf7]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#f7faf7] text-[#123b1f]">
      <div className="mx-auto max-w-[1600px] px-3 py-3 md:px-5 md:py-5">
        <div className="mb-4 rounded-[26px] border border-[#d7eadb] bg-white p-3 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="text-[30px] font-extrabold leading-none text-[#00a63e]">
                Rozvozy
              </div>
              <div className="mt-1 text-sm text-[#5e7568]">
                Kompaktní přehled rozvozů podle okruhů
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {filterBtn("okruh1", "Okruh 1")}
              {filterBtn("okruh2", "Okruh 2")}
              {filterBtn("skolky", "Školky")}
              {filterBtn("vsechny", "Všechny")}

              <button
                onClick={() => setShowSettings((v) => !v)}
                className={`rounded-full px-3 py-2 text-sm font-bold ${
                  showSettings
                    ? "bg-[#0b4a8f] text-white"
                    : "border border-[#cfe5d5] bg-white text-[#103f20]"
                }`}
              >
                Nastavení
              </button>

              <button
                onClick={loadOrders}
                className="rounded-full border border-[#cfe5d5] bg-white px-3 py-2 text-sm font-bold text-[#103f20]"
              >
                Obnovit
              </button>

              <Link
                href="/staff/reporty"
                className="rounded-full border border-[#cfe5d5] bg-white px-3 py-2 text-sm font-bold text-[#103f20]"
              >
                Zpět
              </Link>
            </div>
          </div>

          {showSettings ? (
            <div className="mt-3 rounded-[20px] border border-[#e3efe6] bg-[#fbfefb] p-3 text-sm text-[#556d62]">
              <div>
                <span className="font-bold text-[#103f20]">Automatické rozdělení:</span>{" "}
                sever od železnice = Okruh 1, jih = Okruh 2.
              </div>
              <div className="mt-1">
                Školky můžeš ručně přepnout přímo u objednávky v seznamu.
              </div>
              <div className="mt-2">
                <button
                  onClick={assignOrderNumbers}
                  disabled={busyId === "reorder"}
                  className="rounded-full bg-[#0b4a8f] px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  {busyId === "reorder" ? "Nastavuji pořadí..." : "Nastavit pořadí v aktuálním filtru"}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mb-3 flex gap-2 md:hidden">
          <button
            onClick={() => setMobileTab("seznam")}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              mobileTab === "seznam"
                ? "bg-[#00a63e] text-white"
                : "border border-[#cfe5d5] bg-white text-[#103f20]"
            }`}
          >
            Seznam
          </button>
          <button
            onClick={() => setMobileTab("mapa")}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              mobileTab === "mapa"
                ? "bg-[#00a63e] text-white"
                : "border border-[#cfe5d5] bg-white text-[#103f20]"
            }`}
          >
            Mapa
          </button>
        </div>

        {errorMsg ? (
          <div className="mb-4 rounded-[20px] border border-[#ffd6d6] bg-[#fff5f5] p-4 text-[#9f1d1d]">
            {errorMsg}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.25fr]">
          <div className={mobileTab !== "seznam" ? "hidden md:block" : ""}>
            <div className="rounded-[26px] border border-[#d7eadb] bg-white p-3 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
              <div className="mb-2 flex items-center justify-between px-1">
                <div>
                  <div className="text-[22px] font-extrabold text-[#103f20]">
                    Seznam objednávek
                  </div>
                  <div className="text-sm text-[#5e7568]">
                    {filter === "vsechny" ? "Všechny aktivní rozvozy" : zoneLabel(filter)}
                  </div>
                </div>

                <div className="rounded-full bg-[#f4faf5] px-3 py-1 text-xs font-bold text-[#103f20]">
                  {filteredOrders.length} objednávek
                </div>
              </div>

              <div className="max-h-[76vh] overflow-y-auto">
                {loading ? (
                  <div className="rounded-[18px] border border-[#e3efe6] bg-[#fbfefb] p-4 text-[#5e7568]">
                    Načítám rozvozy...
                  </div>
                ) : null}

                {!loading && filteredOrders.length === 0 ? (
                  <div className="rounded-[18px] border border-[#e3efe6] bg-[#fbfefb] p-4 text-[#5e7568]">
                    V tomto filtru teď nejsou žádné objednávky.
                  </div>
                ) : null}

                {!loading &&
                  filteredOrders.map((order, idx) => {
                    const selected = selectedId === order.id;
                    const noteDraft = noteDrafts[order.id] ?? "";

                    return (
                      <div
                        key={order.id}
                        onClick={() => {
                          setSelectedId(order.id);
                          setMobileTab("mapa");
                        }}
                        className={`mb-2 rounded-[18px] border px-3 py-3 transition ${
                          selected
                            ? "border-[#a6dcb4] bg-[#f4fbf5]"
                            : "border-[#e3efe6] bg-white hover:bg-[#fafdfb]"
                        }`}
                      >
                        <div className="grid grid-cols-[34px_1fr_auto] items-start gap-3">
                          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#00a63e] text-sm font-extrabold text-white">
                            {order.delivery_order ?? idx + 1}
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="truncate text-[18px] font-extrabold text-[#103f20]">
                                {order.full_name}
                              </div>

                              <span
                                className={`rounded-full px-2 py-1 text-[11px] font-bold ${zoneBadgeClass(
                                  order.delivery_zone
                                )}`}
                              >
                                {zoneLabel(order.delivery_zone)}
                              </span>

                              <span
                                className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                                  order.delivery_status === "waiting"
                                    ? "bg-[#fff6db] text-[#8a6610]"
                                    : "bg-[#e6f1ff] text-[#0b4a8f]"
                                }`}
                              >
                                {order.delivery_status === "waiting" ? "Čeká" : "Na cestě"}
                              </span>
                            </div>

                            <div className="mt-1 truncate text-sm text-[#4f685d]">
                              {order.address}
                            </div>

                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold text-[#103f20]">
                              {order.phone ? <span>{order.phone}</span> : null}
                              <span>{formatPrice(order.total)}</span>
                              <span>{formatShortTime(order.created_at)}</span>
                              {etaMap[order.id] ? <span>ETA {etaMap[order.id]}m</span> : null}
                            </div>
                          </div>

                          <div
                            className="flex flex-col gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                setSelectedId(order.id);
                                setMobileTab("mapa");
                              }}
                              className="rounded-full border border-[#d6e8da] px-3 py-1.5 text-xs font-bold text-[#103f20]"
                            >
                              Mapa
                            </button>

                            <button
                              onClick={() => openNavigation(order)}
                              className="rounded-full bg-[#0b4a8f] px-3 py-1.5 text-xs font-bold text-white"
                            >
                              Navigovat
                            </button>
                          </div>
                        </div>

                        <div
                          className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => callCustomer(order)}
                            className="rounded-xl border border-[#d6e8da] bg-white px-2 py-2 text-xs font-bold text-[#103f20]"
                          >
                            Zavolat
                          </button>

                          <button
                            onClick={() => smsCustomer(order)}
                            className="rounded-xl border border-[#d6e8da] bg-white px-2 py-2 text-xs font-bold text-[#103f20]"
                          >
                            SMS
                          </button>

                          <button
                            onClick={() => setZone(order.id, "okruh1")}
                            disabled={busyId === order.id}
                            className="rounded-xl border border-[#d6e8da] bg-white px-2 py-2 text-xs font-bold text-[#103f20] disabled:opacity-60"
                          >
                            O1
                          </button>

                          <button
                            onClick={() => setZone(order.id, "okruh2")}
                            disabled={busyId === order.id}
                            className="rounded-xl border border-[#d6e8da] bg-white px-2 py-2 text-xs font-bold text-[#103f20] disabled:opacity-60"
                          >
                            O2
                          </button>

                          <button
                            onClick={() => setZone(order.id, "skolky")}
                            disabled={busyId === order.id}
                            className="rounded-xl border border-[#d6e8da] bg-white px-2 py-2 text-xs font-bold text-[#103f20] disabled:opacity-60"
                          >
                            Školky
                          </button>

                          {order.delivery_status === "waiting" ? (
                            <button
                              onClick={() => markOnRoute(order.id)}
                              disabled={busyId === order.id}
                              className="rounded-xl bg-[#0b4a8f] px-2 py-2 text-xs font-bold text-white disabled:opacity-60"
                            >
                              Na cestě
                            </button>
                          ) : (
                            <button
                              onClick={() => markDelivered(order.id)}
                              disabled={busyId === order.id}
                              className="rounded-xl bg-[#00a63e] px-2 py-2 text-xs font-bold text-white disabled:opacity-60"
                            >
                              Vyřízeno
                            </button>
                          )}

                          <button
                            onClick={() => saveDriverNote(order.id)}
                            disabled={busyId === order.id}
                            className="rounded-xl border border-[#d6e8da] bg-white px-2 py-2 text-xs font-bold text-[#103f20] disabled:opacity-60"
                          >
                            Uložit
                          </button>
                        </div>

                        <div onClick={(e) => e.stopPropagation()} className="mt-2">
                          <input
                            value={noteDraft}
                            onChange={(e) =>
                              setNoteDrafts((prev) => ({
                                ...prev,
                                [order.id]: e.target.value,
                              }))
                            }
                            placeholder="Poznámka řidiče..."
                            className="h-10 w-full rounded-xl border border-[#d6e8da] bg-white px-3 text-sm outline-none focus:border-[#9acbab]"
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          <div className={mobileTab !== "mapa" ? "hidden md:block" : ""}>
            <div className="rounded-[26px] border border-[#d7eadb] bg-white p-3 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
              <div className="mb-2 px-1">
                <div className="text-[22px] font-extrabold text-[#103f20]">
                  Mapa
                </div>
                <div className="text-sm text-[#5e7568]">
                  Jen body objednávek, bez trasy
                </div>
              </div>

              <div className="overflow-hidden rounded-[20px] border border-[#e3efe6]">
                <div
                  ref={mapWrapRef}
                  style={{ height: "74vh", minHeight: 420, width: "100%" }}
                />
              </div>

              {selectedOrder ? (
                <div className="mt-3 rounded-[20px] border border-[#e3efe6] bg-[#fbfefb] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-[22px] font-extrabold text-[#103f20]">
                      {selectedOrder.full_name}
                    </div>

                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-bold ${zoneBadgeClass(
                        selectedOrder.delivery_zone
                      )}`}
                    >
                      {zoneLabel(selectedOrder.delivery_zone)}
                    </span>
                  </div>

                  <div className="mt-1 text-sm text-[#4f685d]">
                    {selectedOrder.address}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-[#103f20]">
                    {selectedOrder.phone ? <div>{selectedOrder.phone}</div> : null}
                    <div>{formatPrice(selectedOrder.total)}</div>
                    <div>{formatShortTime(selectedOrder.created_at)}</div>
                    {etaMap[selectedOrder.id] ? <div>ETA {etaMap[selectedOrder.id]} min</div> : null}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                    <button
                      onClick={() => openNavigation(selectedOrder)}
                      className="rounded-xl bg-[#0b4a8f] px-3 py-2 text-sm font-bold text-white"
                    >
                      Navigovat
                    </button>

                    <button
                      onClick={() => callCustomer(selectedOrder)}
                      className="rounded-xl border border-[#d6e8da] bg-white px-3 py-2 text-sm font-bold text-[#103f20]"
                    >
                      Zavolat
                    </button>

                    <button
                      onClick={() => smsCustomer(selectedOrder)}
                      className="rounded-xl border border-[#d6e8da] bg-white px-3 py-2 text-sm font-bold text-[#103f20]"
                    >
                      Poslat zprávu
                    </button>

                    {selectedOrder.delivery_status === "waiting" ? (
                      <button
                        onClick={() => markOnRoute(selectedOrder.id)}
                        disabled={busyId === selectedOrder.id}
                        className="rounded-xl bg-[#0b4a8f] px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                      >
                        Na cestě
                      </button>
                    ) : (
                      <button
                        onClick={() => markDelivered(selectedOrder.id)}
                        disabled={busyId === selectedOrder.id}
                        className="rounded-xl bg-[#00a63e] px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                      >
                        Vyřízeno
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-[20px] border border-[#e3efe6] bg-[#fbfefb] p-4 text-[#5e7568]">
                  Vyber objednávku v seznamu.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}