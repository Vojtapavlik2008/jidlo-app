"use client";

import { useEffect, useMemo, useState } from "react";
import { useOrder, type DbMenuRow } from "./order-context";
import {
  formatDayLabel,
  formatRangeLabel,
  isSunday,
  msUntilNextMidnightLocal,
  toISODate,
} from "./_helpers";

// ---- local date helpers (ISO, lokálně) ----
function fromISOToLocalDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function addDaysISO(iso: string, days: number) {
  const d = fromISOToLocalDate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

function mondayOfISO(iso: string) {
  const d = fromISOToLocalDate(iso);
  const dow = d.getDay(); // 0=Ne..6=So
  const diff = dow === 0 ? -6 : 1 - dow; // na pondělí
  d.setDate(d.getDate() + diff);
  return toISODate(d);
}

function uiTodayISO() {
  const today = toISODate(new Date());
  const d = fromISOToLocalDate(today);
  if (d.getDay() === 0) return addDaysISO(today, 1);
  return today;
}

async function fetchMenu(from: string, to: string): Promise<DbMenuRow[]> {
  const qs = new URLSearchParams({ from, to });
  const r = await fetch(`/api/menu?${qs.toString()}`, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || "Chyba při načítání menu.");
  return (j?.data ?? []) as DbMenuRow[];
}

export default function OrderMenuDesktop({
  onOpenCart,
}: {
  onOpenCart: () => void;
}) {
  const { cartCount, total, addOne, removeOne, keyFor, cart } = useOrder();

  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const baseMondayISO = useMemo(() => mondayOfISO(uiTodayISO()), [tick]);

  const [weekOffset, setWeekOffset] = useState<0 | 1>(0);

  useEffect(() => {
    setWeekOffset(0);
  }, [baseMondayISO]);

  const days = useMemo(() => {
    const start = addDaysISO(baseMondayISO, weekOffset * 7);
    const arr: string[] = [];
    for (let i = 0; i < 7; i++) arr.push(addDaysISO(start, i));
    return arr;
  }, [baseMondayISO, weekOffset]);

  // DŮLEŽITÉ:
  // selectedDate nesmí při inicializaci používat `days`,
  // protože `days` ještě v ten moment není připravené.
  const [selectedDate, setSelectedDate] = useState<string>(() => uiTodayISO());

  useEffect(() => {
    if (!days.length) return;

    const todayIso = uiTodayISO();
    setSelectedDate((prev) => {
      if (days.includes(prev)) return prev;
      return days.includes(todayIso) ? todayIso : days[0];
    });
  }, [days]);

  useEffect(() => {
    const t = setTimeout(() => {
      const todayIso = uiTodayISO();

      setSelectedDate((prev) => {
        if (days.includes(todayIso)) return todayIso;
        return days.includes(prev) ? prev : days[0] ?? prev;
      });

      setTick((x) => x + 1);
    }, msUntilNextMidnightLocal() + 50);

    return () => clearTimeout(t);
  }, [days]);

  const zavreno = isSunday(selectedDate);

  const [menuByDate, setMenuByDate] = useState<Record<string, DbMenuRow[]>>({});
  const [loadingMenu, setLoadingMenu] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadMenu() {
      if (!days.length) return;

      setLoadingMenu(true);

      try {
        const from = days[0];
        const to = days[6];
        const rows = await fetchMenu(from, to);

        if (!alive) return;

        const map: Record<string, DbMenuRow[]> = {};
        for (const d of days) map[d] = [];

        for (const r of rows) {
          if (!map[r.datum]) map[r.datum] = [];
          map[r.datum].push(r);
        }

        setMenuByDate(map);
      } catch (e) {
        console.error("OrderMenuDesktop loadMenu error:", e);
        if (!alive) return;
        setMenuByDate({});
      } finally {
        if (alive) setLoadingMenu(false);
      }
    }

    loadMenu();

    return () => {
      alive = false;
    };
  }, [days]);

  const items = useMemo(() => {
    return (menuByDate[selectedDate] ?? []).filter((x) => x.jidla).slice(0, 30);
  }, [menuByDate, selectedDate]);

  const rangeLabel = useMemo(() => {
    if (!days.length) return "";
    return formatRangeLabel(days[0], days[6]);
  }, [days]);

  const dayBtn = (active: boolean) =>
    "rounded-[14px] px-4 py-2.5 text-sm font-bold transition border " +
    (active
      ? "bg-[#08a652] text-white border-[#08a652] shadow-sm"
      : "bg-white text-[#067647] border-[#d9e7de] hover:bg-[#f6fbf8]");

  const arrowBtn =
    "rounded-[14px] px-5 py-2.5 text-sm font-bold bg-white text-[#067647] border border-[#d9e7de] hover:bg-[#f6fbf8]";

  const qtyBtn =
    "h-9 w-9 rounded-[12px] bg-white text-[#067647] font-extrabold transition border border-[#7ac796] " +
    "hover:bg-[#08a652] hover:text-white hover:border-[#08a652] active:scale-[0.98]";

  const addBtn =
    "rounded-[14px] px-5 py-2 text-sm font-bold transition border border-[#73c690] text-[#067647] bg-white " +
    "hover:bg-[#08a652] hover:text-white hover:border-[#08a652] disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[18px] leading-tight font-extrabold text-[#067647]">
            Objednávka jídel
          </div>
          <div className="mt-1 text-sm text-gray-500">{rangeLabel}</div>
        </div>

        <button
          type="button"
          className={
            "inline-flex items-center gap-3 rounded-full px-5 py-2.5 border transition " +
            (cartCount > 0 && !zavreno
              ? "bg-[#f4fbf7] border-[#bfe0cb]"
              : "bg-white border-[#e5ece8] hover:bg-[#f6fbf8]")
          }
          onClick={() => {
            if (cartCount === 0 || zavreno) return;
            onOpenCart();
          }}
          title={
            zavreno
              ? "V neděli je zavřeno"
              : cartCount === 0
              ? "Košík je prázdný"
              : "Otevřít souhrn"
          }
        >
          <span className="text-[15px] font-extrabold text-[#067647]">Objednávka</span>
          <span className="text-base">🛒</span>
          <span className="text-[15px] font-extrabold text-[#067647]">{total} Kč</span>
          <span className="text-gray-300">•</span>
          <span className="text-[15px] font-semibold text-gray-800">{cartCount} ks</span>
          <span className="ml-1 text-[15px] font-extrabold text-[#067647]">→</span>
        </button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {weekOffset === 1 ? (
          <button
            type="button"
            className={arrowBtn}
            onClick={() => setWeekOffset(0)}
            title="Zpět na 1. týden"
          >
            ←
          </button>
        ) : null}

        {days.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setSelectedDate(d)}
            className={dayBtn(d === selectedDate)}
          >
            {formatDayLabel(d)}
          </button>
        ))}

        {weekOffset === 0 ? (
          <button
            type="button"
            className={arrowBtn}
            onClick={() => setWeekOffset(1)}
            title="Na 2. týden"
          >
            →
          </button>
        ) : null}
      </div>

      {zavreno && (
        <div className="rounded-2xl bg-red-50 ring-2 ring-red-200/60 p-3 text-red-700 font-semibold">
          V neděli je zavřeno.
        </div>
      )}

      {loadingMenu ? (
        <div className="rounded-[24px] border border-[#e3ece7] bg-[#f8faf9] px-4 py-4 text-sm font-semibold text-gray-600">
          Načítám menu…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[24px] border border-[#e3ece7] bg-[#f8faf9] px-4 py-4 text-sm font-semibold text-gray-600">
          Zatím nebylo zveřejněné menu.
        </div>
      ) : (
        <div className="grid gap-3 rounded-[28px] border border-[#cfe4d7] bg-[#f8fbf9] p-4">
          {items.map((r, idx) => {
            const key = keyFor(selectedDate, r.jidlo_id);
            const qty = cart.find((x) => x.key === key)?.qty ?? 0;
            const cena = Number(r.jidla?.cena ?? 0).toFixed(2);

            return (
              <div
                key={idx}
                className={
                  "rounded-[22px] border px-4 py-3 transition " +
                  (qty > 0
                    ? "border-[#9ad2b0] bg-[#f2faf5]"
                    : "border-[#cfe2d6] bg-white hover:bg-[#f7fbf8]")
                }
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[18px] leading-[1.2] font-bold text-[#17325c]">
                      {r.jidla?.nazev ?? ""}
                    </div>
                    <div className="mt-1 truncate text-[13px] font-semibold text-[#08a652]">
                      {r.jidla?.kategorie ?? ""}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-4">
                    <div className="whitespace-nowrap text-[16px] font-extrabold text-[#067647]">
                      {cena} Kč
                    </div>

                    {qty === 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (zavreno) return;
                          addOne(selectedDate, r);
                        }}
                        className={addBtn}
                        disabled={zavreno}
                      >
                        Přidat
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => removeOne(selectedDate, r)}
                          className={qtyBtn}
                        >
                          −
                        </button>
                        <div className="w-8 text-center text-sm font-extrabold text-[#17325c]">
                          {qty}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (zavreno) return;
                            addOne(selectedDate, r);
                          }}
                          className={qtyBtn}
                          disabled={zavreno}
                        >
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