"use client";

import { useState } from "react";
import Link from "next/link";
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
    weekOptions.find((w) => w.index === weekIndex)?.label ??
    weekOptions[0]?.label ??
    "Tento týden";

  const canGoPrev = weekIndex > 0;
  const canGoNext = weekIndex < 3;

  return (
    <div className="pb-28">
      <div className="space-y-4">
        {/* HEADER */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[31px] font-extrabold leading-[1] tracking-[-0.02em] text-[#14213d]">
              Objednávka
            </h1>
            <div className="mt-1 text-[14px] font-bold leading-none text-[#60697d]">
              z jídelníčku
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/staff"
              className="inline-flex h-[44px] items-center justify-center rounded-full bg-[#61ae4f] px-5 text-[15px] font-extrabold text-white shadow-[0_5px_14px_rgba(97,174,79,0.22)]"
            >
              Rozcestník
            </Link>
          </div>
        </div>

        {/* CUSTOMER */}
        <div className="rounded-[28px] border border-[#cde9d3] bg-white px-3 py-3 shadow-[0_10px_26px_rgba(27,54,39,0.045)]">
          <div className="grid grid-cols-[1fr_1.35fr] gap-2">
            <button
              type="button"
              onClick={() => setCustomerType("zakaznik")}
              className={cls(
                "h-[46px] rounded-full border text-[14px] font-extrabold transition",
                customerType === "zakaznik"
                  ? "border-[#61ae4f] bg-[#61ae4f] text-white"
                  : "border-[#bfe3c6] bg-white text-[#2f6f44]"
              )}
            >
              Zákazník
            </button>

            <button
              type="button"
              onClick={() => setCustomerType("fakturovany")}
              className={cls(
                "h-[46px] rounded-full border px-3 text-[13px] font-extrabold transition",
                customerType === "fakturovany"
                  ? "border-[#61ae4f] bg-[#61ae4f] text-white"
                  : "border-[#bfe3c6] bg-white text-[#2f6f44]"
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
              className="h-[48px] w-full rounded-full border border-[#bfe3c6] bg-white pl-4 pr-[146px] text-[14px] font-semibold text-[#182033] outline-none placeholder:text-[#98a1b2] focus:border-[#61ae4f]"
            />

            <button
              type="button"
              onClick={() => {
                setCreateMode(customerType === "zakaznik" ? "profile" : "invoice");
                setShowCreateCustomer(true);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-extrabold text-[#2f6f44] underline underline-offset-4"
            >
              Přidat zákazníka
            </button>

            {customerType === "zakaznik" &&
            filteredProfiles.length > 0 &&
            profileSearch.trim() &&
            !selectedProfile ? (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 rounded-[22px] border border-[#dcefe1] bg-white p-2 shadow-[0_16px_34px_rgba(16,24,40,0.14)]">
                <div className="grid gap-2">
                  {filteredProfiles.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedProfile(c);
                        setProfileSearch("");
                      }}
                      className="rounded-[18px] border border-[#dcefe1] bg-[#f7fbf8] px-4 py-3 text-left"
                    >
                      <div className="text-[14px] font-extrabold text-[#182033]">
                        {c.full_name || "Bez jména"}
                      </div>
                      <div className="mt-1 text-[12px] font-bold text-[#6d7687]">
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
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 rounded-[22px] border border-[#dcefe1] bg-white p-2 shadow-[0_16px_34px_rgba(16,24,40,0.14)]">
                <div className="grid gap-2">
                  {filteredInvoiceCustomers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedInvoiceCustomer(c);
                        setInvoiceSearch("");
                      }}
                      className="rounded-[18px] border border-[#dcefe1] bg-[#f7fbf8] px-4 py-3 text-left"
                    >
                      <div className="text-[14px] font-extrabold text-[#182033]">{c.name}</div>
                      <div className="mt-1 text-[12px] font-bold text-[#6d7687]">
                        {c.phone || "bez telefonu"}
                        {c.email ? ` • ${c.email}` : ""}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* WEEK + DAYS + MENU */}
        <div className="rounded-[28px] border border-[#cde9d3] bg-white p-3 shadow-[0_10px_26px_rgba(27,54,39,0.045)]">
          <div className="rounded-[26px] border border-[#cde9d3] px-3 py-3">
            <div className="relative flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  canGoPrev && setWeekIndex((prev) => Math.max(0, prev - 1) as 0 | 1 | 2 | 3)
                }
                className={cls(
                  "inline-flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full border bg-white text-[22px] font-semibold",
                  canGoPrev
                    ? "border-[#d4ebda] text-[#8b8f99]"
                    : "border-[#e7eeea] text-[#c8ccd3]"
                )}
              >
                ←
              </button>

              <button
                type="button"
                onClick={() => setWeeksOpen((v) => !v)}
                className="flex h-[48px] min-w-0 flex-1 items-center justify-between rounded-full border border-[#cde9d3] bg-[#f6faf6] px-4 text-left"
              >
                <span className="truncate text-[13px] font-extrabold text-[#182033]">
                  {currentWeekLabel}
                </span>
                <span className="ml-2 flex shrink-0 flex-col items-center justify-center text-[12px] leading-[9px] text-[#247046]">
                  <span>▲</span>
                  <span>▼</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  canGoNext && setWeekIndex((prev) => Math.min(3, prev + 1) as 0 | 1 | 2 | 3)
                }
                className={cls(
                  "inline-flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full border bg-white text-[22px] font-semibold",
                  canGoNext
                    ? "border-[#d4ebda] text-[#182033]"
                    : "border-[#e7eeea] text-[#c8ccd3]"
                )}
              >
                →
              </button>

              <button
                type="button"
                onClick={() => setWeeksOpen((v) => !v)}
                className="inline-flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[16px] border border-[#d4ebda] bg-white text-[21px]"
              >
                <span className="translate-y-[1px]">📅</span>
              </button>

              {weeksOpen ? (
                <div className="absolute left-[58px] right-[58px] top-[56px] z-20 rounded-[28px] border border-[#dcefe1] bg-white p-3 shadow-[0_18px_36px_rgba(16,24,40,0.16)]">
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
                            active ? "bg-[#08b42f] text-white" : "bg-[#eef5ef] text-[#182033]"
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
                    "h-[42px] rounded-full border text-center text-[14px] font-extrabold transition",
                    activeDay === day.key
                      ? "border-[#08b42f] bg-[#08b42f] text-white"
                      : "border-[#d4ebda] bg-white text-[#2f6f44]"
                  )}
                >
                  {day.short}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 space-y-2.5">
            {menuLoading ? (
              <div className="rounded-[24px] border border-[#dcefe1] bg-[#fbfdfb] px-4 py-4 text-[14px] font-semibold text-[#6b7280]">
                Načítám menu…
              </div>
            ) : menuError ? (
              <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-4 text-[14px] font-semibold text-red-600">
                {menuError}
              </div>
            ) : activeItems.length === 0 ? (
              <div className="rounded-[24px] border border-[#dcefe1] bg-[#fbfdfb] px-4 py-4 text-[14px] font-semibold text-[#6b7280]">
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
                      qty > 0 ? "border-[#98d9ad] bg-[#f3fbf5]" : "border-[#cde9d3] bg-white"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[16px] font-extrabold leading-[1.15] text-[#182033]">
                          {item.name}
                        </div>
                        <div className="mt-1 truncate text-[12px] font-bold leading-[1.15] text-[#3f8f57]">
                          {item.subtitle || "—"}
                        </div>
                      </div>

                      <div className="shrink-0 rounded-[18px] border border-[#bfe3c6] bg-white px-4 py-2 text-[15px] font-extrabold text-[#2f7a49]">
                        {czk(item.price)}
                      </div>

                      {qty <= 0 ? (
                        <button
                          type="button"
                          onClick={() => addToCart(item)}
                          className="shrink-0 rounded-[18px] border border-[#73cd97] bg-white px-4 py-2 text-[14px] font-extrabold text-[#2b6e41]"
                        >
                          Přidat
                        </button>
                      ) : (
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => subFromCart(item)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#73cd97] bg-white text-[22px] font-extrabold text-[#2b6e41]"
                          >
                            −
                          </button>
                          <div className="min-w-[18px] text-center text-[17px] font-extrabold text-[#182033]">
                            {qty}
                          </div>
                          <button
                            type="button"
                            onClick={() => addToCart(item)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#73cd97] bg-white text-[20px] font-extrabold text-[#2b6e41]"
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
          <div className="px-1 text-[13px] font-semibold text-[#2f7a49]">{saveMsg}</div>
        ) : null}
      </div>

      {/* BOTTOM BAR */}
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
                ? "bg-[#61ae4f] text-white shadow-[0_6px_18px_rgba(97,174,79,0.22)]"
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