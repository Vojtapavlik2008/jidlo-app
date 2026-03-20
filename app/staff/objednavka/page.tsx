"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "tady" | "sebou";
type DeliveryChoice = "ano" | "ne";
type PackagingChoice = "plast" | "rekrabicka";

type TodayItem = {
  id: string;
  category: string;
  name: string;
  price: number;
};

type EditableItem = TodayItem & {
  hidden?: boolean;
  added?: boolean;
};

type KeypadTarget = {
  itemId: string;
  current: number | null;
};

type PaymentMethod = "cash" | "card" | "credit";

type CustomerRow = {
  id: string;
  full_name: string | null;
  kredit: number | null;
};

type StaffMenuDenRow = {
  datum: string;
  poradi: number;
  jidlo_id: string;
};

type StaffFoodRow = {
  id: string;
  legacy_id: number;
  nazev: string;
  cena: number | null;
  kategorie: string | null;
  aktivni: boolean | null;
};

type CheckoutLine = EditableItem & {
  q: number;
  unit: number;
  lineTotal: number;
};

type DayOverrides = {
  nameById: Record<string, string>;
  priceById: Record<string, number>;
  manualItems: EditableItem[];
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function czk(n: number) {
  return `${Math.round(n)} Kč`;
}

function isSoup(it: TodayItem) {
  const c = (it.category ?? "").toLowerCase();
  const n = (it.name ?? "").toLowerCase();
  return c.includes("polév") || n.includes("polév");
}

function toISODateLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromISOToLocalDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function addDaysISO(iso: string, days: number) {
  const d = fromISOToLocalDate(iso);
  d.setDate(d.getDate() + days);
  return toISODateLocal(d);
}

function getUiTodayISO() {
  const today = new Date();
  const iso = toISODateLocal(today);
  const day = today.getDay();
  if (day === 0) return addDaysISO(iso, 1);
  return iso;
}

function prettyDayLong(iso: string) {
  const d = fromISOToLocalDate(iso);
  const names = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];
  const wd = names[d.getDay()] ?? "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${wd} ${dd}. ${mm}.`;
}

function dayOverridesKey(dayIso: string) {
  return `pokladna-overrides-${dayIso}`;
}

function loadDayOverrides(dayIso: string): DayOverrides {
  if (typeof window === "undefined") {
    return { nameById: {}, priceById: {}, manualItems: [] };
  }

  try {
    const raw = window.localStorage.getItem(dayOverridesKey(dayIso));
    if (!raw) return { nameById: {}, priceById: {}, manualItems: [] };

    const parsed = JSON.parse(raw);
    return {
      nameById: parsed?.nameById ?? {},
      priceById: parsed?.priceById ?? {},
      manualItems: parsed?.manualItems ?? [],
    };
  } catch {
    return { nameById: {}, priceById: {}, manualItems: [] };
  }
}

function saveDayOverrides(dayIso: string, value: DayOverrides) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(dayOverridesKey(dayIso), JSON.stringify(value));
}

function applyOverrides(items: TodayItem[], overrides: DayOverrides): EditableItem[] {
  return items.map((it) => ({
    ...it,
    name: overrides.nameById[it.id] ?? it.name,
    price: overrides.priceById[it.id] ?? it.price,
  }));
}

async function fetchMenuForDay(dayIso: string): Promise<TodayItem[]> {
  const qs = new URLSearchParams({ from: dayIso, to: dayIso });
  const menuRes = await fetch(`/api/staff/menu-den?${qs.toString()}`, { cache: "no-store" });
  const menuJson = await menuRes.json().catch(() => ({}));

  if (!menuRes.ok) {
    throw new Error(menuJson?.error || "Nepodařilo se načíst menu_den.");
  }

  const menuRows = (menuJson?.data ?? []) as StaffMenuDenRow[];
  if (!menuRows.length) return [];

  const foodsRes = await fetch("/api/staff/jidla", { cache: "no-store" });
  const foodsJson = await foodsRes.json().catch(() => ({}));

  if (!foodsRes.ok) {
    throw new Error(foodsJson?.error || "Nepodařilo se načíst jídla.");
  }

  const foods = (foodsJson?.data ?? []) as StaffFoodRow[];
  const byId = new Map<string, StaffFoodRow>();
  for (const f of foods) byId.set(f.id, f);

  return menuRows
    .sort((a, b) => a.poradi - b.poradi)
    .map((row) => {
      const food = byId.get(row.jidlo_id);
      if (!food || food.aktivni === false) return null;

      return {
        id: food.id,
        category: food.kategorie ?? "",
        name: food.nazev ?? "",
        price: Number(food.cena ?? 0),
      } satisfies TodayItem;
    })
    .filter(Boolean) as TodayItem[];
}

async function fetchAllFoods(): Promise<StaffFoodRow[]> {
  const res = await fetch("/api/staff/jidla", { cache: "no-store" });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json?.error || "Nepodařilo se načíst jídla.");
  }

  return ((json?.data ?? []) as StaffFoodRow[]).filter((x) => x.aktivni !== false);
}

async function fetchCustomers(q: string): Promise<CustomerRow[]> {
  const qs = new URLSearchParams();
  if (q.trim()) qs.set("q", q.trim());

  const r = await fetch(`/api/staff/customers?${qs.toString()}`, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || "Nepodařilo se načíst zákazníky.");
  return (j?.data ?? []) as CustomerRow[];
}

export default function PokladnaPage() {
  const router = useRouter();

  const todayISO = useMemo(() => getUiTodayISO(), []);
  const todayLabel = useMemo(() => prettyDayLong(todayISO), [todayISO]);

  const [mode, setMode] = useState<Mode>("tady");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [specialPrice, setSpecialPrice] = useState<Record<string, number | null>>({});
  const [delivery, setDelivery] = useState<DeliveryChoice>("ne");
  const [packaging, setPackaging] = useState<PackagingChoice>("plast");

  const [baseItems, setBaseItems] = useState<EditableItem[]>([]);
  const [localItems, setLocalItems] = useState<EditableItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);

  const [allFoods, setAllFoods] = useState<StaffFoodRow[]>([]);
  const [foodsLoaded, setFoodsLoaded] = useState(false);
  const [foodSearchQuery, setFoodSearchQuery] = useState("");
  const [foodSearchOpen, setFoodSearchOpen] = useState(false);

  const [manualFoodName, setManualFoodName] = useState("");
  const [manualFoodCategory, setManualFoodCategory] = useState("");
  const [manualFoodPrice, setManualFoodPrice] = useState("");

  const [keypadOpen, setKeypadOpen] = useState(false);
  const [keypad, setKeypad] = useState<{ target: KeypadTarget | null; value: string }>({
    target: null,
    value: "",
  });

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [savingOrder, setSavingOrder] = useState(false);

  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);

  const [creditTopupOpen, setCreditTopupOpen] = useState(false);
  const [creditTopupValue, setCreditTopupValue] = useState("");
  const [creditTopupSaving, setCreditTopupSaving] = useState(false);

  const REKRABICKA_DEPOSIT_PER_MAIN = 80;
  const REKRABICKA_SOUP_EXTRA = 7;

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoadingItems(true);
      setLoadErr(null);

      try {
        const items = await fetchMenuForDay(todayISO);
        if (!alive) return;

        const overrides = loadDayOverrides(todayISO);
        const next = applyOverrides(items, overrides);
        const merged = [...next, ...(overrides.manualItems ?? [])];

        setBaseItems(merged);
        setLocalItems(merged);
      } catch (e: any) {
        if (!alive) return;
        setLoadErr(e?.message ?? "Nepodařilo se načíst menu.");
        setBaseItems([]);
        setLocalItems([]);
      } finally {
        if (alive) setLoadingItems(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [todayISO]);

  useEffect(() => {
    const nameById: Record<string, string> = {};
    const priceById: Record<string, number> = {};

    for (const item of localItems) {
      nameById[item.id] = item.name;
      priceById[item.id] = item.price;
    }

    const manualItems = localItems.filter(
      (x) => x.id.startsWith("manual-") || x.id.startsWith("local-")
    );

    saveDayOverrides(todayISO, {
      nameById,
      priceById,
      manualItems,
    });
  }, [localItems, todayISO]);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      setCustomersLoading(true);
      try {
        const rows = await fetchCustomers(customerQuery);
        if (!alive) return;
        setCustomers(rows);
      } catch {
        if (!alive) return;
        setCustomers([]);
      } finally {
        if (alive) setCustomersLoading(false);
      }
    }, 200);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [customerQuery]);

  useEffect(() => {
    if (!editOpen || foodsLoaded) return;

    let alive = true;
    (async () => {
      try {
        const rows = await fetchAllFoods();
        if (!alive) return;
        setAllFoods(rows);
        setFoodsLoaded(true);
      } catch {
        if (!alive) return;
        setAllFoods([]);
        setFoodsLoaded(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, [editOpen, foodsLoaded]);

  const items = useMemo(() => localItems.filter((x) => !x.hidden), [localItems]);

  const lines = useMemo(() => {
    return items
      .map((it) => {
        const q = qty[it.id] ?? 0;
        if (q <= 0) return null;

        const rawUnit = specialPrice[it.id] ?? it.price;
        const unit = round2(Number(rawUnit ?? 0));
        if (!Number.isFinite(unit) || unit < 0) return null;

        return {
          ...it,
          q,
          unit,
          lineTotal: round2(unit * q),
        };
      })
      .filter(Boolean) as CheckoutLine[];
  }, [items, qty, specialPrice]);

  const packagingFee = useMemo(() => {
    if (mode !== "sebou") return 0;
    if (packaging !== "rekrabicka") return 0;

    const mainsCount = lines.reduce((s, it) => s + (isSoup(it) ? 0 : it.q), 0);
    const soupsCount = lines.reduce((s, it) => s + (isSoup(it) ? it.q : 0), 0);

    return round2(
      mainsCount * REKRABICKA_DEPOSIT_PER_MAIN + soupsCount * REKRABICKA_SOUP_EXTRA
    );
  }, [mode, packaging, lines]);

  const subtotal = useMemo(() => round2(lines.reduce((s, it) => s + it.lineTotal, 0)), [lines]);
  const total = useMemo(() => round2(subtotal + packagingFee), [subtotal, packagingFee]);
  const totalCount = useMemo(() => lines.reduce((s, x) => s + x.q, 0), [lines]);

  const selectedCustomerCredit = Number(selectedCustomer?.kredit ?? 0);
  const creditEnough = selectedCustomer ? selectedCustomerCredit >= total : false;

  const canConfirmPayment =
    total > 0 &&
    !savingOrder &&
    (paymentMethod === "cash" ||
      paymentMethod === "card" ||
      (paymentMethod === "credit" && !!selectedCustomer && creditEnough));

  const filteredFoods = useMemo(() => {
    const q = foodSearchQuery.trim().toLowerCase();
    if (!q) return [];

    const currentIds = new Set(localItems.map((x) => x.id));

    return allFoods
      .filter((f) => {
        if (currentIds.has(f.id)) return false;
        const legacy = String(f.legacy_id ?? "");
        const name = (f.nazev ?? "").toLowerCase();
        return legacy.includes(q) || name.includes(q);
      })
      .slice(0, 15);
  }, [foodSearchQuery, allFoods, localItems]);

  function setToOne(id: string) {
    setQty((p) => ({ ...p, [id]: 1 }));
  }

  function inc(id: string) {
    setQty((p) => ({ ...p, [id]: (p[id] ?? 0) + 1 }));
  }

  function dec(id: string) {
    setQty((p) => {
      const next = Math.max(0, (p[id] ?? 0) - 1);
      const copy = { ...p, [id]: next };
      if (next === 0) delete copy[id];
      return copy;
    });
  }

  function openKeypadFor(itemId: string) {
    const cur = specialPrice[itemId] ?? null;
    setKeypad({
      target: { itemId, current: cur },
      value: cur == null ? "" : String(cur),
    });
    setKeypadOpen(true);
  }

  function keypadPress(ch: string) {
    setKeypad((k) => {
      const v = k.value ?? "";
      if (ch === "C") return { ...k, value: "" };
      if (ch === "←") return { ...k, value: v.slice(0, -1) };
      if (!/^\d$/.test(ch)) return k;
      return { ...k, value: v === "0" ? ch : v + ch };
    });
  }

  function keypadApply() {
    const target = keypad.target;
    if (!target) return;

    const raw = keypad.value.trim();
    if (!raw) {
      setSpecialPrice((p) => ({ ...p, [target.itemId]: null }));
      setKeypadOpen(false);
      return;
    }

    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return;
    setSpecialPrice((p) => ({ ...p, [target.itemId]: Math.round(n) }));
    setKeypadOpen(false);
  }

  function topupKeypadPress(ch: string) {
    setCreditTopupValue((prev) => {
      const v = prev ?? "";
      if (ch === "C") return "";
      if (ch === "←") return v.slice(0, -1);
      if (!/^\d$/.test(ch)) return v;
      return v === "0" ? ch : v + ch;
    });
  }

  function resetOrder() {
    setQty({});
    setSpecialPrice({});
    setDelivery("ne");
    setPackaging("plast");
    setMode("tady");
    setPaymentMethod("cash");
    setSelectedCustomer(null);
    setCustomerPickerOpen(false);
    setPaymentOpen(false);
    setCreditTopupOpen(false);
    setCreditTopupValue("");
    setLocalItems(baseItems);
  }

  function renameLocalItem(id: string, name: string) {
    setLocalItems((prev) => prev.map((x) => (x.id === id ? { ...x, name } : x)));
  }

  function changeLocalPrice(id: string, raw: string) {
    const clean = raw.replace(/[^\d]/g, "");
    const num = clean === "" ? 0 : Number(clean);

    setLocalItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, price: Number.isFinite(num) ? num : 0 } : x))
    );
  }

  async function removeLocalItem(id: string) {
    if (id.startsWith("manual-") || id.startsWith("local-")) {
      setBaseItems((prev) => prev.filter((x) => x.id !== id));
      setLocalItems((prev) => prev.filter((x) => x.id !== id));

      setQty((p) => {
        const copy = { ...p };
        delete copy[id];
        return copy;
      });

      setSpecialPrice((p) => {
        const copy = { ...p };
        delete copy[id];
        return copy;
      });
      return;
    }

    try {
      const r = await fetch("/api/staff/menu-den-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jidlo_id: id,
          datum: todayISO,
        }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Nepodařilo se smazat jídlo.");

      setBaseItems((prev) => prev.filter((x) => x.id !== id));
      setLocalItems((prev) => prev.filter((x) => x.id !== id));

      setQty((p) => {
        const copy = { ...p };
        delete copy[id];
        return copy;
      });

      setSpecialPrice((p) => {
        const copy = { ...p };
        delete copy[id];
        return copy;
      });
    } catch (e: any) {
      alert(e?.message ?? "Nepodařilo se smazat jídlo.");
    }
  }

  async function addFoodFromDatabase(food: StaffFoodRow) {
    try {
      const r = await fetch("/api/staff/menu-den-add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jidlo_id: food.id,
          datum: todayISO,
        }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Nepodařilo se přidat jídlo.");

      const nextItem: EditableItem = {
        id: food.id,
        category: food.kategorie ?? "",
        name: food.nazev ?? "",
        price: Number(food.cena ?? 0),
      };

      setBaseItems((prev) => [...prev, nextItem]);
      setLocalItems((prev) => [...prev, nextItem]);
      setFoodSearchQuery("");
      setFoodSearchOpen(false);
    } catch (e: any) {
      alert(e?.message ?? "Nepodařilo se přidat jídlo.");
    }
  }

  function addManualFood() {
    const name = manualFoodName.trim();
    const category = manualFoodCategory.trim();
    const clean = manualFoodPrice.replace(/[^\d]/g, "");
    const price = clean ? Number(clean) : 0;

    if (!name) {
      alert("Zadej název jídla.");
      return;
    }

    const newItem: EditableItem = {
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      category: category || "Ostatní",
      price: Number.isFinite(price) ? price : 0,
      added: true,
    };

    setBaseItems((prev) => [...prev, newItem]);
    setLocalItems((prev) => [...prev, newItem]);

    setManualFoodName("");
    setManualFoodCategory("");
    setManualFoodPrice("");
  }

  async function confirmCreditTopup() {
    if (!selectedCustomer || creditTopupSaving) return;

    const amount = Number(creditTopupValue.trim());
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Zadej platnou částku.");
      return;
    }

    setCreditTopupSaving(true);
    try {
      const r = await fetch("/api/staff/customer-credit-topup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          amount,
        }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Nepodařilo se dobít kredit.");

      const newCredit = Number(j?.kredit ?? 0);

      setSelectedCustomer((prev) => (prev ? { ...prev, kredit: newCredit } : prev));

      setCustomers((prev) =>
        prev.map((c) => (c.id === selectedCustomer.id ? { ...c, kredit: newCredit } : c))
      );

      setCreditTopupValue("");
      setCreditTopupOpen(false);
    } catch (e: any) {
      alert(e?.message ?? "Nepodařilo se dobít kredit.");
    } finally {
      setCreditTopupSaving(false);
    }
  }

  async function confirmPayment() {
    if (!canConfirmPayment || savingOrder) return;

    setSavingOrder(true);
    try {
      const payload = {
        datum: todayISO,
        mode,
        delivery,
        packaging,
        paymentMethod,
        customerId: paymentMethod === "credit" ? selectedCustomer?.id ?? null : null,
        items: lines.map((it) => ({
          jidlo_id: it.id.startsWith("manual-") || it.id.startsWith("local-") ? null : it.id,
          name: it.name,
          category: it.category,
          unit_price: it.unit,
          qty: it.q,
          line_total: it.lineTotal,
        })),
      };

      const r = await fetch("/api/staff/pokladna-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Nepodařilo se uložit objednávku.");

      setPaymentOpen(false);
      alert(`Objednávka uložena ✅\nCelkem: ${czk(total)}`);
      resetOrder();
    } catch (e: any) {
      alert(e?.message ?? "Nepodařilo se uložit objednávku.");
    } finally {
      setSavingOrder(false);
    }
  }

  const shell = "min-h-screen bg-white";
  const wrap = "mx-auto w-full max-w-[1220px] px-3 sm:px-4 md:px-5 pt-3 pb-36";

  const topCard =
    "rounded-[24px] border border-[#bde7c8] bg-white p-4 shadow-[0_10px_26px_rgba(27,54,39,0.04)]";

  const whiteBtn =
    "rounded-full bg-white px-4 py-2 text-[13px] sm:text-[14px] font-extrabold text-gray-800 ring-1 ring-black/10 hover:bg-gray-50 transition";
  const greenBtn =
    "rounded-full bg-[#08a35c] px-4 py-2 text-[13px] sm:text-[14px] font-extrabold text-white shadow-sm hover:brightness-95 transition";

  const switchBtn = (active: boolean) =>
    [
      "flex-1 rounded-full px-4 py-3 text-[15px] sm:text-[16px] font-extrabold transition",
      active
        ? "bg-[#08a35c] text-white shadow-[0_6px_18px_rgba(8,163,92,0.18)]"
        : "bg-[#eef8f1] text-[#0d6b44] ring-1 ring-[#bde7c8] hover:bg-[#e4f4e8]",
    ].join(" ");

  const sectionCard =
    "mt-3 rounded-[20px] border border-[#bde7c8] bg-white px-4 py-3 shadow-[0_8px_20px_rgba(27,54,39,0.03)]";

  const miniLabel = "text-[13px] font-extrabold text-gray-900";
  const optionWrap = "flex items-center gap-2 flex-wrap";
  const smallBtn = (active: boolean) =>
    [
      "min-w-[80px] rounded-full px-3 py-2 text-[13px] font-extrabold transition",
      active ? "bg-[#08a35c] text-white" : "bg-white text-gray-900 ring-1 ring-black/10 hover:bg-gray-50",
    ].join(" ");

  const itemCard =
    "rounded-[22px] border border-[#bde7c8] bg-white px-4 py-4 shadow-[0_8px_22px_rgba(27,54,39,0.03)]";
  const itemCardActive = "bg-[#dff0e5] border-[#8ec8a1]";
  const itemName = "text-[16px] font-extrabold text-gray-900 leading-snug";
  const itemCategory = "mt-1 text-[12px] font-extrabold text-[#0b8b52]";
  const itemPrice = "text-[16px] font-extrabold text-[#0b7c4d]";
  const addFoodBtn =
    "rounded-full px-4 py-2 text-[13px] font-extrabold text-[#0b7c4d] ring-1 ring-[#78d3a0] bg-white hover:bg-[#f5fbf7] transition";
  const qtyWrap = "flex items-center gap-3";
  const qtyBtn =
    "h-10 w-10 rounded-[16px] bg-white text-[22px] font-extrabold text-[#0b7c4d] ring-1 ring-[#78d3a0] hover:bg-[#f5fbf7] transition";
  const qtyNum = "min-w-[18px] text-center text-[16px] font-extrabold text-gray-900";
  const specText =
    "text-[12px] sm:text-[13px] font-extrabold text-[#0b7c4d] hover:underline underline-offset-4 whitespace-nowrap";

  const bottomFixed = "fixed left-0 right-0 bottom-0 z-30 bg-white/95 backdrop-blur border-t border-black/5";
  const bottomInner = "mx-auto w-full max-w-[1220px] px-3 sm:px-4 md:px-5 pb-4 pt-3";
  const btnCancel =
    "flex-1 rounded-full bg-white px-4 py-3 text-[15px] sm:text-[16px] font-extrabold text-gray-900 ring-1 ring-black/10 hover:bg-gray-50 transition";
  const btnPay =
    "flex-1 rounded-full bg-[#08a35c] px-4 py-3 text-[15px] sm:text-[16px] font-extrabold text-white shadow-sm hover:brightness-95 transition disabled:opacity-40";

  const modalCard =
    "w-full max-w-[520px] rounded-[28px] bg-white p-4 sm:p-5 shadow-[0_22px_70px_rgba(0,0,0,0.2)] ring-1 ring-black/10";
  const modalBtn =
    "rounded-full bg-white px-4 py-2 text-[13px] sm:text-[14px] font-extrabold text-gray-800 ring-1 ring-black/10 hover:bg-gray-50";

  const payBig = (active: boolean) =>
    [
      "rounded-full px-4 py-3 text-[15px] sm:text-[16px] font-extrabold transition",
      active ? "bg-[#08a35c] text-white" : "bg-[#eef8f1] text-[#0d6b44] ring-1 ring-[#bde7c8] hover:bg-[#e4f4e8]",
    ].join(" ");

  const creditLink =
    "text-center text-[14px] font-extrabold text-[#0b7c4d] hover:underline underline-offset-4";

  return (
    <div className={shell}>
      <div className={wrap}>
        <div className={topCard}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-[24px] font-extrabold tracking-tight text-gray-900">Pokladna</div>
              <div className="mt-1 text-[14px] font-extrabold text-[#0b7c4d]">{todayLabel}</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={whiteBtn} onClick={() => setEditOpen(true)}>
                Upravit jídla
              </button>
              <button type="button" className={greenBtn} onClick={() => router.push("/staff")}>
                Rozcestník
              </button>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button type="button" className={switchBtn(mode === "tady")} onClick={() => setMode("tady")}>
              Tady
            </button>
            <button type="button" className={switchBtn(mode === "sebou")} onClick={() => setMode("sebou")}>
              Sebou
            </button>
          </div>
        </div>

        {mode === "sebou" && (
          <div className={sectionCard}>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <div className={miniLabel}>Doprava</div>
                <div className={optionWrap}>
                  <button type="button" className={smallBtn(delivery === "ano")} onClick={() => setDelivery("ano")}>
                    Ano
                  </button>
                  <button type="button" className={smallBtn(delivery === "ne")} onClick={() => setDelivery("ne")}>
                    Ne
                  </button>
                </div>
              </div>

              <div className="grid gap-2">
                <div className={miniLabel}>Balení</div>
                <div className={optionWrap}>
                  <button type="button" className={smallBtn(packaging === "plast")} onClick={() => setPackaging("plast")}>
                    Plast
                  </button>
                  <button
                    type="button"
                    className={smallBtn(packaging === "rekrabicka")}
                    onClick={() => setPackaging("rekrabicka")}
                  >
                    Rekr
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-3 grid gap-3">
          {loadingItems ? (
            <div className="rounded-[22px] border border-[#bde7c8] bg-white px-5 py-4 text-sm font-semibold text-gray-600">
              Načítám dnešní menu…
            </div>
          ) : loadErr ? (
            <div className="rounded-[22px] border border-[#bde7c8] bg-white px-5 py-4 text-sm font-semibold text-red-600">
              {loadErr}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-[22px] border border-[#bde7c8] bg-white px-5 py-4 text-sm font-semibold text-gray-600">
              Pro dnešek zatím nejsou ve správě menu zadaná žádná jídla.
            </div>
          ) : (
            items.map((it) => {
              const q = qty[it.id] ?? 0;
              const unit = specialPrice[it.id] ?? it.price;

              return (
                <div key={it.id} className={`${itemCard} ${q > 0 ? itemCardActive : ""}`}>
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => (q === 0 ? setToOne(it.id) : inc(it.id))}
                  >
                    <div className={itemName}>{it.name}</div>
                  </button>

                  <div className="mt-1 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className={itemCategory}>{it.category}</div>
                    </div>
                    <div className={`${itemPrice} shrink-0`}>{czk(unit)}</div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {q === 0 ? (
                        <button type="button" className={addFoodBtn} onClick={() => setToOne(it.id)}>
                          Přidat
                        </button>
                      ) : (
                        <div className={qtyWrap}>
                          <button type="button" className={qtyBtn} onClick={() => dec(it.id)}>
                            −
                          </button>
                          <div className={qtyNum}>{q}</div>
                          <button type="button" className={qtyBtn} onClick={() => inc(it.id)}>
                            +
                          </button>
                        </div>
                      )}
                    </div>

                    <button type="button" className={specText} onClick={() => openKeypadFor(it.id)}>
                      {specialPrice[it.id] == null ? "Spec. cena" : `Spec: ${czk(specialPrice[it.id]!)}`}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className={bottomFixed}>
        <div className={bottomInner}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button type="button" className={btnCancel} onClick={resetOrder}>
              Zpět / Zrušit
            </button>
            <button type="button" className={btnPay} onClick={() => setPaymentOpen(true)} disabled={total <= 0}>
              Zaplatit • {czk(total)} • {totalCount} ks
            </button>
          </div>
        </div>
      </div>

      {editOpen && (
        <>
          <button type="button" className="fixed inset-0 z-40 bg-black/40" onClick={() => setEditOpen(false)} />
          <div className="fixed inset-0 z-50 overflow-auto px-3 py-4 sm:grid sm:place-items-center">
            <div className="mx-auto w-full max-w-[760px] rounded-[28px] bg-white p-4 sm:p-5 shadow-xl ring-1 ring-black/10">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[20px] font-extrabold text-gray-900">Upravit jídla</div>
                  <div className="mt-1 text-[13px] font-semibold text-gray-500">
                    Úpravy platí pro dnešní pokladnu.
                  </div>
                </div>
                <button type="button" className={modalBtn} onClick={() => setEditOpen(false)}>
                  Zavřít
                </button>
              </div>

              <div className="mt-4 max-h-[34vh] overflow-auto rounded-[22px] border border-[#bde7c8]">
                <div className="divide-y divide-[#dff2e5]">
                  {localItems.map((it) => (
                    <div key={it.id} className="grid gap-2 px-3 py-3 md:grid-cols-[1fr_220px_120px_80px] md:items-center">
                      <input
                        value={it.name}
                        onChange={(e) => renameLocalItem(it.id, e.target.value)}
                        className="w-full rounded-2xl bg-white px-3 py-2 text-sm font-bold text-gray-900 ring-1 ring-black/10 outline-none focus:ring-2 focus:ring-[#a9e0bc]"
                      />

                      <div className="truncate text-xs font-semibold text-gray-500">{it.category}</div>

                      <input
                        value={String(it.price ?? 0)}
                        onChange={(e) => changeLocalPrice(it.id, e.target.value)}
                        inputMode="numeric"
                        className="w-full rounded-2xl bg-white px-3 py-2 text-right text-sm font-bold text-gray-900 ring-1 ring-black/10 outline-none focus:ring-2 focus:ring-[#a9e0bc]"
                      />

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeLocalItem(it.id)}
                          className="rounded-full px-3 py-2 text-xs font-extrabold text-red-600 hover:underline"
                        >
                          Smazat
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-[22px] border border-[#bde7c8] bg-[#f5fbf7] p-3">
                <div className="text-sm font-extrabold text-[#0b7c4d]">Přidat jídlo</div>

                <div className="mt-3 relative">
                  <input
                    value={foodSearchQuery}
                    onChange={(e) => {
                      setFoodSearchQuery(e.target.value);
                      setFoodSearchOpen(true);
                    }}
                    onFocus={() => setFoodSearchOpen(true)}
                    placeholder="Název nebo číslo jídla"
                    className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold text-gray-900 ring-1 ring-black/10 outline-none focus:ring-2 focus:ring-[#a9e0bc]"
                  />

                  {foodSearchOpen && foodSearchQuery.trim() !== "" && (
                    <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-[#bde7c8] bg-white shadow-lg">
                      {filteredFoods.length === 0 ? (
                        <div className="px-4 py-3 text-sm font-semibold text-gray-500">Nic nenalezeno.</div>
                      ) : (
                        filteredFoods.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => addFoodFromDatabase(f)}
                            className="grid w-full grid-cols-[1fr_auto] gap-3 px-4 py-3 text-left hover:bg-[#f5fbf7]"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-extrabold text-gray-900">{f.nazev}</div>
                              <div className="mt-0.5 text-xs font-semibold text-gray-500">
                                #{f.legacy_id} • {f.kategorie ?? "Bez kategorie"}
                              </div>
                            </div>
                            <div className="text-sm font-extrabold text-[#0b7c4d]">
                              {czk(Number(f.cena ?? 0))}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1.5fr_1fr_120px_auto]">
                  <input
                    value={manualFoodName}
                    onChange={(e) => setManualFoodName(e.target.value)}
                    placeholder="Název"
                    className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold text-gray-900 ring-1 ring-black/10 outline-none focus:ring-2 focus:ring-[#a9e0bc]"
                  />

                  <input
                    value={manualFoodCategory}
                    onChange={(e) => setManualFoodCategory(e.target.value)}
                    placeholder="Kategorie"
                    className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold text-gray-900 ring-1 ring-black/10 outline-none focus:ring-2 focus:ring-[#a9e0bc]"
                  />

                  <input
                    value={manualFoodPrice}
                    onChange={(e) => setManualFoodPrice(e.target.value.replace(/[^\d]/g, ""))}
                    placeholder="Cena"
                    inputMode="numeric"
                    className="w-full rounded-2xl bg-white px-4 py-3 text-right text-sm font-bold text-gray-900 ring-1 ring-black/10 outline-none focus:ring-2 focus:ring-[#a9e0bc]"
                  />

                  <button type="button" onClick={addManualFood} className={greenBtn}>
                    Přidat ručně
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {paymentOpen && (
        <>
          <button type="button" className="fixed inset-0 z-40 bg-black/40" onClick={() => setPaymentOpen(false)} />
          <div className="fixed inset-0 z-50 overflow-auto px-3 py-4 sm:grid sm:place-items-center">
            <div className={modalCard}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-[20px] font-extrabold text-gray-900">Platba</div>
                <button type="button" className={modalBtn} onClick={() => setPaymentOpen(false)}>
                  Zavřít
                </button>
              </div>

              <div className="mt-4 rounded-[22px] bg-[#eef8f1] p-5 ring-1 ring-[#bde7c8]">
                <div className="text-xs font-bold text-gray-500">Celkem k úhradě</div>
                <div className="mt-1 text-[30px] sm:text-[34px] font-extrabold text-[#0b7c4d]">{czk(total)}</div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button type="button" className={payBig(paymentMethod === "cash")} onClick={() => setPaymentMethod("cash")}>
                  Hotově
                </button>
                <button type="button" className={payBig(paymentMethod === "card")} onClick={() => setPaymentMethod("card")}>
                  Kartou
                </button>
              </div>

              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  className={creditLink}
                  onClick={() => {
                    setPaymentMethod("credit");
                    setCustomerPickerOpen(true);
                  }}
                >
                  Kredit
                </button>
              </div>

              {paymentMethod === "credit" && (
                <div className="mt-3 rounded-[18px] border border-[#bde7c8] bg-white p-3">
                  {!selectedCustomer ? (
                    <div className="text-sm font-semibold text-gray-600">
                      Není vybraný zákazník. Klikni na „Kredit“ a vyber zákazníka.
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-extrabold text-gray-900">
                            {selectedCustomer.full_name ?? "Bez jména"} • kredit {czk(selectedCustomerCredit)}
                          </div>

                          <div className="mt-1 text-xs font-semibold text-gray-500">
                            {creditEnough
                              ? `Po zaplacení zbude ${czk(selectedCustomerCredit - total)}`
                              : `Nedostatečný kredit • chybí ${czk(total - selectedCustomerCredit)}`}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setCreditTopupValue("");
                            setCreditTopupOpen(true);
                          }}
                          className="shrink-0 text-xs font-extrabold text-[#0b7c4d] hover:underline underline-offset-4"
                        >
                          Dobít kredit
                        </button>
                      </div>

                      {!creditEnough && (
                        <div className="mt-2 text-xs font-extrabold text-red-600">
                          Tímto kreditem nejde objednávku zaplatit.
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button type="button" className={btnCancel} onClick={() => setPaymentOpen(false)}>
                  Zpět
                </button>
                <button type="button" className={btnPay} disabled={!canConfirmPayment} onClick={confirmPayment}>
                  {savingOrder ? "Ukládám…" : "Potvrdit platbu"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {customerPickerOpen && (
        <>
          <button type="button" className="fixed inset-0 z-[60] bg-black/40" onClick={() => setCustomerPickerOpen(false)} />
          <div className="fixed inset-0 z-[70] overflow-auto px-3 py-4 sm:grid sm:place-items-center">
            <div className="mx-auto w-full max-w-[620px] rounded-[28px] bg-white p-4 sm:p-5 shadow-xl ring-1 ring-black/10">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[20px] font-extrabold text-gray-900">Výběr zákazníka</div>
                  <div className="mt-1 text-[13px] font-semibold text-gray-500">
                    Vyhledej zákazníka pro platbu kreditem.
                  </div>
                </div>
                <button type="button" className={modalBtn} onClick={() => setCustomerPickerOpen(false)}>
                  Zavřít
                </button>
              </div>

              <input
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                placeholder="Hledat jméno zákazníka…"
                className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold text-gray-900 ring-1 ring-black/10 outline-none focus:ring-2 focus:ring-[#a9e0bc]"
              />

              <div className="mt-4 max-h-[44vh] overflow-auto rounded-[22px] border border-[#bde7c8]">
                {customersLoading ? (
                  <div className="px-4 py-6 text-sm font-semibold text-gray-600">Načítám zákazníky…</div>
                ) : customers.length === 0 ? (
                  <div className="px-4 py-6 text-sm font-semibold text-gray-600">Nikdo nenalezen.</div>
                ) : (
                  <div className="divide-y divide-[#dff2e5]">
                    {customers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(c);
                          setPaymentMethod("credit");
                          setCustomerPickerOpen(false);
                        }}
                        className="grid w-full grid-cols-[1fr_auto] gap-3 px-4 py-3 text-left hover:bg-[#f5fbf7]"
                      >
                        <div className="text-sm font-extrabold text-gray-900">{c.full_name ?? "Bez jména"}</div>
                        <div className="text-sm font-extrabold text-[#0b7c4d]">{czk(Number(c.kredit ?? 0))}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {creditTopupOpen && selectedCustomer && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[80] bg-black/40"
            onClick={() => {
              if (!creditTopupSaving) setCreditTopupOpen(false);
            }}
          />

          <div className="fixed inset-0 z-[90] overflow-auto px-3 py-4 sm:grid sm:place-items-center">
            <div className="mx-auto w-full max-w-[520px] rounded-[28px] bg-white p-4 sm:p-5 shadow-[0_22px_70px_rgba(0,0,0,0.2)] ring-1 ring-black/10">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[20px] font-extrabold text-gray-900">Dobití kreditu</div>
                  <div className="mt-1 text-[13px] font-semibold text-gray-500">
                    Připiš kredit vybranému zákazníkovi.
                  </div>
                </div>

                <button
                  type="button"
                  className={modalBtn}
                  onClick={() => {
                    if (!creditTopupSaving) setCreditTopupOpen(false);
                  }}
                >
                  Zavřít
                </button>
              </div>

              <div className="mt-4 rounded-[22px] border border-[#bde7c8] bg-[#eef8f1] p-4">
                <div className="text-sm font-extrabold text-gray-900">
                  {selectedCustomer.full_name ?? "Bez jména"}
                </div>
                <div className="mt-1 text-xs font-semibold text-gray-500">
                  Aktuální kredit: {czk(Number(selectedCustomer.kredit ?? 0))}
                </div>
              </div>

              <div className="mt-4 rounded-[22px] bg-[#f7f8f6] p-4 ring-1 ring-black/10">
                <div className="text-[12px] font-bold text-gray-500">Částka k dobití</div>
                <div className="mt-1 text-[28px] font-extrabold text-gray-900">
                  {creditTopupValue ? `${creditTopupValue} Kč` : "—"}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "←"].map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="h-14 rounded-[18px] bg-white text-[20px] font-extrabold text-gray-900 ring-1 ring-black/10 shadow-sm hover:bg-gray-50"
                    onClick={() => topupKeypadPress(k)}
                    disabled={creditTopupSaving}
                  >
                    {k}
                  </button>
                ))}
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  className={btnCancel}
                  onClick={() => setCreditTopupOpen(false)}
                  disabled={creditTopupSaving}
                >
                  Zpět
                </button>

                <button
                  type="button"
                  className={btnPay}
                  onClick={confirmCreditTopup}
                  disabled={creditTopupSaving || !creditTopupValue}
                >
                  {creditTopupSaving ? "Dobíjím…" : "Dobít kredit"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {keypadOpen && (
        <>
          <button type="button" className="fixed inset-0 z-40 bg-black/40" onClick={() => setKeypadOpen(false)} />
          <div className="fixed inset-0 z-50 overflow-auto px-3 py-4 sm:grid sm:place-items-center">
            <div className="mx-auto w-full max-w-[420px] rounded-[26px] bg-white p-4 sm:p-5 shadow-xl ring-1 ring-black/10">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[18px] font-extrabold text-gray-900">Speciální cena</div>
                <button type="button" className={modalBtn} onClick={() => setKeypadOpen(false)}>
                  Zavřít
                </button>
              </div>

              <div className="mt-4 rounded-[18px] bg-[#f7f8f6] p-4 ring-1 ring-black/10">
                <div className="text-[12px] font-bold text-gray-500">Zadaná cena</div>
                <div className="mt-1 text-[28px] font-extrabold text-gray-900">
                  {keypad.value ? `${keypad.value} Kč` : "—"}
                </div>
                <div className="mt-2 text-[12px] font-semibold text-gray-500">Prázdné = zrušit</div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "←"].map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="h-14 rounded-[18px] bg-white text-[20px] font-extrabold text-gray-900 ring-1 ring-black/10 shadow-sm hover:bg-gray-50"
                    onClick={() => keypadPress(k)}
                  >
                    {k}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button type="button" className={btnPay} onClick={keypadApply}>
                  Potvrdit
                </button>
                <button type="button" className={btnCancel} onClick={() => setKeypadOpen(false)}>
                  Zpět
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}