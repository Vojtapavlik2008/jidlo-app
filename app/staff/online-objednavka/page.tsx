"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

/* ===================== Inline icons ===================== */
function IconPencil({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPrinter({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9V3h12v6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M6 18h12v3H6v-3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path
        d="M6 14H5a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3h-1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M8 13h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconRefresh({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M21 3v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconX({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconTrash({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 6V4h8v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 6l1 16h10l1-16" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconChevronDown({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ===================== Types ===================== */
type OrderRow = {
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
};

type OrderItemRow = {
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
  jidlo_id?: string;
};

type FilterMode = "delivery" | "pickup" | "all";
type FoodsMode = "items" | "cart";

type FoodEditRow =
  | { kind: "items"; id: string; name: string }
  | { kind: "cart"; idx: number; name: string };

/* ===================== Helpers ===================== */
function czDateTime(ts: string) {
  try {
    return new Date(ts).toLocaleString("cs-CZ");
  } catch {
    return ts;
  }
}

function pillBase(cls = "") {
  return `inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold ring-1 ${cls}`;
}

function statusPill(status: string) {
  const s = (status ?? "").toLowerCase();
  if (s === "new") return pillBase("bg-amber-50 text-amber-800 ring-amber-200/70");
  if (s === "done" || s === "completed") return pillBase("bg-green-50 text-green-800 ring-green-200/70");
  if (s === "canceled" || s === "cancelled") return pillBase("bg-red-50 text-red-700 ring-red-200/70");
  return pillBase("bg-gray-50 text-gray-700 ring-gray-200/70");
}

function prettyDelivery(x: string) {
  const s = (x ?? "").toLowerCase();
  if (s === "delivery") return "Doručení";
  if (s === "pickup") return "Osobní odběr";
  return x;
}

function prettyPackaging(x: string) {
  const s = (x ?? "").toLowerCase();
  if (s === "plastic") return "Plast";
  if (s === "rekrabicka") return "REkrabička";
  if (s === "own") return "Jídlonosič";
  return x;
}

function prettyPayment(x: string) {
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

function FieldSelect({
  label,
  value,
  onChange,
  options,
  fieldClassName,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  fieldClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? "";

  return (
    <div className="relative">
      <div className="text-xs font-extrabold text-gray-600 tracking-wide">{label}</div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          fieldClassName,
          "mt-2 flex items-center justify-between gap-3 text-left",
          "hover:bg-green-50 hover:ring-green-300 transition",
        ].join(" ")}
      >
        <span className="truncate">{current}</span>
        <IconChevronDown className={["h-5 w-5 text-green-700 transition", open ? "rotate-180" : ""].join(" ")} />
      </button>

      {open ? (
        <>
          <button type="button" className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-label="close" />
          <div className="absolute z-50 bottom-full mb-2 w-full overflow-hidden rounded-2xl bg-white ring-1 ring-black/10 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
            <div className="p-2">
              {options.map((o) => {
                const active = o.value === value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={[
                      "w-full text-left rounded-xl px-4 py-2.5 text-sm font-extrabold transition",
                      active ? "bg-green-600 text-white" : "bg-white text-gray-900 hover:bg-green-50",
                    ].join(" ")}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ===================== Page ===================== */
export default function StaffOnlineOrdersPage() {
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
            `${o.id}|${o.created_at}|${o.status}|${o.total}|${o.payment_method}|${o.delivery_mode}|${o.packaging_mode}`
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const newCount = useMemo(
    () => orders.filter((o) => (o.status ?? "").toLowerCase() === "new").length,
    [orders]
  );

  const deliveryCount = useMemo(
    () => orders.filter((o) => (o.delivery_mode ?? "").toLowerCase() === "delivery").length,
    [orders]
  );

  const pickupCount = useMemo(
    () => orders.filter((o) => (o.delivery_mode ?? "").toLowerCase() === "pickup").length,
    [orders]
  );

  const allCount = useMemo(() => orders.length, [orders]);

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
        .filter((r) => r.name.trim().length > 0);

      return { mode: "cart", rows };
    }

    if (c && typeof c === "object" && Array.isArray(c.items)) {
      const rows: FoodEditRow[] = c.items
        .map((x: CartLine, idx: number) => {
          const nm = (x?.name ?? x?.nazev ?? "").toString();
          return { kind: "cart" as const, idx, name: nm };
        })
        .filter((r) => r.name.trim().length > 0);

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
        .filter((r) => r.name.trim().length > 0);
    });
  }

  /* ===================== Styles ===================== */
  const page = "max-w-6xl mx-auto px-6 py-8";
  const headerBtn =
    "rounded-full border px-4 py-2 text-sm font-extrabold hover:bg-green-50 inline-flex items-center gap-2";

  const card =
    "rounded-3xl border border-green-200/90 bg-white p-4 shadow-[0_12px_30px_rgba(0,0,0,0.05)]";

  const row =
    "grid grid-cols-12 gap-4 items-center rounded-2xl bg-green-50/50 ring-1 ring-green-200/80 px-5 py-4 transition hover:bg-green-50/80 hover:ring-green-300/90 cursor-pointer";

  const colFoods = "col-span-12 md:col-span-4 min-w-0";
  const colDetails = "col-span-12 md:col-span-4 min-w-0";
  const colPrice = "col-span-12 md:col-span-2 justify-self-end text-right";
  const colPencil = "col-span-6 md:col-span-1 justify-self-end";
  const colPrint = "col-span-6 md:col-span-1 justify-self-end";

  const foodLine = "text-[18px] font-bold tracking-tight text-green-900";
  const detailsName = "text-[18px] font-bold tracking-tight text-gray-900";
  const detailsSub = "mt-1 text-[16px] font-semibold text-gray-800";
  const detailsSub2 = "mt-1 text-[14px] font-medium text-gray-600";

  const pricePill =
    "inline-flex items-center rounded-full bg-white ring-2 ring-green-600/25 px-4 py-2 text-sm font-extrabold text-green-700";

  const pencilBtn =
    "h-11 w-11 rounded-full bg-white ring-1 ring-green-200/90 hover:bg-green-50 text-green-700 inline-flex items-center justify-center";
  const printBtn =
    "h-11 w-14 rounded-full bg-green-600 ring-1 ring-green-600 hover:bg-green-700 text-white inline-flex items-center justify-center";

  const modalBox =
    "fixed left-1/2 top-1/2 z-50 w-[860px] max-w-[calc(100vw-28px)] max-h-[calc(100vh-28px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white ring-1 ring-black/10 shadow-[0_34px_110px_rgba(0,0,0,0.26)] overflow-hidden";
  const modalInner = "p-6 md:p-7 overflow-auto max-h-[calc(100vh-28px)]";

  const field =
    "w-full rounded-2xl bg-white ring-1 ring-black/10 px-4 py-3 text-[15px] font-semibold text-gray-900 outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-green-600/25";

  const miniBtn = "rounded-full border px-4 py-2 text-sm font-extrabold hover:bg-gray-50";
  const primaryBtn =
    "rounded-full bg-green-600 px-5 py-2 text-sm font-extrabold text-white hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed";

  const sectionCard = "rounded-3xl bg-green-50/50 ring-1 ring-green-200/80 p-4 relative";
  const sectionTitle = "text-sm font-extrabold text-green-800";
  const sectionHint = "text-xs font-semibold text-gray-600";

  const dangerAction =
    "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-extrabold text-red-700 hover:bg-red-50 ring-1 ring-transparent hover:ring-red-200 transition";

  const confirmBox =
    "fixed left-1/2 top-1/2 z-[60] w-[520px] max-w-[calc(100vw-28px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white ring-1 ring-black/10 shadow-[0_34px_110px_rgba(0,0,0,0.28)] p-5";

  const filterWrap =
    "mt-5 rounded-3xl bg-white ring-1 ring-black/10 p-3 shadow-[0_10px_28px_rgba(0,0,0,0.04)]";

  const countBadge =
    "inline-flex items-center justify-center min-w-[26px] h-[26px] px-2 rounded-full bg-green-700 text-white text-xs font-extrabold";

  const filterBtn = (active: boolean) =>
    [
      "rounded-2xl px-4 py-3 text-sm font-extrabold transition w-full",
      "inline-flex items-center justify-center gap-3",
      active
        ? "bg-green-600 text-white shadow-[0_14px_30px_rgba(22,101,52,0.18)]"
        : "bg-green-50/60 text-green-900 ring-1 ring-green-200 hover:bg-green-50 hover:ring-green-300",
    ].join(" ");

  const foodsBox =
    "fixed left-1/2 top-1/2 z-[70] w-[720px] max-w-[calc(100vw-28px)] max-h-[calc(100vh-28px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white ring-1 ring-black/10 shadow-[0_34px_110px_rgba(0,0,0,0.28)] overflow-hidden";
  const foodsInner = "p-5 md:p-6 overflow-auto max-h-[calc(100vh-28px)]";

  return (
    <div className={page}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-3xl font-bold tracking-tight text-gray-900">Online objednávky</div>
          <div className="mt-1 text-sm text-gray-600 font-semibold">
            Nové: <span className="text-gray-900">{newCount}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={() => load(true)} className={headerBtn}>
            <IconRefresh className="h-4 w-4" />
            Obnovit
          </button>
          <Link href="/staff" className={headerBtn}>
            Zpět →
          </Link>
        </div>
      </div>

      <div className={filterWrap}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button type="button" className={filterBtn(filter === "delivery")} onClick={() => setFilter("delivery")}>
            <span>Doručení</span>
            <span className={countBadge}>{deliveryCount}</span>
          </button>
          <button type="button" className={filterBtn(filter === "pickup")} onClick={() => setFilter("pickup")}>
            <span>Osobní odběr</span>
            <span className={countBadge}>{pickupCount}</span>
          </button>
          <button type="button" className={filterBtn(filter === "all")} onClick={() => setFilter("all")}>
            <span>Všechny objednávky</span>
            <span className={countBadge}>{allCount}</span>
          </button>
        </div>
      </div>

      {err ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {String(err).toLowerCase().includes("jwt expired")
            ? "Přihlášení vypršelo. Obnov stránku nebo se přihlas znovu."
            : err}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-8 text-sm font-semibold text-gray-600">Načítám…</div>
      ) : filteredOrders.length === 0 ? (
        <div className="mt-8 text-sm font-semibold text-gray-600">Tady zatím nic není.</div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4">
          {filteredOrders.map((o) => {
            const foods = getFoodsFromOrder(o);
            const showFoods = foods.slice(0, 2);
            const hasMore = foods.length > 2;

            return (
              <div key={o.id} className={card}>
                <div
                  role="button"
                  tabIndex={0}
                  className={row}
                  onClick={() => openModal(o)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") openModal(o);
                  }}
                  title="Upravit objednávku"
                >
                  <div className={colFoods}>
                    {showFoods.length === 0 ? (
                      <div className={foodLine}>(bez položek)</div>
                    ) : (
                      <ul className="mt-2 space-y-1">
                        {showFoods.map((n, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="mt-[8px] h-2.5 w-2.5 rounded-full bg-green-600 shrink-0" />
                            <span className={foodLine}>{n}</span>
                          </li>
                        ))}
                        {hasMore ? (
                          <li className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-green-600 shrink-0" />
                            <span className="text-base font-bold text-green-800">…</span>
                          </li>
                        ) : null}
                      </ul>
                    )}
                  </div>

                  <div className={colDetails}>
                    <div className={detailsName}>{o.full_name}</div>
                    <div className={detailsSub}>{o.address}</div>
                    <div className={detailsSub2}>
                      {o.phone} • {prettyDelivery(o.delivery_mode)} • {prettyPackaging(o.packaging_mode)}
                    </div>
                  </div>

                  <div className={colPrice}>
                    <div className={pricePill}>
                      {o.total} Kč <span className="ml-2 text-gray-600 font-extrabold">{getQtyFromOrder(o)} ks</span>
                    </div>
                    <div className="mt-2">
                      <span className={pillBase("bg-green-50 text-green-800 ring-green-200/80")}>
                        {prettyPayment(o.payment_method)}
                      </span>
                    </div>
                  </div>

                  <div className={colPencil}>
                    <button
                      type="button"
                      className={pencilBtn}
                      title="Upravit"
                      aria-label="Upravit"
                      onClick={(e) => {
                        e.stopPropagation();
                        openModal(o);
                      }}
                    >
                      <IconPencil className="h-4 w-4" />
                    </button>
                  </div>

                  <div className={colPrint}>
                    <button
                      type="button"
                      className={printBtn}
                      title="Tisk"
                      aria-label="Tisk"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPrint(o);
                      }}
                    >
                      <IconPrinter className="h-6 w-6" />
                    </button>
                  </div>
                </div>

                {o.note ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={pillBase("bg-green-50 text-green-800 ring-green-200/80")}>
                      Poznámka: <span className="ml-2 font-semibold">{o.note}</span>
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {open && active ? (
        <>
          <button type="button" className="fixed inset-0 z-40 bg-black/30" onClick={closeModal} aria-label="close" />

          <div className={modalBox}>
            <div className={modalInner}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="truncate text-[22px] font-extrabold tracking-tight text-gray-900">
                      {active.full_name}
                    </div>
                    <span className={statusPill((active.status ?? "").toLowerCase())}>
                      {(active.status ?? "new").toLowerCase() === "new"
                        ? "Nová"
                        : (active.status ?? "").toUpperCase()}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-gray-600">{czDateTime(active.created_at)}</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex h-10 w-12 items-center justify-center rounded-full bg-green-600 text-white ring-1 ring-green-600 hover:bg-green-700"
                    onClick={() => onPrint(active)}
                    title="Tisk"
                  >
                    <IconPrinter className="h-6 w-6" />
                  </button>

                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-black/10 hover:bg-black/5"
                    onClick={closeModal}
                    title="Zavřít"
                  >
                    <IconX className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                <div className={sectionCard}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className={sectionTitle}>Jídla</div>
                      <div className={"mt-1 " + sectionHint}>Rychlý přehled položek v objednávce.</div>
                    </div>

                    <span className={pillBase("bg-white text-gray-900 ring-black/10")}>
                      Celkem: <span className="ml-2 font-extrabold text-green-700">{active.total} Kč</span>
                      <span className="ml-3 font-extrabold text-gray-600">{getQtyFromOrder(active)} ks</span>
                    </span>
                  </div>

                  {activeLoading ? (
                    <div className="mt-3 text-sm font-semibold text-gray-600">Načítám položky…</div>
                  ) : (() => {
                      const foods = getFoodsFromOrder(active);
                      const show = foods.slice(0, 20);
                      const more = foods.length > 20;
                      if (show.length === 0) {
                        return <div className="mt-3 text-sm font-semibold text-gray-600">(Položky nejsou uložené)</div>;
                      }
                      return (
                        <ul className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1 md:grid-cols-2">
                          {show.map((n, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="mt-[7px] h-2.5 w-2.5 shrink-0 rounded-full bg-green-600" />
                              <span className="leading-snug text-[16px] font-extrabold text-green-900">{n}</span>
                            </li>
                          ))}
                          {more ? (
                            <li className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-600" />
                              <span className="text-sm font-extrabold text-green-800">…</span>
                            </li>
                          ) : null}
                        </ul>
                      );
                    })()}

                  <button
                    type="button"
                    className="absolute bottom-3 right-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-green-700 ring-1 ring-green-200/90 hover:bg-green-50"
                    onClick={openFoodsModal}
                    title="Upravit jídla"
                  >
                    <IconPencil className="h-4 w-4" />
                  </button>
                </div>

                <div className={sectionCard}>
                  <div className="mt-1 text-sm font-extrabold text-green-800">Údaje</div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div>
                      <div className="text-xs font-extrabold tracking-wide text-gray-600">Jméno</div>
                      <input className={field} value={eName} onChange={(e) => setEName(e.target.value)} />
                    </div>

                    <div>
                      <div className="text-xs font-extrabold tracking-wide text-gray-600">Telefon</div>
                      <input className={field} value={ePhone} onChange={(e) => setEPhone(e.target.value)} />
                    </div>

                    <div>
                      <div className="text-xs font-extrabold tracking-wide text-gray-600">Adresa</div>
                      <input className={field} value={eAddress} onChange={(e) => setEAddress(e.target.value)} />
                    </div>

                    <div className="md:col-span-3">
                      <div className="text-xs font-extrabold tracking-wide text-gray-600">Poznámka</div>
                      <textarea
                        className={field + " min-h-[64px] resize-none"}
                        value={eNote}
                        onChange={(e) => setENote(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <FieldSelect
                      label="Převzetí"
                      value={eDelivery}
                      onChange={setEDelivery}
                      fieldClassName={field}
                      options={[
                        { value: "delivery", label: "Doručení" },
                        { value: "pickup", label: "Osobní odběr" },
                      ]}
                    />

                    <FieldSelect
                      label="Balení"
                      value={ePackaging}
                      onChange={setEPackaging}
                      fieldClassName={field}
                      options={[
                        { value: "plastic", label: "Plast" },
                        { value: "rekrabicka", label: "REkrabička" },
                        { value: "own", label: "Jídlonosič" },
                      ]}
                    />

                    <FieldSelect
                      label="Platba"
                      value={ePayment}
                      onChange={setEPayment}
                      fieldClassName={field}
                      options={[
                        { value: "card_online", label: "Kartou online" },
                        { value: "card_delivery", label: "Kartou při převzetí" },
                        { value: "cash", label: "Hotově při převzetí" },
                        { value: "credit", label: "Kredit" },
                        { value: "online", label: "Online" },
                        { value: "invoice", label: "Fakturou" },
                        { value: "menu_order", label: "Objednávka z jídelníčku" },
                      ]}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    className={dangerAction}
                    disabled={savingEdit || deleting || foodsSaving}
                    onClick={() => setConfirmDelOpen(true)}
                    title="Smazat objednávku"
                  >
                    <IconTrash className="h-5 w-5" />
                    <span>Smazat</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={miniBtn}
                      disabled={savingEdit || deleting || foodsSaving}
                      onClick={closeModal}
                    >
                      Zpět
                    </button>
                    <button
                      type="button"
                      className={primaryBtn}
                      disabled={savingEdit || deleting || foodsSaving}
                      onClick={saveEdit}
                    >
                      {savingEdit ? "Ukládám…" : "Uložit"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {foodsOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-[65] bg-black/35"
                onClick={closeFoodsModal}
                aria-label="close-foods"
              />
              <div className={foodsBox}>
                <div className={foodsInner}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-extrabold text-gray-900">Úprava jídel v objednávce</div>
                      <div className="mt-1 text-sm font-semibold text-gray-600">
                        Změny se projeví jen v této objednávce.
                      </div>
                    </div>

                    <button
                      type="button"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-black/10 hover:bg-black/5"
                      onClick={closeFoodsModal}
                      title="Zavřít"
                    >
                      <IconX className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="mt-4 rounded-3xl bg-green-50/50 p-4 ring-1 ring-green-200/80">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-extrabold text-green-800">Jídla</div>
                      <span className={pillBase("bg-white text-gray-900 ring-black/10")}>
                        Celkem: <span className="ml-2 font-extrabold text-green-700">{active.total} Kč</span>
                        <span className="ml-3 font-extrabold text-gray-600">{getQtyFromOrder(active)} ks</span>
                      </span>
                    </div>

                    {foodRows.length === 0 ? (
                      <div className="mt-3 text-sm font-semibold text-gray-600">(Tady zatím žádná jídla nejsou.)</div>
                    ) : (
                      <div className="mt-3 grid gap-2">
                        {foodRows.map((r, idx) => (
                          <div key={r.kind === "items" ? r.id : `cart-${r.idx}`} className="flex items-center gap-2">
                            <input
                              className={field + " py-2.5"}
                              value={r.name}
                              onChange={(e) => {
                                const v = e.target.value;
                                setFoodRows((prev) =>
                                  prev.map((x) => {
                                    const same =
                                      (x.kind === "items" && r.kind === "items" && x.id === r.id) ||
                                      (x.kind === "cart" && r.kind === "cart" && x.idx === r.idx);
                                    return same ? ({ ...x, name: v } as any) : x;
                                  })
                                );
                              }}
                              onBlur={async () => {
                                try {
                                  setFoodsSaving(true);
                                  const current = foodRows[idx];
                                  if (!current) return;
                                  const nm = current.name.trim();
                                  await persistFoodRename(current, nm);
                                } catch (e: any) {
                                  alert(e?.message ?? "Uložení názvu se nepovedlo.");
                                } finally {
                                  setFoodsSaving(false);
                                }
                              }}
                            />

                            <button
                              type="button"
                              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-50"
                              title="Smazat jídlo"
                              onClick={() => setConfirmFoodDelete(r)}
                              disabled={foodsSaving}
                            >
                              <IconX className="h-5 w-5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 flex items-center gap-2">
                      <input
                        className={field + " py-2.5"}
                        placeholder="Přidat jídlo…"
                        value={addFoodName}
                        onChange={(e) => setAddFoodName(e.target.value)}
                      />
                      <button
                        type="button"
                        className={primaryBtn}
                        disabled={foodsSaving || !addFoodName.trim()}
                        onClick={async () => {
                          try {
                            setFoodsSaving(true);
                            await addFoodToOrder(addFoodName);
                            setAddFoodName("");
                          } catch (e: any) {
                            alert(e?.message ?? "Přidání jídla se nepovedlo.");
                          } finally {
                            setFoodsSaving(false);
                          }
                        }}
                      >
                        Přidat
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end gap-2">
                    <button type="button" className={miniBtn} onClick={closeFoodsModal} disabled={foodsSaving}>
                      Zavřít
                    </button>
                  </div>
                </div>
              </div>

              {confirmFoodDelete ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-[75] bg-black/35"
                    onClick={() => (!foodsSaving ? setConfirmFoodDelete(null) : null)}
                    aria-label="close-confirm-food"
                  />
                  <div className={confirmBox + " z-[80]"}>
                    <div className="text-lg font-extrabold text-gray-900">Opravdu chcete smazat jídlo?</div>
                    <div className="mt-2 text-sm font-semibold text-gray-600">
                      Tato akce je nevratná (pro tuto objednávku).
                    </div>

                    <div className="mt-5 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className={miniBtn}
                        disabled={foodsSaving}
                        onClick={() => setConfirmFoodDelete(null)}
                      >
                        Zrušit
                      </button>
                      <button
                        type="button"
                        className="rounded-full bg-red-600 px-5 py-2 text-sm font-extrabold text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={foodsSaving}
                        onClick={async () => {
                          try {
                            setFoodsSaving(true);
                            const r = confirmFoodDelete;
                            setConfirmFoodDelete(null);
                            await deleteFoodFromOrder(r);
                          } catch (e: any) {
                            alert(e?.message ?? "Smazání jídla se nepovedlo.");
                          } finally {
                            setFoodsSaving(false);
                          }
                        }}
                      >
                        Smazat
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </>
          ) : null}

          {confirmDelOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-[55] bg-black/35"
                onClick={() => (!deleting ? setConfirmDelOpen(false) : null)}
                aria-label="close-confirm"
              />
              <div className={confirmBox}>
                <div className="text-lg font-extrabold text-gray-900">Opravdu chcete smazat objednávku?</div>
                <div className="mt-2 text-sm font-semibold text-gray-600">
                  Tato akce je nevratná. Objednávka zmizí ze seznamu.
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className={miniBtn}
                    disabled={deleting}
                    onClick={() => setConfirmDelOpen(false)}
                  >
                    Zrušit
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-red-600 px-5 py-2 text-sm font-extrabold text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={deleting}
                    onClick={deleteOrderConfirmed}
                  >
                    {deleting ? "Mažu…" : "Smazat"}
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}