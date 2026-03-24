"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type {
  CurrentPosition,
  DeliveryZone,
  FilterKey,
  OrderUi,
  RouteInfo,
} from "../page";
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

  currentPosition: CurrentPosition | null;
  locationAllowed: boolean | null;
  locationBusy: boolean;
  requestCurrentPosition: (center?: boolean) => void;
  focusMyLocation: () => void;

  outlineBtn: string;
  activeBtn: string;
};

type SheetState = "peek" | "mid" | "full";

function IconChevronLeft({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M15 5l-7 7l7 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChevronRight({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M9 5l7 7l-7 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChevronUp({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M5 15l7-7l7 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChevronDown({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M5 9l7 7l7-7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconGrip({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M8 7h8M8 12h8M8 17h8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconLocation({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11Z"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.9" />
    </svg>
  );
}

function IconRefresh({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M17 3v5h-5M7 21v-5h5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChevronDownSmall({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M6 9l6 6l6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function MobileView({
  loading,
  busyId,
  errorMsg,
  selectedId,
  setSelectedId,
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
  currentPosition,
  locationAllowed,
  locationBusy,
  requestCurrentPosition,
  focusMyLocation,
}: Props) {
  const [fullscreenMap, setFullscreenMap] = useState(false);
  const [topMenuOpen, setTopMenuOpen] = useState(false);

  const [railOpen, setRailOpen] = useState(false);
  const [railEditMode, setRailEditMode] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [pickedMoveId, setPickedMoveId] = useState<string | null>(null);
  const [localOrder, setLocalOrder] = useState<string[]>([]);

  const [sheetState, setSheetState] = useState<SheetState>("peek");

  const sheetStartYRef = useRef<number | null>(null);
  const sheetDeltaRef = useRef(0);

  useEffect(() => {
    setMobileTab("mapa");
  }, [setMobileTab]);

  useEffect(() => {
    setLocalOrder((prev) => {
      const incoming = filteredOrders.map((o) => o.id);
      const kept = prev.filter((id) => incoming.includes(id));
      const missing = incoming.filter((id) => !kept.includes(id));
      return [...kept, ...missing];
    });
  }, [filteredOrders]);

  useEffect(() => {
    const timers = [60, 160, 300, 650, 1100].map((delay) =>
      window.setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, delay)
    );

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [fullscreenMap, railOpen, sheetState, filteredOrders.length, selectedId]);

  const orderedForMobile = useMemo(() => {
    if (!localOrder.length) return filteredOrders;
    const map = new Map(filteredOrders.map((o) => [o.id, o]));
    return localOrder.map((id) => map.get(id)).filter(Boolean) as OrderUi[];
  }, [filteredOrders, localOrder]);

  const selectedFromOrdered =
    orderedForMobile.find((o) => o.id === selectedId) ?? selectedOrder ?? orderedForMobile[0] ?? null;

  useEffect(() => {
    if (!selectedId && orderedForMobile[0]) {
      setSelectedId(orderedForMobile[0].id);
    }
  }, [orderedForMobile, selectedId, setSelectedId]);

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

  function handleRailItemPress(orderId: string) {
    if (!railEditMode) {
      setSelectedId(orderId);
      const order = orderedForMobile.find((o) => o.id === orderId);
      if (order) focusOnMap(order);
      return;
    }

    if (!pickedMoveId) {
      setPickedMoveId(orderId);
      return;
    }

    if (pickedMoveId === orderId) {
      setPickedMoveId(null);
      return;
    }

    reorderList(pickedMoveId, orderId);
    setPickedMoveId(null);
  }

  function cycleSheetUp() {
    setSheetState((prev) => {
      if (prev === "peek") return "mid";
      if (prev === "mid") return "full";
      return "full";
    });
  }

  function cycleSheetDown() {
    setSheetState((prev) => {
      if (prev === "full") return "mid";
      if (prev === "mid") return "peek";
      return "peek";
    });
  }

  function onSheetTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    sheetStartYRef.current = e.touches[0].clientY;
    sheetDeltaRef.current = 0;
  }

  function onSheetTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (sheetStartYRef.current == null) return;
    sheetDeltaRef.current = e.touches[0].clientY - sheetStartYRef.current;
  }

  function onSheetTouchEnd() {
    const delta = sheetDeltaRef.current;

    if (delta < -45) {
      cycleSheetUp();
    } else if (delta > 45) {
      cycleSheetDown();
    }

    sheetStartYRef.current = null;
    sheetDeltaRef.current = 0;
  }

  const sheetHeightClass =
    sheetState === "peek"
      ? "h-[126px]"
      : sheetState === "mid"
      ? "h-[34dvh]"
      : "h-[82dvh]";

  const railWidth = railOpen ? 108 : 28;

  const filterBtn = (key: FilterKey, label: string) => (
    <button
      type="button"
      onClick={() => {
        clearRoute();
        setFilter(key);
      }}
      className={`rounded-full px-3 py-2 text-[13px] font-bold whitespace-nowrap transition ${
        filter === key
          ? "border border-[#00a63e] bg-[#00a63e] text-white"
          : "border border-[#cfe5d5] bg-white text-[#103f20]"
      }`}
    >
      {label}
    </button>
  );

  const mapHeightStyle = fullscreenMap
    ? { height: "100dvh" }
    : { height: "calc(100dvh - 160px)" };

  return (
    <div className="space-y-3">
      <div className="relative rounded-[22px] border border-[#d7eadb] bg-white px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
        <div className="flex items-start justify-between gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setTopMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 text-[28px] font-extrabold leading-none text-[#00a63e]"
            >
              <span>Rozvozy</span>
              <IconChevronDownSmall className="mt-1 h-5 w-5 text-[#00a63e]" />
            </button>

            {topMenuOpen ? (
              <div className="absolute left-0 top-10 z-[60] min-w-[150px] rounded-[18px] border border-[#d7eadb] bg-white p-2 shadow-[0_16px_40px_rgba(0,0,0,0.14)]">
                <button
                  type="button"
                  onClick={() => {
                    setTopMenuOpen(false);
                    setFullscreenMap(false);
                  }}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-[#103f20] hover:bg-[#f4fbf5]"
                >
                  Zmenšit
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setFullscreenMap(true)}
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

      <div
        className={
          fullscreenMap
            ? "fixed inset-0 z-[9998] bg-[#f7faf7]"
            : "overflow-hidden rounded-[22px] border border-[#d7eadb] bg-white shadow-[0_10px_30px_rgba(0,0,0,0.05)]"
        }
      >
        <div className="relative w-full overflow-hidden" style={mapHeightStyle}>
          {fullscreenMap ? (
            <div className="absolute left-3 top-3 right-3 z-[10000] flex items-center justify-between gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setTopMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2 rounded-full border border-[#d7eadb] bg-white/95 px-4 py-2 text-[18px] font-extrabold text-[#00a63e] shadow backdrop-blur"
                >
                  <span>Rozvozy</span>
                  <IconChevronDownSmall className="h-4 w-4 text-[#00a63e]" />
                </button>

                {topMenuOpen ? (
                  <div className="absolute left-0 top-12 z-[60] min-w-[150px] rounded-[18px] border border-[#d7eadb] bg-white p-2 shadow-[0_16px_40px_rgba(0,0,0,0.14)]">
                    <button
                      type="button"
                      onClick={() => {
                        setTopMenuOpen(false);
                        setFullscreenMap(false);
                      }}
                      className="w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-[#103f20] hover:bg-[#f4fbf5]"
                    >
                      Zmenšit
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={focusMyLocation}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[#cfe5d5] bg-white text-[#103f20] shadow"
                  title="Moje poloha"
                >
                  <IconLocation className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  onClick={() => setFullscreenMap(false)}
                  className="rounded-full border border-[#cfe5d5] bg-white px-3 py-2 text-[13px] font-bold text-[#103f20] shadow"
                >
                  Ukončit
                </button>
              </div>
            </div>
          ) : null}

          <div ref={mapWrapRef} className="h-full w-full" />

          <div className="absolute bottom-[142px] left-3 z-[9999] flex flex-col gap-2">
            <button
              type="button"
              onClick={focusMyLocation}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#cfe5d5] bg-white text-[#103f20] shadow"
              title="Moje poloha"
            >
              <IconLocation className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={loadOrders}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#cfe5d5] bg-white text-[#103f20] shadow"
              title="Obnovit"
            >
              <IconRefresh className="h-5 w-5" />
            </button>
          </div>

          {routeInfo ? (
            <div className="absolute left-3 top-[78px] z-[9999] max-w-[240px] rounded-[16px] border border-[#dff0e3] bg-[#f7fcf8]/95 px-4 py-3 text-sm font-semibold text-[#103f20] shadow backdrop-blur">
              Trasa: {routeInfo.distanceKm.toFixed(1)} km • přibližně{" "}
              {Math.max(1, Math.round(routeInfo.durationMin))} min
            </div>
          ) : null}

          {errorMsg ? (
            <div className="absolute left-3 right-3 top-[78px] z-[9999] rounded-[16px] border border-[#ffd4d4] bg-white/95 px-4 py-3 text-sm font-semibold text-[#9f2222] shadow backdrop-blur">
              {errorMsg}
            </div>
          ) : null}

          <div
            className="absolute right-0 top-0 bottom-0 z-[9999] flex"
            style={{ width: railWidth }}
          >
            <div className="flex w-7 items-center justify-center border-l border-[#d7eadb] bg-white/92 backdrop-blur">
              <button
                type="button"
                onClick={() => setRailOpen((prev) => !prev)}
                className="flex h-12 w-6 items-center justify-center rounded-full border border-[#d7eadb] bg-white text-[#103f20] shadow"
                title={railOpen ? "Sbalit pořadí" : "Rozbalit pořadí"}
              >
                {railOpen ? (
                  <IconChevronRight className="h-4 w-4" />
                ) : (
                  <IconChevronLeft className="h-4 w-4" />
                )}
              </button>
            </div>

            {railOpen ? (
              <div className="w-[81px] overflow-y-auto border-l border-[#e3efe6] bg-[#fbfefb]/95 backdrop-blur">
                <div className="sticky top-0 z-10 space-y-2 border-b border-[#e3efe6] bg-[#fbfefb]/95 px-2 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRailEditMode((prev) => !prev);
                      setPickedMoveId(null);
                    }}
                    className={`w-full rounded-xl px-2 py-2 text-[11px] font-extrabold ${
                      railEditMode
                        ? "border border-[#00a63e] bg-[#00a63e] text-white"
                        : "border border-[#cfe5d5] bg-white text-[#103f20]"
                    }`}
                  >
                    {railEditMode ? "Hotovo" : "Upravit"}
                  </button>

                  {railEditMode ? (
                    <div className="text-center text-[10px] leading-tight text-[#5e7568]">
                      Klikni na číslo a pak na místo, kam ho chceš přesunout
                    </div>
                  ) : null}
                </div>

                <div className="p-2">
                  {orderedForMobile.slice(0, 40).map((order, index) => {
                    const selected = selectedId === order.id;
                    const picked = pickedMoveId === order.id;

                    return (
                      <div key={order.id} className="mb-2">
                        <button
                          type="button"
                          draggable={railEditMode}
                          onDragStart={() => setDraggedId(order.id)}
                          onDragEnd={() => setDraggedId(null)}
                          onDragOver={(e) => {
                            if (railEditMode) e.preventDefault();
                          }}
                          onDrop={() => {
                            if (railEditMode && draggedId) {
                              reorderList(draggedId, order.id);
                            }
                            setDraggedId(null);
                            setPickedMoveId(null);
                          }}
                          onClick={() => handleRailItemPress(order.id)}
                          className={`flex w-full items-center justify-center gap-1 rounded-[16px] border px-2 py-3 text-sm font-extrabold transition ${
                            picked
                              ? "border-[#111827] bg-[#111827] text-white"
                              : selected
                              ? "border-[#00a63e] bg-[#00a63e] text-white"
                              : "border-[#cfe5d5] bg-white text-[#103f20]"
                          } ${draggedId === order.id ? "opacity-60" : ""}`}
                          title={
                            railEditMode
                              ? "Klikni pro přesun nebo podrž a přetáhni"
                              : order.full_name
                          }
                        >
                          <span>{index + 1}</span>
                          {railEditMode ? <IconGrip className="h-3.5 w-3.5" /> : null}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div
            className={`absolute bottom-0 left-0 z-[9999] rounded-t-[28px] border-t border-[#d7eadb] bg-white/97 shadow-[0_-16px_40px_rgba(0,0,0,0.18)] backdrop-blur transition-all duration-300 ${sheetHeightClass}`}
            style={{ right: `${railWidth}px` }}
            onTouchStart={onSheetTouchStart}
            onTouchMove={onSheetTouchMove}
            onTouchEnd={onSheetTouchEnd}
          >
            <div className="px-3 pt-2">
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={cycleSheetDown}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[#d7eadb] bg-white text-[#103f20]"
                >
                  <IconChevronDown className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={cycleSheetUp}
                  className="flex min-w-[92px] items-center justify-center gap-2 rounded-full border border-[#d7eadb] bg-[#f8fbf8] px-3 py-1.5 text-[12px] font-extrabold text-[#103f20]"
                >
                  <span className="h-1.5 w-10 rounded-full bg-[#cfe5d5]" />
                </button>

                <button
                  type="button"
                  onClick={cycleSheetUp}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[#d7eadb] bg-white text-[#103f20]"
                >
                  <IconChevronUp className="h-4 w-4" />
                </button>
              </div>

              {selectedFromOrdered ? (
                <div className="mt-3 rounded-[22px] border-2 border-[#cfe5d5] bg-white px-3 py-3 shadow-[0_10px_28px_rgba(0,0,0,0.10)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[19px] font-extrabold text-[#103f20]">
                        {selectedFromOrdered.full_name}
                      </div>
                      <div className="mt-1 text-[13px] leading-snug text-[#4f685d]">
                        {selectedFromOrdered.address}
                      </div>
                      <div className="mt-1 text-[13px] text-[#4f685d]">
                        {selectedFromOrdered.phone || "bez telefonu"} •{" "}
                        {formatPrice(selectedFromOrdered.total)}
                      </div>
                    </div>

                    <div className="shrink-0">
                      <select
                        value={selectedFromOrdered.delivery_zone ?? ""}
                        onChange={(e) =>
                          setZone(
                            selectedFromOrdered.id,
                            (e.target.value || null) as DeliveryZone
                          )
                        }
                        className="rounded-xl border border-[#d6e8da] bg-white px-3 py-2 text-[12px] font-bold text-[#103f20] outline-none"
                      >
                        <option value="okruh1">Okruh 1</option>
                        <option value="okruh2">Okruh 2</option>
                        <option value="skolky">Školky</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-bold ${zoneBadgeClass(
                        selectedFromOrdered.delivery_zone
                      )}`}
                    >
                      {zoneLabel(selectedFromOrdered.delivery_zone)}
                    </span>
                  </div>

                  {sheetState !== "peek" ? (
                    <>
                      <div className="mt-4 grid grid-cols-2 gap-2">
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

                      <div className="mt-3 flex justify-center">
                        <button
                          type="button"
                          onClick={() => setConfirmDeliveredOrder(selectedFromOrdered)}
                          disabled={busyId === selectedFromOrdered.id}
                          className="min-w-[180px] rounded-xl border border-[#00a63e] bg-[#00a63e] px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
                        >
                          Vyřízeno
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : (
                <div className="mt-3 rounded-[20px] border border-[#e3efe6] bg-[#fbfefb] px-3 py-4 text-sm text-[#5e7568]">
                  {loading ? "Načítám rozvozy..." : "Žádná rozvozová objednávka."}
                </div>
              )}

              {sheetState !== "peek" ? (
                <div className="mt-3 max-h-[calc(100%-170px)] overflow-y-auto pb-5">
                  {locationAllowed === false ? (
                    <div className="mb-3 rounded-[16px] border border-[#ffe2b4] bg-[#fff8ee] px-3 py-3 text-[13px] text-[#8b5a00]">
                      Nepovolil jsi polohu. Trasa se pak počítá z Jiřky, ne z tvojí aktuální pozice.
                    </div>
                  ) : null}

                  <div className="mb-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => requestCurrentPosition(true)}
                      className="rounded-full border border-[#cfe5d5] bg-white px-3 py-2 text-[12px] font-bold text-[#103f20]"
                    >
                      {locationBusy ? "Zjišťuji polohu..." : "Aktualizovat polohu"}
                    </button>

                    {currentPosition ? (
                      <div className="text-[12px] text-[#5e7568]">Poloha nalezena</div>
                    ) : null}
                  </div>

                  {orderedForMobile.length === 0 && !loading ? (
                    <div className="rounded-[18px] border border-[#e3efe6] bg-[#fbfefb] p-4 text-[#5e7568]">
                      V tomto filtru teď nejsou žádné objednávky.
                    </div>
                  ) : null}

                  {orderedForMobile.map((order, index) => {
                    const selected = selectedId === order.id;

                    return (
                      <div
                        key={order.id}
                        onClick={() => {
                          setSelectedId(order.id);
                          focusOnMap(order);
                          setSheetState("mid");
                        }}
                        className={`mb-2 rounded-[18px] border px-3 py-3 transition ${
                          selected
                            ? "border-[#00a63e] bg-[#f4fbf5]"
                            : "border-[#e3efe6] bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 min-w-7 items-center justify-center rounded-full bg-[#103f20] px-2 text-[12px] font-extrabold text-white">
                                {index + 1}
                              </div>
                              <div className="truncate text-[16px] font-extrabold text-[#103f20]">
                                {order.full_name}
                              </div>
                            </div>

                            <div className="mt-1 text-[13px] leading-snug text-[#4f685d]">
                              {order.address}
                            </div>

                            <div className="mt-1 text-[13px] text-[#4f685d]">
                              {order.phone || "bez telefonu"} • {formatPrice(order.total)}
                            </div>
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${zoneBadgeClass(
                              order.delivery_zone
                            )}`}
                          >
                            {zoneLabel(order.delivery_zone)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
