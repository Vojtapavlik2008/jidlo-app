"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useIsMobile } from "@/app/components/hooks/useIsMobile";
import DesktopView from "./_ui/DesktopView";
import MobileView from "./_ui/MobileView";

type Mode = "tady" | "sebou";
type DeliveryChoice = "ano" | "ne";
type PackagingChoice = "plast" | "rekrabicka";
type PaymentMethod = "cash" | "card" | "credit";

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

export type PokladnaViewProps = {
  todayLabel: string;
  mode: Mode;
  setMode: (v: Mode) => void;
  delivery: DeliveryChoice;
  setDelivery: (v: DeliveryChoice) => void;
  packaging: PackagingChoice;
  setPackaging: (v: PackagingChoice) => void;

  items: EditableItem[];
  qty: Record<string, number>;
  specialPrice: Record<string, number | null>;
  loadingItems: boolean;
  loadErr: string | null;

  setToOne: (id: string) => void;
  inc: (id: string) => void;
  dec: (id: string) => void;
  openKeypadFor: (id: string) => void;

  total: number;
  totalCount: number;
  resetOrder: () => void;
  openPayment: () => void;

  editOpen: boolean;
  setEditOpen: (v: boolean) => void;

  localItems: EditableItem[];
  renameLocalItem: (id: string, name: string) => void;
  changeLocalPrice: (id: string, raw: string) => void;
  removeLocalItem: (id: string) => void | Promise<void>;

  foodSearchQuery: string;
  setFoodSearchQuery: (v: string) => void;
  foodSearchOpen: boolean;
  setFoodSearchOpen: (v: boolean) => void;
  filteredFoods: StaffFoodRow[];
  addFoodFromDatabase: (food: StaffFoodRow) => void | Promise<void>;

  manualFoodName: string;
  setManualFoodName: (v: string) => void;
  manualFoodCategory: string;
  setManualFoodCategory: (v: string) => void;
  manualFoodPrice: string;
  setManualFoodPrice: (v: string) => void;
  addManualFood: () => void;

  paymentOpen: boolean;
  setPaymentOpen: (v: boolean) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (v: PaymentMethod) => void;
  savingOrder: boolean;
  canConfirmPayment: boolean;
  confirmPayment: () => void | Promise<void>;

  selectedCustomer: CustomerRow | null;
  selectedCustomerCredit: number;
  creditEnough: boolean;

  customerPickerOpen: boolean;
  setCustomerPickerOpen: (v: boolean) => void;
  customerQuery: string;
  setCustomerQuery: (v: string) => void;
  customers: CustomerRow[];
  customersLoading: boolean;
  setSelectedCustomer: (v: CustomerRow | null) => void;

  creditTopupOpen: boolean;
  setCreditTopupOpen: (v: boolean) => void;
  creditTopupValue: string;
  creditTopupSaving: boolean;
  topupKeypadPress: (ch: string) => void;
  confirmCreditTopup: () => void | Promise<void>;

  keypadOpen: boolean;
  setKeypadOpen: (v: boolean) => void;
  keypad: { target: KeypadTarget | null; value: string };
  keypadPress: (ch: string) => void;
  keypadApply: () => void;

  router: ReturnType<typeof useRouter>;
  czk: (n: number) => string;
};

export default function PokladnaPage() {
  const router = useRouter();
  const isMobile = useIsMobile();

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

  const viewProps: PokladnaViewProps = {
    todayLabel,
    mode,
    setMode,
    delivery,
    setDelivery,
    packaging,
    setPackaging,

    items,
    qty,
    specialPrice,
    loadingItems,
    loadErr,

    setToOne,
    inc,
    dec,
    openKeypadFor,

    total,
    totalCount,
    resetOrder,
    openPayment: () => setPaymentOpen(true),

    editOpen,
    setEditOpen,

    localItems,
    renameLocalItem,
    changeLocalPrice,
    removeLocalItem,

    foodSearchQuery,
    setFoodSearchQuery,
    foodSearchOpen,
    setFoodSearchOpen,
    filteredFoods,
    addFoodFromDatabase,

    manualFoodName,
    setManualFoodName,
    manualFoodCategory,
    setManualFoodCategory,
    manualFoodPrice,
    setManualFoodPrice,
    addManualFood,

    paymentOpen,
    setPaymentOpen,
    paymentMethod,
    setPaymentMethod,
    savingOrder,
    canConfirmPayment,
    confirmPayment,

    selectedCustomer,
    selectedCustomerCredit,
    creditEnough,

    customerPickerOpen,
    setCustomerPickerOpen,
    customerQuery,
    setCustomerQuery,
    customers,
    customersLoading,
    setSelectedCustomer,

    creditTopupOpen,
    setCreditTopupOpen,
    creditTopupValue,
    creditTopupSaving,
    topupKeypadPress,
    confirmCreditTopup,

    keypadOpen,
    setKeypadOpen,
    keypad,
    keypadPress,
    keypadApply,

    router,
    czk,
  };

  return isMobile ? <MobileView {...viewProps} /> : <DesktopView {...viewProps} />;
}