"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import type { DeliveryZone, FilterKey, OrderUi, RouteInfo } from "../page";
import { formatPrice, zoneBadgeClass, zoneLabel } from "../page";

type Props = {
  loading: boolean;
  busyId: string | null;
  errorMsg: string;
  selectedId: string | null;
  setSelectedId: (value: string | null) => void;
  mobileTab: "seznam" | "mapa";
  setMobileTab: (value: "seznam" | "mapa") => void;
  filter: FilterKey;
  setFilter: (value: FilterKey) => void;
  filteredOrders: OrderUi[];
  selectedOrder: OrderUi | null;
  routeInfo: RouteInfo | null;
  routingOrderId: string | null;
  mapWrapRef: RefObject<HTMLDivElement | null>;

  loadOrders: () => void;
  setZone: (orderId: string, zone: DeliveryZone) => Promise<void>;
  openEdit: (order: OrderUi) => void;
  setConfirmDeliveredOrder: (order: OrderUi | null) => void;
  callCustomer: (order: OrderUi) => void;
  smsCustomer: (order: OrderUi) => void;
  focusOnMap: (order: OrderUi) => void;
  startInternalNavigation: (order: OrderUi) => Promise<void>;
  clearRoute: () => void;

  outlineBtn: string;
  activeBtn: string;
};

export default function MobileView({
  loading,
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
}: Props) {
  const [fullscreenMap, setFullscreenMap] = useState(false);
  const [expandedRailId, setExpandedRailId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [localOrder, setLocalOrder] = useState<string[]>([]);

  useEffect(() => {
    setLocalOrder((prev) => {
      const incoming = filteredOrders.map((o) => o.id);
      const kept = prev.filter((id) => incoming.includes(id));
      const missing = incoming.filter((id) => !kept.includes(id));
      return [...kept, ...missing];
    });
  }, [filteredOrders]);

  const orderedForMobile = useMemo(() => {
    if (!localOrder.length) return filteredOrders;
    const map = new Map(filteredOrders.map((o) => [o.id, o]));
    return localOrder.map((id) => map.get(id)).filter(Boolean) as OrderUi[];
  }, [filteredOrders, localOrder]);

  function reorderList(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;

    setLocalOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(sourceId);
      const to = next.indexOf(targetId);
      if (from === -1 || to === -1) return prev;

      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function moveItem(id: string, dir: "up" | "down") {
    setLocalOrder((prev) => {
      const idx = prev.indexOf(id);
      if (idx === -1) return prev;

      const next = [...prev];
      const swap = dir === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= next.length) return prev;

      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }

  const filterBtn = (key: FilterKey, label: string) => (
    <button
      onClick={() => {
        clearRoute();
        setFilter(key);
      }}
      className={`rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap transition ${
        filter === key
          ? "border border-[#00a63e] bg-[#00a63e] text-white"
          : "border border-[#cfe5d5] bg-white text-[#103f20]"
      }`}
    >
      {label}
    </button>
  );

  const selectedFromOrdered =
    orderedForMobile.find((o) => o.id === selectedId) ?? selectedOrder ?? null;

  return (
    <div className="space-y-3">
      {!fullscreenMap ? (
        <>
          <div className="rounded-[22px] border border-[#d7eadb] bg-white px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
            <div className="flex items-start justify-between gap-3">
              <div className="text-[28px] font-extrabold leading-none text-[#00a63e]">
                Rozvozy
              </div>

              <button
                type="button"
                onClick={() => {
                  setMobileTab("mapa");
                  setFullscreenMap(true);
                }}
                className="rounded-full border border-[#cfe5d5] bg-white px-4 py-2 text-sm font-bold text-[#103f20]"
              >
                Zvětšit obrazovku
              </button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {filterBtn("okruh1", "Okruh 1")}
            {filterBtn("okruh2", "Okruh 2")}
            {filterBtn("skolky", "Školky")}
            {filterBtn("vsechny", "Všechny")}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setMobileTab("seznam")}
              className={`rounded-full px-4 py-2 text-sm font-bold ${
                mobileTab === "seznam"
                  ? "border border-[#00a63e] bg-[#00a63e] text-white"
                  : "border border-[#cfe5d5] bg-white text-[#103f20]"
              }`}
            >
              Seznam
            </button>

            <button
              onClick={() => setMobileTab("mapa")}
              className={`rounded-full px-4 py-2 text-sm font-bold ${
                mobileTab === "mapa"
                  ? "border border-[#00a63e] bg-[#00a63e] text-white"
                  : "border border-[#cfe5d5] bg-white text-[#103f20]"
              }`}
            >
              Mapa
            </button>
          </div>
        </>
      ) : null}

      {!fullscreenMap && mobileTab === "seznam" ? (
        <div className="rounded-[22px] border border-[#d7eadb] bg-white p-3 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-[22px] font-extrabold text-[#103f20]">
              Seznam objednávek
            </div>

            <button
              onClick={loadOrders}
              className="rounded-full border border-[#cfe5d5] bg-white px-3 py-2 text-xs font-bold text-[#103f20]"
            >
              Obnovit
            </button>
          </div>

          <div className="max-h-[72vh] overflow-y-auto">
            {loading ? (
              <div className="rounded-[18px] border border-[#e3efe6] bg-[#fbfefb] p-4 text-[#5e7568]">
                Načítám rozvozy...
              </div>
            ) : null}

            {!loading && orderedForMobile.length === 0 ? (
              <div className="rounded-[18px] border border-[#e3efe6] bg-[#fbfefb] p-4 text-[#5e7568]">
                V tomto filtru teď nejsou žádné objednávky.
              </div>
            ) : null}

            {!loading &&
              orderedForMobile.map((order) => {
                const selected = selectedId === order.id;

                return (
                  <div
                    key={order.id}
                    className={`mb-3 rounded-[20px] border p-4 transition ${
                      selected
                        ? "border-[#a6dcb4] bg-[#f4fbf5]"
                        : "border-[#e3efe6] bg-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-[20px] font-extrabold text-[#103f20]">
                        {order.full_name}
                      </div>

                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-bold ${zoneBadgeClass(
                          order.delivery_zone
                        )}`}
                      >
                        {zoneLabel(order.delivery_zone)}
                      </span>
                    </div>

                    <div className="mt-2 text-sm text-[#4f685d]">{order.address}</div>
                    <div className="mt-1 text-sm text-[#4f685d]">
                      {order.phone || "bez telefonu"} • {formatPrice(order.total)}
                    </div>

                    <div className="mt-3">
                      <select
                        value={order.delivery_zone ?? ""}
                        onChange={(e) =>
                          setZone(order.id, (e.target.value || null) as DeliveryZone)
                        }
                        className="w-full rounded-xl border border-[#cfe5d5] bg-white px-3 py-2 text-sm font-bold text-[#103f20]"
                      >
                        <option value="okruh1">Okruh 1</option>
                        <option value="okruh2">Okruh 2</option>
                        <option value="skolky">Školky</option>
                      </select>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => smsCustomer(order)}
                        className="rounded-xl border border-[#00a63e] bg-white px-3 py-2 text-sm font-bold text-[#0f6c2a]"
                      >
                        SMS
                      </button>

                      <button
                        onClick={() => callCustomer(order)}
                        className="rounded-xl border border-[#00a63e] bg-white px-3 py-2 text-sm font-bold text-[#0f6c2a]"
                      >
                        Zavolat
                      </button>

                      <button
                        onClick={() => openEdit(order)}
                        className="rounded-xl border border-[#00a63e] bg-white px-3 py-2 text-sm font-bold text-[#0f6c2a]"
                      >
                        Upravit
                      </button>

                      <button
                        onClick={async () => {
                          await startInternalNavigation(order);
                        }}
                        className={`rounded-xl px-3 py-2 text-sm font-bold ${
                          routingOrderId === order.id
                            ? "border border-[#00a63e] bg-[#00a63e] text-white"
                            : "border border-[#00a63e] bg-white text-[#0f6c2a]"
                        }`}
                      >
                        Navigovat
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setSelectedId(order.id);
                          focusOnMap(order);
                          setFullscreenMap(true);
                        }}
                        className="rounded-xl border border-[#00a63e] bg-[#00a63e] px-3 py-2 text-sm font-bold text-white"
                      >
                        Otevřít v mapě
                      </button>

                      <button
                        onClick={() => setConfirmDeliveredOrder(order)}
                        className="rounded-xl border border-[#00a63e] bg-white px-3 py-2 text-sm font-bold text-[#0f6c2a]"
                      >
                        Vyřízeno
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ) : null}

      {(fullscreenMap || mobileTab === "mapa") ? (
        <div
          className={
            fullscreenMap
              ? "fixed inset-0 z-[9998] bg-[#f7faf7]"
              : "rounded-[22px] border border-[#d7eadb] bg-white shadow-[0_10px_30px_rgba(0,0,0,0.05)]"
          }
        >
          {fullscreenMap ? (
            <div className="absolute right-3 top-3 z-[10000]">
              <button
                type="button"
                onClick={() => setFullscreenMap(false)}
                className="rounded-full border border-[#cfe5d5] bg-white px-4 py-2 text-sm font-bold text-[#103f20] shadow"
              >
                Ukončit režim
              </button>
            </div>
          ) : null}

          {routeInfo ? (
            <div
              className={
                fullscreenMap
                  ? "absolute left-3 top-3 z-[9999] max-w-[220px] rounded-[16px] border border-[#dff0e3] bg-[#f7fcf8] px-4 py-3 text-sm font-semibold text-[#103f20] shadow"
                  : "m-3 rounded-[16px] border border-[#dff0e3] bg-[#f7fcf8] px-4 py-3 text-sm font-semibold text-[#103f20]"
              }
            >
              Trasa: {routeInfo.distanceKm.toFixed(1)} km • přibližně{" "}
              {Math.max(1, Math.round(routeInfo.durationMin))} min
            </div>
          ) : null}

          <div
            className={
              fullscreenMap
                ? "flex h-screen w-screen"
                : "flex h-[62vh] min-h-[480px]"
            }
          >
            <div className="relative min-w-0 flex-1 border-r border-[#e3efe6] bg-white">
              <div ref={mapWrapRef} style={{ height: "100%", width: "100%" }} />
            </div>

            <div className="w-[92px] shrink-0 overflow-y-auto bg-[#fbfefb] border-l border-[#e3efe6]">
              <div className="sticky top-0 z-10 border-b border-[#e3efe6] bg-[#fbfefb] px-2 py-2 text-center text-[11px] font-extrabold text-[#5e7568]">
                Pořadí
              </div>

              <div className="p-2">
                {orderedForMobile.slice(0, 15).map((order, index) => {
                  const expanded = expandedRailId === order.id;
                  const selected = selectedId === order.id;

                  return (
                    <div key={order.id} className="mb-2">
                      <button
                        type="button"
                        draggable
                        onDragStart={() => setDraggedId(order.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (draggedId) reorderList(draggedId, order.id);
                          setDraggedId(null);
                        }}
                        onClick={() => {
                          setSelectedId(order.id);
                          focusOnMap(order);
                          setExpandedRailId((prev) => (prev === order.id ? null : order.id));
                        }}
                        className={`flex w-full items-center justify-center rounded-[16px] border px-2 py-3 text-sm font-extrabold transition ${
                          selected
                            ? "border-[#00a63e] bg-[#00a63e] text-white"
                            : "border-[#cfe5d5] bg-white text-[#103f20]"
                        }`}
                      >
                        {order.delivery_order ?? index + 1}
                      </button>

                      <div className="mt-1 grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          onClick={() => moveItem(order.id, "up")}
                          className="rounded-[10px] border border-[#cfe5d5] bg-white px-1 py-1 text-[10px] font-bold text-[#103f20]"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveItem(order.id, "down")}
                          className="rounded-[10px] border border-[#cfe5d5] bg-white px-1 py-1 text-[10px] font-bold text-[#103f20]"
                        >
                          ↓
                        </button>
                      </div>

                      {expanded ? (
                        <div className="mt-2 rounded-[14px] border border-[#d7eadb] bg-white p-2 text-[11px] shadow-sm">
                          <div className="font-extrabold text-[#103f20]">{order.full_name}</div>
                          <div className="mt-1 leading-snug text-[#5e7568]">{order.address}</div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {selectedFromOrdered ? (
            <div
              className={
                fullscreenMap
                  ? "absolute bottom-0 left-0 right-[92px] z-[9999] border-t border-[#d7eadb] bg-white/95 p-4 backdrop-blur shadow-[0_-10px_30px_rgba(0,0,0,0.16)]"
                  : "sticky bottom-0 z-20 border-t border-[#d7eadb] bg-white p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.16)]"
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[20px] font-extrabold text-[#103f20]">
                  {selectedFromOrdered.full_name}
                </div>

                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-bold ${zoneBadgeClass(
                    selectedFromOrdered.delivery_zone
                  )}`}
                >
                  {zoneLabel(selectedFromOrdered.delivery_zone)}
                </span>
              </div>

              <div className="mt-2 text-sm text-[#4f685d]">
                {selectedFromOrdered.address}
              </div>

              <div className="mt-1 text-sm text-[#4f685d]">
                {selectedFromOrdered.phone || "bez telefonu"} •{" "}
                {formatPrice(selectedFromOrdered.total)}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => smsCustomer(selectedFromOrdered)}
                  className="rounded-xl border border-[#00a63e] bg-white px-3 py-2 text-sm font-bold text-[#0f6c2a]"
                >
                  SMS
                </button>

                <button
                  onClick={() => callCustomer(selectedFromOrdered)}
                  className="rounded-xl border border-[#00a63e] bg-white px-3 py-2 text-sm font-bold text-[#0f6c2a]"
                >
                  Zavolat
                </button>

                <button
                  onClick={async () => {
                    await startInternalNavigation(selectedFromOrdered);
                  }}
                  className={`rounded-xl px-3 py-2 text-sm font-bold ${
                    routingOrderId === selectedFromOrdered.id
                      ? "border border-[#00a63e] bg-[#00a63e] text-white"
                      : "border border-[#00a63e] bg-white text-[#0f6c2a]"
                  }`}
                >
                  Navigovat
                </button>

                <button
                  onClick={() => openEdit(selectedFromOrdered)}
                  className="rounded-xl border border-[#00a63e] bg-white px-3 py-2 text-sm font-bold text-[#0f6c2a]"
                >
                  Upravit
                </button>
              </div>

              <div className="mt-3">
                <button
                  onClick={() => setConfirmDeliveredOrder(selectedFromOrdered)}
                  className="w-full rounded-xl border border-[#00a63e] bg-[#00a63e] px-3 py-3 text-sm font-bold text-white"
                >
                  Vyřízeno
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
