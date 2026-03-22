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

function tileClass(mode: "green" | "blue" = "green") {
  return cls(
    "w-full rounded-[26px] border px-8 py-9 text-center text-[18px] font-extrabold transition shadow-sm",
    mode === "green"
      ? "border-[#08a35c] bg-[#08a35c] text-white hover:brightness-95"
      : "border-[#4f77d9] bg-[#5f87ea] text-white hover:brightness-95"
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
        "rounded-full border px-4 py-2 text-[14px] font-extrabold transition",
        active
          ? "border-[#08a35c] bg-[#08a35c] text-white"
          : "border-[#bde7c8] bg-white text-[#0b7c4d] hover:bg-[#f5fbf7]"
      )}
    >
      {children}
    </button>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-[#bde7c8] bg-white shadow-[0_12px_32px_rgba(27,54,39,0.05)]">
      <div className="border-b border-[#d9efe1] px-6 py-5">
        <div className="text-[28px] font-extrabold text-[#0b2149]">{title}</div>
        {subtitle ? <div className="mt-1 text-[15px] font-semibold text-gray-500">{subtitle}</div> : null}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function RowList({
  rows,
  columns,
  onEdit,
  onAdd,
  addLabel = "Přidat",
}: {
  rows: SystemItemRow[];
  columns: Array<{ key: keyof SystemItemRow; label: string; render?: (row: SystemItemRow) => ReactNode }>;
  onEdit: (row: SystemItemRow) => void;
  onAdd: () => void;
  addLabel?: string;
}) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-[#d9efe1] bg-white">
      <div className="flex items-center justify-between border-b border-[#d9efe1] px-5 py-4">
        <div className="text-[22px] font-extrabold text-[#0b2149]">Seznam</div>

        <button
          type="button"
          onClick={onAdd}
          className="rounded-[16px] bg-[#08a35c] px-5 py-3 text-[14px] font-extrabold text-white hover:brightness-95"
        >
          + {addLabel}
        </button>
      </div>

      <div className="p-4">
        <div className="overflow-hidden rounded-[20px] border border-[#d9efe1]">
          <div
            className="grid gap-4 bg-[#eef7f1] px-5 py-4 text-[14px] font-extrabold text-[#0b2149]"
            style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr)) 140px` }}
          >
            {columns.map((col) => (
              <div key={String(col.key)}>{col.label}</div>
            ))}
            <div className="text-right">Akce</div>
          </div>

          {rows.length === 0 ? (
            <div className="px-5 py-6 text-sm font-semibold text-gray-500">Zatím nic k zobrazení.</div>
          ) : (
            rows.map((row) => (
              <div
                key={String(row.id)}
                className="grid items-center gap-4 border-t border-[#e5f2e9] px-5 py-4"
                style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr)) 140px` }}
              >
                {columns.map((col) => (
                  <div key={String(col.key)} className="text-[14px] font-semibold text-[#0b2149]">
                    {col.render ? col.render(row) : String(row[col.key] ?? "—")}
                  </div>
                ))}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => onEdit(row)}
                    className="rounded-[14px] border border-[#bde7c8] bg-white px-4 py-2 text-[13px] font-extrabold text-[#0b7c4d] hover:bg-[#f5fbf7]"
                  >
                    Upravit
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
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

export default function DesktopView(props: Props) {
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
    <>
      {view === "home" ? (
        <>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[40px] font-extrabold tracking-tight text-[#0b2149]">Reporty a administrace</h1>
              <div className="mt-1 text-[14px] font-semibold text-gray-500">Přehled a správa systému</div>
            </div>

            <Link
              href="/staff"
              className="rounded-[18px] bg-[#08a35c] px-5 py-3 text-[15px] font-extrabold text-white hover:brightness-95"
            >
              Rozcestník
            </Link>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <button type="button" className={tileClass("green")} onClick={() => { setSummaryRange("lastMonth"); setView("summary"); }}>
              Minulý měsíc
            </button>
            <button type="button" className={tileClass("green")} onClick={() => { setSummaryRange("thisMonth"); setView("summary"); }}>
              Tento měsíc
            </button>
            <button type="button" className={tileClass("green")} onClick={() => { setSummaryRange("yesterday"); setView("summary"); }}>
              Včera
            </button>
            <button type="button" className={tileClass("green")} onClick={() => { setSummaryRange("today"); setView("summary"); }}>
              Dnes
            </button>
            <button type="button" className={tileClass("green")} onClick={() => setView("invoiceCustomers")}>
              Fakturovaní zákazníci
            </button>
            <button type="button" className={tileClass("green")} onClick={() => setView("dailyReport")}>
              Denní report
            </button>
          </div>

          <div className="mt-20 flex justify-center">
            <div className="grid w-full max-w-[620px] gap-4">
              <button type="button" className={tileClass("blue")} onClick={() => setView("settingsHome")}>
                Nastavení
              </button>

              <Link href="/staff/reporty/rozvozy" className={tileClass("green")}>
                Rozvozy
              </Link>
            </div>
          </div>
        </>
      ) : null}

      {view === "settingsHome" ? (
        <>
          <HeaderBack title="Nastavení" subtitle="Správa systému a webu" onBack={() => setView("home")} />

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <button type="button" className={tileClass("green")} onClick={() => setView("allergens")}>Alergeny</button>
            <button type="button" className={tileClass("green")} onClick={() => setView("items")}>Položky</button>
            <button type="button" className={tileClass("green")} onClick={() => setView("openingHours")}>Otevírací doba</button>
            <button type="button" className={tileClass("green")} onClick={() => setView("aboutText")}>Text Jiřka</button>
            <button type="button" className={tileClass("green")} onClick={() => setView("deliveryZones")}>Rozvoz okruhy</button>
            <button type="button" className={tileClass("green")} onClick={() => setView("foodCounts")}>Počty jídel</button>
          </div>
        </>
      ) : null}

      {view === "summary" ? (
        <>
          <HeaderBack title="Reporty" subtitle={`Přehled objednávek • ${summaryRangeData.label}`} onBack={() => setView("home")} />

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <FilterButton active={summaryRange === "today"} onClick={() => setSummaryRange("today")}>Dnes</FilterButton>
            <FilterButton active={summaryRange === "yesterday"} onClick={() => setSummaryRange("yesterday")}>Včera</FilterButton>
            <FilterButton active={summaryRange === "thisMonth"} onClick={() => setSummaryRange("thisMonth")}>Tento měsíc</FilterButton>
            <FilterButton active={summaryRange === "lastMonth"} onClick={() => setSummaryRange("lastMonth")}>Minulý měsíc</FilterButton>

            {(summaryRange === "thisMonth" || summaryRange === "lastMonth") ? (
              <div className="ml-3 flex items-center gap-2">
                <button type="button" onClick={() => setSummaryMonthCursor((d) => addMonths(d, -1))} className="rounded-full border border-[#bde7c8] bg-white px-3 py-2 text-sm font-extrabold text-[#0b7c4d]">←</button>
                <div className="rounded-full border border-[#bde7c8] bg-white px-4 py-2 text-sm font-extrabold text-[#0b2149]">{monthLabel(summaryMonthCursor)}</div>
                <button type="button" onClick={() => setSummaryMonthCursor((d) => addMonths(d, 1))} className="rounded-full border border-[#bde7c8] bg-white px-3 py-2 text-sm font-extrabold text-[#0b7c4d]">→</button>
              </div>
            ) : null}
          </div>

          <div className="mt-8 rounded-[28px] border border-[#bde7c8] bg-white p-5 shadow-[0_12px_32px_rgba(27,54,39,0.05)]">
            <div className="text-[28px] font-extrabold text-[#0b2149]">Souhrn • {summaryRangeData.label}</div>
            <div className="mt-1 text-[15px] font-semibold text-gray-500">
              Celkem objednávek: {summaryAll.count} • cena: {czk(summaryAll.total)}
            </div>

            {loading ? (
              <div className="mt-6 text-sm font-semibold text-gray-600">Načítám report…</div>
            ) : err ? (
              <div className="mt-6 text-sm font-semibold text-red-600">{err}</div>
            ) : (
              <div className="mt-6 grid gap-4">
                {summaryBoxes.map((b) => {
                  const total = b.rows.reduce((s, x) => s + Number(x.total ?? 0), 0);

                  return (
                    <details key={b.title} className="group overflow-hidden rounded-[22px] border border-[#bde7c8]">
                      <summary className="cursor-pointer list-none bg-[#2cab41] px-5 py-5 text-white">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[17px] font-extrabold">
                            {b.title}: objednávek {b.rows.length}, cena {czk(total)}
                          </div>
                          <div className="text-2xl font-black transition group-open:rotate-45">+</div>
                        </div>
                      </summary>

                      <div className="bg-white p-4">
                        {b.rows.length === 0 ? (
                          <div className="text-sm font-semibold text-gray-500">Nic k zobrazení.</div>
                        ) : (
                          <div className="grid gap-3">
                            {b.rows.map((o) => (
                              <div
                                key={o.id}
                                className="grid grid-cols-[1fr_auto_auto] gap-4 rounded-[20px] border border-[#dff2e5] bg-[#f5fbf7] px-4 py-3"
                              >
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-extrabold text-gray-900">
                                    {o.full_name || "Pokladna"}
                                  </div>
                                  <div className="mt-1 text-xs font-semibold text-gray-500">
                                    {prettyDate(o.created_at)} • {prettyPayment(o.payment_method)}
                                  </div>
                                </div>

                                <div className="self-center text-sm font-extrabold text-[#0b7c4d]">
                                  {czk(Number(o.total ?? 0))}
                                </div>

                                <div className="self-center text-xs font-bold text-gray-500">
                                  {o.status || "—"}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : null}

      {view === "invoiceCustomers" ? (
        <>
          <HeaderBack title="Fakturovaní zákazníci" subtitle={`Přehled fakturovaných zákazníků • ${invoiceRangeData.label}`} onBack={() => setView("home")} />

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <FilterButton active={invoiceRange === "today"} onClick={() => setInvoiceRange("today")}>Dnes</FilterButton>
            <FilterButton active={invoiceRange === "yesterday"} onClick={() => setInvoiceRange("yesterday")}>Včera</FilterButton>
            <FilterButton active={invoiceRange === "customDay"} onClick={() => setInvoiceRange("customDay")}>Vyber den</FilterButton>
            <FilterButton active={invoiceRange === "thisMonth"} onClick={() => setInvoiceRange("thisMonth")}>Tento měsíc</FilterButton>
            <FilterButton active={invoiceRange === "lastMonth"} onClick={() => setInvoiceRange("lastMonth")}>Minulý měsíc</FilterButton>

            {(invoiceRange === "thisMonth" || invoiceRange === "lastMonth") ? (
              <div className="ml-3 flex items-center gap-2">
                <button type="button" onClick={() => setInvoiceMonthCursor((d) => addMonths(d, -1))} className="rounded-full border border-[#bde7c8] bg-white px-3 py-2 text-sm font-extrabold text-[#0b7c4d]">←</button>
                <div className="rounded-full border border-[#bde7c8] bg-white px-4 py-2 text-sm font-extrabold text-[#0b2149]">{monthLabel(invoiceMonthCursor)}</div>
                <button type="button" onClick={() => setInvoiceMonthCursor((d) => addMonths(d, 1))} className="rounded-full border border-[#bde7c8] bg-white px-3 py-2 text-sm font-extrabold text-[#0b7c4d]">→</button>
              </div>
            ) : null}

            {invoiceRange === "customDay" ? (
              <input
                type="date"
                value={dailyDay}
                onChange={(e) => setDailyDay(e.target.value)}
                className="ml-2 rounded-full border border-[#bde7c8] bg-white px-4 py-2 text-sm font-semibold text-[#0b2149] outline-none"
              />
            ) : null}
          </div>

          <div className="mt-6 rounded-[28px] border border-[#bde7c8] bg-white p-5 shadow-[0_12px_32px_rgba(27,54,39,0.05)]">
            <input
              value={invoiceSearch}
              onChange={(e) => setInvoiceSearch(e.target.value)}
              placeholder="Vyhledávání zákazníka dle jména"
              className="w-full rounded-[12px] border border-gray-300 px-4 py-3 text-[15px] outline-none"
            />

            {loading ? (
              <div className="mt-6 text-sm font-semibold text-gray-600">Načítám…</div>
            ) : err ? (
              <div className="mt-6 text-sm font-semibold text-red-600">{err}</div>
            ) : (
              <div className="mt-6 overflow-hidden rounded-[18px] border border-gray-200">
                <div className="grid grid-cols-[1.2fr_160px_1.8fr_140px] gap-4 border-b border-gray-200 bg-white px-4 py-4 text-[14px] font-extrabold text-[#182033]">
                  <div>Jméno zákazníka</div>
                  <div>Suma za období</div>
                  <div>Seznam objednávek daného klienta</div>
                  <div className="text-right">Akce</div>
                </div>

                {filteredInvoiceCustomers.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-gray-500">Nic k zobrazení.</div>
                ) : (
                  filteredInvoiceCustomers.map((c) => (
                    <div
                      key={c.name}
                      className="grid grid-cols-[1.2fr_160px_1.8fr_140px] gap-4 border-b border-gray-200 bg-white px-4 py-4 last:border-b-0"
                    >
                      <div className="text-[16px] text-[#182033]">{c.name}</div>
                      <div className="text-[16px] text-[#182033]">{czk(c.total)}</div>

                      <details className="group overflow-hidden rounded-[14px] border border-[#bde7c8]">
                        <summary className="cursor-pointer list-none bg-[#2cab41] px-4 py-4 text-white">
                          <div className="flex items-center justify-between">
                            <div className="text-[15px] font-extrabold">Seznam objednávek</div>
                            <div className="text-xl font-black transition group-open:rotate-45">+</div>
                          </div>
                        </summary>

                        <div className="grid gap-2 bg-white p-3">
                          {c.orders.map((o) => (
                            <div
                              key={o.id}
                              className="rounded-[14px] border border-[#dff2e5] bg-[#f5fbf7] px-3 py-3"
                            >
                              <div className="text-[14px] font-extrabold text-[#182033]">
                                {prettyDate(o.created_at)}
                              </div>
                              <div className="mt-1 text-[13px] text-gray-500">
                                {prettyPayment(o.payment_method)} • {o.status || "—"}
                              </div>
                              <div className="mt-1 text-[14px] font-extrabold text-[#0b7c4d]">
                                {czk(Number(o.total ?? 0))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>

                      <div className="text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedInvoiceCustomer(c);
                            setView("invoicePreview");
                          }}
                          className="rounded-[14px] border border-[#78d3a0] bg-white px-4 py-3 text-[14px] font-extrabold text-[#0b7c4d] hover:bg-[#f5fbf7]"
                        >
                          Faktura
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      ) : null}

      {view === "invoicePreview" && selectedInvoiceCustomer ? (
        <>
          <HeaderBack title="Faktura" subtitle={selectedInvoiceCustomer.name} onBack={() => setView("invoiceCustomers")} />

          <div className="mt-8 rounded-[28px] border border-gray-200 bg-white p-8 shadow-sm">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-[32px] font-extrabold text-[#182033]">FAKTURA</div>
                <div className="mt-2 text-[14px] text-gray-500">Období: {invoiceRangeData.label}</div>
              </div>

              <div className="text-right">
                <div className="text-[14px] font-bold text-gray-500">Odběratel</div>
                <div className="mt-1 text-[20px] font-extrabold text-[#182033]">{selectedInvoiceCustomer.name}</div>
              </div>
            </div>

            <div className="mt-8 overflow-hidden rounded-[18px] border border-gray-200">
              <div className="grid grid-cols-[1.5fr_1fr_120px] gap-4 border-b border-gray-200 bg-[#f8faf8] px-4 py-3 text-[13px] font-extrabold uppercase text-gray-500">
                <div>Položka</div>
                <div>Datum</div>
                <div className="text-right">Cena</div>
              </div>

              {selectedInvoiceCustomer.orders.map((o) => (
                <div
                  key={o.id}
                  className="grid grid-cols-[1.5fr_1fr_120px] gap-4 border-b border-gray-100 px-4 py-3 last:border-b-0"
                >
                  <div className="text-[15px] font-semibold text-[#182033]">Objednávka #{o.id.slice(0, 8)}</div>
                  <div className="text-[15px] text-gray-600">{new Date(o.created_at).toLocaleDateString("cs-CZ")}</div>
                  <div className="text-right text-[15px] font-extrabold text-[#0b7c4d]">{czk(Number(o.total ?? 0))}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <div className="rounded-[18px] border border-[#bde7c8] bg-[#f5fbf7] px-6 py-4 text-right">
                <div className="text-[14px] font-bold text-gray-500">Celkem k úhradě</div>
                <div className="mt-1 text-[28px] font-extrabold text-[#0b7c4d]">
                  {czk(selectedInvoiceCustomer.total)}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {view === "dailyReport" ? (
        <>
          <HeaderBack title="Denní report" subtitle="Report za vybraný den" onBack={() => setView("home")} />

          <div className="mt-6 flex items-center gap-3">
            <div className="rounded-full border border-[#bde7c8] bg-white px-5 py-2 text-sm font-extrabold text-[#0b7c4d]">
              Vyber den
            </div>
            <input
              type="date"
              value={dailyDay}
              onChange={(e) => setDailyDay(e.target.value)}
              className="rounded-full border border-[#bde7c8] bg-white px-5 py-2 text-sm font-extrabold text-[#0b2149] outline-none"
            />
          </div>

          <div className="mt-8 rounded-[28px] border border-[#bde7c8] bg-white p-5 shadow-[0_12px_32px_rgba(27,54,39,0.05)]">
            <div className="text-[28px] font-extrabold text-[#0b2149]">Souhrn • {dailyRangeData.label}</div>
            <div className="mt-1 text-[15px] font-semibold text-gray-500">
              Celkem objednávek: {dailyAll.count} • cena: {czk(dailyAll.total)}
            </div>

            {loading ? (
              <div className="mt-6 text-sm font-semibold text-gray-600">Načítám report…</div>
            ) : err ? (
              <div className="mt-6 text-sm font-semibold text-red-600">{err}</div>
            ) : (
              <div className="mt-6 grid gap-4">
                {dailyBoxes.map((b) => {
                  const total = b.rows.reduce((s, x) => s + Number(x.total ?? 0), 0);

                  return (
                    <details key={b.title} className="group overflow-hidden rounded-[22px] border border-[#bde7c8]">
                      <summary className="cursor-pointer list-none bg-[#2cab41] px-5 py-5 text-white">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[17px] font-extrabold">
                            {b.title}: objednávek {b.rows.length}, cena {czk(total)}
                          </div>
                          <div className="text-2xl font-black transition group-open:rotate-45">+</div>
                        </div>
                      </summary>

                      <div className="bg-white p-4">
                        {b.rows.length === 0 ? (
                          <div className="text-sm font-semibold text-gray-500">Nic k zobrazení.</div>
                        ) : (
                          <div className="grid gap-3">
                            {b.rows.map((o) => (
                              <div
                                key={o.id}
                                className="grid grid-cols-[1fr_auto_auto] gap-4 rounded-[20px] border border-[#dff2e5] bg-[#f5fbf7] px-4 py-3"
                              >
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-extrabold text-gray-900">
                                    {o.full_name || "Pokladna"}
                                  </div>
                                  <div className="mt-1 text-xs font-semibold text-gray-500">
                                    {prettyDate(o.created_at)} • {prettyPayment(o.payment_method)}
                                  </div>
                                </div>

                                <div className="self-center text-sm font-extrabold text-[#0b7c4d]">
                                  {czk(Number(o.total ?? 0))}
                                </div>

                                <div className="self-center text-xs font-bold text-gray-500">
                                  {o.status || "—"}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : null}

      {view === "allergens" ? (
        <>
          <HeaderBack title="Alergeny" subtitle="Seznam alergenů s možností úprav" onBack={() => setView("settingsHome")} />

          <div className="mt-8">
            <SectionCard title="Alergeny" subtitle="Úprava čísel a názvů alergenů">
              {itemsLoading ? (
                <div className="text-sm font-semibold text-gray-500">Načítám…</div>
              ) : (
                <RowList
                  rows={sectionRows}
                  onEdit={(row) => openEditor("Upravit alergen", "allergens", ["item_key", "label", "sort_order", "is_active"], row)}
                  onAdd={() => openEditor("Přidat alergen", "allergens", ["item_key", "label", "sort_order", "is_active"])}
                  addLabel="Přidat alergen"
                  columns={[
                    { key: "item_key", label: "Číslo" },
                    { key: "label", label: "Název" },
                    { key: "is_active", label: "Aktivní", render: (row) => (row.is_active ? "Ano" : "Ne") },
                  ]}
                />
              )}

              <div className="mt-6 text-sm font-semibold text-gray-500">{itemsMsg ?? " "}</div>
            </SectionCard>
          </div>
        </>
      ) : null}

      {view === "items" ? (
        <>
          <HeaderBack title="Položky" subtitle="Krabičky, rozvoz, zálohy a další položky" onBack={() => setView("settingsHome")} />

          <div className="mt-8">
            <SectionCard title="Položky systému" subtitle="Úprava názvu a ceny položek">
              {itemsLoading ? (
                <div className="text-sm font-semibold text-gray-500">Načítám…</div>
              ) : (
                <RowList
                  rows={sectionRows}
                  onEdit={(row) => openEditor("Upravit položku", "items", ["item_key", "label", "value_number", "sort_order", "is_active"], row)}
                  onAdd={() => openEditor("Přidat položku", "items", ["item_key", "label", "value_number", "sort_order", "is_active"])}
                  addLabel="Přidat položku"
                  columns={[
                    { key: "label", label: "Název" },
                    { key: "value_number", label: "Cena", render: (row) => czk(Number(row.value_number ?? 0)) },
                    { key: "item_key", label: "Klíč" },
                  ]}
                />
              )}

              <div className="mt-6 text-sm font-semibold text-gray-500">{itemsMsg ?? " "}</div>
            </SectionCard>
          </div>
        </>
      ) : null}

      {view === "openingHours" ? (
        <>
          <HeaderBack title="Otevírací doba" subtitle="Jídelna a obchod" onBack={() => setView("settingsHome")} />

          <div className="mt-8 grid gap-6 xl:grid-cols-2">
            <SectionCard title="Obchod" subtitle="Uprav dny a časy">
              {itemsLoading ? (
                <div className="text-sm font-semibold text-gray-500">Načítám…</div>
              ) : (
                <RowList
                  rows={shopHoursRows}
                  onEdit={(row) => openEditor("Upravit otevírací dobu obchodu", "opening_hours_shop", ["item_key", "label", "value_text", "sort_order", "is_active"], row)}
                  onAdd={() => openEditor("Přidat den do obchodu", "opening_hours_shop", ["item_key", "label", "value_text", "sort_order", "is_active"])}
                  addLabel="Přidat den"
                  columns={[
                    { key: "label", label: "Den" },
                    { key: "value_text", label: "Čas" },
                    { key: "is_active", label: "Aktivní", render: (row) => (row.is_active ? "Ano" : "Ne") },
                  ]}
                />
              )}
            </SectionCard>

            <SectionCard title="Jídelna" subtitle="Uprav dny a časy">
              {itemsLoading ? (
                <div className="text-sm font-semibold text-gray-500">Načítám…</div>
              ) : (
                <RowList
                  rows={canteenHoursRows}
                  onEdit={(row) => openEditor("Upravit otevírací dobu jídelny", "opening_hours_canteen", ["item_key", "label", "value_text", "sort_order", "is_active"], row)}
                  onAdd={() => openEditor("Přidat den do jídelny", "opening_hours_canteen", ["item_key", "label", "value_text", "sort_order", "is_active"])}
                  addLabel="Přidat den"
                  columns={[
                    { key: "label", label: "Den" },
                    { key: "value_text", label: "Čas" },
                    { key: "is_active", label: "Aktivní", render: (row) => (row.is_active ? "Ano" : "Ne") },
                  ]}
                />
              )}
            </SectionCard>
          </div>

          <div className="mt-6 text-sm font-semibold text-gray-500">{itemsMsg ?? " "}</div>
        </>
      ) : null}

      {view === "aboutText" ? (
        <>
          <HeaderBack title="Text Jiřka" subtitle="Text článku na web" onBack={() => setView("settingsHome")} />

          <div className="mt-8">
            <SectionCard title="Text Jiřka" subtitle="Úprava hlavního textu">
              {itemsLoading ? (
                <div className="text-sm font-semibold text-gray-500">Načítám…</div>
              ) : (
                <div className="rounded-[24px] border border-[#d9efe1] bg-[#f8fcf9] p-5">
                  <div className="text-[22px] font-extrabold text-[#0b2149]">Text na webu</div>
                  <div className="mt-1 text-sm font-semibold text-gray-500">Zobrazí se v sekci O nás</div>

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
                    className="mt-5 w-full rounded-[18px] border border-[#bde7c8] bg-white px-4 py-4 text-[15px] font-medium text-[#0b2149] outline-none focus:border-[#08a35c]"
                  />

                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      onClick={async () => {
                        if (sectionRows[0]) await saveItem(sectionRows[0]);
                      }}
                      className="rounded-[18px] bg-[#08a35c] px-6 py-3 text-[15px] font-extrabold text-white hover:brightness-95"
                    >
                      Uložit změny
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-6 text-sm font-semibold text-gray-500">{itemsMsg ?? " "}</div>
            </SectionCard>
          </div>
        </>
      ) : null}

      {view === "deliveryZones" ? (
        <>
          <HeaderBack title="Rozvoz okruhy" subtitle="Okruhy, popis a cena rozvozu" onBack={() => setView("settingsHome")} />

          <div className="mt-8">
            <SectionCard title="Rozvoz okruhy" subtitle="Úprava názvu, popisu a ceny">
              {itemsLoading ? (
                <div className="text-sm font-semibold text-gray-500">Načítám…</div>
              ) : (
                <RowList
                  rows={sectionRows}
                  onEdit={(row) => openEditor("Upravit rozvoz okruh", "delivery_zones", ["item_key", "label", "value_text", "value_number", "sort_order", "is_active"], row)}
                  onAdd={() => openEditor("Přidat rozvoz okruh", "delivery_zones", ["item_key", "label", "value_text", "value_number", "sort_order", "is_active"])}
                  addLabel="Přidat okruh"
                  columns={[
                    { key: "label", label: "Název" },
                    { key: "value_text", label: "Popis" },
                    { key: "value_number", label: "Cena", render: (row) => czk(Number(row.value_number ?? 0)) },
                  ]}
                />
              )}

              <div className="mt-6 text-sm font-semibold text-gray-500">{itemsMsg ?? " "}</div>
            </SectionCard>
          </div>
        </>
      ) : null}

      {view === "foodCounts" ? (
        <>
          <HeaderBack title="Počty jídel" subtitle="Přehled prodaných jídel" onBack={() => setView("settingsHome")} />

          <div className="mt-8">
            <SectionCard title="Filtr období" subtitle="Zvol období, které chceš zobrazit">
              <div className="flex flex-wrap items-center gap-2 border-b border-[#d9efe1] pb-4">
                <FilterButton active={countRange === "today"} onClick={() => setCountRange("today")}>Dnes</FilterButton>
                <FilterButton active={countRange === "yesterday"} onClick={() => setCountRange("yesterday")}>Včera</FilterButton>
                <FilterButton active={countRange === "week"} onClick={() => setCountRange("week")}>Týden</FilterButton>
                <FilterButton active={countRange === "month"} onClick={() => setCountRange("month")}>Měsíc</FilterButton>
                <FilterButton active={countRange === "customDay"} onClick={() => setCountRange("customDay")}>Vyber den</FilterButton>

                {countRange === "customDay" ? (
                  <input
                    type="date"
                    value={countDay}
                    onChange={(e) => setCountDay(e.target.value)}
                    className="ml-1 rounded-full border border-[#bde7c8] bg-white px-4 py-2 text-sm font-semibold text-[#0b2149] outline-none"
                  />
                ) : null}
              </div>

              <div className="mt-5 overflow-hidden rounded-[18px] border border-[#d9efe1]">
                <div className="grid grid-cols-[110px_1.6fr_1fr_1fr_140px] gap-4 bg-[#eef7f1] px-4 py-4 text-[14px] font-extrabold text-[#0b2149]">
                  <div>ID</div>
                  <div>Název</div>
                  <div>Popis</div>
                  <div>Kategorie</div>
                  <div>Počet</div>
                </div>

                {foodLoading ? (
                  <div className="px-4 py-6 text-sm font-semibold text-gray-500">Načítám prodaná jídla…</div>
                ) : foodErr ? (
                  <div className="px-4 py-6 text-sm font-semibold text-red-600">{foodErr}</div>
                ) : foodRows.length === 0 ? (
                  <div className="px-4 py-6 text-sm font-semibold text-gray-500">Za zvolené období nic nenalezeno.</div>
                ) : (
                  foodRows.map((row) => (
                    <div
                      key={`${row.id}-${row.name}`}
                      className="grid grid-cols-[110px_1.6fr_1fr_1fr_140px] items-center gap-4 border-t border-[#e5f2e9] px-4 py-4 text-[14px]"
                    >
                      <div className="font-semibold text-[#0b2149]">{row.id}</div>
                      <div className="font-extrabold text-[#0b2149]">{row.name}</div>
                      <div className="font-semibold text-gray-500">{row.description}</div>
                      <div className="font-semibold text-[#0b2149]">{row.category}</div>
                      <div className="font-extrabold text-[#067647]">{row.qty}</div>
                    </div>
                  ))
                )}
              </div>
            </SectionCard>
          </div>
        </>
      ) : null}
    </>
  );
}

function HeaderBack({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-[38px] font-extrabold tracking-tight text-[#0b2149]">{title}</h1>
        <div className="mt-1 text-[14px] font-semibold text-gray-500">{subtitle}</div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-[18px] border border-[#78d3a0] bg-white px-5 py-3 text-[15px] font-extrabold text-[#0b7c4d] hover:bg-[#f5fbf7]"
        >
          Zpět
        </button>

        <Link
          href="/staff"
          className="rounded-[18px] bg-[#08a35c] px-5 py-3 text-[15px] font-extrabold text-white hover:brightness-95"
        >
          Rozcestník
        </Link>
      </div>
    </div>
  );
}
