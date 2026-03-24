"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useIsMobile } from "@/app/components/hooks/useIsMobile";
import DesktopView from "./_ui/DesktopView";
import MobileView from "./_ui/MobileView";

/* ===================== Types ===================== */
export type OrderRow = {
  id: string;
  created_at: string;
  full_name: string;
  phone: string;
  address: string;
  note: string;
  delivery_mode: string;
  packaging_mode: string;
  payment_method: string;
  cart: any;
  total: number;
  status: string;
  source?: string | null;
  datum?: string | null;
  delivery_date?: string | null;
  order_date?: string | null;
  date?: string | null;
  selected_date?: string | null;
  day?: string | null;
  times_by_day?: Record<string, any> | null;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  datum: string | null;
  jidlo_id: string | null;
  name: string | null;
  unit_price: number | null;
  qty: number | null;
  line_total: number | null;
};

type CartLine = {
  name?: string;
  nazev?: string;
  qty?: number;
  unit_price?: number;
  line_total?: number;
  datum?: string;
  date?: string;
  day?: string;
  jidlo_id?: string;
};

export type FilterMode = "delivery" | "pickup" | "all";
export type FoodsMode = "items" | "cart";

export type FoodEditRow =
  | { kind: "items"; id: string; name: string }
  | { kind: "cart"; idx: number; name: string };

/* ===================== Helpers ===================== */
export function czDateTime(ts: string) {
  try {
    return new Date(ts).toLocaleString("cs-CZ");
  } catch {
    return ts;
  }
}

export function pillBase(cls = "") {
  return `inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold ring-1 ${cls}`;
}

export function statusPill(status: string) {
  const s = (status ?? "").toLowerCase();
  if (s === "new") return pillBase("bg-amber-50 text-amber-800 ring-amber-200/70");
  if (s === "done" || s === "completed") return pillBase("bg-green-50 text-green-800 ring-green-200/70");
  if (s === "canceled" || s === "cancelled") return pillBase("bg-red-50 text-red-700 ring-red-200/70");
  return pillBase("bg-gray-50 text-gray-700 ring-gray-200/70");
}

export function prettyDelivery(x: string) {
  const s = (x ?? "").toLowerCase();
  if (s === "delivery") return "Doručení";
  if (s === "pickup") return "Osobní odběr";
  return x;
}

export function prettyPackaging(x: string) {
  const s = (x ?? "").toLowerCase();
  if (s === "plastic") return "Plast";
  if (s === "rekrabicka") return "REkrabička";
  if (s === "own") return "Jídlonosič";
  return x;
}

export function prettyPayment(x: string) {
  const s = (x ?? "").toLowerCase();
  if (s === "credit") return "Kredit";
  if (s === "card_online") return "Kartou online";
  if (s === "online") return "Online";
  if (s === "card_delivery") return "Kartou při převzetí";
  if (s === "cash") return "Hotově při převzetí";
  if (s === "invoice") return "Fakturou";
  if (s === "menu_order") return "Objednávka z jídelníčku";
  return x;
}

function escapeHtml(s: string) {
  return (s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toIsoLocal(date: Date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isIsoDate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function normalizeMaybeDateString(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v.slice(0, 10);

  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;

  return toIsoLocal(d);
}

function extractOrderDay(order: any): string | null {
  const directCandidates = [
    order?.delivery_date,
    order?.order_date,
    order?.datum,
    order?.date,
    order?.selected_date,
    order?.day,
  ];

  for (const c of directCandidates) {
    const n = normalizeMaybeDateString(c);
    if (n) return n;
  }

  const timesByDay = order?.times_by_day;
  if (timesByDay && typeof timesByDay === "object") {
    const keys = Object.keys(timesByDay).filter(isIsoDate).sort();
    if (keys.length > 0) return keys[0];
  }

  const cart = order?.cart;
  if (Array.isArray(cart)) {
    for (const item of cart) {
      const n =
        normalizeMaybeDateString(item?.date) ||
        normalizeMaybeDateString(item?.datum) ||
        normalizeMaybeDateString(item?.day);
      if (n) return n;
    }
  }

  if (cart && typeof cart === "object" && Array.isArray(cart.items)) {
    for (const item of cart.items) {
      const n =
        normalizeMaybeDateString(item?.date) ||
        normalizeMaybeDateString(item?.datum) ||
        normalizeMaybeDateString(item?.day);
      if (n) return n;
    }
  }

  return null;
}

async function fetchOrderItemsMany(orderIds: string[]) {
  if (!orderIds.length) return [] as OrderItemRow[];
  const { data, error } = await supabase
    .from("order_items")
    .select("id, order_id, datum, jidlo_id, name, unit_price, qty, line_total")
    .in("order_id", orderIds)
    .order("datum", { ascending: true });

  if (error) throw error;
  return (data ?? []) as OrderItemRow[];
}

async function fetchOrderItems(orderId: string) {
  const { data, error } = await supabase
    .from("order_items")
    .select("id, order_id, datum, jidlo_id, name, unit_price, qty, line_total")
    .eq("order_id", orderId)
    .order("datum", { ascending: true });

  if (error) throw error;
  return (data ?? []) as OrderItemRow[];
}

async function ensureFreshSession(forceRefresh = false): Promise<boolean> {
  try {
    const { data: sess } = await supabase.auth.getSession();
    const hasSession = !!sess.session;

    if (hasSession && !forceRefresh) return true;

    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (error) return false;
    return !!refreshed.session;
  } catch {
    return false;
  }
}

function buildReceiptHTML(o: OrderRow, items: OrderItemRow[]) {
  const rows =
    items.length > 0
      ? items
          .map((it) => {
            const name = (it.name ?? "").toString();
            const qty = Number(it.qty ?? 0);
            const unit = Number(it.unit_price ?? 0);
            const line = Number(it.line_total ?? unit * qty);
            return `<tr>
              <td style="padding:6px 0; border-bottom:1px solid #eee;">
                <div style="font-weight:800;">${escapeHtml(name)}</div>
                <div style="font-size:12px; color:#666;">${qty} ks × ${unit} Kč</div>
              </td>
              <td style="padding:6px 0; border-bottom:1px solid #eee; text-align:right; font-weight:900;">
                ${line} Kč
              </td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="2" style="padding:10px 0; color:#666;">(Položky nejsou uložené)</td></tr>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Účtenka</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; padding: 18px; }
    .h { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
    .title { font-size: 20px; font-weight: 900; color:#166534; }
    .meta { font-size: 12px; color:#555; font-weight: 700; }
    .box { margin-top: 12px; border: 1px solid #e5e7eb; border-radius: 16px; padding: 14px; }
    table { width:100%; border-collapse: collapse; margin-top: 10px; }
    .total { display:flex; justify-content:space-between; margin-top: 12px; font-size: 16px; font-weight: 900; }
    @media print { button { display:none; } }
  </style>
</head>
<body>
  <div class="h">
    <div>
      <div class="title">Jiřka – účtenka</div>
      <div class="meta">Objednávka: ${escapeHtml(o.id)}<br/>${escapeHtml(czDateTime(o.created_at))}</div>
    </div>
    <button onclick="window.print()" style="border:1px solid #ddd; background:#fff; border-radius:999px; padding:10px 14px; font-weight:800;">
      Tisk
    </button>
  </div>

  <div class="box">
    <div style="font-weight:900; margin-bottom:6px;">Zákazník</div>
    <div>${escapeHtml(o.full_name ?? "")}</div>
    <div>${escapeHtml(o.phone ?? "")}</div>
    <div>${escapeHtml(o.address ?? "")}</div>
    <div style="margin-top:8px; font-weight:900;">Převzetí / Platba</div>
    <div>${escapeHtml(prettyDelivery(o.delivery_mode))} • ${escapeHtml(prettyPayment(o.payment_method))}</div>
  </div>

  <div class="box">
    <div style="font-weight:900; margin-bottom:6px;">Položky</div>
    <table>${rows}</table>
    <div class="total">
      <span>Celkem</span><span>${Number(o.total ?? 0)} Kč</span>
    </div>
  </div>

  ${o.note ? `<div class="box"><div style="font-weight:900; margin-bottom:6px;">Poznámka</div><div style="white-space:pre-wrap;">${escapeHtml(o.note)}</div></div>` : ""}
</body>
</html>`;
}

export type ViewProps = {
  loading: boolean;
  err: string | null;
  orders: OrderRow[];
  filteredOrders: OrderRow[];
  filter: FilterMode;
  setFilter: (v: FilterMode) => void;
  newCount: number;
  deliveryCount: number;
  pickupCount: number;
  allCount: number;

  open: boolean;
  active: OrderRow | null;
  activeItems: OrderItemRow[];
  activeLoading: boolean;

  savingEdit: boolean;
  confirmDelOpen: boolean;
  deleting: boolean;

  foodsOpen: boolean;
  foodsMode: FoodsMode;
  foodRows: FoodEditRow[];
  foodsSaving: boolean;
  addFoodName: string;
  setAddFoodName: (v: string) => void;
  confirmFoodDelete: FoodEditRow | null;

  eName: string;
  setEName: (v: string) => void;
  ePhone: string;
  setEPhone: (v: string) => void;
  eAddress: string;
  setEAddress: (v: string) => void;
  eNote: string;
  setENote: (v: string) => void;
  eDelivery: string;
  setEDelivery: (v: string) => void;
  ePackaging: string;
  setEPackaging: (v: string) => void;
  ePayment: string;
  setEPayment: (v: string) => void;

  load: (silent?: boolean, retried?: boolean) => Promise<void>;
  openModal: (o: OrderRow) => void;
  closeModal: () => void;
  onPrint: (o: OrderRow) => Promise<void>;
  saveEdit: () => Promise<void>;
  deleteOrderConfirmed: () => Promise<void>;

  getFoodsFromOrder: (o: OrderRow) => string[];
  getQtyFromOrder: (o: OrderRow) => number;

  openFoodsModal: () => void;
  closeFoodsModal: () => void;

  setFoodRows: React.Dispatch<React.SetStateAction<FoodEditRow[]>>;
  setConfirmDelOpen: (v: boolean) => void;
  setConfirmFoodDelete: (v: FoodEditRow | null) => void;

  persistFoodRename: (row: FoodEditRow, newName: string) => Promise<void>;
  addFoodToOrder: (name: string) => Promise<void>;
  deleteFoodFromOrder: (row: FoodEditRow) => Promise<void>;
};

export default function StaffOnlineOrdersPage() {
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const lastSigRef = useRef<string>("");

  const [itemsMap, setItemsMap] = useState<Record<string, OrderItemRow[]>>({});

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<OrderRow | null>(null);
  const [activeItems, setActiveItems] = useState<OrderItemRow[]>([]);
  const [activeLoading, setActiveLoading] = useState(false);

  const [savingEdit, setSavingEdit] = useState(false);

  const [confirmDelOpen, setConfirmDelOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [foodsOpen, setFoodsOpen] = useState(false);
  const [foodsMode, setFoodsMode] = useState<FoodsMode>("items");
  const [foodRows, setFoodRows] = useState<FoodEditRow[]>([]);
  const [foodsSaving, setFoodsSaving] = useState(false);
  const [addFoodName, setAddFoodName] = useState("");
  const [confirmFoodDelete, setConfirmFoodDelete] = useState<FoodEditRow | null>(null);

  const [filter, setFilter] = useState<FilterMode>("delivery");

  const [eName, setEName] = useState("");
  const [ePhone, setEPhone] = useState("");
  const [eAddress, setEAddress] = useState("");
  const [eNote, setENote] = useState("");
  const [eDelivery, setEDelivery] = useState("delivery");
  const [ePackaging, setEPackaging] = useState("plastic");
  const [ePayment, setEPayment] = useState("card_online");

  const todayIso = useMemo(() => toIsoLocal(new Date()), []);

  async function load(silent = false, retried = false) {
    if (!silent) setErr(null);

    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      const rows = (data ?? []) as OrderRow[];

      const sig = rows
        .map(
          (o) =>
            `${o.id}|${o.created_at}|${o.status}|${o.total}|${o.payment_method}|${o.delivery_mode}|${o.packaging_mode}|${
              extractOrderDay(o) ?? ""
            }`
        )
        .join(";;");

      if (sig === lastSigRef.current) return;
      lastSigRef.current = sig;

      setOrders(rows);

      try {
        const ids = rows.map((x) => x.id);
        const all = await fetchOrderItemsMany(ids);
        const m: Record<string, OrderItemRow[]> = {};
        for (const it of all) (m[it.order_id] ??= []).push(it);
        setItemsMap(m);
      } catch {
        // ignore
      }
    } catch (e: any) {
      const msg = String(e?.message ?? "").toLowerCase();

      if (!retried && (msg.includes("jwt expired") || msg.includes("invalid jwt"))) {
        const ok = await ensureFreshSession(true);
        if (ok) return load(true, true);

        setErr("Přihlášení vypršelo. Obnov stránku nebo se přihlas znovu.");
        return;
      }

      setErr(e?.message ?? "Nepodařilo se načíst objednávky.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(false);
    const id = setInterval(() => load(true), 10_000);
    return () => clearInterval(id);
  }, []);

  const todayOrders = useMemo(() => {
    return orders.filter((o) => extractOrderDay(o) === todayIso);
  }, [orders, todayIso]);

  const newCount = useMemo(
    () => todayOrders.filter((o) => (o.status ?? "").toLowerCase() === "new").length,
    [todayOrders]
  );

  const deliveryCount = useMemo(
    () => todayOrders.filter((o) => (o.delivery_mode ?? "").toLowerCase() === "delivery").length,
    [todayOrders]
  );

  const pickupCount = useMemo(
    () => todayOrders.filter((o) => (o.delivery_mode ?? "").toLowerCase() === "pickup").length,
    [todayOrders]
  );

  const allCount = useMemo(() => todayOrders.length, [todayOrders]);

  const filteredOrders = useMemo(() => {
    if (filter === "all") return orders;
    return orders.filter((o) => (o.delivery_mode ?? "").toLowerCase() === filter);
  }, [orders, filter]);

  function getFoodsFromOrder(o: OrderRow): string[] {
    const items = itemsMap[o.id] ?? [];
    const names = items.map((x) => (x.name ?? "").toString().trim()).filter(Boolean);
    if (names.length) return names;

    const c = o.cart;
    if (Array.isArray(c)) {
      const n2 = c
        .map((x: any) => (x?.name ?? x?.nazev ?? "").toString().trim())
        .filter(Boolean);
      if (n2.length) return n2;
    }

    if (c && typeof c === "object" && Array.isArray(c.items)) {
      const n3 = c.items
        .map((x: any) => (x?.name ?? x?.nazev ?? "").toString().trim())
        .filter(Boolean);
      if (n3.length) return n3;
    }

    return [];
  }

  function getQtyFromOrder(o: OrderRow): number {
    const items = itemsMap[o.id] ?? [];
    const sumItems = items.reduce((s, it) => s + Number(it.qty ?? 0), 0);
    if (sumItems > 0) return sumItems;

    const c = o.cart;
    if (Array.isArray(c)) {
      const sumCart = c.reduce((s: number, x: any) => s + Number(x?.qty ?? 1), 0);
      if (sumCart > 0) return sumCart;
    }

    if (c && typeof c === "object" && Array.isArray(c.items)) {
      const sumObj = c.items.reduce((s: number, x: any) => s + Number(x?.qty ?? 1), 0);
      if (sumObj > 0) return sumObj;
    }

    return getFoodsFromOrder(o).length;
  }

  function openModal(o: OrderRow) {
    setOpen(true);
    setActive(o);
    setConfirmDelOpen(false);
    setFoodsOpen(false);
    setConfirmFoodDelete(null);

    setEName(o.full_name ?? "");
    setEPhone(o.phone ?? "");
    setEAddress(o.address ?? "");
    setENote(o.note ?? "");
    setEDelivery((o.delivery_mode ?? "delivery").toLowerCase());
    setEPackaging((o.packaging_mode ?? "plastic").toLowerCase());

    const payment = (o.payment_method ?? "card_online").toLowerCase();
    setEPayment(payment === "card_on_delivery" ? "card_delivery" : payment);

    (async () => {
      setActiveLoading(true);
      try {
        const items = await fetchOrderItems(o.id);
        setActiveItems(items);
      } catch {
        setActiveItems(itemsMap[o.id] ?? []);
      } finally {
        setActiveLoading(false);
      }
    })();
  }

  function closeModal() {
    if (savingEdit || deleting || foodsSaving) return;
    setOpen(false);
    setActive(null);
    setActiveItems([]);
    setConfirmDelOpen(false);
    setFoodsOpen(false);
    setFoodRows([]);
    setAddFoodName("");
    setConfirmFoodDelete(null);
  }

  async function onPrint(o: OrderRow) {
    try {
      let items: OrderItemRow[] = [];
      try {
        items = await fetchOrderItems(o.id);
      } catch {
        items = itemsMap[o.id] ?? [];
      }

      const html = buildReceiptHTML(o, items);
      const w = window.open("", "_blank", "width=520,height=720");
      if (!w) return;

      w.document.open();
      w.document.write(html);
      w.document.close();

      setTimeout(() => {
        w.focus();
        w.print();
      }, 250);
    } catch (e: any) {
      alert(e?.message ?? "Tisk se nepovedl.");
    }
  }

  async function saveEdit() {
    if (!active || savingEdit) return;

    setSavingEdit(true);
    try {
      const patch: Partial<OrderRow> = {
        full_name: (eName ?? "").trim(),
        phone: (ePhone ?? "").trim(),
        address: (eAddress ?? "").trim(),
        note: (eNote ?? "").trim(),
        delivery_mode: (eDelivery ?? "delivery").toLowerCase(),
        packaging_mode: (ePackaging ?? "plastic").toLowerCase(),
        payment_method: (ePayment ?? "card_online").toLowerCase(),
      };

      const { error } = await supabase.from("orders").update(patch).eq("id", active.id);
      if (error) throw error;

      setOrders((prev) => prev.map((x) => (x.id === active.id ? { ...x, ...(patch as any) } : x)));
      setActive((prev) => (prev ? ({ ...prev, ...(patch as any) } as OrderRow) : prev));
      closeModal();
    } catch (e: any) {
      alert(e?.message ?? "Uložení se nepovedlo.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteOrderConfirmed() {
    if (!active || deleting) return;

    setDeleting(true);
    try {
      await supabase.from("order_items").delete().eq("order_id", active.id);

      const { error } = await supabase.from("orders").delete().eq("id", active.id);
      if (error) throw error;

      setOrders((prev) => prev.filter((x) => x.id !== active.id));
      setItemsMap((prev) => {
        const next = { ...prev };
        delete next[active.id];
        return next;
      });

      setConfirmDelOpen(false);
      closeModal();
    } catch (e: any) {
      alert(e?.message ?? "Smazání se nepovedlo.");
    } finally {
      setDeleting(false);
    }
  }

  function buildFoodRowsForOrder(o: OrderRow): { mode: FoodsMode; rows: FoodEditRow[] } {
    const items = itemsMap[o.id] ?? [];
    if (items.length > 0) {
      return {
        mode: "items",
        rows: items
          .map((it) => ({
            kind: "items" as const,
            id: it.id,
            name: (it.name ?? "").toString(),
          }))
          .filter((r) => r.name.trim().length > 0),
      };
    }

    const c = o.cart;
    if (Array.isArray(c)) {
      const rows: FoodEditRow[] = c
        .map((x: CartLine, idx: number) => {
          const nm = (x?.name ?? x?.nazev ?? "").toString();
          return { kind: "cart" as const, idx, name: nm };
        })
        .filter((r: { name: string }) => r.name.trim().length > 0);

      return { mode: "cart", rows };
    }

    if (c && typeof c === "object" && Array.isArray(c.items)) {
      const rows: FoodEditRow[] = c.items
        .map((x: CartLine, idx: number) => {
          const nm = (x?.name ?? x?.nazev ?? "").toString();
          return { kind: "cart" as const, idx, name: nm };
        })
        .filter((r: { name: string }) => r.name.trim().length > 0);

      return { mode: "cart", rows };
    }

    return { mode: "items", rows: [] };
  }

  function openFoodsModal() {
    if (!active) return;
    const built = buildFoodRowsForOrder(active);
    setFoodsMode(built.mode);
    setFoodRows(built.rows);
    setAddFoodName("");
    setConfirmFoodDelete(null);
    setFoodsOpen(true);
  }

  function closeFoodsModal() {
    if (foodsSaving) return;
    setFoodsOpen(false);
    setConfirmFoodDelete(null);
  }

  async function persistFoodRename(row: FoodEditRow, newName: string) {
    const nm = (newName ?? "").toString().trim();
    if (!active) return;

    if (row.kind === "items") {
      const { error } = await supabase.from("order_items").update({ name: nm }).eq("id", row.id);
      if (error) throw error;

      setItemsMap((prev) => {
        const next = { ...prev };
        next[active.id] = (next[active.id] ?? []).map((it) => (it.id === row.id ? { ...it, name: nm } : it));
        return next;
      });
      setActiveItems((prev) => prev.map((it) => (it.id === row.id ? { ...it, name: nm } : it)));
      return;
    }

    let c: any[] = [];
    if (Array.isArray(active.cart)) c = [...active.cart];
    else if (active.cart && typeof active.cart === "object" && Array.isArray(active.cart.items)) {
      c = [...active.cart.items];
    }

    if (row.idx >= 0 && row.idx < c.length) {
      c[row.idx] = { ...(c[row.idx] ?? {}), name: nm };

      const nextCart = Array.isArray(active.cart) ? c : { ...(active.cart ?? {}), items: c };

      const { error } = await supabase.from("orders").update({ cart: nextCart }).eq("id", active.id);
      if (error) throw error;

      setActive((prev) => (prev ? ({ ...prev, cart: nextCart } as OrderRow) : prev));
      setOrders((prev) => prev.map((x) => (x.id === active.id ? ({ ...x, cart: nextCart } as any) : x)));
    }
  }

  async function addFoodToOrder(name: string) {
    const nm = (name ?? "").trim();
    if (!active || !nm) return;

    if (foodsMode === "items") {
      const payload = {
        order_id: active.id,
        datum: null,
        jidlo_id: null,
        name: nm,
        unit_price: 0,
        qty: 1,
        line_total: 0,
      };

      const { data, error } = await supabase
        .from("order_items")
        .insert(payload)
        .select("id, order_id, datum, jidlo_id, name, unit_price, qty, line_total")
        .single();

      if (error) throw error;

      const inserted = data as OrderItemRow;

      setItemsMap((prev) => {
        const next = { ...prev };
        next[active.id] = [...(next[active.id] ?? []), inserted];
        return next;
      });
      setActiveItems((prev) => [...prev, inserted]);
      setFoodRows((prev) => [...prev, { kind: "items", id: inserted.id, name: nm }]);
      return;
    }

    let c: any[] = [];
    if (Array.isArray(active.cart)) c = [...active.cart];
    else if (active.cart && typeof active.cart === "object" && Array.isArray(active.cart.items)) {
      c = [...active.cart.items];
    }

    c.push({ name: nm, qty: 1, unit_price: 0, line_total: 0 });
    const nextCart = Array.isArray(active.cart) ? c : { ...(active.cart ?? {}), items: c };

    const { error } = await supabase.from("orders").update({ cart: nextCart }).eq("id", active.id);
    if (error) throw error;

    setActive((prev) => (prev ? ({ ...prev, cart: nextCart } as OrderRow) : prev));
    setOrders((prev) => prev.map((x) => (x.id === active.id ? ({ ...x, cart: nextCart } as any) : x)));
    setFoodRows((prev) => [...prev, { kind: "cart", idx: c.length - 1, name: nm }]);
  }

  async function deleteFoodFromOrder(row: FoodEditRow) {
    if (!active) return;

    if (row.kind === "items") {
      const { error } = await supabase.from("order_items").delete().eq("id", row.id);
      if (error) throw error;

      setItemsMap((prev) => {
        const next = { ...prev };
        next[active.id] = (next[active.id] ?? []).filter((it) => it.id !== row.id);
        return next;
      });
      setActiveItems((prev) => prev.filter((it) => it.id !== row.id));
      setFoodRows((prev) => prev.filter((r) => !(r.kind === "items" && r.id === row.id)));
      return;
    }

    let c: any[] = [];
    if (Array.isArray(active.cart)) c = [...active.cart];
    else if (active.cart && typeof active.cart === "object" && Array.isArray(active.cart.items)) {
      c = [...active.cart.items];
    }

    if (row.idx < 0 || row.idx >= c.length) return;

    c.splice(row.idx, 1);
    const nextCart = Array.isArray(active.cart) ? c : { ...(active.cart ?? {}), items: c };

    const { error } = await supabase.from("orders").update({ cart: nextCart }).eq("id", active.id);
    if (error) throw error;

    setActive((prev) => (prev ? ({ ...prev, cart: nextCart } as OrderRow) : prev));
    setOrders((prev) => prev.map((x) => (x.id === active.id ? ({ ...x, cart: nextCart } as any) : x)));

    setFoodRows(() => {
      return c
        .map((x: CartLine, idx: number) => ({
          kind: "cart" as const,
          idx,
          name: (x?.name ?? x?.nazev ?? "").toString(),
        }))
        .filter((r: { name: string }) => r.name.trim().length > 0);
    });
  }

  const props: ViewProps = {
    loading,
    err,
    orders,
    filteredOrders,
    filter,
    setFilter,
    newCount,
    deliveryCount,
    pickupCount,
    allCount,

    open,
    active,
    activeItems,
    activeLoading,

    savingEdit,
    confirmDelOpen,
    deleting,

    foodsOpen,
    foodsMode,
    foodRows,
    foodsSaving,
    addFoodName,
    setAddFoodName,
    confirmFoodDelete,

    eName,
    setEName,
    ePhone,
    setEPhone,
    eAddress,
    setEAddress,
    eNote,
    setENote,
    eDelivery,
    setEDelivery,
    ePackaging,
    setEPackaging,
    ePayment,
    setEPayment,

    load,
    openModal,
    closeModal,
    onPrint,
    saveEdit,
    deleteOrderConfirmed,

    getFoodsFromOrder,
    getQtyFromOrder,

    openFoodsModal,
    closeFoodsModal,

    setFoodRows,
    setConfirmDelOpen,
    setConfirmFoodDelete,

    persistFoodRename,
    addFoodToOrder,
    deleteFoodFromOrder,
  };

  return isMobile ? <MobileView {...props} /> : <DesktopView {...props} />;
}
