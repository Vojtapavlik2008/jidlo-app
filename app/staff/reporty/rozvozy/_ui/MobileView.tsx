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
  const [expandedRailId, setExpandedRailId] = useState<string | null>(null);
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

  return (
    <div className="space-y-3">
      <div className="rounded-[22px] border border-[#d7eadb] bg-white px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
        <div className="flex items-start justify-between gap-3">
          <div className="text-[28px] font-extrabold leading-none text-[#00a63e]">
            Reporty
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/staff/reporty"
              className="rounded-full border border-[#cfe5d5] bg-white px-4 py-2 text-sm font-bold text-[#103f20]"
            >
              Zpět
            </a>

            <a
              href="/staff"
              className="rounded-full border border-[#cfe5d5] bg-white px-4 py-2 text-sm font-bold text-[#103f20]"
            >
              Rozcestník
            </a>
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

      {mobileTab === "seznam" ? (
        <div className="rounded-[22px] border border-[#d7eadb] bg-white p-3 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-[22px] font-extrabold text-[#103f20]">Seznam objednávek</div>

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
                      <button onClick={() => smsCustomer(order)} className="rounded-xl border border-[#00a63e] bg-white px-3 py-2 text-sm font-bold text-[#0f6c2a]">
                        SMS
                      </button>
                      <button onClick={() => callCustomer(order)} className="rounded-xl border border-[#00a63e] bg-white px-3 py-2 text-sm font-bold text-[#0f6c2a]">
                        Zavolat
                      </button>
                      <button onClick={() => openEdit(order)} className="rounded-xl border border-[#00a63e] bg-white px-3 py-2 text-sm font-bold text-[#0f6c2a]">
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

      {mobileTab === "mapa" ? (
        <div className="space-y-3">
          {routeInfo ? (
            <div className="rounded-[16px] border border-[#dff0e3] bg-[#f7fcf8] px-4 py-3 text-sm font-semibold text-[#103f20]">
              Trasa: {routeInfo.distanceKm.toFixed(1)} km • přibližně{" "}
              {Math.max(1, Math.round(routeInfo.durationMin))} min
            </div>
          ) : null}

          <div className="overflow-hidden rounded-[22px] border border-[#d7eadb] bg-white shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
            <div className="flex h-[62vh] min-h-[480px]">
              <div className="relative min-w-0 flex-1 border-r border-[#e3efe6]">
                <div ref={mapWrapRef} style={{ height: "100%", width: "100%" }} />
              </div>

              <div className="w-[86px] shrink-0 overflow-y-auto bg-[#fbfefb]">
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
                          <div className="mt-2 rounded-[14px] border border-[#d7eadb] bg-white p-2 text-[11px]">
                            <div className="font-extrabold text-[#103f20]">{order.full_name}</div>
                            <div className="mt-1 text-[#5e7568] leading-snug">{order.address}</div>
                            <div className="mt-1 text-[#5e7568]">{order.phone || "bez telefonu"}</div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {selectedOrder ? (
            <div className="sticky bottom-3 z-20 rounded-[22px] border border-[#d7eadb] bg-white p-4 shadow-[0_20px_40px_rgba(0,0,0,0.16)]">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[20px] font-extrabold text-[#103f20]">
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

              <div className="mt-2 text-sm text-[#4f685d]">{selectedOrder.address}</div>
              <div className="mt-1 text-sm text-[#4f685d]">
                {selectedOrder.phone || "bez telefonu"} • {formatPrice(selectedOrder.total)}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => smsCustomer(selectedOrder)}
                  className="rounded-xl border border-[#00a63e] bg-white px-3 py-2 text-sm font-bold text-[#0f6c2a]"
                >
                  SMS
                </button>

                <button
                  onClick={() => callCustomer(selectedOrder)}
                  className="rounded-xl border border-[#00a63e] bg-white px-3 py-2 text-sm font-bold text-[#0f6c2a]"
                >
                  Zavolat
                </button>

                <button
                  onClick={() => openEdit(selectedOrder)}
                  className="rounded-xl border border-[#00a63e] bg-white px-3 py-2 text-sm font-bold text-[#0f6c2a]"
                >
                  Upravit
                </button>

                <button
                  onClick={async () => {
                    await startInternalNavigation(selectedOrder);
                  }}
                  className={`rounded-xl px-3 py-2 text-sm font-bold ${
                    routingOrderId === selectedOrder.id
                      ? "border border-[#00a63e] bg-[#00a63e] text-white"
                      : "border border-[#00a63e] bg-white text-[#0f6c2a]"
                  }`}
                >
                  Navigovat
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => focusOnMap(selectedOrder)}
                  className="rounded-xl border border-[#00a63e] bg-[#00a63e] px-3 py-2 text-sm font-bold text-white"
                >
                  Zaměřit mapu
                </button>

                <button
                  onClick={() => setConfirmDeliveredOrder(selectedOrder)}
                  className="rounded-xl border border-[#00a63e] bg-white px-3 py-2 text-sm font-bold text-[#0f6c2a]"
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
