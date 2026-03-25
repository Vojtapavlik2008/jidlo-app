"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { MenuDay, MenuItem, WeekOption } from "../page";

type CustomerType = "zakaznik" | "fakturovany";

type ProfileRow = {
  id: string;
  full_name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  kredit: number | null;
};

type InvoiceCustomerDbRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
};

function cls(...a: Array<string | false | undefined | null>) {
  return a.filter(Boolean).join(" ");
}

function czk(n: number) {
  return `${Number(n || 0).toFixed(0)} Kč`;
}

function isoLocal(d: Date) {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, diff: number) {
  return new Date(d.getFullYear(), d.getMonth() + diff, 1);
}

function monthLabel(date: Date) {
  const raw = new Intl.DateTimeFormat("cs-CZ", {
    month: "long",
    year: "numeric",
  }).format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildCalendarDays(monthDate: Date) {
  const start = startOfMonth(monthDate);
  const firstWeekDay = (start.getDay() + 6) % 7;
  const days: Date[] = [];

  for (let i = 0; i < 42; i++) {
    days.push(new Date(start.getFullYear(), start.getMonth(), i - firstWeekDay + 1));
  }

  return days;
}

function InfoIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 10.2V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="7.2" r="1.2" fill="currentColor" />
    </svg>
  );
}

function IconButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cls(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-green-50 text-[20px] ring-2 ring-green-200/80 transition",
        disabled
          ? "cursor-not-allowed text-gray-300"
          : "text-gray-900 hover:bg-green-100/70"
      )}
    >
      {children}
    </button>
  );
}

type Props = {
  customerType: CustomerType;
  setCustomerType: (value: CustomerType) => void;
  profileSearch: string;
  setProfileSearch: (value: string) => void;
  invoiceSearch: string;
  setInvoiceSearch: (value: string) => void;
  selectedProfile: ProfileRow | null;
  setSelectedProfile: (value: ProfileRow | null) => void;
  selectedInvoiceCustomer: InvoiceCustomerDbRow | null;
  setSelectedInvoiceCustomer: (value: InvoiceCustomerDbRow | null) => void;
  filteredProfiles: ProfileRow[];
  filteredInvoiceCustomers: InvoiceCustomerDbRow[];
  setCreateMode: (value: "profile" | "invoice") => void;
  setShowCreateCustomer: (value: boolean) => void;
  menuDays: MenuDay[];
  activeDay: string;
  setActiveDay: (value: string) => void;
  weekIndex: 0 | 1 | 2 | 3;
  setWeekIndex: Dispatch<SetStateAction<0 | 1 | 2 | 3>>;
  weekOptions: WeekOption[];
  menuLoading: boolean;
  menuError: string | null;
  activeItems: MenuItem[];
  cartQty: (foodId: string, dayKey: string) => number;
  addToCart: (item: MenuItem) => void;
  subFromCart: (item: MenuItem) => void;
  cartCount: number;
  cartTotal: number;
  saveMsg: string | null;
  setShowSummary: (value: boolean) => void;
};

export default function MobileView({
  customerType,
  setCustomerType,
  profileSearch,
  setProfileSearch,
  invoiceSearch,
  setInvoiceSearch,
  selectedProfile,
  setSelectedProfile,
  selectedInvoiceCustomer,
  setSelectedInvoiceCustomer,
  filteredProfiles,
  filteredInvoiceCustomers,
  setCreateMode,
  setShowCreateCustomer,
  menuDays,
  activeDay,
  setActiveDay,
  weekIndex,
  setWeekIndex,
  weekOptions,
  menuLoading,
  menuError,
  activeItems,
  cartQty,
  addToCart,
  subFromCart,
  cartCount,
  cartTotal,
  saveMsg,
  setShowSummary,
}: Props) {
  const [weekMenuOpen, setWeekMenuOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);

  const weekMenuRef = useRef<HTMLDivElement | null>(null);
  const calWrapRef = useRef<HTMLDivElement | null>(null);

  const outer = "rounded-[26px] bg-green-50/50 ring-2 ring-green-200/70 p-3";
  const panel = "rounded-[22px] bg-white ring-2 ring-green-200/70 p-3";

  const searchValue =
    customerType === "zakaznik"
      ? selectedProfile
        ? selectedProfile.full_name || ""
        : profileSearch
      : selectedInvoiceCustomer
        ? selectedInvoiceCustomer.name
        : invoiceSearch;

  const currentWeekLabel =
    weekOptions.find((w) => w.index === weekIndex)?.label ?? weekOptions[0]?.label ?? "Tento týden";

  const weekPos = useMemo(() => {
    const i = weekOptions.findIndex((w) => w.index === weekIndex);
    return i < 0 ? 0 : i;
  }, [weekIndex, weekOptions]);

  const canPrevWeek = weekPos > 0;
  const canNextWeek = weekPos < weekOptions.length - 1;

  const initialCalendarDate = useMemo(() => {
    const found = activeDay || isoLocal(new Date());
    const d = new Date(found);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }, [activeDay]);

  const [calendarMonth, setCalendarMonth] = useState<Date>(startOfMonth(initialCalendarDate));

  useEffect(() => {
    setCalendarMonth(startOfMonth(initialCalendarDate));
  }, [initialCalendarDate]);

  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const node = e.target as Node;
      if (weekMenuRef.current && !weekMenuRef.current.contains(node)) {
        setWeekMenuOpen(false);
      }
      if (calWrapRef.current && !calWrapRef.current.contains(node)) {
        setCalOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pickWeek = (index: 0 | 1 | 2 | 3) => {
    setWeekIndex(index);
    setWeekMenuOpen(false);
    setCalOpen(false);
  };

  const shortDayTabs = ["Po", "Út", "St", "Čt", "Pá", "So"];

  return (
    <div className="md:hidden px-3 pb-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[24px] leading-none font-extrabold text-gray-900">
            Objednávka
          </div>
          <div className="mt-1 text-[14px] leading-none font-extrabold text-gray-500">
            z jídelníčku
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/staff"
            className="rounded-full bg-green-600 px-5 py-2.5 text-[12px] font-extrabold text-white shadow-sm transition hover:brightness-95"
          >
            Rozcestník
          </Link>
        </div>
      </div>

      <section className="mt-3 space-y-3">
        <div className={outer}>
          <div className={panel}>
            <div className="grid grid-cols-[1fr_1.38fr] gap-2">
              <button
                type="button"
                onClick={() => setCustomerType("zakaznik")}
                className={cls(
                  "h-11 rounded-full px-3 text-[12px] font-extrabold ring-1 ring-green-200/80 transition",
                  customerType === "zakaznik"
                    ? "bg-green-600 text-white ring-green-600"
                    : "bg-white text-green-800 hover:bg-green-50"
                )}
              >
                Zákazník
              </button>

              <button
                type="button"
                onClick={() => setCustomerType("fakturovany")}
                className={cls(
                  "h-11 rounded-full px-3 text-[12px] font-extrabold ring-1 ring-green-200/80 transition",
                  customerType === "fakturovany"
                    ? "bg-green-600 text-white ring-green-600"
                    : "bg-white text-green-800 hover:bg-green-50"
                )}
              >
                Fakturovaný zákazník
              </button>
            </div>

            <div className="relative mt-3">
              <input
                value={searchValue}
                onChange={(e) => {
                  if (customerType === "zakaznik") {
                    setSelectedProfile(null);
                    setProfileSearch(e.target.value);
                  } else {
                    setSelectedInvoiceCustomer(null);
                    setInvoiceSearch(e.target.value);
                  }
                }}
                placeholder={
                  customerType === "zakaznik"
                    ? "Vyhledat zákazníka"
                    : "Vyhledat fakturovaného zákazníka"
                }
                className="h-11 w-full rounded-[16px] bg-white px-4 pr-[160px] text-[14px] font-semibold text-gray-900 placeholder:text-gray-400 ring-1 ring-green-200/90 focus:outline-none focus:ring-2 focus:ring-green-500/30"
              />

              <button
                type="button"
                onClick={() => {
                  setCreateMode(customerType === "zakaznik" ? "profile" : "invoice");
                  setShowCreateCustomer(true);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-extrabold text-green-800 underline underline-offset-4"
              >
                Přidat zákazníka
              </button>

              {customerType === "zakaznik" &&
              filteredProfiles.length > 0 &&
              profileSearch.trim() &&
              !selectedProfile ? (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-72 overflow-auto rounded-[18px] bg-white p-2 shadow-lg ring-1 ring-green-200/90">
                  {filteredProfiles.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedProfile(c);
                        setProfileSearch("");
                      }}
                      className="mb-2 w-full rounded-[14px] bg-green-50 px-3 py-3 text-left ring-1 ring-green-200/80 last:mb-0"
                    >
                      <div className="text-[13px] font-extrabold text-gray-900">
                        {c.full_name || "Bez jména"}
                      </div>
                      <div className="mt-1 text-[11px] font-semibold text-gray-500">
                        {c.phone || "bez telefonu"}
                        {c.email ? ` • ${c.email}` : ""}
                      </div>
                      <div className="mt-1 text-[12px] font-extrabold text-green-800">
                        Kredit {czk(Number(c.kredit ?? 0))}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}

              {customerType === "fakturovany" &&
              filteredInvoiceCustomers.length > 0 &&
              invoiceSearch.trim() &&
              !selectedInvoiceCustomer ? (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-72 overflow-auto rounded-[18px] bg-white p-2 shadow-lg ring-1 ring-green-200/90">
                  {filteredInvoiceCustomers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedInvoiceCustomer(c);
                        setInvoiceSearch("");
                      }}
                      className="mb-2 w-full rounded-[14px] bg-green-50 px-3 py-3 text-left ring-1 ring-green-200/80 last:mb-0"
                    >
                      <div className="text-[13px] font-extrabold text-gray-900">{c.name}</div>
                      <div className="mt-1 text-[11px] font-semibold text-gray-500">
                        {c.phone || "bez telefonu"}
                        {c.email ? ` • ${c.email}` : ""}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className={outer}>
          <div className={panel}>
            <div className="relative flex items-center gap-2">
              <IconButton
                title="Předchozí týden"
                onClick={() => {
                  if (!canPrevWeek) return;
                  pickWeek(weekOptions[weekPos - 1].index);
                }}
                disabled={!canPrevWeek}
              >
                ←
              </IconButton>

              <div className="relative min-w-0 flex-1" ref={weekMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setCalOpen(false);
                    setWeekMenuOpen((v) => !v);
                  }}
                  className="flex h-11 w-full items-center justify-between gap-2 rounded-[16px] bg-green-50 px-3 text-left ring-2 ring-green-200/80 transition hover:bg-green-100/70"
                >
                  <span className="min-w-0 truncate text-[14px] font-extrabold text-gray-900">
                    {currentWeekLabel}
                  </span>
                  <span className="shrink-0 text-[11px] font-black leading-none text-green-800">
                    <span className="block">▲</span>
                    <span className="-mt-0.5 block">▼</span>
                  </span>
                </button>

                {weekMenuOpen ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-72 overflow-auto rounded-[18px] bg-white p-2 shadow-lg ring-1 ring-green-200/90">
                    {weekOptions.map((o) => {
                      const active = o.index === weekIndex;
                      return (
                        <button
                          key={o.index}
                          type="button"
                          onClick={() => pickWeek(o.index)}
                          className={cls(
                            "mb-1 flex w-full items-center justify-between rounded-[14px] px-3 py-2.5 text-left text-sm font-bold transition last:mb-0",
                            active
                              ? "bg-green-600 text-white"
                              : "bg-green-50 text-gray-900 hover:bg-green-100"
                          )}
                        >
                          <span>{o.label}</span>
                          {active ? <span>✓</span> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <IconButton
                title="Další týden"
                onClick={() => {
                  if (!canNextWeek) return;
                  pickWeek(weekOptions[weekPos + 1].index);
                }}
                disabled={!canNextWeek}
              >
                →
              </IconButton>

              <div className="relative" ref={calWrapRef}>
                <button
                  type="button"
                  onClick={() => {
                    setWeekMenuOpen(false);
                    setCalOpen((v) => !v);
                  }}
                  className="h-11 w-11 shrink-0 rounded-[16px] bg-green-50 text-[18px] ring-2 ring-green-200/80 transition hover:bg-green-100/70"
                  title="Kalendář"
                >
                  📅
                </button>

                {calOpen ? (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-[322px] max-w-[calc(100vw-40px)] rounded-[22px] bg-white p-3 shadow-xl ring-1 ring-green-200/90">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setCalendarMonth((m) => addMonths(m, -1))}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[20px] text-gray-900 ring-2 ring-green-200/80"
                      >
                        ←
                      </button>

                      <div className="text-[17px] font-extrabold text-gray-900">
                        {monthLabel(calendarMonth)}
                      </div>

                      <button
                        type="button"
                        onClick={() => setCalendarMonth((m) => addMonths(m, 1))}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[20px] text-gray-900 ring-2 ring-green-200/80"
                      >
                        →
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-7 gap-y-2 text-center text-[11px] font-extrabold text-gray-500">
                      {["po", "út", "st", "čt", "pá", "so", "ne"].map((d) => (
                        <div key={d}>{d}</div>
                      ))}
                    </div>

                    <div className="mt-2 grid grid-cols-7 gap-2">
                      {calendarDays.map((d, i) => {
                        const inMonth = d.getMonth() === calendarMonth.getMonth();
                        const selected = isSameDay(d, initialCalendarDate);

                        return (
                          <button
                            key={`${d.toISOString()}-${i}`}
                            type="button"
                            onClick={() => {
                              setActiveDay(isoLocal(d));
                              setCalOpen(false);
                            }}
                            className={cls(
                              "inline-flex h-10 items-center justify-center rounded-full border text-[16px] font-extrabold",
                              selected
                                ? "border-green-600 bg-green-600 text-white"
                                : inMonth
                                ? "border-green-200 bg-white text-gray-900"
                                : "border-green-100 bg-white text-gray-300"
                            )}
                          >
                            {d.getDate()}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setCalOpen(false)}
                        className="rounded-full bg-white px-5 py-2 text-[14px] font-extrabold text-gray-900 ring-2 ring-green-200/80"
                      >
                        OK
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-6 gap-2">
              {menuDays.map((d, idx) => {
                const active = activeDay === d.key;
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setActiveDay(d.key)}
                    className={cls(
                      "rounded-full px-0 py-2 text-[12px] font-extrabold ring-1 ring-green-200/80 transition",
                      active
                        ? "bg-green-600 text-white ring-green-600"
                        : "bg-white text-green-800 hover:bg-green-50"
                    )}
                  >
                    {shortDayTabs[idx] ?? d.short}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 space-y-3">
            {menuLoading ? (
              <div className={panel}>
                <div className="text-[13px] font-semibold text-gray-500">Načítám menu…</div>
              </div>
            ) : menuError ? (
              <div className="rounded-[22px] bg-red-50 p-3 ring-1 ring-red-200">
                <div className="text-[13px] font-semibold text-red-600">{menuError}</div>
              </div>
            ) : activeItems.length === 0 ? (
              <div className={panel}>
                <div className="text-[13px] font-semibold text-gray-500">
                  Na tento den není v menu nic zadané.
                </div>
              </div>
            ) : (
              activeItems.map((item) => {
                const qty = cartQty(item.foodId, item.dayKey);

                return (
                  <div
                    key={item.id}
                    className={cls(
                      "rounded-[22px] bg-white p-3 ring-2 transition",
                      qty > 0 ? "bg-green-50/40 ring-green-300" : "ring-green-200/70"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[16px] font-extrabold text-gray-900">
                          {item.name}
                        </div>
                        <div className="mt-1 truncate text-[11px] font-extrabold text-green-700">
                          {item.subtitle || "—"}
                        </div>
                      </div>

                      <button
                        type="button"
                        title={item.allergens ? `Alergeny: ${item.allergens}` : "Alergeny"}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700 ring-1 ring-green-200/80"
                      >
                        <InfoIcon className="h-4.5 w-4.5" />
                      </button>

                      <div className="shrink-0 whitespace-nowrap rounded-[16px] bg-white px-4 py-2 text-[14px] font-extrabold text-green-800 ring-1 ring-green-200/80">
                        {czk(item.price)}
                      </div>

                      {qty <= 0 ? (
                        <button
                          type="button"
                          onClick={() => addToCart(item)}
                          className="shrink-0 rounded-[16px] bg-white px-4 py-2 text-[14px] font-extrabold text-green-800 ring-1 ring-green-200/80 transition hover:bg-green-50"
                        >
                          Přidat
                        </button>
                      ) : (
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => subFromCart(item)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[22px] font-extrabold text-green-800 ring-1 ring-green-200/80"
                          >
                            −
                          </button>
                          <div className="min-w-[18px] text-center text-[16px] font-extrabold text-gray-900">
                            {qty}
                          </div>
                          <button
                            type="button"
                            onClick={() => addToCart(item)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[20px] font-extrabold text-green-800 ring-1 ring-green-200/80"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {saveMsg ? (
          <div className="px-1 text-[13px] font-semibold text-green-700">{saveMsg}</div>
        ) : null}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e7eee8] bg-white/96 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link
            href="/staff"
            className="inline-flex h-[56px] min-w-[122px] items-center justify-center rounded-full border border-[#d7dfda] bg-white px-6 text-[16px] font-extrabold text-[#182033]"
          >
            Zrušit
          </Link>

          <button
            type="button"
            onClick={() => setShowSummary(true)}
            className={cls(
              "inline-flex h-[56px] min-w-0 flex-1 items-center justify-center rounded-full px-5 text-center text-[16px] font-extrabold transition",
              cartCount > 0
                ? "bg-[#67ad4f] text-white shadow-[0_6px_18px_rgba(103,173,79,0.22)]"
                : "bg-[#badbb1] text-white"
            )}
          >
            <span className="truncate">
              {cartCount > 0 ? `Objednávka • ${cartCount} ks • ${czk(cartTotal)}` : `0 Kč • 0 ks`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}