"use client";

import { useEffect, useMemo, useState } from "react";
import AuthButton from "@/app/components/AuthButton";
import { getMyProfile } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type {
  TimesByDay as CtxTimesByDay,
  DeliveryMode as CtxDeliveryMode,
  PackagingMode as CtxPackagingMode,
  PaymentMethod as CtxPaymentMethod,
} from "@/app/components/order/order-context";

type OrderCartItem = {
  key: string;
  datum: string;
  jidlo_id: string;
  nazev: string;
  cena: number;
  qty: number;
};

type SystemItemRow = {
  id: number;
  section: string;
  item_key: string | null;
  label: string | null;
  value_text: string | null;
  value_number: number | null;
  sort_order: number | null;
  is_active: boolean | null;
};

const ALLERGEN_LABELS: Record<number, string> = {
  1: "lepek",
  2: "korýši",
  3: "vejce",
  4: "ryby",
  5: "arašídy",
  6: "sójové boby",
  7: "mléko",
  8: "skořápkové plody",
  9: "celer",
  10: "hořčice",
  11: "sezamová semena",
  12: "oxid siřičitý a siřičitany",
  13: "lupina",
  14: "měkkýši",
};

function normalizeAllergens(input: any): number[] {
  if (!input) return [];

  if (Array.isArray(input)) {
    return input
      .map((x) => Number(String(x).replace(/[^\d]/g, "")))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 14);
  }

  if (typeof input === "string") {
    return input
      .split(/[,\s;|/]+/)
      .map((x) => Number(String(x).replace(/[^\d]/g, "")))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 14);
  }

  return [];
}

function allergensToText(input: any) {
  const ids = normalizeAllergens(input);
  if (!ids.length) return "Bez uvedených alergenů";
  return ids.map((id) => ALLERGEN_LABELS[id]).filter(Boolean).join(", ");
}

export async function createOrder(params: {
  full_name: string;
  phone: string;
  address: string;
  note: string;
  delivery_mode: CtxDeliveryMode;
  packaging_mode: CtxPackagingMode;
  payment_method: CtxPaymentMethod;
  times_by_day: CtxTimesByDay;
  cart: OrderCartItem[];
}) {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) throw new Error("Nejsi přihlášený.");

  const total = params.cart.reduce((s, it) => s + it.cena * it.qty, 0);

  const { data: order, error: e1 } = await supabase
    .from("orders")
    .insert({
      user_id: uid,
      full_name: params.full_name.trim() || null,
      phone: params.phone.replace(/\D/g, "").slice(0, 9) || null,
      address: params.address.trim() || null,
      note: params.note.trim() || null,
      delivery_mode: params.delivery_mode,
      packaging_mode: params.packaging_mode,
      payment_method: params.payment_method,
      times_by_day: params.times_by_day,
      status: "new",
      total,
      cart: params.cart,
    })
    .select("id")
    .single();

  if (e1) throw new Error(e1.message);
  if (!order?.id) throw new Error("Nepovedlo se vytvořit objednávku.");

  const items = params.cart.map((it) => ({
    order_id: order.id,
    datum: it.datum,
    jidlo_id: it.jidlo_id,
    name: it.nazev,
    unit_price: it.cena,
    qty: it.qty,
    line_total: it.cena * it.qty,
  }));

  const { error: e2 } = await supabase.from("order_items").insert(items);
  if (e2) throw new Error(e2.message);

  return order.id as string;
}

// ===================== Date helpers =====================
function toISODate(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const dd = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function isSunday(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.getDay() === 0;
}

function isSaturday(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.getDay() === 6;
}

function baseMondayAutoNextWeekend(now: Date) {
  const x = new Date(now);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();

  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(x);
  monday.setDate(monday.getDate() - diffToMonday);

  if (day === 6 || day === 0) monday.setDate(monday.getDate() + 7);

  return monday;
}

function formatDayLabel(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const wd = new Intl.DateTimeFormat("cs-CZ", { weekday: "short" })
    .format(d)
    .replace(".", "");
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${wd} ${dd}.${mm}.`;
}

function formatRangeLabel(fromIso: string, toIso: string) {
  const f = new Date(fromIso + "T00:00:00");
  const t = new Date(toIso + "T00:00:00");
  const fWd = new Intl.DateTimeFormat("cs-CZ", { weekday: "short" }).format(f).replace(".", "");
  const tWd = new Intl.DateTimeFormat("cs-CZ", { weekday: "short" }).format(t).replace(".", "");
  const fDd = String(f.getDate()).padStart(2, "0");
  const fMm = String(f.getMonth() + 1).padStart(2, "0");
  const tDd = String(t.getDate()).padStart(2, "0");
  const tMm = String(t.getMonth() + 1).padStart(2, "0");
  return `${fWd} ${fDd}.${fMm}. – ${tWd} ${tDd}.${tMm}.`;
}

function msUntilNextMidnightLocal() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

function getTodayHoursFromRows(rows: SystemItemRow[]) {
  const d = new Date();
  const day = d.getDay();

  let key = "sun";
  if (day === 1) key = "mon";
  else if (day === 2) key = "tue";
  else if (day === 3) key = "wed";
  else if (day === 4) key = "thu";
  else if (day === 5) key = "fri";
  else if (day === 6) key = "sat";

  const row = rows.find((x) => x.item_key === key && x.is_active);
  if (!row?.value_text) return null;
  return `dnes ${row.value_text}`;
}

// ===================== DesktopView =====================
export default function DesktopView({
  onOpenCart,
}: {
  onOpenCart: () => void;
}) {
  const [activeSection, setActiveSection] = useState<
    "daily" | "order" | "shop" | "canteen" | "about"
  >("daily");

  const [systemItems, setSystemItems] = useState<SystemItemRow[]>([]);
  const [loadingSystemItems, setLoadingSystemItems] = useState(true);

  useEffect(() => {
    let alive = true;

    async function loadSystemItems() {
      setLoadingSystemItems(true);

      const { data, error } = await supabase
        .from("system_items")
        .select("id, section, item_key, label, value_text, value_number, sort_order, is_active")
        .eq("is_active", true)
        .order("section", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true });

      if (!alive) return;

      if (error) {
        console.error("loadSystemItems error:", error);
        setSystemItems([]);
        setLoadingSystemItems(false);
        return;
      }

      setSystemItems((data ?? []) as SystemItemRow[]);
      setLoadingSystemItems(false);
    }

    loadSystemItems();

    return () => {
      alive = false;
    };
  }, []);

  const shopHoursRows = useMemo(
    () => systemItems.filter((x) => x.section === "opening_hours_shop"),
    [systemItems]
  );

  const canteenHoursRows = useMemo(
    () => systemItems.filter((x) => x.section === "opening_hours_canteen"),
    [systemItems]
  );

  const aboutTextRow = useMemo(
    () => systemItems.find((x) => x.section === "about_text" && x.item_key === "main") ?? null,
    [systemItems]
  );

  const shopHoursToday = useMemo(
    () => getTodayHoursFromRows(shopHoursRows),
    [shopHoursRows]
  );

  const canteenHoursToday = useMemo(
    () => getTodayHoursFromRows(canteenHoursRows),
    [canteenHoursRows]
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl px-6 pt-6 pb-8">
        <header className="mb-6">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <img
                src="/logo.png"
                alt="Logo Jiřka"
                className="h-16 w-16 md:h-20 md:w-20 rounded-3xl object-contain"
              />

              <div>
                <h1 className="text-4xl md:text-5xl font-extrabold text-green-700 leading-none">
                  Jiřka
                </h1>
                <p className="mt-2 text-sm text-gray-500">Jídelna • Zdravá výživa • Obchod</p>
                <p className="mt-1 text-sm font-medium text-gray-500">
                  Havlíčkova 72, 29001, Poděbrady
                </p>
              </div>
            </div>

            <div className="pt-1">
              <AuthButton />
            </div>
          </div>

          <div className="mt-5 h-1 w-36 rounded-full bg-yellow-400" />
        </header>

        <div className="grid grid-cols-12 gap-6">
          <aside className="col-span-12 md:col-span-4 lg:col-span-3">
            <Sidebar
              active={activeSection}
              onChange={setActiveSection}
              shopHoursToday={shopHoursToday}
              canteenHoursToday={canteenHoursToday}
            />
          </aside>

          <main className="col-span-12 md:col-span-8 lg:col-span-9">
            <div className="rounded-3xl border border-green-100 bg-white p-5 -mt-12 shadow-sm">
              {activeSection === "daily" ? (
                <DailyMenuPanel />
              ) : activeSection === "order" ? (
                <OrderPanel onOpenCart={onOpenCart} />
              ) : activeSection === "shop" ? (
                <PhotosPanelWithHours
                  title="Obchod & Zdravá výživa"
                  folder="/fotky"
                  keys={["obchod-1.jpg", "obchod-2.jpg", "obchod-3.jpg"]}
                  hours={shopHoursRows}
                  loading={loadingSystemItems}
                />
              ) : activeSection === "canteen" ? (
                <PhotosPanelWithHours
                  title="Jídelna"
                  folder="/fotky"
                  keys={["jidelna-1.jpg", "jidelna-2.jpg", "jidelna-3.jpg"]}
                  hours={canteenHoursRows}
                  loading={loadingSystemItems}
                />
              ) : (
                <AboutPanelDynamic
                  text={aboutTextRow?.value_text ?? ""}
                  loading={loadingSystemItems}
                />
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

// ===================== Sidebar =====================
function Sidebar({
  active,
  onChange,
  shopHoursToday,
  canteenHoursToday,
}: {
  active: "daily" | "order" | "shop" | "canteen" | "about";
  onChange: (x: "daily" | "order" | "shop" | "canteen" | "about") => void;
  shopHoursToday?: string | null;
  canteenHoursToday?: string | null;
}) {
  const navBase =
    "rounded-2xl px-5 py-4 transition-all duration-200 shadow-sm ring-1 ring-green-100";
  const navNormal =
    "bg-white hover:bg-green-50 hover:shadow-md hover:-translate-y-[1px]";
  const navActive =
    "bg-gradient-to-br from-green-50 to-green-100 ring-2 ring-green-400/40 shadow-md";
  const subLine = "mt-1 text-sm font-semibold text-gray-500";

  const Item = ({
    id,
    title,
    sub,
    icon,
  }: {
    id: typeof active;
    title: string;
    sub?: string | null;
    icon: string;
  }) => (
    <button
      type="button"
      onClick={() => onChange(id)}
      className={`${navBase} ${active === id ? navActive : navNormal} w-full text-left`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-50 text-lg">
          {icon}
        </div>

        <div>
          <div className="text-base font-extrabold text-green-700">{title}</div>
          {sub ? <div className={subLine}>{sub}</div> : null}
        </div>
      </div>
    </button>
  );

  return (
    <div className="grid gap-3">
      <Item id="daily" title="Denní menu" sub={null} icon="📋" />
      <Item id="order" title="Objednávka jídel" sub={null} icon="🍽️" />
      <Item id="shop" title="Obchod" sub={shopHoursToday} icon="🛒" />
      <Item id="canteen" title="Jídelna" sub={canteenHoursToday} icon="🏠" />
      <Item id="about" title="O nás" sub={null} icon="ℹ️" />
    </div>
  );
}

// ===================== Panels =====================
function AboutPanelDynamic({
  text,
  loading,
}: {
  text: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-green-100 bg-white p-6 text-gray-700">
      <div className="text-2xl font-extrabold text-green-700">O nás</div>

      <div className="mt-4 text-[15px] leading-7 text-gray-600 whitespace-pre-line">
        {loading ? "Načítám text…" : text || "Text zatím nebyl vyplněn."}
      </div>

      <div className="mt-6 rounded-2xl bg-green-50 px-4 py-4 ring-1 ring-green-100">
        <div className="text-sm font-extrabold uppercase tracking-wide text-green-700">Adresa</div>
        <div className="mt-1 text-sm font-semibold text-gray-700">
          Havlíčkova 72, 29001, Poděbrady
        </div>
      </div>
    </div>
  );
}

function PhotosPanelWithHours({
  title,
  folder,
  keys,
  hours,
  loading,
}: {
  title: string;
  folder: string;
  keys: string[];
  hours: SystemItemRow[];
  loading: boolean;
}) {
  return (
    <div className="grid gap-4">
      <div className="text-2xl font-extrabold text-green-700">{title}</div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {keys.map((k, i) => (
            <div
              key={k}
              className={
                "rounded-3xl bg-white ring-1 ring-black/10 overflow-hidden shadow-sm " +
                (i === 2 ? "sm:col-span-2" : "")
              }
            >
              <img src={`${folder}/${k}`} alt={k} className="w-full h-56 object-cover" />
            </div>
          ))}
        </div>

        <div className="rounded-3xl bg-[#f7fbf8] p-5 ring-1 ring-green-100">
          <div className="text-2xl font-extrabold text-green-700">Otevírací doba</div>

          <div className="mt-4 grid gap-2">
            {loading ? (
              <div className="text-sm font-semibold text-gray-500">Načítám…</div>
            ) : hours.length === 0 ? (
              <div className="text-sm font-semibold text-gray-500">
                Otevírací doba zatím není vyplněná.
              </div>
            ) : (
              hours.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 ring-1 ring-green-100"
                >
                  <div className="text-[15px] font-extrabold text-[#1f2f56]">
                    {row.label ?? "Den"}
                  </div>
                  <div className="text-[15px] font-semibold text-gray-700">
                    {row.value_text ?? "—"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================== DailyMenuPanel =====================
function DailyMenuPanel() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const baseMondayISO = useMemo(() => toISODate(baseMondayAutoNextWeekend(new Date())), [tick]);
  const [weekOffset, setWeekOffset] = useState<0 | 1>(0);

  useEffect(() => setWeekOffset(0), [baseMondayISO]);

  const days = useMemo(() => {
    const base = new Date(baseMondayISO + "T00:00:00");
    base.setDate(base.getDate() + weekOffset * 7);

    const arr: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      arr.push(toISODate(d));
    }
    return arr;
  }, [baseMondayISO, weekOffset]);

  const [selectedDate, setSelectedDate] = useState<string>(toISODate(new Date()));

  useEffect(() => {
    const todayIso = toISODate(new Date());
    setSelectedDate((prev) => {
      if (days.includes(prev)) return prev;
      return days.includes(todayIso) ? todayIso : days[0];
    });
  }, [days]);

  useEffect(() => {
    const t = setTimeout(() => {
      const todayIso = toISODate(new Date());
      setSelectedDate((prev) => (days.includes(todayIso) ? todayIso : prev));
      setTick((x) => x + 1);
    }, msUntilNextMidnightLocal() + 50);

    return () => clearTimeout(t);
  }, [days]);

  const zavreno = isSunday(selectedDate);
  const sobota = isSaturday(selectedDate);

  type DbMenuRow = {
    datum: string;
    poradi: number;
    jidla: {
      nazev: string;
      cena: number | null;
      kategorie: string | null;
      alergeny?: any;
    } | null;
  };

  const [menuByDate, setMenuByDate] = useState<Record<string, DbMenuRow[]>>({});
  const [loadingMenu, setLoadingMenu] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadMenu() {
      if (!days?.length) return;
      setLoadingMenu(true);

      const { data, error } = await supabase
        .from("menu_den")
        .select("datum, poradi, jidla:jidlo_id(nazev, cena, kategorie, alergeny)")
        .in("datum", days)
        .order("datum", { ascending: true })
        .order("poradi", { ascending: true });

      if (!alive) return;

      if (error) {
        console.error("loadMenu error:", error);
        setMenuByDate({});
        setLoadingMenu(false);
        return;
      }

      const rows = (data ?? []) as unknown as DbMenuRow[];

      const map: Record<string, DbMenuRow[]> = {};
      for (const d of days) map[d] = [];

      for (const r of rows) {
        if (!map[r.datum]) map[r.datum] = [];
        map[r.datum].push(r);
      }

      setMenuByDate(map);
      setLoadingMenu(false);
    }

    loadMenu();
    return () => {
      alive = false;
    };
  }, [days]);

  const items = (menuByDate[selectedDate] ?? []).filter((x) => x.jidla).slice(0, 10);

  const rangeLabel = useMemo(() => formatRangeLabel(days[0], days[6]), [days]);

  const dayBtn = (active: boolean) =>
    "rounded-xl px-3 py-2 text-sm font-semibold transition w-full " +
    (active
      ? "bg-green-600 text-white shadow-sm"
      : "bg-white text-green-700 ring-1 ring-black/5 hover:bg-green-50");

  const arrowBtnFull =
    "h-[40px] w-full rounded-xl bg-white text-green-700 font-extrabold transition ring-1 ring-black/5 hover:bg-green-50";

  const todayIso = toISODate(new Date());

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-extrabold text-green-700">Denní menu</div>
          <div className="mt-1 text-sm text-gray-500">{rangeLabel}</div>
        </div>
      </div>

      <div className="w-full">
        {weekOffset === 0 ? (
          <div className="grid grid-cols-8 gap-2 w-full">
            {days.map((d) => {
              const isToday = d === todayIso;
              const isActive = d === selectedDate;

              return (
                <div key={d} className="relative">
                  <button type="button" onClick={() => setSelectedDate(d)} className={dayBtn(isActive)}>
                    {formatDayLabel(d)}
                  </button>

                  {isToday && (
                    <div className="pointer-events-none absolute left-1/2 top-full -translate-x-1/2 text-[9px] font-bold text-green-700 leading-none mt-[2px]">
                      dnes
                    </div>
                  )}
                </div>
              );
            })}

            <button type="button" onClick={() => setWeekOffset(1)} className={arrowBtnFull} title="Na 2. týden">
              →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-8 gap-2 w-full">
            <button type="button" onClick={() => setWeekOffset(0)} className={arrowBtnFull} title="Zpět na 1. týden">
              ←
            </button>

            {days.map((d) => {
              const isToday = d === todayIso;
              const isActive = d === selectedDate;

              return (
                <div key={d} className="relative">
                  <button type="button" onClick={() => setSelectedDate(d)} className={dayBtn(isActive)}>
                    {formatDayLabel(d)}
                  </button>

                  {isToday && (
                    <div className="pointer-events-none absolute left-1/2 top-full -translate-x-1/2 text-[9px] font-bold text-green-700 leading-none mt-[2px]">
                      dnes
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {zavreno && (
        <div className="rounded-2xl bg-red-50 ring-2 ring-red-200/60 p-3 text-red-700 font-semibold">
          V neděli je zavřeno.
        </div>
      )}

      {sobota && (
        <div className="rounded-2xl bg-yellow-50 ring-2 ring-green-200/60 p-3 text-green-700 font-semibold">
          V sobotu není rozvoz – obědy jsou dostupné pouze v jídelně.
        </div>
      )}

      {loadingMenu ? (
        <div className="rounded-2xl bg-gray-50 ring-1 ring-black/5 px-4 py-4 text-sm font-semibold text-gray-600">
          Načítám menu…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl bg-gray-50 ring-1 ring-black/5 px-4 py-4 text-sm font-semibold text-gray-600">
          Zatím nebylo zveřejněné menu.
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((r, idx) => {
            const cena = Number(r.jidla?.cena ?? 0).toFixed(2);
            const allergenText = allergensToText(r.jidla?.alergeny);

            return (
              <div
                key={idx}
                className="rounded-[22px] border border-[#cfe2d6] bg-white px-4 py-3 transition hover:bg-[#f7fbf8]"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_210px_110px] items-center gap-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="min-w-0 truncate text-[17px] font-bold tracking-[-0.01em] text-[#1f2f56]">
                      {r.jidla?.nazev ?? ""}
                    </div>

                    <div className="relative group shrink-0">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full border border-[#7ac796] bg-white text-[11px] font-extrabold text-[#067647] cursor-default">
                        i
                      </div>

                      <div className="pointer-events-none invisible absolute left-0 top-full z-50 mt-3 w-[340px] rounded-[18px] border border-[#bde7c8] bg-white p-4 text-left opacity-0 shadow-[0_16px_40px_rgba(0,0,0,0.14)] transition-all duration-150 group-hover:visible group-hover:opacity-100">
                        <div className="text-[14px] font-extrabold text-[#1f2f56]">
                          {r.jidla?.nazev ?? ""}
                        </div>
                        <div className="mt-2 text-[12px] font-bold uppercase tracking-wide text-[#08a652]">
                          Alergeny
                        </div>
                        <div className="mt-1 text-[13px] font-semibold leading-5 text-gray-700">
                          {allergenText}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold text-[#08a652]">
                      {r.jidla?.kategorie ?? ""}
                    </div>
                  </div>

                  <div className="whitespace-nowrap text-[16px] font-extrabold text-[#067647]">
                    {cena} Kč
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===================== OrderPanel =====================
function OrderPanel() {
  const [step, setStep] = useState<"menu" | "summary" | "checkout">("menu");

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const baseMondayISO = useMemo(() => toISODate(baseMondayAutoNextWeekend(new Date())), [tick]);
  const [weekOffset, setWeekOffset] = useState<0 | 1>(0);
  useEffect(() => setWeekOffset(0), [baseMondayISO]);

  const days = useMemo(() => {
    const base = new Date(baseMondayISO + "T00:00:00");
    base.setDate(base.getDate() + weekOffset * 7);

    const arr: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      arr.push(toISODate(d));
    }
    return arr;
  }, [baseMondayISO, weekOffset]);

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const todayIso = toISODate(new Date());
    return days.includes(todayIso) ? todayIso : days[0];
  });

  useEffect(() => {
    const todayIso = toISODate(new Date());
    setSelectedDate(days.includes(todayIso) ? todayIso : days[0]);
  }, [days]);

  useEffect(() => {
    const t = setTimeout(() => {
      const todayIso = toISODate(new Date());
      setSelectedDate((prev) => (days.includes(todayIso) ? todayIso : prev));
      setTick((x) => x + 1);
    }, msUntilNextMidnightLocal() + 50);

    return () => clearTimeout(t);
  }, [days]);

  const zavreno = isSunday(selectedDate);

  type DbMenuRow = {
    datum: string;
    poradi: number;
    jidlo_id: string;
    jidla: {
      nazev: string;
      cena: number | null;
      kategorie: string | null;
      alergeny?: any;
    } | null;
  };

  const [menuByDate, setMenuByDate] = useState<Record<string, DbMenuRow[]>>({});
  const [loadingMenu, setLoadingMenu] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadMenu() {
      if (!days?.length) return;
      setLoadingMenu(true);

      const { data, error } = await supabase
        .from("menu_den")
        .select("datum, poradi, jidlo_id, jidla:jidlo_id(nazev, cena, kategorie, alergeny)")
        .in("datum", days)
        .order("datum", { ascending: true })
        .order("poradi", { ascending: true });

      if (!alive) return;

      if (error) {
        console.error("OrderPanel loadMenu error:", error);
        setMenuByDate({});
        setLoadingMenu(false);
        return;
      }

      const rows = (data ?? []) as unknown as DbMenuRow[];
      const map: Record<string, DbMenuRow[]> = {};
      for (const d of days) map[d] = [];

      for (const r of rows) {
        if (!map[r.datum]) map[r.datum] = [];
        map[r.datum].push(r);
      }

      setMenuByDate(map);
      setLoadingMenu(false);
    }

    loadMenu();
    return () => {
      alive = false;
    };
  }, [days]);

  const items = (menuByDate[selectedDate] ?? []).filter((x) => x.jidla).slice(0, 10);

  type CartItem2 = {
    key: string;
    datum: string;
    jidlo_id: string;
    nazev: string;
    cena: number;
    qty: number;
    kategorie: string | null;
    isSoup: boolean;
  };

  const [cart, setCart] = useState<CartItem2[]>([]);
  const cartCount = useMemo(() => cart.reduce((s, it) => s + it.qty, 0), [cart]);
  const total = useMemo(() => cart.reduce((s, it) => s + it.cena * it.qty, 0), [cart]);

  function keyFor(dayIso: string, jidlo_id: string) {
    return `db:${dayIso}:${jidlo_id}`;
  }

  function addOne(dayIso: string, r: DbMenuRow) {
    const j = r.jidla;
    if (!j?.nazev) return;
    const cena = Number(j.cena ?? 0);
    const key = keyFor(dayIso, r.jidlo_id);

    setCart((prev) => {
      const idx = prev.findIndex((x) => x.key === key);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }

      const cat = (j.kategorie ?? "").toLowerCase();
      const isSoup = cat.includes("polév") || (j.nazev ?? "").toLowerCase().includes("polév");

      return [
        ...prev,
        {
          key,
          datum: dayIso,
          jidlo_id: r.jidlo_id,
          nazev: j.nazev,
          cena,
          qty: 1,
          kategorie: j.kategorie ?? null,
          isSoup,
        },
      ];
    });
  }

  function removeOne(dayIso: string, r: DbMenuRow) {
    const key = keyFor(dayIso, r.jidlo_id);

    setCart((prev) => {
      const idx = prev.findIndex((x) => x.key === key);
      if (idx < 0) return prev;
      const nextQty = prev[idx].qty - 1;
      if (nextQty <= 0) return prev.filter((x) => x.key !== key);
      const copy = [...prev];
      copy[idx] = { ...copy[idx], qty: nextQty };
      return copy;
    });
  }

  const byDay = useMemo(() => {
    const m = new Map<string, CartItem2[]>();
    for (const it of cart) {
      const arr = m.get(it.datum) ?? [];
      arr.push(it);
      m.set(it.datum, arr);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [cart]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const p = await getMyProfile();
      if (!p) return;
      if (!name.trim() && p.full_name) setName(p.full_name);
      if (!phone.trim() && p.phone) setPhone(p.phone);
      if (!address.trim() && p.address) setAddress(p.address);
    })();
  }, [name, phone, address]);

  type DeliveryMode = "delivery" | "pickup";
  type PackagingMode = "plastic" | "rekrabicka" | "own";
  type PaymentMethod = "card_online" | "online" | "card_on_delivery" | "cash" | "credit";

  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("delivery");
  const [deliveryOpen, setDeliveryOpen] = useState(false);

  const [packagingMode, setPackagingMode] = useState<PackagingMode>("plastic");
  const [packagingOpen, setPackagingOpen] = useState(false);

  const [payment, setPayment] = useState<PaymentMethod>("card_online");
  const [paymentOpen, setPaymentOpen] = useState(false);

  const [packTooltip, setPackTooltip] = useState<PackagingMode | null>(null);

  const hasSaturdayInCart = useMemo(() => cart.some((it) => isSaturday(it.datum)), [cart]);

  useEffect(() => {
    if (hasSaturdayInCart && deliveryMode === "delivery") setDeliveryMode("pickup");
  }, [hasSaturdayInCart, deliveryMode]);

  const deliveryFee = deliveryMode === "delivery" ? 10 : 0;
  const SOUP_BOX = 7;
  const MEAL_BOX = 8;

  const packagingFee =
    packagingMode === "plastic"
      ? cart.reduce((sum, it) => sum + (it.isSoup ? SOUP_BOX : MEAL_BOX) * it.qty, 0)
      : 0;

  const packagingDeposit = packagingMode === "rekrabicka" ? 80 : 0;
  const extras = deliveryFee + packagingFee + packagingDeposit;
  const totalWithExtras = total + extras;

  async function finishOrder() {
    setMsg(null);

    if (!cart.length) return setMsg("Košík je prázdný.");
    if (!name.trim()) return setMsg("Vyplň jméno a příjmení.");
    if (!phone.trim()) return setMsg("Vyplň telefon.");
    if (deliveryMode !== "pickup" && !address.trim()) return setMsg("Vyplň adresu.");
    if (!payment) return setMsg("Vyber způsob platby.");

    setSaving(true);
    try {
      const orderId = await createOrder({
        full_name: name,
        phone,
        address: deliveryMode === "pickup" ? "" : address,
        note,
        delivery_mode: deliveryMode as CtxDeliveryMode,
        packaging_mode: packagingMode as CtxPackagingMode,
        payment_method: payment as CtxPaymentMethod,
        times_by_day: timesByDay as CtxTimesByDay,
        cart: cart as OrderCartItem[],
      });

      setMsg(`Objednávka odeslána ✅ (ID: ${orderId})`);
      setCart([]);
      setStep("summary");
    } catch (e: any) {
      setMsg(e?.message ?? "Nepodařilo se objednávku odeslat.");
    } finally {
      setSaving(false);
    }
  }

  type DayTime = { from: string; to: string } | null;
  type TimesByDay = Record<string, DayTime>;

  const [timeOpen, setTimeOpen] = useState(false);
  const [sameTimeForAll, setSameTimeForAll] = useState(false);
  const [activeTimeDay, setActiveTimeDay] = useState<string | null>(null);
  const [timesByDay, setTimesByDay] = useState<TimesByDay>({});

  const cartDays = useMemo(() => {
    return Array.from(new Set(cart.map((it) => it.datum))).sort();
  }, [cart]);

  const timePickWeekDays = useMemo(() => days.slice(0, 6), [days]);

  const timePickDays = useMemo(() => {
    if (cartDays.length === 0) return [];
    const set = new Set(cartDays);
    const fullWeek = timePickWeekDays.length > 0 && timePickWeekDays.every((d) => set.has(d));
    return fullWeek ? timePickWeekDays : cartDays;
  }, [cartDays, timePickWeekDays]);

  useEffect(() => {
    if (!activeTimeDay || (timePickDays.length > 0 && !timePickDays.includes(activeTimeDay))) {
      setActiveTimeDay(timePickDays[0] ?? null);
    }
  }, [timePickDays, activeTimeDay]);

  function buildTimeSlots(start = "10:00", end = "13:30", stepMin = 30) {
    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    const toStr = (mins: number) => {
      const h = String(Math.floor(mins / 60)).padStart(2, "0");
      const m = String(mins % 60).padStart(2, "0");
      return `${h}:${m}`;
    };

    const s = toMin(start);
    const e = toMin(end);
    const out: { from: string; to: string }[] = [];
    for (let t = s; t < e; t += stepMin) out.push({ from: toStr(t), to: toStr(t + stepMin) });
    return out;
  }

  const timeSummary = useMemo(() => {
    const parts: string[] = [];
    for (const d of cartDays) {
      const t = timesByDay[d];
      if (!t) continue;
      parts.push(`${formatDayLabel(d)} ${t.from}–${t.to}`);
    }
    if (parts.length === 0) return null;
    return parts.join(", ");
  }, [cartDays, timesByDay]);

  const rangeLabel = useMemo(() => formatRangeLabel(days[0], days[6]), [days]);

  const dayBtn = (active: boolean) =>
    "rounded-xl px-3 py-2 text-sm font-semibold transition w-full " +
    (active
      ? "bg-green-600 text-white shadow-sm"
      : "bg-white text-green-700 ring-1 ring-black/5 hover:bg-green-50");

  const arrowBtnFull =
    "h-[40px] w-full rounded-xl bg-white text-green-700 font-extrabold transition ring-1 ring-black/5 hover:bg-green-50";

  const addBtn =
    "rounded-xl px-3 py-2 text-sm font-semibold transition ring-1 ring-green-600/70 text-green-700 bg-white hover:bg-green-600 hover:text-white hover:ring-green-600";

  const qtyBtn =
    "h-9 w-9 rounded-xl bg-white text-green-700 font-extrabold transition ring-1 ring-green-600/70 hover:bg-green-600 hover:text-white hover:ring-green-600 active:scale-[0.98]";

  if (step === "summary") {
    return (
      <div className="grid gap-5">
        <div className="grid grid-cols-3 items-center gap-4">
          <div>
            <button
              type="button"
              onClick={() => setStep("menu")}
              className="rounded-2xl px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-100/60 bg-green-50 ring-1 ring-green-600/25"
            >
              ← Zpět
            </button>
          </div>

          <div className="text-center">
            <div className="text-2xl font-extrabold text-green-700 whitespace-nowrap">Souhrn objednávky</div>
          </div>

          <div className="text-right">
            <div className="text-sm font-semibold text-gray-500">{cartCount} ks</div>
          </div>
        </div>

        {cart.length === 0 ? (
          <div className="rounded-2xl bg-white p-4 text-gray-600 ring-1 ring-black/5">Košík je prázdný.</div>
        ) : (
          <>
            {byDay.map(([day, items2]) => (
              <div key={day} className="rounded-2xl bg-white p-4 ring-2 ring-green-600/40 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-extrabold text-gray-800">{formatDayLabel(day)}</div>
                  <div className="text-xs font-semibold text-gray-500">
                    {items2.reduce((s, x) => s + x.qty, 0)} ks
                  </div>
                </div>

                <div className="grid gap-2">
                  {items2.map((it) => (
                    <div
                      key={it.key}
                      className="rounded-xl bg-green-50 px-3 py-2 ring-2 ring-green-600/50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="min-w-0 flex-1 truncate font-semibold text-gray-900">
                          {it.nazev}
                        </div>
                        <div className="shrink-0 text-sm font-medium text-gray-500">
                          {it.kategorie ?? ""}
                        </div>
                        <div className="shrink-0 text-sm font-bold text-gray-700">
                          {it.qty} ks
                        </div>
                        <div className="shrink-0 text-sm font-bold text-green-700">
                          {it.cena * it.qty} Kč
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="rounded-2xl bg-green-50 ring-1 ring-green-600/20 p-5 flex items-center justify-between">
              <div className="text-lg font-extrabold text-gray-900">Celkem</div>
              <div className="text-xl font-extrabold text-green-700">{total} Kč</div>
            </div>

            <button
              type="button"
              onClick={() => setStep("checkout")}
              className="w-full rounded-2xl bg-green-600 px-4 py-4 text-sm font-extrabold text-white transition hover:brightness-95"
            >
              Dokončit objednávku
            </button>
          </>
        )}
      </div>
    );
  }

  if (step === "checkout") {
    const inputBase =
      "w-full rounded-2xl px-3 py-2 text-[14px] font-semibold text-gray-900 placeholder:text-gray-400 transition focus:outline-none focus:ring-2";
    const normal = "bg-white ring-1 ring-black/10 focus:ring-green-600/25";
    const filled = "bg-green-50 ring-1 ring-green-600/25 focus:ring-green-600/25";

    const box =
      "rounded-3xl bg-white ring-1 ring-black/5 p-3 md:p-4 shadow-[0_10px_30px_rgba(0,0,0,0.04)] space-y-3";

    const row = "grid gap-2 md:grid-cols-[190px_1fr] md:items-center";
    const leftLabel = "text-[14px] font-semibold text-gray-800";

    const optionField =
      "w-full rounded-2xl px-3 py-2.5 text-left font-extrabold bg-green-50 ring-1 ring-green-600/25 hover:bg-green-100/40 transition flex items-center justify-between gap-3";

    const popover =
      "absolute z-50 mt-2 w-[360px] max-w-[calc(100vw-48px)] rounded-3xl bg-white ring-1 ring-black/10 shadow-[0_20px_60px_rgba(0,0,0,0.18)] p-2";

    const popItem =
      "w-full rounded-2xl px-4 py-3 text-left transition ring-1 ring-black/5 hover:bg-green-50 flex items-start justify-between gap-4";

    const badge =
      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold bg-green-50 ring-1 ring-green-600/25 text-green-700";

    const deliveryLabel = deliveryMode === "delivery" ? "Doručení" : "Osobní odběr";
    const deliveryExtra = deliveryMode === "delivery" ? "Doprava 10 Kč" : "Bez dopravy";

    const packagingLabel =
      packagingMode === "plastic"
        ? "Plastová krabička"
        : packagingMode === "rekrabicka"
        ? "REkrabička"
        : "Jídlonosič";

    const packagingExtra =
      packagingMode === "plastic"
        ? `+ 8 Kč jídlo / + 7 Kč polévka`
        : packagingMode === "rekrabicka"
        ? "Záloha 80 Kč"
        : "Bez poplatku";

    const paymentLabel =
      payment === "card_online"
        ? "Kartou online"
        : payment === "online"
        ? "Online"
        : payment === "card_on_delivery"
        ? "Kartou při doručení"
        : payment === "cash"
        ? "Hotově"
        : "Kredit";

    return (
      <div className="grid gap-2 -mt-1">
        <div className="grid grid-cols-3 items-center gap-3">
          <div>
            <button
              type="button"
              onClick={() => setStep("summary")}
              className="rounded-2xl px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-100/60 bg-green-50 ring-1 ring-green-600/25"
            >
              ← Zpět
            </button>
          </div>

          <div className="text-center">
            <div className="text-2xl font-extrabold text-green-700 whitespace-nowrap">Dokončení</div>
          </div>

          <div className="text-right">
            <div className="text-sm font-semibold text-gray-500">{cartCount} ks</div>
          </div>
        </div>

        <div className="-mt-2">
          <div className={box}>
            <div className={row}>
              <div className={leftLabel}>Způsob převzetí</div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setDeliveryOpen((v) => !v);
                    setPackagingOpen(false);
                    setPaymentOpen(false);
                  }}
                  className={optionField}
                >
                  <div className="min-w-0">
                    <div className="text-[14px] font-extrabold text-gray-900">
                      {deliveryLabel}{" "}
                      <span className="ml-2 text-sm font-extrabold text-gray-500">({deliveryExtra})</span>
                    </div>
                  </div>
                  <span className="text-lg font-semibold text-green-700/70 shrink-0">›</span>
                </button>

                {hasSaturdayInCart && (
                  <div className="mt-2 rounded-2xl bg-yellow-50 ring-1 ring-yellow-200 px-4 py-3 text-sm font-semibold text-yellow-800 flex items-start gap-2">
                    <span className="text-lg leading-none">⚠️</span>
                    <div>
                      Nelze zvolit <b>doručení</b>, protože v košíku je <b>sobota</b> (v sobotu se nerozváží).
                    </div>
                  </div>
                )}

                {deliveryOpen && (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-40 cursor-default"
                      onClick={() => setDeliveryOpen(false)}
                      aria-label="close"
                    />

                    <div className={popover + " z-50"}>
                      <button
                        type="button"
                        disabled={hasSaturdayInCart}
                        className={
                          popItem +
                          (deliveryMode === "delivery"
                            ? " bg-green-50 ring-2 ring-green-600/30"
                            : " bg-white") +
                          (hasSaturdayInCart ? " opacity-50 cursor-not-allowed" : "")
                        }
                        onClick={() => {
                          if (hasSaturdayInCart) return;
                          setDeliveryMode("delivery");
                          setDeliveryOpen(false);
                        }}
                      >
                        <div>
                          <div className="font-extrabold text-gray-900">Doručení</div>
                          <div className="text-xs font-semibold text-gray-500">Přivezeme na adresu</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-extrabold text-gray-600">Doprava 10 Kč</div>
                        </div>
                      </button>

                      <div className="h-2" />

                      <button
                        type="button"
                        className={
                          popItem +
                          (deliveryMode === "pickup" ? " bg-green-50 ring-2 ring-green-600/30" : " bg-white")
                        }
                        onClick={() => {
                          setDeliveryMode("pickup");
                          setDeliveryOpen(false);
                        }}
                      >
                        <div>
                          <div className="font-extrabold text-gray-900">Osobní odběr</div>
                          <div className="text-xs font-semibold text-gray-500">Vyzvednutí u nás</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-extrabold text-gray-600">Bez dopravy</div>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className={row}>
              <div className={leftLabel}>Jméno a příjmení</div>
              <input
                className={inputBase + " " + (name.trim() ? filled : normal)}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Např. Jan Novák"
                autoComplete="name"
              />
            </div>

            <div className={row}>
              <div className={leftLabel}>Telefon</div>
              <input
                className={inputBase + " " + (phone.trim() ? filled : normal)}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="111 111 111"
                autoComplete="tel"
              />
            </div>

            <div className={row}>
              <div className={leftLabel}>Adresa</div>
              <input
                className={
                  inputBase +
                  " " +
                  (address.trim() ? filled : normal) +
                  (deliveryMode === "pickup" ? " opacity-60" : "")
                }
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ulice a č.p., město"
                autoComplete="street-address"
                disabled={deliveryMode === "pickup"}
              />
            </div>

            <div className={row}>
              <div className={leftLabel}>Poznámka</div>
              <textarea
                className={inputBase + " " + normal + " h-[38px] resize-none"}
                placeholder="Např. bez cibule, zazvonit…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <div className={row}>
              <div className={leftLabel}>Balení</div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setPackagingOpen((v) => !v);
                    setDeliveryOpen(false);
                    setPaymentOpen(false);
                  }}
                  className={optionField}
                >
                  <div className="min-w-0">
                    <div className="text-[14px] font-extrabold text-gray-900">
                      {packagingLabel}{" "}
                      <span className="ml-2 text-[12px] font-bold text-gray-400">({packagingExtra})</span>
                    </div>
                  </div>
                  <span className="text-lg font-semibold text-green-700/70 shrink-0">›</span>
                </button>

                {packagingOpen && (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-40 cursor-default"
                      onClick={() => {
                        setPackagingOpen(false);
                        setPackTooltip(null);
                      }}
                      aria-label="close"
                    />

                    <div className="absolute left-full top-[-110px] ml-[-300px] w-[380px] rounded-3xl bg-white ring-1 ring-black/10 shadow-[0_20px_60px_rgba(0,0,0,0.18)] p-4 z-50">
                      <button
                        type="button"
                        className={
                          popItem +
                          (packagingMode === "plastic" ? " bg-green-50 ring-2 ring-green-600/30" : " bg-white")
                        }
                        onClick={() => {
                          setPackagingMode("plastic");
                          setPackagingOpen(false);
                          setPackTooltip(null);
                        }}
                      >
                        <div className="min-w-0">
                          <div className="font-extrabold text-gray-900">Plastová krabička</div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex flex-col items-end leading-tight">
                            <span className={badge + " whitespace-nowrap"}>7 Kč polévka</span>
                            <span className={badge + " whitespace-nowrap mt-1"}>8 Kč jídlo</span>
                          </div>

                          <div
                            className="relative"
                            onMouseEnter={() => setPackTooltip("plastic")}
                            onMouseLeave={() => setPackTooltip(null)}
                          >
                            <button
                              type="button"
                              className="h-9 w-9 rounded-full ring-1 ring-black/10 bg-white hover:bg-black/5 font-extrabold text-gray-700"
                              onClick={(e) => e.stopPropagation()}
                              title="Info"
                            >
                              i
                            </button>

                            {packTooltip === "plastic" && (
                              <div className="absolute right-0 top-full mt-3 w-[380px] rounded-3xl bg-white ring-1 ring-black/10 shadow-[0_20px_60px_rgba(0,0,0,0.18)] p-4 flex gap-4">
                                <img
                                  src="/baleni/plast.jpg"
                                  alt="Plastová krabička"
                                  className="h-20 w-20 rounded-2xl object-cover ring-1 ring-black/10"
                                />
                                <div className="min-w-0">
                                  <div className="font-extrabold text-gray-900">Plastová krabička</div>
                                  <div className="text-[15px] font-semibold text-gray-700 leading-snug">
                                    Polévka: 7 Kč • Jídlo: 8 Kč (počítá se podle položek v košíku).
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </button>

                      <div className="h-2" />

                      <button
                        type="button"
                        className={
                          popItem +
                          (packagingMode === "rekrabicka" ? " bg-green-50 ring-2 ring-green-600/30" : " bg-white")
                        }
                        onClick={() => {
                          setPackagingMode("rekrabicka");
                          setPackagingOpen(false);
                          setPackTooltip(null);
                        }}
                      >
                        <div className="min-w-0">
                          <div className="font-extrabold text-gray-900">REkrabička</div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className={badge + " whitespace-nowrap"}>Záloha 80 Kč</span>

                          <div
                            className="relative"
                            onMouseEnter={() => setPackTooltip("rekrabicka")}
                            onMouseLeave={() => setPackTooltip(null)}
                          >
                            <span
                              role="button"
                              tabIndex={0}
                              className="h-9 w-9 inline-flex items-center justify-center rounded-full ring-1 ring-black/10 bg-white hover:bg-black/5 font-extrabold text-gray-700 cursor-pointer select-none"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }
                              }}
                              title="Info"
                            >
                              i
                            </span>

                            {packTooltip === "rekrabicka" && (
                              <div className="absolute right-0 top-full mt-3 w-[380px] rounded-3xl bg-white ring-1 ring-black/10 shadow-[0_20px_60px_rgba(0,0,0,0.18)] p-4 flex gap-4">
                                <img
                                  src="/baleni/rekrabicka.jpg"
                                  alt="ReKrabička"
                                  className="h-20 w-20 rounded-2xl object-cover ring-1 ring-black/10"
                                />
                                <div className="min-w-0">
                                  <div className="font-extrabold text-gray-900">REkrabička</div>
                                  <div className="text-[15px] font-semibold text-gray-700 leading-snug">
                                    Vratná krabička se zálohou 80 Kč.
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </button>

                      <div className="h-2" />

                      <button
                        type="button"
                        className={popItem + (packagingMode === "own" ? " bg-green-50 ring-2 ring-green-600/30" : " bg-white")}
                        onClick={() => {
                          setPackagingMode("own");
                          setPackagingOpen(false);
                          setPackTooltip(null);
                        }}
                      >
                        <div className="min-w-0">
                          <div className="font-extrabold text-gray-900">Jídlonosič</div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className={badge + " whitespace-nowrap"}>Bez poplatku</span>

                          <div
                            className="relative"
                            onMouseEnter={() => setPackTooltip("own")}
                            onMouseLeave={() => setPackTooltip(null)}
                          >
                            <button
                              type="button"
                              className="h-9 w-9 rounded-full ring-1 ring-black/10 bg-white hover:bg-black/5 font-extrabold text-gray-700"
                              onClick={(e) => e.stopPropagation()}
                              title="Info"
                            >
                              i
                            </button>

                            {packTooltip === "own" && (
                              <div className="absolute right-0 top-full mt-2 w-[320px] rounded-3xl bg-white ring-1 ring-black/10 shadow-[0_20px_60px_rgba(0,0,0,0.18)] p-3 flex gap-3">
                                <img
                                  src="/baleni/jidlonosic.jpg"
                                  alt="Jídlonosič"
                                  className="h-16 w-16 rounded-2xl object-cover ring-1 ring-black/10"
                                />
                                <div className="min-w-0">
                                  <div className="font-extrabold text-gray-900">Jídlonosič</div>
                                  <div className="text-sm font-semibold text-gray-600">Pro stálé zákazníky.</div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className={row}>
              <div className={leftLabel}>
                Preferuji čas doručení <span className="text-xs font-semibold text-gray-500">(volitelné)</span>
              </div>

              <button
                type="button"
                className={optionField}
                onClick={() => {
                  setTimeOpen(true);
                  setDeliveryOpen(false);
                  setPackagingOpen(false);
                  setPaymentOpen(false);
                }}
              >
                <div className="min-w-0">
                  <div className="text-[12px] font-extrabold text-gray-500">
                    {timeSummary ?? "Vybrat čas"}
                  </div>
                </div>
                <span className="text-lg font-semibold text-green-700/70 shrink-0">›</span>
              </button>
            </div>

            <div className={row}>
              <div className={leftLabel}>Platba</div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentOpen((v) => !v);
                    setDeliveryOpen(false);
                    setPackagingOpen(false);
                  }}
                  className={optionField}
                >
                  <div className="min-w-0">
                    <div className="text-[14px] font-extrabold text-gray-900">{paymentLabel}</div>
                  </div>
                  <span className="text-lg font-semibold text-green-700/70 shrink-0">›</span>
                </button>

                {paymentOpen && (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-40 cursor-default"
                      onClick={() => setPaymentOpen(false)}
                      aria-label="close"
                    />

                    <div className={popover + " z-50"}>
                      <button
                        type="button"
                        className={
                          popItem +
                          (payment === "card_online" ? " bg-green-50 ring-2 ring-green-600/30" : " bg-white")
                        }
                        onClick={() => {
                          setPayment("card_online");
                          setPaymentOpen(false);
                        }}
                      >
                        <div>
                          <div className="font-extrabold text-gray-900">Kartou online</div>
                          <div className="text-xs font-semibold text-gray-500">Platební brána</div>
                        </div>
                      </button>

                      <div className="h-2" />

                      <button
                        type="button"
                        className={popItem + (payment === "online" ? " bg-green-50 ring-2 ring-green-600/30" : " bg-white")}
                        onClick={() => {
                          setPayment("online");
                          setPaymentOpen(false);
                        }}
                      >
                        <div>
                          <div className="font-extrabold text-gray-900">Online</div>
                          <div className="text-xs font-semibold text-gray-500">Např. převod / QR</div>
                        </div>
                      </button>

                      <div className="h-2" />

                      <button
                        type="button"
                        className={
                          popItem +
                          (payment === "card_on_delivery" ? " bg-green-50 ring-2 ring-green-600/30" : " bg-white")
                        }
                        onClick={() => {
                          setPayment("card_on_delivery");
                          setPaymentOpen(false);
                        }}
                      >
                        <div>
                          <div className="font-extrabold text-gray-900">Kartou při doručení</div>
                          <div className="text-xs font-semibold text-gray-500">Terminál u kurýra</div>
                        </div>
                      </button>

                      <div className="h-2" />

                      <button
                        type="button"
                        className={popItem + (payment === "cash" ? " bg-green-50 ring-2 ring-green-600/30" : " bg-white")}
                        onClick={() => {
                          setPayment("cash");
                          setPaymentOpen(false);
                        }}
                      >
                        <div>
                          <div className="font-extrabold text-gray-900">Hotově</div>
                          <div className="text-xs font-semibold text-gray-500">Platba při převzetí</div>
                        </div>
                      </button>

                      <div className="h-2" />

                      <button
                        type="button"
                        className={popItem + (payment === "credit" ? " bg-green-50 ring-2 ring-green-600/30" : " bg-white")}
                        onClick={() => {
                          setPayment("credit");
                          setPaymentOpen(false);
                        }}
                      >
                        <div>
                          <div className="font-extrabold text-gray-900">Kredit</div>
                          <div className="text-xs font-semibold text-gray-500">Odečte se z kreditu</div>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {timeOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/20"
              onClick={() => setTimeOpen(false)}
              aria-label="close"
            />

            <div className="fixed left-1/2 top-1/2 z-50 w-[520px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white ring-1 ring-black/10 shadow-[0_20px_60px_rgba(0,0,0,0.18)] p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xl font-extrabold text-gray-900">Čas doručení</div>
                  <div className="text-sm font-semibold text-gray-600">10:00 – 13:30 (po 30 min) • (volitelné)</div>
                </div>

                <button
                  type="button"
                  className="h-10 w-10 rounded-full ring-1 ring-black/10 hover:bg-black/5 font-extrabold"
                  onClick={() => setTimeOpen(false)}
                >
                  ×
                </button>
              </div>

              <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                {timePickDays.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setActiveTimeDay(d)}
                    className={
                      "rounded-full px-3 py-2 text-sm font-extrabold ring-1 " +
                      (activeTimeDay === d
                        ? "bg-green-600 text-white ring-green-600"
                        : "bg-white text-green-700 ring-black/10 hover:bg-green-50")
                    }
                  >
                    {formatDayLabel(d)}
                  </button>
                ))}
              </div>

              <label className="mt-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <input type="checkbox" checked={sameTimeForAll} onChange={(e) => setSameTimeForAll(e.target.checked)} />
                Stejný čas pro všechny dny
              </label>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {buildTimeSlots("10:00", "13:30", 30).map((s) => {
                  const dayKey = activeTimeDay ?? cartDays[0] ?? null;
                  const cur = dayKey ? timesByDay[dayKey] : null;
                  const isActive = cur?.from === s.from && cur?.to === s.to;

                  return (
                    <button
                      key={s.from}
                      type="button"
                      className={
                        "rounded-2xl px-4 py-3 text-sm font-extrabold ring-1 transition " +
                        (isActive
                          ? "bg-green-50 ring-2 ring-green-600/40 text-gray-900"
                          : "bg-white ring-black/10 hover:bg-black/5 text-gray-800")
                      }
                      onClick={() => {
                        const applyTo = sameTimeForAll ? timePickDays : dayKey ? [dayKey] : [];
                        setTimesByDay((prev) => {
                          const next = { ...prev };
                          for (const d of applyTo) next[d] = { from: s.from, to: s.to };
                          return next;
                        });
                      }}
                    >
                      {s.from}–{s.to}
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setTimeOpen(false)}
                  className="rounded-2xl bg-green-600 px-6 py-3 text-sm font-extrabold text-white hover:brightness-95"
                >
                  Hotovo
                </button>
              </div>
            </div>
          </>
        )}

        <div className="rounded-3xl bg-green-50 ring-1 ring-green-600/20 p-3">
          <div className="flex items-center justify-between">
            <div className="text-lg font-extrabold text-gray-900">Celkem</div>
            <div className="text-xl font-extrabold text-green-700">{totalWithExtras} Kč</div>
          </div>

          <div className="mt-2 text-sm font-semibold text-gray-600">
            Jídla: {total} Kč
            {deliveryFee ? ` • Doprava: ${deliveryFee} Kč` : " • Bez dopravy"}
            {packagingMode === "plastic" ? ` • Balení: ${packagingFee} Kč` : ""}
            {packagingMode === "rekrabicka" ? ` • Záloha: ${packagingDeposit} Kč` : ""}
          </div>

          {msg ? (
            <div className="mt-3 rounded-2xl bg-white ring-1 ring-black/10 px-4 py-3 text-sm font-semibold text-gray-800">
              {msg}
            </div>
          ) : null}

          <button
            type="button"
            onClick={finishOrder}
            disabled={saving}
            className="mt-3 w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-extrabold text-white hover:brightness-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? "Odesílám…" : "Dokončit objednávku"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-extrabold text-green-700">Objednávka jídel</div>
          <div className="mt-1 text-sm text-gray-500">{rangeLabel}</div>
        </div>

        <button
          type="button"
          className={
            "inline-flex items-center gap-3 rounded-2xl px-4 py-2 ring-1 ring-black/5 transition " +
            (cartCount > 0 && !zavreno ? "bg-green-50 ring-2 ring-green-600/25" : "bg-white hover:bg-green-50")
          }
          onClick={() => {
            if (cartCount === 0 || zavreno) return;
            setStep("summary");
          }}
          title={zavreno ? "V neděli je zavřeno" : cartCount === 0 ? "Košík je prázdný" : "Otevřít souhrn"}
        >
          <span className="text-base font-extrabold text-green-700">Objednávka</span>
          <span className="text-base">🛒</span>
          <span className="text-base font-extrabold text-green-700">{total} Kč</span>
          <span className="text-gray-300">•</span>
          <span className="text-base font-semibold text-gray-800">{cartCount} ks</span>
          <span className="ml-1 text-base font-extrabold text-green-700">→</span>
        </button>
      </div>

      <div className="w-full">
        {weekOffset === 0 ? (
          <div className="grid grid-cols-8 gap-2 w-full">
            {days.map((d) => (
              <button key={d} type="button" onClick={() => setSelectedDate(d)} className={dayBtn(d === selectedDate)}>
                {formatDayLabel(d)}
              </button>
            ))}
            <button type="button" onClick={() => setWeekOffset(1)} className={arrowBtnFull} title="Na 2. týden">
              →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-8 gap-2 w-full">
            <button type="button" onClick={() => setWeekOffset(0)} className={arrowBtnFull} title="Zpět na 1. týden">
              ←
            </button>
            {days.map((d) => (
              <button key={d} type="button" onClick={() => setSelectedDate(d)} className={dayBtn(d === selectedDate)}>
                {formatDayLabel(d)}
              </button>
            ))}
          </div>
        )}
      </div>

      {zavreno && (
        <div className="rounded-2xl bg-red-50 ring-2 ring-red-200/60 p-3 text-red-700 font-semibold">
          V neděli je zavřeno.
        </div>
      )}

      {loadingMenu ? (
        <div className="rounded-2xl bg-gray-50 ring-1 ring-black/5 px-4 py-4 text-sm font-semibold text-gray-600">
          Načítám menu…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl bg-gray-50 ring-1 ring-black/5 px-4 py-4 text-sm font-semibold text-gray-600">
          Zatím nebylo zveřejněné menu.
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((r, idx) => {
            const key = keyFor(selectedDate, r.jidlo_id);
            const qty = cart.find((x) => x.key === key)?.qty ?? 0;
            const cena = Number(r.jidla?.cena ?? 0).toFixed(2);
            const allergenText = allergensToText(r.jidla?.alergeny);

            return (
              <div
                key={idx}
                className={
                  "rounded-[22px] border px-4 py-3 transition " +
                  (qty > 0
                    ? "bg-[#f2faf5] border-[#9ad2b0]"
                    : "bg-white border-[#cfe2d6] hover:bg-[#f7fbf8]")
                }
              >
                <div className="grid grid-cols-[minmax(0,1fr)_210px_110px_120px] items-center gap-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="min-w-0 truncate text-[17px] font-bold tracking-[-0.01em] text-[#1f2f56]">
                      {r.jidla?.nazev ?? ""}
                    </div>

                    <div className="relative group shrink-0">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full border border-[#7ac796] bg-white text-[11px] font-extrabold text-[#067647] cursor-default">
                        i
                      </div>

                      <div className="pointer-events-none invisible absolute left-0 top-full z-50 mt-3 w-[340px] rounded-[18px] border border-[#bde7c8] bg-white p-4 text-left opacity-0 shadow-[0_16px_40px_rgba(0,0,0,0.14)] transition-all duration-150 group-hover:visible group-hover:opacity-100">
                        <div className="text-[14px] font-extrabold text-[#1f2f56]">
                          {r.jidla?.nazev ?? ""}
                        </div>
                        <div className="mt-2 text-[12px] font-bold uppercase tracking-wide text-[#08a652]">
                          Alergeny
                        </div>
                        <div className="mt-1 text-[13px] font-semibold leading-5 text-gray-700">
                          {allergenText}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold text-[#08a652]">
                      {r.jidla?.kategorie ?? ""}
                    </div>
                  </div>

                  <div className="whitespace-nowrap text-[16px] font-extrabold text-[#067647]">
                    {cena} Kč
                  </div>

                  <div className="flex justify-end">
                    {qty === 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (zavreno) return;
                          addOne(selectedDate, r);
                        }}
                        className={addBtn}
                      >
                        Přidat
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => removeOne(selectedDate, r)} className={qtyBtn}>
                          −
                        </button>
                        <div className="w-8 text-center text-sm font-extrabold text-[#17325c]">{qty}</div>
                        <button type="button" onClick={() => addOne(selectedDate, r)} className={qtyBtn}>
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}