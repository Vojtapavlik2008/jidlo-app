"use client";

import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import DesktopView from "./_ui/DesktopView";
import MobileView from "./_ui/MobileView";

export type DeliveryStatus = "waiting" | "on_route" | "delivered";
export type DeliveryZone = "okruh1" | "okruh2" | "skolky" | null;
export type FilterKey = "okruh1" | "okruh2" | "skolky" | "vsechny";

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

export type OrderUi = {
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

export type RouteInfo = {
  distanceKm: number;
  durationMin: number;
};

const JIRKA_BASE = {
  name: "Jiřka",
  address: "Havlíčkova 72/1, 29001 Poděbrady",
  lat: 50.14277,
  lng: 15.11838,
};

const RAILWAY_LAT_SPLIT = 50.1425;

export function formatPrice(value: number) {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateTime(value: string | null) {
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

function autoZoneFromLat(lat: number | null): DeliveryZone {
  if (lat == null) return null;
  return lat >= RAILWAY_LAT_SPLIT ? "okruh1" : "okruh2";
}

export function zoneLabel(zone: DeliveryZone) {
  if (zone === "okruh1") return "Okruh 1";
  if (zone === "okruh2") return "Okruh 2";
  if (zone === "skolky") return "Školky";
  return "Bez okruhu";
}

export function zoneBadgeClass(zone: DeliveryZone) {
  if (zone === "okruh1") return "bg-[#e8f8ec] text-[#0f6c2a]";
  if (zone === "okruh2") return "bg-[#e8f1ff] text-[#0b4a8f]";
  if (zone === "skolky") return "bg-[#fff3e6] text-[#9a5800]";
  return "bg-[#f2f4f5] text-[#5f6b73]";
}

async function geocodeAddress(address: string) {
  try {
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
  } catch {
    return null;
  }
}

async function fetchDrivingRoute(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number
) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const json = await res.json();
    const route = json?.routes?.[0];
    if (!route?.geometry?.coordinates?.length) return null;

    const points = route.geometry.coordinates.map(
      (p: [number, number]) => [p[1], p[0]] as [number, number]
    );

    return {
      points,
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
    };
  } catch {
    return null;
  }
}

export default function RozvozyPage() {
  const [orders, setOrders] = useState<OrderUi[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"seznam" | "mapa">("seznam");
  const [filter, setFilter] = useState<FilterKey>("vsechny");
  const [leafletReady, setLeafletReady] = useState(false);

  const [editOrder, setEditOrder] = useState<OrderUi | null>(null);
  const [confirmDeliveredOrder, setConfirmDeliveredOrder] = useState<OrderUi | null>(null);

  const [editForm, setEditForm] = useState({
    full_name: "",
    phone: "",
    address: "",
    total: "",
    driver_note: "",
  });

  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [routingOrderId, setRoutingOrderId] = useState<string | null>(null);

  const geocodingIdsRef = useRef<Set<string>>(new Set());

  const mapWrapRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  async function loadOrders() {
    try {
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
          delivery_zone: (row.delivery_zone as DeliveryZone) || autoZone || null,
        };
      });

      setOrders(mapped);
      setSelectedId((prev) => prev ?? mapped[0]?.id ?? null);
    } catch {
      setErrorMsg("Nepodařilo se načíst rozvozové objednávky.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initLeaflet() {
      try {
        const L = await import("leaflet");
        if (cancelled) return;
        leafletRef.current = L;
        setLeafletReady(true);
      } catch {
        setErrorMsg("Nepodařilo se načíst mapu.");
      }
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

    const needZoneOnly = orders.filter((o) => o.lat != null && !o.delivery_zone);

    for (const order of needZoneOnly) {
      const zone = autoZoneFromLat(order.lat);
      if (!zone) continue;

      const { error } = await supabase
        .from("orders")
        .update({ delivery_zone: zone })
        .eq("id", order.id);

      if (!error) {
        setOrders((prev) =>
          prev.map((p) => (p.id === order.id ? { ...p, delivery_zone: zone } : p))
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

  const selectedOrder = useMemo(
    () => filteredOrders.find((o) => o.id === selectedId) ?? null,
    [filteredOrders, selectedId]
  );

  async function setZone(orderId: string, zone: DeliveryZone) {
    setBusyId(orderId);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ delivery_zone: zone })
        .eq("id", orderId);

      if (!error) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, delivery_zone: zone } : o))
        );
      }
    } finally {
      setBusyId(null);
    }
  }

  async function saveEdit() {
    if (!editOrder) return;

    setBusyId(editOrder.id);

    try {
      const totalValue = Number(editForm.total || 0);

      const updatePayload: Record<string, any> = {
        full_name: editForm.full_name.trim(),
        phone: editForm.phone.trim(),
        address: editForm.address.trim(),
        total: Number.isFinite(totalValue) ? totalValue : 0,
        driver_note: editForm.driver_note,
      };

      const found = editForm.address.trim()
        ? await geocodeAddress(editForm.address.trim())
        : null;

      if (found) {
        updatePayload.lat = found.lat;
        updatePayload.lng = found.lng;
        if (!editOrder.delivery_zone || editOrder.delivery_zone !== "skolky") {
          updatePayload.delivery_zone = autoZoneFromLat(found.lat);
        }
      }

      const { error } = await supabase
        .from("orders")
        .update(updatePayload)
        .eq("id", editOrder.id);

      if (!error) {
        await loadOrders();
        setEditOrder(null);
      }
    } finally {
      setBusyId(null);
    }
  }

  function openEdit(order: OrderUi) {
    setEditOrder(order);
    setEditForm({
      full_name: order.full_name,
      phone: order.phone,
      address: order.address,
      total: String(order.total || 0),
      driver_note: order.driver_note || "",
    });
  }

  async function markDelivered(orderId: string) {
    setBusyId(orderId);

    try {
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
        setConfirmDeliveredOrder(null);
        clearRoute();
      }
    } finally {
      setBusyId(null);
    }
  }

  function callCustomer(order: OrderUi) {
    if (!order.phone) return;
    window.location.href = `tel:${normalizePhone(order.phone)}`;
  }

  function smsCustomer(order: OrderUi) {
    if (!order.phone) return;
    const text = "Dobrý den, za chvíli jsme u Vás. Jiřka";
    window.location.href = `sms:${normalizePhone(order.phone)}?body=${encodeURIComponent(
      text
    )}`;
  }

  function forceMapResize() {
    const map = mapRef.current;
    if (!map) return;

    [0, 80, 180, 350, 700, 1200].forEach((delay) => {
      window.setTimeout(() => {
        map.invalidateSize();
      }, delay);
    });
  }

  function focusOnMap(order: OrderUi) {
    clearRoute();
    setSelectedId(order.id);
    setMobileTab("mapa");

    window.setTimeout(() => {
      forceMapResize();

      if (mapRef.current && order.lat != null && order.lng != null) {
        mapRef.current.flyTo([order.lat, order.lng], 16, {
          duration: 0.6,
        });
      }
    }, 120);
  }

  async function startInternalNavigation(order: OrderUi) {
    if (order.lat == null || order.lng == null) return;

    setRoutingOrderId(order.id);
    setSelectedId(order.id);
    setMobileTab("mapa");

    window.setTimeout(() => {
      forceMapResize();
    }, 120);

    const route = await fetchDrivingRoute(
      JIRKA_BASE.lng,
      JIRKA_BASE.lat,
      order.lng,
      order.lat
    );

    if (!routeLayerRef.current || !leafletRef.current || !mapRef.current) return;

    const L = leafletRef.current;
    routeLayerRef.current.clearLayers();

    if (route) {
      const poly = L.polyline(route.points, {
        color: "#16a34a",
        weight: 6,
        opacity: 0.9,
      }).addTo(routeLayerRef.current);

      mapRef.current.fitBounds(poly.getBounds(), { padding: [30, 30] });
      setRouteInfo({
        distanceKm: route.distanceKm,
        durationMin: route.durationMin,
      });
    } else {
      setRouteInfo(null);
    }
  }

  function clearRoute() {
    setRoutingOrderId(null);
    setRouteInfo(null);
    if (routeLayerRef.current) {
      routeLayerRef.current.clearLayers();
    }
  }

  useEffect(() => {
    if (!leafletReady) return;
    if (!mapWrapRef.current) return;

    const L = leafletRef.current;
    if (!L) return;

    if (!mapRef.current) {
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
    }

    const timers = [50, 150, 300, 700, 1200].map((delay) =>
      window.setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, delay)
    );

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [leafletReady]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (mobileTab !== "mapa") return;

    const timers = [50, 150, 300, 700, 1200].map((delay) =>
      window.setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, delay)
    );

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [mobileTab]);

  useEffect(() => {
    if (!mapWrapRef.current || !mapRef.current) return;

    resizeObserverRef.current?.disconnect();

    const observer = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });

    observer.observe(mapWrapRef.current);
    resizeObserverRef.current = observer;

    return () => {
      observer.disconnect();
      resizeObserverRef.current = null;
    };
  }, [mobileTab, leafletReady]);

  useEffect(() => {
    const onResize = () => {
      mapRef.current?.invalidateSize();
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  useEffect(() => {
    if (mobileTab !== "mapa") return;
    forceMapResize();
  }, [mobileTab, filteredOrders.length, selectedId]);

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
          width:46px;
          height:46px;
          border-radius:14px;
          background:#fff;
          border:2px solid #d7eadb;
          display:flex;
          align-items:center;
          justify-content:center;
          box-shadow:0 8px 18px rgba(0,0,0,.12);
          overflow:hidden;
        ">
          <img
            src="/logo-jirka.png"
            alt="Jiřka"
            style="
              width:30px;
              height:30px;
              object-fit:contain;
              display:block;
            "
          />
        </div>
      `,
      iconSize: [46, 46],
      iconAnchor: [23, 42],
      popupAnchor: [0, -34],
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
            width:34px;
            height:34px;
            border-radius:999px;
            background:${bg};
            color:#fff;
            border:${border};
            display:flex;
            align-items:center;
            justify-content:center;
            font-weight:800;
            font-size:13px;
            box-shadow:0 8px 18px rgba(0,0,0,.18);
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
        clearRoute();
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

    forceMapResize();
  }, [leafletReady, filteredOrders, selectedId]);

  const outlineBtn =
    "rounded-xl border border-[#00a63e] bg-white px-3 py-2 text-sm font-bold text-[#0f6c2a] transition hover:bg-[#f4fbf5]";
  const activeBtn =
    "rounded-xl border border-[#00a63e] bg-[#00a63e] px-3 py-2 text-sm font-bold text-white transition hover:brightness-95";

  const sharedProps = {
    loading,
    busyId,
    errorMsg,
    selectedId,
    setSelectedId,
    mobileTab,
    setMobileTab,
    filter,
    setFilter,
    filteredOrders,
    selectedOrder,
    routeInfo,
    routingOrderId,
    mapWrapRef,
    loadOrders,
    setZone,
    openEdit,
    setConfirmDeliveredOrder,
    callCustomer,
    smsCustomer,
    focusOnMap,
    startInternalNavigation,
    clearRoute,
    outlineBtn,
    activeBtn,
  };

  return (
    <div className="min-h-screen bg-[#f7faf7] text-[#123b1f]">
      <div className="mx-auto max-w-[1600px] px-3 py-3 md:px-5 md:py-5">
        <div className="hidden md:block">
          <div className="mb-4 rounded-[22px] border border-[#d7eadb] bg-white px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-4">
                <div className="text-[28px] font-extrabold leading-none text-[#00a63e]">
                  Rozvozy
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/staff/reporty"
                  className="rounded-full border border-[#cfe5d5] bg-white px-4 py-2 text-sm font-bold text-[#103f20]"
                >
                  Zpět
                </Link>

                <Link
                  href="/staff"
                  className="rounded-full border border-[#cfe5d5] bg-white px-4 py-2 text-sm font-bold text-[#103f20]"
                >
                  Rozcestník
                </Link>
              </div>
            </div>
          </div>

          <DesktopView {...sharedProps} />
        </div>

        <div className="md:hidden">
          <MobileView {...sharedProps} />
        </div>
      </div>

      {editOrder ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-[620px] rounded-[24px] bg-white p-5 shadow-[0_25px_80px_rgba(0,0,0,0.18)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[26px] font-extrabold text-[#103f20]">
                  Upravit zákazníka
                </div>
                <div className="mt-1 text-sm text-[#5e7568]">
                  Vytvořeno: {formatDateTime(editOrder.created_at)}
                </div>
              </div>

              <button
                onClick={() => setEditOrder(null)}
                className="rounded-full border border-[#cfe5d5] px-3 py-2 text-sm font-bold text-[#103f20]"
              >
                Zavřít
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-bold text-[#103f20]">
                  Jméno
                </label>
                <input
                  value={editForm.full_name}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, full_name: e.target.value }))
                  }
                  className="h-11 w-full rounded-xl border border-[#d6e8da] px-3 text-sm outline-none focus:border-[#9acbab]"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-[#103f20]">
                  Telefon
                </label>
                <input
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  className="h-11 w-full rounded-xl border border-[#d6e8da] px-3 text-sm outline-none focus:border-[#9acbab]"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-[#103f20]">
                  Cena
                </label>
                <input
                  value={editForm.total}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, total: e.target.value }))
                  }
                  className="h-11 w-full rounded-xl border border-[#d6e8da] px-3 text-sm outline-none focus:border-[#9acbab]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-bold text-[#103f20]">
                  Adresa
                </label>
                <input
                  value={editForm.address}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, address: e.target.value }))
                  }
                  className="h-11 w-full rounded-xl border border-[#d6e8da] px-3 text-sm outline-none focus:border-[#9acbab]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-bold text-[#103f20]">
                  Poznámka
                </label>
                <textarea
                  value={editForm.driver_note}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, driver_note: e.target.value }))
                  }
                  className="min-h-[110px] w-full rounded-xl border border-[#d6e8da] px-3 py-3 text-sm outline-none focus:border-[#9acbab]"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                onClick={() => setEditOrder(null)}
                className="rounded-full border border-[#cfe5d5] bg-white px-4 py-2 text-sm font-bold text-[#103f20]"
              >
                Zrušit
              </button>

              <button
                onClick={saveEdit}
                disabled={busyId === editOrder.id}
                className="rounded-full bg-[#00a63e] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                Uložit změny
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDeliveredOrder ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-[460px] rounded-[24px] bg-white p-5 shadow-[0_25px_80px_rgba(0,0,0,0.18)]">
            <div className="text-[24px] font-extrabold text-[#103f20]">
              Objednávka předána?
            </div>

            <div className="mt-2 text-sm text-[#5e7568]">
              {confirmDeliveredOrder.full_name}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeliveredOrder(null)}
                className="rounded-full border border-[#cfe5d5] bg-white px-4 py-2 text-sm font-bold text-[#103f20]"
              >
                Ne
              </button>

              <button
                onClick={() => markDelivered(confirmDeliveredOrder.id)}
                disabled={busyId === confirmDeliveredOrder.id}
                className="rounded-full bg-[#00a63e] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                Ano
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
