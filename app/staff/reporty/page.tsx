"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import DesktopView from "./_ui/DesktopView";
import MobileView from "./_ui/MobileView";

export type OrderRow = {
  id: string;
  created_at: string;
  full_name: string | null;
  payment_method: string | null;
  total: number | null;
  status: string | null;
  cart?: any;
};

export type SystemItemRow = {
  id: number | string;
  section: string;
  item_key: string | null;
  label: string | null;
  value_text: string | null;
  value_number: number | null;
  sort_order: number | null;
  is_active: boolean | null;
};

export type SoldFoodRow = {
  id: string;
  name: string;
  description: string;
  category: string;
  qty: number;
};

export type RangeKey = "today" | "yesterday" | "thisMonth" | "lastMonth" | "customDay";
export type CountRangeKey = "today" | "yesterday" | "week" | "month" | "customDay";

export type ViewMode =
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

export type InvoiceCustomerRow = {
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

export function czk(n: number) {
  return `${Number(n || 0).toFixed(2)} Kč`;
}

export function prettyDate(ts: string) {
  try {
    return new Date(ts).toLocaleString("cs-CZ");
  } catch {
    return ts;
  }
}

export function prettyPayment(x: string | null) {
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

      <div className="fixed left-1/2 top-1/2 z-50 w-[680px] max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 rounded-[28px] bg-white shadow-[0_25px_80px_rgba(0,0,0,0.22)] ring-1 ring-black/10">
        <div className="flex items-center justify-between border-b border-[#e8f2eb] px-5 py-4 md:px-6 md:py-5">
          <div>
            <div className="text-[24px] md:text-[28px] font-extrabold text-[#0b2149]">{title}</div>
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

        <div className="grid gap-4 px-5 py-5 md:px-6 md:py-6">
          {fields.includes("item_key") && (
            <Field label="Klíč / číslo">
              <input
                value={String(local.item_key ?? "")}
                onChange={(e) => setField("item_key", e.target.value)}
                className="w-full rounded-[16px] border border-[#bfe6ca] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#0b2149] outline-none focus:border-[#08a35c]"
              />
            </Field>
          )}

          {fields.includes("label") && (
            <Field label="Název">
              <input
                value={String(local.label ?? "")}
                onChange={(e) => setField("label", e.target.value)}
                className="w-full rounded-[16px] border border-[#bfe6ca] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#0b2149] outline-none focus:border-[#08a35c]"
              />
            </Field>
          )}

          {fields.includes("value_text") && (
            <Field label="Text / hodnota">
              <input
                value={String(local.value_text ?? "")}
                onChange={(e) => setField("value_text", e.target.value)}
                className="w-full rounded-[16px] border border-[#bfe6ca] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#0b2149] outline-none focus:border-[#08a35c]"
              />
            </Field>
          )}

          {fields.includes("value_number") && (
            <Field label="Cena / číslo">
              <input
                type="number"
                value={String(local.value_number ?? 0)}
                onChange={(e) => setField("value_number", Number(e.target.value || 0))}
                className="w-full rounded-[16px] border border-[#bfe6ca] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#0b2149] outline-none focus:border-[#08a35c]"
              />
            </Field>
          )}

          {fields.includes("sort_order") && (
            <Field label="Pořadí">
              <input
                type="number"
                value={String(local.sort_order ?? 0)}
                onChange={(e) => setField("sort_order", Number(e.target.value || 0))}
                className="w-full rounded-[16px] border border-[#bfe6ca] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#0b2149] outline-none focus:border-[#08a35c]"
              />
            </Field>
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

        <div className="flex items-center justify-between border-t border-[#e8f2eb] px-5 py-4 md:px-6 md:py-5">
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <div className="text-sm font-extrabold text-[#0b2149]">{label}</div>
      {children}
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
      const { error } = await supabase.from("system_items").update(payload).eq("id", row.id);
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
    const idSet = Array.from(new Set(items.map((x: any) => x.jidlo_id).filter(Boolean)));

    const foodsMap = new Map<string, { kategorie?: string | null }>();

    if (idSet.length > 0) {
      const { data: foodsData } = await supabase.from("jidla").select("id, kategorie").in("id", idSet);

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

    setFoodRows(Array.from(grouped.values()).sort((a, b) => b.qty - a.qty));
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

  const summaryAll = useMemo(
    () => ({
      count: summaryOrders.length,
      total: summaryOrders.reduce((s, x) => s + Number(x.total ?? 0), 0),
    }),
    [summaryOrders]
  );

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

  const dailyAll = useMemo(
    () => ({
      count: dailyOrders.length,
      total: dailyOrders.reduce((s, x) => s + Number(x.total ?? 0), 0),
    }),
    [dailyOrders]
  );

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
  const shopHoursRows = useMemo(() => allSystemRows.filter((x) => x.section === "opening_hours_shop"), [allSystemRows]);
  const canteenHoursRows = useMemo(() => allSystemRows.filter((x) => x.section === "opening_hours_canteen"), [allSystemRows]);

  const sharedProps = {
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
    foodRangeData,
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
    allSystemRows,
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
  };

  return (
    <div className="min-h-screen bg-[#f7f8f6]">
      <div className="mx-auto w-full max-w-[1380px] px-4 py-5 md:px-8 md:py-6">
        <div className="hidden md:block">
          <DesktopView {...sharedProps} />
        </div>

        <div className="md:hidden">
          <MobileView {...sharedProps} />
        </div>

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
