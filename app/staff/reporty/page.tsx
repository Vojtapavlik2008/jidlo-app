"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type OrderRow = {
  id: string;
  created_at: string;
  full_name: string | null;
  payment_method: string | null;
  total: number | null;
  status: string | null;
  cart?: any;
};

type SystemItemRow = {
  id: number | string;
  section: string;
  item_key: string | null;
  label: string | null;
  value_text: string | null;
  value_number: number | null;
  sort_order: number | null;
  is_active: boolean | null;
};

type SoldFoodRow = {
  id: string;
  name: string;
  description: string;
  category: string;
  qty: number;
};

type RangeKey = "today" | "yesterday" | "thisMonth" | "lastMonth" | "customDay";
type CountRangeKey = "today" | "yesterday" | "week" | "month" | "customDay";

type ViewMode =
  | "home"
  | "summary"
  | "invoiceCustomers"
  | "invoicePreview"
  | "dailyReport"
  | "settingsHome"
  | "allergens"
  | "items"
  | "openingHours"
  | "aboutText"
  | "deliveryZones"
  | "foodCounts";

type InvoiceCustomerRow = {
  name: string;
  total: number;
  orders: OrderRow[];
};

function cls(...a: Array<string | false | undefined | null>) {
  return a.filter(Boolean).join(" ");
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function addMonths(d: Date, diff: number) {
  return new Date(d.getFullYear(), d.getMonth() + diff, 1);
}

function monthLabel(d: Date) {
  return new Intl.DateTimeFormat("cs-CZ", { month: "long", year: "numeric" }).format(d);
}

function toISODateLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getRange(key: RangeKey, customDay: string, monthCursor: Date) {
  const now = new Date();

  if (key === "today") {
    return { from: startOfDay(now), to: endOfDay(now), label: "Dnes" };
  }

  if (key === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { from: startOfDay(y), to: endOfDay(y), label: "Včera" };
  }

  if (key === "thisMonth") {
    return {
      from: startOfMonth(monthCursor),
      to: endOfMonth(monthCursor),
      label: `Tento měsíc • ${monthLabel(monthCursor)}`,
    };
  }

  if (key === "lastMonth") {
    const lm = addMonths(monthCursor, -1);
    return {
      from: startOfMonth(lm),
      to: endOfMonth(lm),
      label: `Minulý měsíc • ${monthLabel(lm)}`,
    };
  }

  const [y, m, d] = customDay.split("-").map(Number);
  const day = new Date(y, (m ?? 1) - 1, d ?? 1);
  return {
    from: startOfDay(day),
    to: endOfDay(day),
    label: `Vybraný den • ${day.toLocaleDateString("cs-CZ")}`,
  };
}

function getFoodCountRange(key: CountRangeKey, customDay: string) {
  const now = new Date();

  if (key === "today") {
    const iso = toISODateLocal(now);
    return { from: iso, to: iso, label: "Dnes" };
  }

  if (key === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const iso = toISODateLocal(y);
    return { from: iso, to: iso, label: "Včera" };
  }

  if (key === "week") {
    const start = new Date(now);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);

    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    return {
      from: toISODateLocal(start),
      to: toISODateLocal(end),
      label: "Týden",
    };
  }

  if (key === "month") {
    const from = toISODateLocal(new Date(now.getFullYear(), now.getMonth(), 1));
    const to = toISODateLocal(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    return { from, to, label: "Měsíc" };
  }

  return {
    from: customDay,
    to: customDay,
    label: "Vybraný den",
  };
}

function czk(n: number) {
  return `${Number(n || 0).toFixed(2)} Kč`;
}

function prettyDate(ts: string) {
  try {
    return new Date(ts).toLocaleString("cs-CZ");
  } catch {
    return ts;
  }
}

function prettyPayment(x: string | null) {
  const s = (x ?? "").toLowerCase();
  if (s === "cash") return "Hotově";
  if (s === "credit") return "Kredit";
  if (s === "card_on_delivery" || s === "card" || s === "card_online") return "Kartou";
  if (s === "invoice") return "Faktura";
  return x || "—";
}

function isInvoiceOrder(o: OrderRow) {
  const pm = (o.payment_method ?? "").toLowerCase();
  const st = (o.status ?? "").toLowerCase();
  const type = String(o.cart?.type ?? "").toLowerCase();
  return pm === "invoice" || st.includes("faktur") || st.includes("invoice") || type.includes("invoice");
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
  children: React.ReactNode;
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

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-[16px] border border-[#bfe6ca] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#0b2149] outline-none focus:border-[#08a35c]"
    />
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-[#bde7c8] bg-white shadow-[0_12px_32px_rgba(27,54,39,0.05)] overflow-hidden">
      <div className="border-b border-[#d9efe1] px-6 py-5">
        <div className="text-[28px] font-extrabold text-[#0b2149]">{title}</div>
        {subtitle ? <div className="mt-1 text-[15px] font-semibold text-gray-500">{subtitle}</div> : null}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function EditItemModal({
  open,
  title,
  item,
  onClose,
  onSave,
  onDelete,
  fields,
}: {
  open: boolean;
  title: string;
  item: SystemItemRow | null;
  onClose: () => void;
  onSave: (item: SystemItemRow) => void;
  onDelete?: (item: SystemItemRow) => void;
  fields: Array<"item_key" | "label" | "value_text" | "value_number" | "sort_order" | "is_active">;
}) {
  const [local, setLocal] = useState<SystemItemRow | null>(item);

  useEffect(() => {
    setLocal(item);
  }, [item]);

  if (!open || !local) return null;

  function setField<K extends keyof SystemItemRow>(key: K, value: SystemItemRow[K]) {
    setLocal((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
        aria-label="close"
      />

      <div className="fixed left-1/2 top-1/2 z-50 w-[680px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-[28px] bg-white shadow-[0_25px_80px_rgba(0,0,0,0.22)] ring-1 ring-black/10">
        <div className="flex items-center justify-between border-b border-[#e8f2eb] px-6 py-5">
          <div>
            <div className="text-[28px] font-extrabold text-[#0b2149]">{title}</div>
            <div className="mt-1 text-sm font-semibold text-gray-500">Úprava záznamu</div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-11 w-11 rounded-full border border-[#d7ebe0] bg-white text-xl font-black text-[#0b2149] hover:bg-[#f6fbf8]"
          >
            ×
          </button>
        </div>

        <div className="grid gap-4 px-6 py-6">
          {fields.includes("item_key") && (
            <div className="grid gap-2">
              <div className="text-sm font-extrabold text-[#0b2149]">Klíč / číslo</div>
              <TextInput
                value={String(local.item_key ?? "")}
                onChange={(v) => setField("item_key", v)}
                placeholder="např. 1 nebo mon"
              />
            </div>
          )}

          {fields.includes("label") && (
            <div className="grid gap-2">
              <div className="text-sm font-extrabold text-[#0b2149]">Název</div>
              <TextInput
                value={String(local.label ?? "")}
                onChange={(v) => setField("label", v)}
                placeholder="Název"
              />
            </div>
          )}

          {fields.includes("value_text") && (
            <div className="grid gap-2">
              <div className="text-sm font-extrabold text-[#0b2149]">Text / hodnota</div>
              <TextInput
                value={String(local.value_text ?? "")}
                onChange={(v) => setField("value_text", v)}
                placeholder="Text"
              />
            </div>
          )}

          {fields.includes("value_number") && (
            <div className="grid gap-2">
              <div className="text-sm font-extrabold text-[#0b2149]">Cena / číslo</div>
              <TextInput
                type="number"
                value={String(local.value_number ?? 0)}
                onChange={(v) => setField("value_number", Number(v || 0))}
                placeholder="0"
              />
            </div>
          )}

          {fields.includes("sort_order") && (
            <div className="grid gap-2">
              <div className="text-sm font-extrabold text-[#0b2149]">Pořadí</div>
              <TextInput
                type="number"
                value={String(local.sort_order ?? 0)}
                onChange={(v) => setField("sort_order", Number(v || 0))}
                placeholder="0"
              />
            </div>
          )}

          {fields.includes("is_active") && (
            <label className="flex items-center gap-3 rounded-[16px] border border-[#d9efe1] bg-[#f8fcf9] px-4 py-3">
              <input
                type="checkbox"
                checked={Boolean(local.is_active)}
                onChange={(e) => setField("is_active", e.target.checked)}
              />
              <span className="text-sm font-extrabold text-[#0b2149]">Aktivní</span>
            </label>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#e8f2eb] px-6 py-5">
          <div>
            {onDelete ? (
              <button
                type="button"
                onClick={() => onDelete(local)}
                className="rounded-[16px] border border-red-200 bg-red-50 px-5 py-3 text-[14px] font-extrabold text-red-600 hover:bg-red-100"
              >
                Smazat
              </button>
            ) : (
              <div />
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[16px] border border-[#cfe7d7] bg-white px-5 py-3 text-[14px] font-extrabold text-[#0b7c4d] hover:bg-[#f6fbf8]"
            >
              Zrušit
            </button>
            <button
              type="button"
              onClick={() => onSave(local)}
              className="rounded-[16px] bg-[#08a35c] px-5 py-3 text-[14px] font-extrabold text-white hover:brightness-95"
            >
              Uložit
            </button>
          </div>
        </div>
      </div>
    </>
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
  columns: Array<{ key: keyof SystemItemRow; label: string; render?: (row: SystemItemRow) => React.ReactNode }>;
  onEdit: (row: SystemItemRow) => void;
  onAdd: () => void;
  addLabel?: string;
}) {
  return (
    <div className="rounded-[24px] border border-[#d9efe1] bg-white overflow-hidden">
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
                className="grid gap-4 border-t border-[#e5f2e9] px-5 py-4 items-center"
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

export default function ReportyPage() {
  const [view, setView] = useState<ViewMode>("home");

  const [summaryRange, setSummaryRange] = useState<RangeKey>("today");
  const [invoiceRange, setInvoiceRange] = useState<RangeKey>("thisMonth");
  const [dailyDay, setDailyDay] = useState<string>(toISODateLocal(new Date()));

  const [summaryMonthCursor, setSummaryMonthCursor] = useState<Date>(new Date());
  const [invoiceMonthCursor, setInvoiceMonthCursor] = useState<Date>(new Date());

  const [summaryOrders, setSummaryOrders] = useState<OrderRow[]>([]);
  const [invoiceOrders, setInvoiceOrders] = useState<OrderRow[]>([]);
  const [dailyOrders, setDailyOrders] = useState<OrderRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [selectedInvoiceCustomer, setSelectedInvoiceCustomer] = useState<InvoiceCustomerRow | null>(null);

  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsMsg, setItemsMsg] = useState<string | null>(null);
  const [sectionRows, setSectionRows] = useState<SystemItemRow[]>([]);
  const [allSystemRows, setAllSystemRows] = useState<SystemItemRow[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editFields, setEditFields] = useState<Array<"item_key" | "label" | "value_text" | "value_number" | "sort_order" | "is_active">>([]);
  const [editItem, setEditItem] = useState<SystemItemRow | null>(null);
  const [activeSection, setActiveSection] = useState<string>("");

  const [countRange, setCountRange] = useState<CountRangeKey>("today");
  const [countDay, setCountDay] = useState<string>(toISODateLocal(new Date()));
  const [foodRows, setFoodRows] = useState<SoldFoodRow[]>([]);
  const [foodLoading, setFoodLoading] = useState(false);
  const [foodErr, setFoodErr] = useState<string | null>(null);

  const summaryRangeData = useMemo(
    () => getRange(summaryRange, toISODateLocal(new Date()), summaryMonthCursor),
    [summaryRange, summaryMonthCursor]
  );

  const invoiceRangeData = useMemo(
    () => getRange(invoiceRange, dailyDay, invoiceMonthCursor),
    [invoiceRange, dailyDay, invoiceMonthCursor]
  );

  const dailyRangeData = useMemo(() => getRange("customDay", dailyDay, new Date()), [dailyDay]);

  const foodRangeData = useMemo(() => getFoodCountRange(countRange, countDay), [countRange, countDay]);

  async function loadOrders(from: Date, to: Date) {
    const { data, error } = await supabase
      .from("orders")
      .select("id, created_at, full_name, payment_method, total, status, cart")
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString())
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as OrderRow[];
  }

  async function loadSection(section: string) {
    setItemsLoading(true);
    setItemsMsg(null);
    setActiveSection(section);

    const { data, error } = await supabase
      .from("system_items")
      .select("id, section, item_key, label, value_text, value_number, sort_order, is_active")
      .eq("section", section)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      setItemsLoading(false);
      setItemsMsg(`Chyba: ${error.message}`);
      return;
    }

    setSectionRows((data ?? []) as SystemItemRow[]);
    setItemsLoading(false);
  }

  async function loadAllSystemRows() {
    setItemsLoading(true);
    setItemsMsg(null);

    const { data, error } = await supabase
      .from("system_items")
      .select("id, section, item_key, label, value_text, value_number, sort_order, is_active")
      .order("section", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      setItemsLoading(false);
      setItemsMsg(`Chyba: ${error.message}`);
      return;
    }

    setAllSystemRows((data ?? []) as SystemItemRow[]);
    setItemsLoading(false);
  }

  async function saveItem(row: SystemItemRow) {
    setItemsMsg(null);

    const payload = {
      section: row.section,
      item_key: row.item_key,
      label: row.label,
      value_text: row.value_text,
      value_number: row.value_number,
      sort_order: row.sort_order ?? 0,
      is_active: row.is_active ?? true,
    };

    if (typeof row.id === "number") {
      const { error } = await supabase
        .from("system_items")
        .update(payload)
        .eq("id", row.id);

      if (error) {
        setItemsMsg(`Chyba: ${error.message}`);
        return;
      }
    } else {
      const { error } = await supabase.from("system_items").insert(payload);
      if (error) {
        setItemsMsg(`Chyba: ${error.message}`);
        return;
      }
    }

    setEditOpen(false);
    setItemsMsg("Uloženo ✅");

    if (view === "openingHours") {
      await loadAllSystemRows();
    } else {
      await loadSection(activeSection);
    }
  }

  async function deleteItem(row: SystemItemRow) {
    if (typeof row.id !== "number") {
      setEditOpen(false);
      return;
    }

    const { error } = await supabase.from("system_items").delete().eq("id", row.id);

    if (error) {
      setItemsMsg(`Chyba: ${error.message}`);
      return;
    }

    setEditOpen(false);
    setItemsMsg("Smazáno ✅");

    if (view === "openingHours") {
      await loadAllSystemRows();
    } else {
      await loadSection(activeSection);
    }
  }

  function openEditor(
    title: string,
    section: string,
    fields: Array<"item_key" | "label" | "value_text" | "value_number" | "sort_order" | "is_active">,
    row?: SystemItemRow
  ) {
    setEditTitle(title);
    setEditFields(fields);
    setActiveSection(section);
    setEditItem(
      row ?? {
        id: `new-${Date.now()}`,
        section,
        item_key: "",
        label: "",
        value_text: "",
        value_number: 0,
        sort_order: 0,
        is_active: true,
      }
    );
    setEditOpen(true);
  }

  async function loadFoodCounts() {
    setFoodLoading(true);
    setFoodErr(null);

    const { data: orderItems, error: orderItemsError } = await supabase
      .from("order_items")
      .select("jidlo_id, name, qty, datum")
      .gte("datum", foodRangeData.from)
      .lte("datum", foodRangeData.to);

    if (orderItemsError) {
      setFoodLoading(false);
      setFoodErr(orderItemsError.message);
      return;
    }

    const items = orderItems ?? [];

    const idSet = Array.from(
      new Set(
        items
          .map((x: any) => x.jidlo_id)
          .filter(Boolean)
      )
    );

    let foodsMap = new Map<string, { kategorie?: string | null }>();

    if (idSet.length > 0) {
      const { data: foodsData } = await supabase
        .from("jidla")
        .select("id, kategorie")
        .in("id", idSet);

      for (const row of foodsData ?? []) {
        foodsMap.set(String((row as any).id), {
          kategorie: (row as any).kategorie ?? null,
        });
      }
    }

    const grouped = new Map<string, SoldFoodRow>();

    for (const it of items as any[]) {
      const jidloId = String(it.jidlo_id ?? it.name ?? "");
      const current = grouped.get(jidloId);
      const qty = Number(it.qty ?? 0);
      const foodMeta = foodsMap.get(String(it.jidlo_id));

      if (current) {
        current.qty += qty;
      } else {
        grouped.set(jidloId, {
          id: String(it.jidlo_id ?? "—"),
          name: String(it.name ?? "—"),
          description: "—",
          category: String(foodMeta?.kategorie ?? "—"),
          qty,
        });
      }
    }

    const result = Array.from(grouped.values()).sort((a, b) => b.qty - a.qty);
    setFoodRows(result);
    setFoodLoading(false);
  }

  useEffect(() => {
    if (view !== "summary") return;

    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const data = await loadOrders(summaryRangeData.from, summaryRangeData.to);
        if (!alive) return;
        setSummaryOrders(data);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Chyba při načítání reportu.");
        setSummaryOrders([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [view, summaryRangeData.from, summaryRangeData.to]);

  useEffect(() => {
    if (view !== "invoiceCustomers") return;

    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const data = await loadOrders(invoiceRangeData.from, invoiceRangeData.to);
        if (!alive) return;
        setInvoiceOrders(data.filter(isInvoiceOrder));
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Chyba při načítání fakturovaných zákazníků.");
        setInvoiceOrders([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [view, invoiceRangeData.from, invoiceRangeData.to]);

  useEffect(() => {
    if (view !== "dailyReport") return;

    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const data = await loadOrders(dailyRangeData.from, dailyRangeData.to);
        if (!alive) return;
        setDailyOrders(data);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Chyba při načítání denního reportu.");
        setDailyOrders([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [view, dailyRangeData.from, dailyRangeData.to]);

  useEffect(() => {
    if (view === "allergens") loadSection("allergens");
    if (view === "items") loadSection("items");
    if (view === "openingHours") loadAllSystemRows();
    if (view === "aboutText") loadSection("about_text");
    if (view === "deliveryZones") loadSection("delivery_zones");
  }, [view]);

  useEffect(() => {
    if (view === "foodCounts") loadFoodCounts();
  }, [view, foodRangeData.from, foodRangeData.to]);

  const summaryAll = useMemo(() => {
    return {
      count: summaryOrders.length,
      total: summaryOrders.reduce((s, x) => s + Number(x.total ?? 0), 0),
    };
  }, [summaryOrders]);

  const summaryCashOrders = useMemo(
    () => summaryOrders.filter((x) => (x.payment_method ?? "").toLowerCase() === "cash"),
    [summaryOrders]
  );

  const summaryCardOrders = useMemo(
    () =>
      summaryOrders.filter((x) => {
        const s = (x.payment_method ?? "").toLowerCase();
        return s === "card_on_delivery" || s === "card" || s === "card_online";
      }),
    [summaryOrders]
  );

  const summaryCreditOrders = useMemo(
    () => summaryOrders.filter((x) => (x.payment_method ?? "").toLowerCase() === "credit"),
    [summaryOrders]
  );

  const summaryBoxes = [
    { title: "Všichni zákazníci celkem", rows: summaryOrders },
    { title: "Hotově", rows: summaryCashOrders },
    { title: "Kartou", rows: summaryCardOrders },
    { title: "Kredit", rows: summaryCreditOrders },
  ];

  const invoiceCustomers = useMemo(() => {
    const map = new Map<string, InvoiceCustomerRow>();

    for (const o of invoiceOrders) {
      const key = (o.full_name || "Bez jména").trim();

      if (!map.has(key)) {
        map.set(key, { name: key, total: 0, orders: [] });
      }

      const item = map.get(key)!;
      item.total += Number(o.total ?? 0);
      item.orders.push(o);
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [invoiceOrders]);

  const filteredInvoiceCustomers = useMemo(() => {
    const q = invoiceSearch.trim().toLowerCase();
    if (!q) return invoiceCustomers;
    return invoiceCustomers.filter((c) => c.name.toLowerCase().includes(q));
  }, [invoiceCustomers, invoiceSearch]);

  const dailyAll = useMemo(() => {
    return {
      count: dailyOrders.length,
      total: dailyOrders.reduce((s, x) => s + Number(x.total ?? 0), 0),
    };
  }, [dailyOrders]);

  const dailyCashOrders = useMemo(
    () => dailyOrders.filter((x) => (x.payment_method ?? "").toLowerCase() === "cash"),
    [dailyOrders]
  );

  const dailyCardOrders = useMemo(
    () =>
      dailyOrders.filter((x) => {
        const s = (x.payment_method ?? "").toLowerCase();
        return s === "card_on_delivery" || s === "card" || s === "card_online";
      }),
    [dailyOrders]
  );

  const dailyCreditOrders = useMemo(
    () => dailyOrders.filter((x) => (x.payment_method ?? "").toLowerCase() === "credit"),
    [dailyOrders]
  );

  const dailyBoxes = [
    { title: "Všichni zákazníci celkem", rows: dailyOrders },
    { title: "Hotově", rows: dailyCashOrders },
    { title: "Kartou", rows: dailyCardOrders },
    { title: "Kredit", rows: dailyCreditOrders },
  ];

  const aboutTextRow = sectionRows[0] ?? null;

  const shopHoursRows = useMemo(
    () => allSystemRows.filter((x) => x.section === "opening_hours_shop"),
    [allSystemRows]
  );

  const canteenHoursRows = useMemo(
    () => allSystemRows.filter((x) => x.section === "opening_hours_canteen"),
    [allSystemRows]
  );

  return (
    <div className="min-h-screen bg-[#f7f8f6]">
      <div className="mx-auto w-full max-w-[1380px] px-8 py-6">
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
              <div className="w-full max-w-[620px]">
                <button
                  type="button"
                  className={tileClass("blue")}
                  onClick={() => setView("settingsHome")}
                >
                  Nastavení
                </button>
              </div>
            </div>
          </>
        ) : null}

        {view === "settingsHome" ? (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[38px] font-extrabold tracking-tight text-[#0b2149]">Nastavení</h1>
                <div className="mt-1 text-[14px] font-semibold text-gray-500">Správa systému a webu</div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setView("home")}
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

  <div className="mt-8 grid gap-4 md:grid-cols-2">
  <button type="button" className={tileClass("green")} onClick={() => setView("allergens")}>
    Alergeny
  </button>
  <button type="button" className={tileClass("green")} onClick={() => setView("items")}>
    Položky
  </button>

  <button type="button" className={tileClass("green")} onClick={() => setView("openingHours")}>
    Otevírací doba
  </button>
  <button type="button" className={tileClass("green")} onClick={() => setView("aboutText")}>
    Text Jiřka
  </button>

  <button type="button" className={tileClass("green")} onClick={() => setView("deliveryZones")}>
    Rozvoz okruhy
  </button>
  <button type="button" className={tileClass("green")} onClick={() => setView("foodCounts")}>
    Počty jídel
  </button>

  <Link
    href="/staff/reporty/rozvozy"
    className={tileClass("green")}
  >
    Rozvozy
  </Link>
</div>
          </>
        ) : null}

        {view === "summary" ? (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[38px] font-extrabold tracking-tight text-[#0b2149]">Reporty</h1>
                <div className="mt-1 text-[14px] font-semibold text-gray-500">
                  Přehled objednávek • {summaryRangeData.label}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setView("home")}
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

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <FilterButton active={summaryRange === "today"} onClick={() => setSummaryRange("today")}>
                Dnes
              </FilterButton>
              <FilterButton active={summaryRange === "yesterday"} onClick={() => setSummaryRange("yesterday")}>
                Včera
              </FilterButton>
              <FilterButton active={summaryRange === "thisMonth"} onClick={() => setSummaryRange("thisMonth")}>
                Tento měsíc
              </FilterButton>
              <FilterButton active={summaryRange === "lastMonth"} onClick={() => setSummaryRange("lastMonth")}>
                Minulý měsíc
              </FilterButton>

              {(summaryRange === "thisMonth" || summaryRange === "lastMonth") ? (
                <div className="ml-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSummaryMonthCursor((d) => addMonths(d, -1))}
                    className="rounded-full border border-[#bde7c8] bg-white px-3 py-2 text-sm font-extrabold text-[#0b7c4d]"
                  >
                    ←
                  </button>
                  <div className="rounded-full border border-[#bde7c8] bg-white px-4 py-2 text-sm font-extrabold text-[#0b2149]">
                    {monthLabel(summaryMonthCursor)}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSummaryMonthCursor((d) => addMonths(d, 1))}
                    className="rounded-full border border-[#bde7c8] bg-white px-3 py-2 text-sm font-extrabold text-[#0b7c4d]"
                  >
                    →
                  </button>
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
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[38px] font-extrabold tracking-tight text-[#0b2149]">
                  Fakturovaní zákazníci
                </h1>
                <div className="mt-1 text-[14px] font-semibold text-gray-500">
                  Přehled fakturovaných zákazníků • {invoiceRangeData.label}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setView("home")}
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

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <FilterButton active={invoiceRange === "today"} onClick={() => setInvoiceRange("today")}>
                Dnes
              </FilterButton>
              <FilterButton active={invoiceRange === "yesterday"} onClick={() => setInvoiceRange("yesterday")}>
                Včera
              </FilterButton>
              <FilterButton active={invoiceRange === "customDay"} onClick={() => setInvoiceRange("customDay")}>
                Vyber den
              </FilterButton>
              <FilterButton active={invoiceRange === "thisMonth"} onClick={() => setInvoiceRange("thisMonth")}>
                Tento měsíc
              </FilterButton>
              <FilterButton active={invoiceRange === "lastMonth"} onClick={() => setInvoiceRange("lastMonth")}>
                Minulý měsíc
              </FilterButton>

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
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[38px] font-extrabold tracking-tight text-[#0b2149]">Faktura</h1>
                <div className="mt-1 text-[14px] font-semibold text-gray-500">
                  {selectedInvoiceCustomer.name}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setView("invoiceCustomers")}
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
                    <div className="text-[15px] text-gray-600">
                      {new Date(o.created_at).toLocaleDateString("cs-CZ")}
                    </div>
                    <div className="text-right text-[15px] font-extrabold text-[#0b7c4d]">
                      {czk(Number(o.total ?? 0))}
                    </div>
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
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[38px] font-extrabold tracking-tight text-[#0b2149]">Denní report</h1>
                <div className="mt-1 text-[14px] font-semibold text-gray-500">Report za vybraný den</div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setView("home")}
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
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[38px] font-extrabold tracking-tight text-[#0b2149]">Alergeny</h1>
                <div className="mt-1 text-[14px] font-semibold text-gray-500">Seznam alergenů s možností úprav</div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setView("settingsHome")}
                  className="rounded-[18px] border border-[#78d3a0] bg-white px-5 py-3 text-[15px] font-extrabold text-[#0b7c4d]"
                >
                  Zpět
                </button>
                <Link href="/staff" className="rounded-[18px] bg-[#08a35c] px-5 py-3 text-[15px] font-extrabold text-white">
                  Rozcestník
                </Link>
              </div>
            </div>

            <div className="mt-8">
              <SectionCard title="Alergeny" subtitle="Úprava čísel a názvů alergenů">
                {itemsLoading ? (
                  <div className="text-sm font-semibold text-gray-500">Načítám…</div>
                ) : (
                  <RowList
                    rows={sectionRows}
                    onEdit={(row) =>
                      openEditor("Upravit alergen", "allergens", ["item_key", "label", "sort_order", "is_active"], row)
                    }
                    onAdd={() =>
                      openEditor("Přidat alergen", "allergens", ["item_key", "label", "sort_order", "is_active"])
                    }
                    addLabel="Přidat alergen"
                    columns={[
                      { key: "item_key", label: "Číslo" },
                      { key: "label", label: "Název" },
                      {
                        key: "is_active",
                        label: "Aktivní",
                        render: (row) => (row.is_active ? "Ano" : "Ne"),
                      },
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
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[38px] font-extrabold tracking-tight text-[#0b2149]">Položky</h1>
                <div className="mt-1 text-[14px] font-semibold text-gray-500">Krabičky, rozvoz, zálohy a další položky</div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setView("settingsHome")}
                  className="rounded-[18px] border border-[#78d3a0] bg-white px-5 py-3 text-[15px] font-extrabold text-[#0b7c4d]"
                >
                  Zpět
                </button>
                <Link href="/staff" className="rounded-[18px] bg-[#08a35c] px-5 py-3 text-[15px] font-extrabold text-white">
                  Rozcestník
                </Link>
              </div>
            </div>

            <div className="mt-8">
              <SectionCard title="Položky systému" subtitle="Úprava názvu a ceny položek">
                {itemsLoading ? (
                  <div className="text-sm font-semibold text-gray-500">Načítám…</div>
                ) : (
                  <RowList
                    rows={sectionRows}
                    onEdit={(row) =>
                      openEditor("Upravit položku", "items", ["item_key", "label", "value_number", "sort_order", "is_active"], row)
                    }
                    onAdd={() =>
                      openEditor("Přidat položku", "items", ["item_key", "label", "value_number", "sort_order", "is_active"])
                    }
                    addLabel="Přidat položku"
                    columns={[
                      { key: "label", label: "Název" },
                      {
                        key: "value_number",
                        label: "Cena",
                        render: (row) => czk(Number(row.value_number ?? 0)),
                      },
                      {
                        key: "item_key",
                        label: "Klíč",
                      },
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
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[38px] font-extrabold tracking-tight text-[#0b2149]">Otevírací doba</h1>
                <div className="mt-1 text-[14px] font-semibold text-gray-500">Jídelna a obchod</div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setView("settingsHome")}
                  className="rounded-[18px] border border-[#78d3a0] bg-white px-5 py-3 text-[15px] font-extrabold text-[#0b7c4d]"
                >
                  Zpět
                </button>
                <Link href="/staff" className="rounded-[18px] bg-[#08a35c] px-5 py-3 text-[15px] font-extrabold text-white">
                  Rozcestník
                </Link>
              </div>
            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-2">
              <SectionCard title="Obchod" subtitle="Uprav dny a časy">
                {itemsLoading ? (
                  <div className="text-sm font-semibold text-gray-500">Načítám…</div>
                ) : (
                  <RowList
                    rows={shopHoursRows}
                    onEdit={(row) =>
                      openEditor("Upravit otevírací dobu obchodu", "opening_hours_shop", ["item_key", "label", "value_text", "sort_order", "is_active"], row)
                    }
                    onAdd={() =>
                      openEditor("Přidat den do obchodu", "opening_hours_shop", ["item_key", "label", "value_text", "sort_order", "is_active"])
                    }
                    addLabel="Přidat den"
                    columns={[
                      { key: "label", label: "Den" },
                      { key: "value_text", label: "Čas" },
                      {
                        key: "is_active",
                        label: "Aktivní",
                        render: (row) => (row.is_active ? "Ano" : "Ne"),
                      },
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
                    onEdit={(row) =>
                      openEditor("Upravit otevírací dobu jídelny", "opening_hours_canteen", ["item_key", "label", "value_text", "sort_order", "is_active"], row)
                    }
                    onAdd={() =>
                      openEditor("Přidat den do jídelny", "opening_hours_canteen", ["item_key", "label", "value_text", "sort_order", "is_active"])
                    }
                    addLabel="Přidat den"
                    columns={[
                      { key: "label", label: "Den" },
                      { key: "value_text", label: "Čas" },
                      {
                        key: "is_active",
                        label: "Aktivní",
                        render: (row) => (row.is_active ? "Ano" : "Ne"),
                      },
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
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[38px] font-extrabold tracking-tight text-[#0b2149]">Text Jiřka</h1>
                <div className="mt-1 text-[14px] font-semibold text-gray-500">Text článku na web</div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setView("settingsHome")}
                  className="rounded-[18px] border border-[#78d3a0] bg-white px-5 py-3 text-[15px] font-extrabold text-[#0b7c4d]"
                >
                  Zpět
                </button>
                <Link href="/staff" className="rounded-[18px] bg-[#08a35c] px-5 py-3 text-[15px] font-extrabold text-white">
                  Rozcestník
                </Link>
              </div>
            </div>

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
                          return prev.map((x, i) =>
                            i === 0 ? { ...x, value_text: e.target.value } : x
                          );
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
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[38px] font-extrabold tracking-tight text-[#0b2149]">Rozvoz okruhy</h1>
                <div className="mt-1 text-[14px] font-semibold text-gray-500">Okruhy, popis a cena rozvozu</div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setView("settingsHome")}
                  className="rounded-[18px] border border-[#78d3a0] bg-white px-5 py-3 text-[15px] font-extrabold text-[#0b7c4d]"
                >
                  Zpět
                </button>
                <Link href="/staff" className="rounded-[18px] bg-[#08a35c] px-5 py-3 text-[15px] font-extrabold text-white">
                  Rozcestník
                </Link>
              </div>
            </div>

            <div className="mt-8">
              <SectionCard title="Rozvoz okruhy" subtitle="Úprava názvu, popisu a ceny">
                {itemsLoading ? (
                  <div className="text-sm font-semibold text-gray-500">Načítám…</div>
                ) : (
                  <RowList
                    rows={sectionRows}
                    onEdit={(row) =>
                      openEditor("Upravit rozvoz okruh", "delivery_zones", ["item_key", "label", "value_text", "value_number", "sort_order", "is_active"], row)
                    }
                    onAdd={() =>
                      openEditor("Přidat rozvoz okruh", "delivery_zones", ["item_key", "label", "value_text", "value_number", "sort_order", "is_active"])
                    }
                    addLabel="Přidat okruh"
                    columns={[
                      { key: "label", label: "Název" },
                      { key: "value_text", label: "Popis" },
                      {
                        key: "value_number",
                        label: "Cena",
                        render: (row) => czk(Number(row.value_number ?? 0)),
                      },
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
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[38px] font-extrabold tracking-tight text-[#0b2149]">Počty jídel</h1>
                <div className="mt-1 text-[14px] font-semibold text-[#0b7c4d]">Přehled prodaných jídel</div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setView("settingsHome")}
                  className="rounded-[18px] border border-[#78d3a0] bg-white px-5 py-3 text-[15px] font-extrabold text-[#0b7c4d]"
                >
                  Zpět
                </button>
                <Link
                  href="/staff"
                  className="rounded-[18px] border border-[#78d3a0] bg-white px-5 py-3 text-[15px] font-extrabold text-[#0b7c4d]"
                >
                  Rozcestník
                </Link>
              </div>
            </div>

            <div className="mt-8">
              <SectionCard title="Filtr období" subtitle="Zvol období, které chceš zobrazit">
                <div className="flex flex-wrap items-center gap-2 border-b border-[#d9efe1] pb-4">
                  <FilterButton active={countRange === "today"} onClick={() => setCountRange("today")}>
                    Dnes
                  </FilterButton>
                  <FilterButton active={countRange === "yesterday"} onClick={() => setCountRange("yesterday")}>
                    Včera
                  </FilterButton>
                  <FilterButton active={countRange === "week"} onClick={() => setCountRange("week")}>
                    Týden
                  </FilterButton>
                  <FilterButton active={countRange === "month"} onClick={() => setCountRange("month")}>
                    Měsíc
                  </FilterButton>
                  <FilterButton active={countRange === "customDay"} onClick={() => setCountRange("customDay")}>
                    Vyber den
                  </FilterButton>

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
                        className="grid grid-cols-[110px_1.6fr_1fr_1fr_140px] gap-4 border-t border-[#e5f2e9] px-4 py-4 text-[14px] items-center"
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


        <EditItemModal
          open={editOpen}
          title={editTitle}
          item={editItem}
          fields={editFields}
          onClose={() => setEditOpen(false)}
          onSave={saveItem}
          onDelete={deleteItem}
        />
      </div>
    </div>
  );
}