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

function IconSettings({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 8.75a3.25 3.25 0 1 0 0 6.5a3.25 3.25 0 0 0 0-6.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.9 1.9 0 0 1-1.35 3.25h-.15a1 1 0 0 0-.95.68l-.05.14a1.9 1.9 0 0 1-3.58 0l-.05-.14a1 1 0 0 0-.95-.68h-1.3a1 1 0 0 0-.95.68l-.05.14a1.9 1.9 0 0 1-3.58 0l-.05-.14a1 1 0 0 0-.95-.68h-.15A1.9 1.9 0 0 1 4.3 16.2l.1-.1a1 1 0 0 0 .2-1.1l-.08-.18a1 1 0 0 0-.9-.57H3.4a1.9 1.9 0 0 1 0-3.8h.12a1 1 0 0 0 .9-.57l.08-.18a1 1 0 0 0-.2-1.1l-.1-.1A1.9 1.9 0 0 1 5.65 5h.15a1 1 0 0 0 .95-.68l.05-.14a1.9 1.9 0 0 1 3.58 0l.05.14a1 1 0 0 0 .95.68h1.3a1 1 0 0 0 .95-.68l.05-.14a1.9 1.9 0 0 1 3.58 0l.05.14a1 1 0 0 0 .95.68h.15A1.9 1.9 0 0 1 19.7 7.8l-.1.1a1 1 0 0 0-.2 1.1l.08.18a1 1 0 0 0 .9.57h.12a1.9 1.9 0 0 1 0 3.8h-.12a1 1 0 0 0-.9.57L19.4 15Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setLocalOrder((prev) => {
      const incoming = filteredOrders.map((o) => o.id);
      const kept = prev.filter((id) => incoming.includes(id));
      const missing = incoming.filter((id) => !kept.includes(id));
      return [...kept, ...missing];
    });
  }, [filteredOrders]);

  useEffect(() => {
    if (mobileTab !== "mapa" && !fullscreenMap) return;

    const timers = [50, 150, 300, 600].map((delay) =>
      window.setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, delay)
    );

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [mobileTab, fullscreenMap]);

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

  const filterBtn = (key: FilterKey, label: string) => (
    <button
      type="button"
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

  const rightPanelWidth = 92;

  return (
    <div className="space-y-3">
      {!fullscreenMap ? (
        <>
          <div className="rounded-[22px] border border-[#d7eadb] bg-white px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 text-[28px] font-extrabold leading-none text-[#00a63e]">
                Rozvozy
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileTab("mapa");
                    setFullscreenMap(true);
                  }}
                  className="rounded-full border border-[#cfe5d5] bg-white px-3 py-2 text-[13px] font-bold text-[#103f20]"
                >
                  Zvětšit
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "/staff";
                  }}
                  className="rounded-full border border-[#cfe5d5] bg-white px-3 py-2 text-[13px] font-bold text-[#103f20]"
                >
                  Rozcestník
                </button>
              </div>
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
              type="button"
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
              type="button"
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
        <div className="rounded-[22px] border border-[#d7eadb] bg-white px-3 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-[20px] font-extrabold text-[#103f20]">
              Seznam objednávek
            </div>

            <button
              type="button"
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
              orderedForMobile.map((order, index) => {
                const selected = selectedId === order.id;

                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedId(order.id)}
                    className={`py-3 ${
                      index !== orderedForMobile.length - 1 ? "border-b border-[#e6efe8]" : ""
                    }`}
                  >
                    <div
                      className={`rounded-[18px] px-3 py-3 transition ${
                        selected ? "bg-[#f4fbf5]" : "bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-[18px] font-extrabold leading-tight text-[#103f20]">
                            {order.full_name}
                          </div>
                        </div>

                        <select
                          value={order.delivery_zone ?? ""}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            setZone(order.id, (e.target.value || null) as DeliveryZone)
                          }
                          className="shrink-0 rounded-full border border-[#cfe5d5] bg-white px-2 py-1 text-[11px] font-bold text-[#103f20]"
                        >
                          <option value="okruh1">Okruh 1</option>
                          <option value="okruh2">Okruh 2</option>
                          <option value="skolky">Školky</option>
                        </select>
                      </div>

                      <div className="mt-1 text-[13px] leading-snug text-[#4f685d]">
                        {order.address}
                      </div>

                      <div className="mt-1 text-[13px] text-[#4f685d]">
                        {order.phone || "bez telefonu"} • {formatPrice(order.total)}
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            smsCustomer(order);
                          }}
                          className="rounded-xl border border-[#00a63e] bg-white px-3 py-2 text-sm font-bold text-[#0f6c2a]"
                        >
                          SMS
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            callCustomer(order);
                          }}
                          className="rounded-xl border border-[#00a63e] bg-white px-3 py-2 text-sm font-bold text-[#0f6c2a]"
                        >
                          Zavolat
                        </button>

                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
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

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(order);
                          }}
                          className="rounded-xl border border-[#00a63e] bg-white px-3 py-2 text-sm font-bold text-[#0f6c2a]"
                        >
                          Upravit
                        </button>
                      </div>

                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeliveredOrder(order);
                          }}
                          className="w-full rounded-xl border border-[#00a63e] bg-[#00a63e] px-3 py-3 text-sm font-bold text-white"
                        >
                          Vyřízeno
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ) : null}

      <div
        className={
          fullscreenMap
            ? "fixed inset-0 z-[9998] bg-[#f7faf7]"
            : mobileTab === "mapa"
            ? "overflow-hidden rounded-[22px] border border-[#d7eadb] bg-white shadow-[0_10px_30px_rgba(0,0,0,0.05)]"
            : "hidden"
        }
      >
        {fullscreenMap ? (
          <div className="absolute left-3 top-3 z-[10000]">
            <div className="relative">
              <button
                type="button"
                onClick={() => setSettingsOpen((prev) => !prev)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[#cfe5d5] bg-white text-[#103f20] shadow"
              >
                <IconSettings className="h-5 w-5" />
              </button>

              {settingsOpen ? (
                <div className="absolute left-0 top-12 min-w-[190px] rounded-[16px] border border-[#d7eadb] bg-white p-2 shadow-[0_12px_30px_rgba(0,0,0,0.14)]">
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsOpen(false);
                      setFullscreenMap(false);
                    }}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-[#103f20] hover:bg-[#f4fbf5]"
                  >
                    Ukončit režim
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {routeInfo ? (
          <div
            className={
              fullscreenMap
                ? "absolute right-3 top-3 z-[9999] max-w-[220px] rounded-[16px] border border-[#dff0e3] bg-[#f7fcf8] px-4 py-3 text-sm font-semibold text-[#103f20] shadow"
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
              ? "flex h-[100dvh] w-screen overflow-hidden"
              : "flex h-[420px] w-full overflow-hidden"
          }
        >
          <div className="relative min-w-0 flex-1 bg-white">
            <div ref={mapWrapRef} className="h-[420px] w-full md:h-full" />
          </div>

          <div className="w-[92px] shrink-0 overflow-y-auto border-l border-[#e3efe6] bg-[#fbfefb]">
            <div className="sticky top-0 z-10 border-b border-[#e3efe6] bg-[#fbfefb] px-2 py-2 text-center text-[11px] font-extrabold text-[#5e7568]">
              Pořadí
            </div>

            <div className="p-2">
              {orderedForMobile.slice(0, 25).map((order, index) => {
                const expanded = expandedRailId === order.id;
                const selected = selectedId === order.id;

                return (
                  <div key={order.id} className="mb-2">
                    <button
                      type="button"
                      draggable
                      onDragStart={() => setDraggedId(order.id)}
                      onDragEnd={() => setDraggedId(null)}
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
                      } ${draggedId === order.id ? "opacity-60" : ""}`}
                      title="Podrž a přetáhni pro změnu pořadí"
                    >
                      {index + 1}
                    </button>

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
                ? "absolute bottom-0 left-0 z-[9999] border-t border-[#d7eadb] bg-white/95 p-4 backdrop-blur shadow-[0_-10px_30px_rgba(0,0,0,0.16)]"
                : "sticky bottom-0 z-20 border-t border-[#d7eadb] bg-white p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.16)]"
            }
            style={fullscreenMap ? { right: `${rightPanelWidth}px` } : undefined}
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

            <div className="mt-2 text-sm text-[#4f685d]">{selectedFromOrdered.address}</div>

            <div className="mt-1 text-sm text-[#4f685d]">
              {selectedFromOrdered.phone || "bez telefonu"} •{" "}
              {formatPrice(selectedFromOrdered.total)}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => smsCustomer(selectedFromOrdered)}
                className="rounded-xl border border-[#00a63e] bg-white px-3 py-2 text-sm font-bold text-[#0f6c2a]"
              >
                SMS
              </button>

              <button
                type="button"
                onClick={() => callCustomer(selectedFromOrdered)}
                className="rounded-xl border border-[#00a63e] bg-white px-3 py-2 text-sm font-bold text-[#0f6c2a]"
              >
                Zavolat
              </button>

              <button
                type="button"
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
                type="button"
                onClick={() => openEdit(selectedFromOrdered)}
                className="rounded-xl border border-[#00a63e] bg-white px-3 py-2 text-sm font-bold text-[#0f6c2a]"
              >
                Upravit
              </button>
            </div>

            <div className="mt-3">
              <button
                type="button"
                onClick={() => setConfirmDeliveredOrder(selectedFromOrdered)}
                className="w-full rounded-xl border border-[#00a63e] bg-[#00a63e] px-3 py-3 text-sm font-bold text-white"
              >
                Vyřízeno
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
