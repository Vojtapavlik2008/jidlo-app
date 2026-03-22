"use client";

import Link from "next/link";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type {
  CountRangeKey,
  InvoiceCustomerRow,
  OrderRow,
  RangeKey,
  SoldFoodRow,
  SystemItemRow,
  ViewMode,
} from "../page";
import { czk, prettyDate, prettyPayment } from "../page";

function cls(...a: Array<string | false | undefined | null>) {
  return a.filter(Boolean).join(" ");
}

function addMonths(d: Date, diff: number) {
  return new Date(d.getFullYear(), d.getMonth() + diff, 1);
}

function monthLabel(d: Date) {
  return new Intl.DateTimeFormat("cs-CZ", { month: "long", year: "numeric" }).format(d);
}

function Tile({
  children,
  onClick,
  href,
  variant = "green",
  compact = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "green" | "blue" | "red";
  compact?: boolean;
}) {
  const styles =
    variant === "blue"
      ? "border-[#4f77d9] bg-[#5f87ea] text-white"
      : variant === "red"
      ? "border-[#d83a3a] bg-[#e54848] text-white"
      : "border-[#08a35c] bg-[#08a35c] text-white";

  const baseClass = cls(
    "w-full rounded-[20px] border text-left font-extrabold shadow-sm transition active:scale-[0.99]",
    compact ? "px-4 py-4 text-[15px]" : "px-5 py-5 text-[16px]",
    styles
  );

  if (href) {
    return (
      <Link href={href} className={baseClass}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={baseClass}>
      {children}
    </button>
  );
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cls(
        "rounded-full border px-4 py-2 text-[13px] font-extrabold transition",
        active
          ? "border-[#08a35c] bg-[#08a35c] text-white"
          : "border-[#bde7c8] bg-white text-[#0b7c4d]"
      )}
    >
      {children}
    </button>
  );
}

type Props = {
  view: ViewMode;
  setView: (value: ViewMode) => void;
  summaryRange: RangeKey;
  setSummaryRange: (value: RangeKey) => void;
  invoiceRange: RangeKey;
  setInvoiceRange: (value: RangeKey) => void;
  dailyDay: string;
  setDailyDay: (value: string) => void;
  summaryMonthCursor: Date;
  setSummaryMonthCursor: Dispatch<SetStateAction<Date>>;
  invoiceMonthCursor: Date;
  setInvoiceMonthCursor: Dispatch<SetStateAction<Date>>;
  loading: boolean;
  err: string | null;
  summaryRangeData: { label: string };
  invoiceRangeData: { label: string };
  dailyRangeData: { label: string };
  summaryAll: { count: number; total: number };
  summaryBoxes: Array<{ title: string; rows: OrderRow[] }>;
  invoiceSearch: string;
  setInvoiceSearch: (value: string) => void;
  filteredInvoiceCustomers: InvoiceCustomerRow[];
  selectedInvoiceCustomer: InvoiceCustomerRow | null;
  setSelectedInvoiceCustomer: (value: InvoiceCustomerRow | null) => void;
  dailyAll: { count: number; total: number };
  dailyBoxes: Array<{ title: string; rows: OrderRow[] }>;
  itemsLoading: boolean;
  itemsMsg: string | null;
  sectionRows: SystemItemRow[];
  shopHoursRows: SystemItemRow[];
  canteenHoursRows: SystemItemRow[];
  aboutTextRow: SystemItemRow | null;
  setSectionRows: Dispatch<SetStateAction<SystemItemRow[]>>;
  countRange: CountRangeKey;
  setCountRange: (value: CountRangeKey) => void;
  countDay: string;
  setCountDay: (value: string) => void;
  foodRows: SoldFoodRow[];
  foodLoading: boolean;
  foodErr: string | null;
  openEditor: (
    title: string,
    section: string,
    fields: Array<"item_key" | "label" | "value_text" | "value_number" | "sort_order" | "is_active">,
    row?: SystemItemRow
  ) => void;
  saveItem: (row: SystemItemRow) => Promise<void>;
};

export default function MobileView(props: Props) {
  const {
    view,
    setView,
    summaryRange,
    setSummaryRange,
    invoiceRange,
    setInvoiceRange,
    dailyDay,
    setDailyDay,
    summaryMonthCursor,
    setSummaryMonthCursor,
    invoiceMonthCursor,
    setInvoiceMonthCursor,
    loading,
    err,
    summaryRangeData,
    invoiceRangeData,
    dailyRangeData,
    summaryAll,
    summaryBoxes,
    invoiceSearch,
    setInvoiceSearch,
    filteredInvoiceCustomers,
    selectedInvoiceCustomer,
    setSelectedInvoiceCustomer,
    dailyAll,
    dailyBoxes,
    itemsLoading,
    itemsMsg,
    sectionRows,
    shopHoursRows,
    canteenHoursRows,
    aboutTextRow,
    setSectionRows,
    countRange,
    setCountRange,
    countDay,
    setCountDay,
    foodRows,
    foodLoading,
    foodErr,
    openEditor,
    saveItem,
  } = props;

  return (
    <div className={cls("space-y-5", view === "home" && "min-h-[calc(100dvh-120px)]")}>
      {view === "home" ? (
        <div className="flex min-h-[calc(100dvh-120px)] flex-col">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-[28px] font-extrabold tracking-tight text-[#0b2149]">Reporty</h1>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="rounded-[14px] border border-[#cfd7e6] bg-white px-3 py-2.5 text-[13px] font-extrabold text-[#0b2149]"
              >
                Zpět
              </button>

              <Link
                href="/staff"
                className="rounded-[14px] bg-[#08a35c] px-3 py-2.5 text-[13px] font-extrabold text-white"
              >
                Rozcestník
              </Link>
            </div>
          </div>

          <div className="mt-4 flex flex-1 flex-col gap-3">
            <Tile href="/staff/reporty/rozvozy" variant="red" compact>
              Rozvozy
            </Tile>

            <div className="grid grid-cols-2 gap-3">
              <Tile
                compact
                onClick={() => {
                  setSummaryRange("lastMonth");
                  setView("summary");
                }}
              >
                Minulý měsíc
              </Tile>

              <Tile
                compact
                onClick={() => {
                  setSummaryRange("thisMonth");
                  setView("summary");
                }}
              >
                Tento měsíc
              </Tile>

              <Tile
                compact
                onClick={() => {
                  setSummaryRange("yesterday");
                  setView("summary");
                }}
              >
                Včera
              </Tile>

              <Tile
                compact
                onClick={() => {
                  setSummaryRange("today");
                  setView("summary");
                }}
              >
                Dnes
              </Tile>

              <Tile compact onClick={() => setView("invoiceCustomers")}>
                Fakturovaní zákazníci
              </Tile>

              <Tile compact onClick={() => setView("dailyReport")}>
                Denní report
              </Tile>
            </div>

            <div className="mt-auto pt-1">
              <Tile variant="blue" compact onClick={() => setView("settingsHome")}>
                Nastavení
              </Tile>
            </div>
          </div>
        </div>
      ) : null}

      {view === "settingsHome" ? (
        <>
          <MobileHeader title="Nastavení" subtitle="Správa systému a webu" onBack={() => setView("home")} />

          <div className="grid gap-3">
            <Tile onClick={() => setView("allergens")}>Alergeny</Tile>
            <Tile onClick={() => setView("items")}>Položky</Tile>
            <Tile onClick={() => setView("openingHours")}>Otevírací doba</Tile>
            <Tile onClick={() => setView("aboutText")}>Text Jiřka</Tile>
            <Tile onClick={() => setView("deliveryZones")}>Rozvoz okruhy</Tile>
            <Tile onClick={() => setView("foodCounts")}>Počty jídel</Tile>
          </div>
        </>
      ) : null}

      {view === "summary" ? (
        <>
          <MobileHeader title="Reporty" subtitle={summaryRangeData.label} onBack={() => setView("home")} />

          <div className="flex flex-wrap gap-2">
            <FilterButton active={summaryRange === "today"} onClick={() => setSummaryRange("today")}>Dnes</FilterButton>
            <FilterButton active={summaryRange === "yesterday"} onClick={() => setSummaryRange("yesterday")}>Včera</FilterButton>
            <FilterButton active={summaryRange === "thisMonth"} onClick={() => setSummaryRange("thisMonth")}>Tento měsíc</FilterButton>
            <FilterButton active={summaryRange === "lastMonth"} onClick={() => setSummaryRange("lastMonth")}>Minulý měsíc</FilterButton>
          </div>

          {(summaryRange === "thisMonth" || summaryRange === "lastMonth") ? (
            <div className="flex items-center justify-between rounded-[18px] border border-[#dff2e5] bg-white px-4 py-3">
              <button type="button" onClick={() => setSummaryMonthCursor((d) => addMonths(d, -1))}>←</button>
              <div className="font-extrabold text-[#0b2149]">{monthLabel(summaryMonthCursor)}</div>
              <button type="button" onClick={() => setSummaryMonthCursor((d) => addMonths(d, 1))}>→</button>
            </div>
          ) : null}

          <div className="rounded-[22px] border border-[#bde7c8] bg-white p-4">
            <div className="text-[18px] font-extrabold text-[#0b2149]">Celkem</div>
            <div className="mt-1 text-[14px] font-semibold text-gray-500">
              {summaryAll.count} objednávek • {czk(summaryAll.total)}
            </div>
          </div>

          {loading ? <div className="text-sm font-semibold text-gray-600">Načítám…</div> : null}
          {err ? <div className="text-sm font-semibold text-red-600">{err}</div> : null}

          <div className="grid gap-3">
            {summaryBoxes.map((b) => {
              const total = b.rows.reduce((s, x) => s + Number(x.total ?? 0), 0);

              return (
                <details key={b.title} className="overflow-hidden rounded-[20px] border border-[#dff2e5] bg-white">
                  <summary className="cursor-pointer list-none bg-[#2cab41] px-4 py-4 text-white">
                    <div className="text-[15px] font-extrabold">
                      {b.title} • {b.rows.length} • {czk(total)}
                    </div>
                  </summary>

                  <div className="grid gap-2 p-3">
                    {b.rows.length === 0 ? (
                      <div className="text-sm text-gray-500">Nic k zobrazení.</div>
                    ) : (
                      b.rows.map((o) => (
                        <div key={o.id} className="rounded-[14px] border border-[#dff2e5] bg-[#f5fbf7] p-3">
                          <div className="text-[14px] font-extrabold text-[#182033]">{o.full_name || "Pokladna"}</div>
                          <div className="mt-1 text-[12px] text-gray-500">{prettyDate(o.created_at)}</div>
                          <div className="mt-1 text-[12px] text-gray-500">{prettyPayment(o.payment_method)} • {o.status || "—"}</div>
                          <div className="mt-2 text-[14px] font-extrabold text-[#0b7c4d]">{czk(Number(o.total ?? 0))}</div>
                        </div>
                      ))
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </>
      ) : null}

      {view === "invoiceCustomers" ? (
        <>
          <MobileHeader title="Fakturovaní zákazníci" subtitle={invoiceRangeData.label} onBack={() => setView("home")} />

          <div className="flex flex-wrap gap-2">
            <FilterButton active={invoiceRange === "today"} onClick={() => setInvoiceRange("today")}>Dnes</FilterButton>
            <FilterButton active={invoiceRange === "yesterday"} onClick={() => setInvoiceRange("yesterday")}>Včera</FilterButton>
            <FilterButton active={invoiceRange === "customDay"} onClick={() => setInvoiceRange("customDay")}>Den</FilterButton>
            <FilterButton active={invoiceRange === "thisMonth"} onClick={() => setInvoiceRange("thisMonth")}>Měsíc</FilterButton>
            <FilterButton active={invoiceRange === "lastMonth"} onClick={() => setInvoiceRange("lastMonth")}>Minulý</FilterButton>
          </div>

          {(invoiceRange === "thisMonth" || invoiceRange === "lastMonth") ? (
            <div className="flex items-center justify-between rounded-[18px] border border-[#dff2e5] bg-white px-4 py-3">
              <button type="button" onClick={() => setInvoiceMonthCursor((d) => addMonths(d, -1))}>←</button>
              <div className="font-extrabold text-[#0b2149]">{monthLabel(invoiceMonthCursor)}</div>
              <button type="button" onClick={() => setInvoiceMonthCursor((d) => addMonths(d, 1))}>→</button>
            </div>
          ) : null}

          {invoiceRange === "customDay" ? (
            <input
              type="date"
              value={dailyDay}
              onChange={(e) => setDailyDay(e.target.value)}
              className="w-full rounded-[16px] border border-[#bde7c8] bg-white px-4 py-3 text-[14px] font-semibold text-[#0b2149] outline-none"
            />
          ) : null}

          <input
            value={invoiceSearch}
            onChange={(e) => setInvoiceSearch(e.target.value)}
            placeholder="Vyhledej zákazníka"
            className="w-full rounded-[16px] border border-[#bde7c8] bg-white px-4 py-3 text-[14px] font-semibold text-[#0b2149] outline-none"
          />

          {loading ? <div className="text-sm font-semibold text-gray-600">Načítám…</div> : null}
          {err ? <div className="text-sm font-semibold text-red-600">{err}</div> : null}

          <div className="grid gap-3">
            {filteredInvoiceCustomers.map((c) => (
              <div key={c.name} className="rounded-[20px] border border-[#dff2e5] bg-white p-4">
                <div className="text-[16px] font-extrabold text-[#182033]">{c.name}</div>
                <div className="mt-1 text-[14px] font-bold text-[#0b7c4d]">{czk(c.total)}</div>

                <details className="mt-3 overflow-hidden rounded-[16px] border border-[#dff2e5]">
                  <summary className="cursor-pointer list-none bg-[#2cab41] px-4 py-3 text-[14px] font-extrabold text-white">
                    Seznam objednávek
                  </summary>

                  <div className="grid gap-2 p-3">
                    {c.orders.map((o) => (
                      <div key={o.id} className="rounded-[14px] border border-[#dff2e5] bg-[#f5fbf7] p-3">
                        <div className="text-[13px] font-extrabold text-[#182033]">{prettyDate(o.created_at)}</div>
                        <div className="mt-1 text-[12px] text-gray-500">{prettyPayment(o.payment_method)} • {o.status || "—"}</div>
                        <div className="mt-2 text-[14px] font-extrabold text-[#0b7c4d]">{czk(Number(o.total ?? 0))}</div>
                      </div>
                    ))}
                  </div>
                </details>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedInvoiceCustomer(c);
                    setView("invoicePreview");
                  }}
                  className="mt-3 w-full rounded-[16px] border border-[#78d3a0] bg-white px-4 py-3 text-[14px] font-extrabold text-[#0b7c4d]"
                >
                  Faktura
                </button>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {view === "invoicePreview" && selectedInvoiceCustomer ? (
        <>
          <MobileHeader title="Faktura" subtitle={selectedInvoiceCustomer.name} onBack={() => setView("invoiceCustomers")} />

          <div className="rounded-[22px] border border-gray-200 bg-white p-4">
            <div className="text-[24px] font-extrabold text-[#182033]">FAKTURA</div>
            <div className="mt-1 text-[13px] text-gray-500">Období: {invoiceRangeData.label}</div>

            <div className="mt-4 grid gap-2">
              {selectedInvoiceCustomer.orders.map((o) => (
                <div key={o.id} className="rounded-[16px] border border-[#dff2e5] bg-[#f5fbf7] p-3">
                  <div className="text-[14px] font-extrabold text-[#182033]">Objednávka #{o.id.slice(0, 8)}</div>
                  <div className="mt-1 text-[13px] text-gray-500">{new Date(o.created_at).toLocaleDateString("cs-CZ")}</div>
                  <div className="mt-2 text-[14px] font-extrabold text-[#0b7c4d]">{czk(Number(o.total ?? 0))}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-[16px] border border-[#bde7c8] bg-[#f5fbf7] px-4 py-3">
              <div className="text-[13px] text-gray-500">Celkem k úhradě</div>
              <div className="mt-1 text-[24px] font-extrabold text-[#0b7c4d]">{czk(selectedInvoiceCustomer.total)}</div>
            </div>
          </div>
        </>
      ) : null}

      {view === "dailyReport" ? (
        <>
          <MobileHeader title="Denní report" subtitle="Report za vybraný den" onBack={() => setView("home")} />

          <input
            type="date"
            value={dailyDay}
            onChange={(e) => setDailyDay(e.target.value)}
            className="w-full rounded-[16px] border border-[#bde7c8] bg-white px-4 py-3 text-[14px] font-semibold text-[#0b2149] outline-none"
          />

          <div className="rounded-[22px] border border-[#bde7c8] bg-white p-4">
            <div className="text-[18px] font-extrabold text-[#0b2149]">Souhrn • {dailyRangeData.label}</div>
            <div className="mt-1 text-[14px] font-semibold text-gray-500">
              {dailyAll.count} objednávek • {czk(dailyAll.total)}
            </div>
          </div>

          {loading ? <div className="text-sm font-semibold text-gray-600">Načítám…</div> : null}
          {err ? <div className="text-sm font-semibold text-red-600">{err}</div> : null}

          <div className="grid gap-3">
            {dailyBoxes.map((b) => {
              const total = b.rows.reduce((s, x) => s + Number(x.total ?? 0), 0);

              return (
                <details key={b.title} className="overflow-hidden rounded-[20px] border border-[#dff2e5] bg-white">
                  <summary className="cursor-pointer list-none bg-[#2cab41] px-4 py-4 text-white">
                    <div className="text-[15px] font-extrabold">
                      {b.title} • {b.rows.length} • {czk(total)}
                    </div>
                  </summary>

                  <div className="grid gap-2 p-3">
                    {b.rows.map((o) => (
                      <div key={o.id} className="rounded-[14px] border border-[#dff2e5] bg-[#f5fbf7] p-3">
                        <div className="text-[14px] font-extrabold text-[#182033]">{o.full_name || "Pokladna"}</div>
                        <div className="mt-1 text-[12px] text-gray-500">{prettyDate(o.created_at)}</div>
                        <div className="mt-1 text-[12px] text-gray-500">{prettyPayment(o.payment_method)} • {o.status || "—"}</div>
                        <div className="mt-2 text-[14px] font-extrabold text-[#0b7c4d]">{czk(Number(o.total ?? 0))}</div>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        </>
      ) : null}

      {view === "allergens" ? (
        <SimpleEditList
          title="Alergeny"
          subtitle="Úprava čísel a názvů alergenů"
          onBack={() => setView("settingsHome")}
          loading={itemsLoading}
          message={itemsMsg}
          rows={sectionRows}
          addLabel="Přidat alergen"
          onAdd={() => openEditor("Přidat alergen", "allergens", ["item_key", "label", "sort_order", "is_active"])}
          onEdit={(row) => openEditor("Upravit alergen", "allergens", ["item_key", "label", "sort_order", "is_active"], row)}
          renderRow={(row) => (
            <>
              <div className="text-[14px] font-extrabold text-[#182033]">{row.item_key || "—"} • {row.label || "—"}</div>
              <div className="mt-1 text-[12px] text-gray-500">{row.is_active ? "Aktivní" : "Neaktivní"}</div>
            </>
          )}
        />
      ) : null}

      {view === "items" ? (
        <SimpleEditList
          title="Položky"
          subtitle="Krabičky, rozvoz, zálohy a další položky"
          onBack={() => setView("settingsHome")}
          loading={itemsLoading}
          message={itemsMsg}
          rows={sectionRows}
          addLabel="Přidat položku"
          onAdd={() => openEditor("Přidat položku", "items", ["item_key", "label", "value_number", "sort_order", "is_active"])}
          onEdit={(row) => openEditor("Upravit položku", "items", ["item_key", "label", "value_number", "sort_order", "is_active"], row)}
          renderRow={(row) => (
            <>
              <div className="text-[14px] font-extrabold text-[#182033]">{row.label || "—"}</div>
              <div className="mt-1 text-[12px] text-gray-500">{row.item_key || "—"} • {czk(Number(row.value_number ?? 0))}</div>
            </>
          )}
        />
      ) : null}

      {view === "openingHours" ? (
        <>
          <MobileHeader title="Otevírací doba" subtitle="Jídelna a obchod" onBack={() => setView("settingsHome")} />

          <MiniSection
            title="Obchod"
            rows={shopHoursRows}
            loading={itemsLoading}
            onAdd={() => openEditor("Přidat den do obchodu", "opening_hours_shop", ["item_key", "label", "value_text", "sort_order", "is_active"])}
            onEdit={(row) => openEditor("Upravit otevírací dobu obchodu", "opening_hours_shop", ["item_key", "label", "value_text", "sort_order", "is_active"], row)}
          />

          <MiniSection
            title="Jídelna"
            rows={canteenHoursRows}
            loading={itemsLoading}
            onAdd={() => openEditor("Přidat den do jídelny", "opening_hours_canteen", ["item_key", "label", "value_text", "sort_order", "is_active"])}
            onEdit={(row) => openEditor("Upravit otevírací dobu jídelny", "opening_hours_canteen", ["item_key", "label", "value_text", "sort_order", "is_active"], row)}
          />

          <div className="text-sm font-semibold text-gray-500">{itemsMsg ?? " "}</div>
        </>
      ) : null}

      {view === "aboutText" ? (
        <>
          <MobileHeader title="Text Jiřka" subtitle="Text článku na web" onBack={() => setView("settingsHome")} />

          <div className="rounded-[22px] border border-[#d9efe1] bg-white p-4">
            <textarea
              value={String(aboutTextRow?.value_text ?? "")}
              onChange={(e) =>
                setSectionRows((prev) => {
                  if (prev.length === 0) {
                    return [
                      {
                        id: `new-${Date.now()}`,
                        section: "about_text",
                        item_key: "main",
                        label: "Text Jiřka",
                        value_text: e.target.value,
                        value_number: null,
                        sort_order: 1,
                        is_active: true,
                      },
                    ];
                  }
                  return prev.map((x, i) => (i === 0 ? { ...x, value_text: e.target.value } : x));
                })
              }
              rows={12}
              className="w-full rounded-[18px] border border-[#bde7c8] bg-white px-4 py-4 text-[15px] font-medium text-[#0b2149] outline-none focus:border-[#08a35c]"
            />

            <button
              type="button"
              onClick={async () => {
                if (sectionRows[0]) await saveItem(sectionRows[0]);
              }}
              className="mt-4 w-full rounded-[18px] bg-[#08a35c] px-6 py-3 text-[15px] font-extrabold text-white"
            >
              Uložit změny
            </button>
          </div>

          <div className="text-sm font-semibold text-gray-500">{itemsMsg ?? " "}</div>
        </>
      ) : null}

      {view === "deliveryZones" ? (
        <SimpleEditList
          title="Rozvoz okruhy"
          subtitle="Okruhy, popis a cena rozvozu"
          onBack={() => setView("settingsHome")}
          loading={itemsLoading}
          message={itemsMsg}
          rows={sectionRows}
          addLabel="Přidat okruh"
          onAdd={() => openEditor("Přidat rozvoz okruh", "delivery_zones", ["item_key", "label", "value_text", "value_number", "sort_order", "is_active"])}
          onEdit={(row) => openEditor("Upravit rozvoz okruh", "delivery_zones", ["item_key", "label", "value_text", "value_number", "sort_order", "is_active"], row)}
          renderRow={(row) => (
            <>
              <div className="text-[14px] font-extrabold text-[#182033]">{row.label || "—"}</div>
              <div className="mt-1 text-[12px] text-gray-500">{row.value_text || "—"} • {czk(Number(row.value_number ?? 0))}</div>
            </>
          )}
        />
      ) : null}

      {view === "foodCounts" ? (
        <>
          <MobileHeader title="Počty jídel" subtitle="Přehled prodaných jídel" onBack={() => setView("settingsHome")} />

          <div className="flex flex-wrap gap-2">
            <FilterButton active={countRange === "today"} onClick={() => setCountRange("today")}>Dnes</FilterButton>
            <FilterButton active={countRange === "yesterday"} onClick={() => setCountRange("yesterday")}>Včera</FilterButton>
            <FilterButton active={countRange === "week"} onClick={() => setCountRange("week")}>Týden</FilterButton>
            <FilterButton active={countRange === "month"} onClick={() => setCountRange("month")}>Měsíc</FilterButton>
            <FilterButton active={countRange === "customDay"} onClick={() => setCountRange("customDay")}>Den</FilterButton>
          </div>

          {countRange === "customDay" ? (
            <input
              type="date"
              value={countDay}
              onChange={(e) => setCountDay(e.target.value)}
              className="w-full rounded-[16px] border border-[#bde7c8] bg-white px-4 py-3 text-[14px] font-semibold text-[#0b2149] outline-none"
            />
          ) : null}

          {foodLoading ? <div className="text-sm font-semibold text-gray-600">Načítám…</div> : null}
          {foodErr ? <div className="text-sm font-semibold text-red-600">{foodErr}</div> : null}

          <div className="grid gap-3">
            {foodRows.map((row) => (
              <div key={`${row.id}-${row.name}`} className="rounded-[18px] border border-[#d9efe1] bg-white p-4">
                <div className="text-[14px] font-extrabold text-[#182033]">{row.name}</div>
                <div className="mt-1 text-[12px] text-gray-500">ID {row.id} • {row.category}</div>
                <div className="mt-2 text-[16px] font-extrabold text-[#067647]">{row.qty} ks</div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function MobileHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-[#0b2149]">{title}</h1>
        <div className="mt-1 text-[13px] font-semibold text-gray-500">{subtitle}</div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-[16px] border border-[#78d3a0] bg-white px-4 py-3 text-[14px] font-extrabold text-[#0b7c4d]"
        >
          Zpět
        </button>

        <Link
          href="/staff"
          className="rounded-[16px] bg-[#08a35c] px-4 py-3 text-[14px] font-extrabold text-white"
        >
          Rozcestník
        </Link>
      </div>
    </div>
  );
}

function SimpleEditList({
  title,
  subtitle,
  onBack,
  loading,
  message,
  rows,
  addLabel,
  onAdd,
  onEdit,
  renderRow,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  loading: boolean;
  message: string | null;
  rows: SystemItemRow[];
  addLabel: string;
  onAdd: () => void;
  onEdit: (row: SystemItemRow) => void;
  renderRow: (row: SystemItemRow) => ReactNode;
}) {
  return (
    <>
      <MobileHeader title={title} subtitle={subtitle} onBack={onBack} />

      <button
        type="button"
        onClick={onAdd}
        className="w-full rounded-[18px] bg-[#08a35c] px-5 py-3 text-[15px] font-extrabold text-white"
      >
        + {addLabel}
      </button>

      {loading ? <div className="text-sm font-semibold text-gray-600">Načítám…</div> : null}

      <div className="grid gap-3">
        {rows.map((row) => (
          <button
            key={String(row.id)}
            type="button"
            onClick={() => onEdit(row)}
            className="rounded-[18px] border border-[#d9efe1] bg-white p-4 text-left"
          >
            {renderRow(row)}
          </button>
        ))}
      </div>

      <div className="text-sm font-semibold text-gray-500">{message ?? " "}</div>
    </>
  );
}

function MiniSection({
  title,
  rows,
  loading,
  onAdd,
  onEdit,
}: {
  title: string;
  rows: SystemItemRow[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (row: SystemItemRow) => void;
}) {
  return (
    <div className="rounded-[22px] border border-[#d9efe1] bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-[18px] font-extrabold text-[#0b2149]">{title}</div>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-[14px] bg-[#08a35c] px-4 py-2 text-[13px] font-extrabold text-white"
        >
          + Přidat
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Načítám…</div>
      ) : (
        <div className="grid gap-2">
          {rows.map((row) => (
            <button
              key={String(row.id)}
              type="button"
              onClick={() => onEdit(row)}
              className="rounded-[16px] border border-[#dff2e5] bg-[#f5fbf7] p-3 text-left"
            >
              <div className="text-[14px] font-extrabold text-[#182033]">{row.label || "—"}</div>
              <div className="mt-1 text-[12px] text-gray-500">{row.value_text || "—"}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
