"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
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
  const [weeksOpen, setWeeksOpen] = useState(false);

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

  const canGoPrev = weekIndex > 0;
  const canGoNext = weekIndex < 3;

  const activeDayTitle = useMemo(() => {
    return menuDays.find((d) => d.key === activeDay)?.label ?? "";
  }, [menuDays, activeDay]);

  return (
    <div className="space-y-4 pb-28">
      <div className="rounded-[28px] border border-[#dff2e5] bg-white px-4 py-4 shadow-[0_12px_30px_rgba(27,54,39,0.05)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[30px] font-extrabold leading-[0.95] text-[#14213d]">
              Objednávka
            </div>
            <div className="mt-1 text-[14px] font-bold leading-none text-[#5f677b]">
              z jídelníčku
            </div>
          </div>

          <Link
            href="/staff"
            className="inline-flex h-[46px] shrink-0 items-center justify-center rounded-full bg-[#60b14d] px-5 text-[15px] font-extrabold text-white shadow-[0_6px_18px_rgba(96,177,77,0.24)]"
          >
            Rozcestník
          </Link>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCustomerType("zakaznik")}
            className={cls(
              "min-w-0 rounded-full border px-4 py-2.5 text-[14px] font-extrabold transition",
              customerType === "zakaznik"
                ? "border-[#60b14d] bg-[#60b14d] text-white"
                : "border-[#bde7c8] bg-white text-[#2d6f43]"
            )}
          >
            Zákazník
          </button>

          <button
            type="button"
            onClick={() => setCustomerType("fakturovany")}
            className={cls(
              "min-w-0 flex-1 rounded-full border px-4 py-2.5 text-[13px] font-extrabold transition",
              customerType === "fakturovany"
                ? "border-[#60b14d] bg-[#60b14d] text-white"
                : "border-[#bde7c8] bg-white text-[#2d6f43]"
            )}
          >
            Fakturovaný zákazník
          </button>
        </div>

        <div className="relative mt-3 flex items-center gap-2">
          <div className="relative flex-1">
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
              className="w-full rounded-full border border-[#bde7c8] bg-white px-4 py-3 text-[14px] font-semibold text-[#182033] outline-none placeholder:text-[#9aa2b1] focus:border-[#60b14d]"
            />

            {customerType === "zakaznik" &&
            filteredProfiles.length > 0 &&
            profileSearch.trim() &&
            !selectedProfile ? (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 rounded-[20px] border border-[#dff2e5] bg-white p-2 shadow-[0_14px_28px_rgba(16,24,40,0.12)]">
                <div className="grid gap-2">
                  {filteredProfiles.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedProfile(c);
                        setProfileSearch("");
                      }}
                      className="rounded-[16px] border border-[#dff2e5] bg-[#f7fcf8] px-4 py-3 text-left"
                    >
                      <div className="text-[14px] font-extrabold text-[#182033]">
                        {c.full_name || "Bez jména"}
                      </div>
                      <div className="mt-1 text-[12px] font-bold text-[#667085]">
                        {c.phone || "bez telefonu"}
                        {c.email ? ` • ${c.email}` : ""}
                      </div>
                      <div className="mt-1 text-[13px] font-extrabold text-[#2f7a49]">
                        Kredit {czk(Number(c.kredit ?? 0))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {customerType === "fakturovany" &&
            filteredInvoiceCustomers.length > 0 &&
            invoiceSearch.trim() &&
            !selectedInvoiceCustomer ? (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 rounded-[20px] border border-[#dff2e5] bg-white p-2 shadow-[0_14px_28px_rgba(16,24,40,0.12)]">
                <div className="grid gap-2">
                  {filteredInvoiceCustomers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedInvoiceCustomer(c);
                        setInvoiceSearch("");
                      }}
                      className="rounded-[16px] border border-[#dff2e5] bg-[#f7fcf8] px-4 py-3 text-left"
                    >
                      <div className="text-[14px] font-extrabold text-[#182033]">{c.name}</div>
                      <div className="mt-1 text-[12px] font-bold text-[#667085]">
                        {c.phone || "bez telefonu"}
                        {c.email ? ` • ${c.email}` : ""}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => {
              setCreateMode(customerType === "zakaznik" ? "profile" : "invoice");
              setShowCreateCustomer(true);
            }}
            className="inline-flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[16px] border border-[#bde7c8] bg-white text-[28px] font-extrabold leading-none text-[#2d6f43]"
          >
            +
          </button>
        </div>
      </div>

      <div className="rounded-[28px] border border-[#bde7c8] bg-white p-3 shadow-[0_12px_30px_rgba(27,54,39,0.05)]">
        <div className="rounded-[24px] border border-[#bde7c8] p-3">
          <div className="relative flex items-center gap-2">
            <button
              type="button"
              onClick={() => canGoPrev && setWeekIndex((prev) => Math.max(0, prev - 1) as 0 | 1 | 2 | 3)}
              className={cls(
                "inline-flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-full border bg-white text-[24px] font-bold",
                canGoPrev
                  ? "border-[#bde7c8] text-[#7a7f8a]"
                  : "border-[#dfe8e1] text-[#c0c6d0]"
              )}
            >
              ←
            </button>

            <button
              type="button"
              onClick={() => setWeeksOpen((v) => !v)}
              className="flex h-[54px] min-w-0 flex-1 items-center justify-between rounded-full border border-[#bde7c8] bg-[#f4faf5] px-5 text-left"
            >
              <span className="truncate text-[16px] font-extrabold text-[#182033]">
                {currentWeekLabel}
              </span>
              <span className="ml-3 text-[16px] font-extrabold leading-none text-[#2f7a49]">
                ▲
                <br />
                ▼
              </span>
            </button>

            <button
              type="button"
              onClick={() => canGoNext && setWeekIndex((prev) => Math.min(3, prev + 1) as 0 | 1 | 2 | 3)}
              className={cls(
                "inline-flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-full border bg-white text-[24px] font-bold",
                canGoNext
                  ? "border-[#bde7c8] text-[#182033]"
                  : "border-[#dfe8e1] text-[#c0c6d0]"
              )}
            >
              →
            </button>

            <button
              type="button"
              onClick={() => setWeeksOpen((v) => !v)}
              className="inline-flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[18px] border border-[#bde7c8] bg-white text-[24px]"
            >
              📅
            </button>

            {weeksOpen ? (
              <div className="absolute left-[82px] right-[82px] top-[62px] z-20 rounded-[26px] border border-[#dff2e5] bg-white p-3 shadow-[0_16px_34px_rgba(16,24,40,0.16)]">
                <div className="grid gap-2">
                  {weekOptions.map((w) => {
                    const active = w.index === weekIndex;
                    return (
                      <button
                        key={w.index}
                        type="button"
                        onClick={() => {
                          setWeekIndex(w.index);
                          setWeeksOpen(false);
                        }}
                        className={cls(
                          "rounded-[18px] px-5 py-4 text-left text-[16px] font-extrabold transition",
                          active
                            ? "bg-[#60b14d] text-white"
                            : "bg-[#eef4ef] text-[#182033]"
                        )}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span>{w.label}</span>
                          {active ? <span className="text-[22px]">✓</span> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-3 grid grid-cols-6 gap-2">
            {menuDays.map((day) => (
              <button
                key={day.key}
                type="button"
                onClick={() => setActiveDay(day.key)}
                className={cls(
                  "rounded-full border px-1 py-3 text-center text-[14px] font-extrabold transition",
                  activeDay === day.key
                    ? "border-[#60b14d] bg-[#60b14d] text-white"
                    : "border-[#bde7c8] bg-white text-[#2d6f43]"
                )}
              >
                {day.short}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {menuLoading ? (
            <div className="rounded-[24px] border border-[#dff2e5] bg-[#fbfdfb] px-4 py-5 text-[14px] font-semibold text-[#6b7280]">
              Načítám menu…
            </div>
          ) : menuError ? (
            <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-5 text-[14px] font-semibold text-red-600">
              {menuError}
            </div>
          ) : activeItems.length === 0 ? (
            <div className="rounded-[24px] border border-[#dff2e5] bg-[#fbfdfb] px-4 py-5 text-[14px] font-semibold text-[#6b7280]">
              Na tento den není v menu nic zadané.
            </div>
          ) : (
            activeItems.map((item) => {
              const qty = cartQty(item.foodId, item.dayKey);

              return (
                <div
                  key={item.id}
                  className={cls(
                    "rounded-[24px] border px-4 py-4 transition",
                    qty > 0 ? "border-[#95d6af] bg-[#f3fbf5]" : "border-[#bde7c8] bg-white"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[17px] font-extrabold text-[#182033]">
                        {item.name}
                      </div>
                      <div className="mt-1 truncate text-[13px] font-bold text-[#3f8f57]">
                        {item.subtitle || "—"}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#bde7c8] bg-[#eef8f1] text-[20px] font-extrabold text-[#3f8f57]"
                    >
                      i
                    </button>

                    <div className="shrink-0 rounded-[18px] border border-[#bde7c8] bg-white px-4 py-2 text-[16px] font-extrabold text-[#2f7a49]">
                      {czk(item.price)}
                    </div>

                    {qty <= 0 ? (
                      <button
                        type="button"
                        onClick={() => addToCart(item)}
                        className="shrink-0 rounded-[18px] border border-[#78d3a0] bg-white px-4 py-2 text-[15px] font-extrabold text-[#2b6e41]"
                      >
                        Přidat
                      </button>
                    ) : (
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => subFromCart(item)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#78d3a0] bg-white text-[24px] font-extrabold text-[#2b6e41]"
                        >
                          −
                        </button>
                        <div className="min-w-[20px] text-center text-[18px] font-extrabold text-[#182033]">
                          {qty}
                        </div>
                        <button
                          type="button"
                          onClick={() => addToCart(item)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#78d3a0] bg-white text-[22px] font-extrabold text-[#2b6e41]"
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

      {saveMsg ? <div className="px-1 text-[13px] font-semibold text-[#2f7a49]">{saveMsg}</div> : null}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e6efe8] bg-white/95 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <Link
            href="/staff"
            className="rounded-full border border-[#d8dfdb] bg-white px-5 py-3 text-[15px] font-extrabold text-[#182033]"
          >
            Zrušit
          </Link>

          <button
            type="button"
            onClick={() => setShowSummary(true)}
            className={cls(
              "min-w-0 flex-1 rounded-full px-4 py-3 text-center text-[15px] font-extrabold transition",
              cartCount > 0
                ? "bg-[#b9dcae] text-white"
                : "border border-[#dff2e5] bg-[#eef6ee] text-white"
            )}
          >
            <span className="block truncate">Objednávka • {cartCount} ks • {czk(cartTotal)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}