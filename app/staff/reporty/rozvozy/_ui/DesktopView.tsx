"use client";

import type { RefObject } from "react";
import type { FilterKey, OrderUi, RouteInfo, DeliveryZone } from "../page";
import { formatPrice, zoneBadgeClass, zoneLabel } from "../page";

type Props = {
  loading: boolean;
  busyId: string | null;
  errorMsg: string;
  selectedId: string | null;
  setSelectedId: (value: string | null) => void;
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

export default function DesktopView({
  loading,
  selectedId,
  setSelectedId,
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
}: Props) {
  const filterBtn = (key: FilterKey, label: string) => (
    <button
      onClick={() => {
        clearRoute();
        setFilter(key);
      }}
      className={`rounded-full px-4 py-2 text-sm font-bold transition ${
        filter === key
          ? "border border-[#00a63e] bg-[#00a63e] text-white"
          : "border border-[#cfe5d5] bg-white text-[#103f20] hover:bg-[#f6fbf7]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {filterBtn("okruh1", "Okruh 1")}
        {filterBtn("okruh2", "Okruh 2")}
        {filterBtn("skolky", "Školky")}
        {filterBtn("vsechny", "Všechny")}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.92fr_1.28fr]">
        <div>
          <div className="rounded-[24px] border border-[#d7eadb] bg-white p-3 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[24px] font-extrabold text-[#103f20]">Seznam objednávek</div>
              <button
                onClick={loadOrders}
                className="rounded-full border border-[#cfe5d5] bg-white px-3 py-2 text-xs font-bold text-[#103f20]"
              >
                Obnovit
              </button>
            </div>

            <div className="max-h-[78vh] overflow-y-auto">
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
                filteredOrders.map((order) => {
                  const selected = selectedId === order.id;

                  return (
                    <div
                      key={order.id}
                      onClick={() => {
                        clearRoute();
                        setSelectedId(order.id);
                      }}
                      className={`mb-3 rounded-[20px] border p-4 transition ${
                        selected
                          ? "border-[#a6dcb4] bg-[#f4fbf5]"
                          : "border-[#e3efe6] bg-white hover:bg-[#fafdfb]"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-[22px] font-extrabold text-[#103f20]">{order.full_name}</div>

                        <select
                          value={order.delivery_zone ?? ""}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setZone(order.id, (e.target.value || null) as DeliveryZone)}
                          className="rounded-full border border-[#cfe5d5] bg-white px-3 py-1 text-sm font-bold text-[#103f20]"
                        >
                          <option value="okruh1">Okruh 1</option>
                          <option value="okruh2">Okruh 2</option>
                          <option value="skolky">Školky</option>
                        </select>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(order);
                          }}
                          className="text-sm font-semibold text-[#5e7568] underline underline-offset-2"
                        >
                          Upravit
                        </button>
                      </div>

                      <div className="mt-2 text-sm text-[#4f685d]">
                        {order.address} <span className="text-[#aab7af]">|</span> {order.phone || "bez telefonu"}{" "}
                        <span className="text-[#aab7af]">|</span> {formatPrice(order.total)}
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            smsCustomer(order);
                          }}
                          className={outlineBtn}
                        >
                          SMS
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            callCustomer(order);
                          }}
                          className={outlineBtn}
                        >
                          Zavolat
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            focusOnMap(order);
                          }}
                          className={!routingOrderId || routingOrderId !== order.id ? activeBtn : outlineBtn}
                        >
                          Mapa
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startInternalNavigation(order);
                          }}
                          className={routingOrderId === order.id ? activeBtn : outlineBtn}
                        >
                          Navigovat
                        </button>
                      </div>

                      <div className="mt-3 flex justify-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeliveredOrder(order);
                          }}
                          className={outlineBtn}
                        >
                          Vyřízeno
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        <div>
          <div className="rounded-[24px] border border-[#d7eadb] bg-white p-3 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <div className="text-[24px] font-extrabold text-[#103f20]">Mapa</div>
                <div className="text-sm text-[#5e7568]">Body objednávek a interní navigace</div>
              </div>

              {routingOrderId ? (
                <button
                  onClick={clearRoute}
                  className="rounded-full border border-[#cfe5d5] bg-white px-3 py-2 text-xs font-bold text-[#103f20]"
                >
                  Zavřít navigaci
                </button>
              ) : null}
            </div>

            {routeInfo ? (
              <div className="mb-3 rounded-[16px] border border-[#dff0e3] bg-[#f7fcf8] px-4 py-3 text-sm font-semibold text-[#103f20]">
                Trasa: {routeInfo.distanceKm.toFixed(1)} km • přibližně {Math.max(1, Math.round(routeInfo.durationMin))} min
              </div>
            ) : null}

            <div className="overflow-hidden rounded-[20px] border border-[#e3efe6]">
              <div ref={mapWrapRef} style={{ height: "76vh", minHeight: 430, width: "100%" }} />
            </div>

            {selectedOrder ? (
              <div className="mt-3 rounded-[18px] border border-[#e3efe6] bg-[#fbfefb] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[22px] font-extrabold text-[#103f20]">{selectedOrder.full_name}</div>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${zoneBadgeClass(selectedOrder.delivery_zone)}`}>
                    {zoneLabel(selectedOrder.delivery_zone)}
                  </span>
                </div>

                <div className="mt-2 text-sm text-[#4f685d]">
                  {selectedOrder.address} <span className="text-[#aab7af]">|</span> {selectedOrder.phone || "bez telefonu"}{" "}
                  <span className="text-[#aab7af]">|</span> {formatPrice(selectedOrder.total)}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                  <button onClick={() => smsCustomer(selectedOrder)} className={outlineBtn}>SMS</button>
                  <button onClick={() => callCustomer(selectedOrder)} className={outlineBtn}>Zavolat</button>
                  <button onClick={() => focusOnMap(selectedOrder)} className={!routingOrderId || routingOrderId !== selectedOrder.id ? activeBtn : outlineBtn}>Mapa</button>
                  <button onClick={() => startInternalNavigation(selectedOrder)} className={routingOrderId === selectedOrder.id ? activeBtn : outlineBtn}>Navigovat</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
