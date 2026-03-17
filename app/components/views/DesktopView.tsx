"use client";

import { useEffect, useMemo, useState } from "react";
import AuthButton from "@/app/components/AuthButton";
import { supabase } from "@/lib/supabase";
import OrderMenuDesktop from "@/app/components/order/OrderMenuDesktop";

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
                <OrderMenuDesktop onOpenCart={onOpenCart} />
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
  const todayIso = toISODate(new Date());

  const dayBtn = (active: boolean) =>
    "rounded-xl px-3 py-2 text-sm font-semibold transition w-full " +
    (active
      ? "bg-green-600 text-white shadow-sm"
      : "bg-white text-green-700 ring-1 ring-black/5 hover:bg-green-50");

  const arrowBtnFull =
    "h-[40px] w-full rounded-xl bg-white text-green-700 font-extrabold transition ring-1 ring-black/5 hover:bg-green-50";

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