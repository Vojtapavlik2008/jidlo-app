"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type MenuRow = {
  id: string; // jidelnik.id
  datum: string; // YYYY-MM-DD
  poradi: number | null;
  dostupne: boolean;
  jidlo: {
    legacy_id: number;
    nazev: string;
    cena: number | null;
    kategorie: string | null;
  } | null;
};

type CartItem = {
  key: string; // unikátní klíč (db nebo mock)
  source: "db" | "mock";
  datum: string; // datum dne, pro který je položka objednaná
  legacy_id?: number; // jen pro db
  nazev: string;
  cena: number;
  qty: number;
};

type Zpusob = "rozvoz" | "vyzvednuti";
type Baleni = "plast" | "eko" | "jidlonosic";

type MockItem = { kategorie: string; nazev: string; cena: number };

const PROVIZORNI_MENU: Record<string, MockItem[]> = {
  "2026-02-16": [
    { kategorie: "Polévka", nazev: "Hovězí vývar", cena: 35 },
    { kategorie: "Kuřecí maso", nazev: "Kuře na paprice, rýže", cena: 119 },
    { kategorie: "Salát", nazev: "Zeleninový salát 100g", cena: 20 },
  ],
  "2026-02-17": [
    { kategorie: "Polévka", nazev: "Hovězí vývar", cena: 35 },
    { kategorie: "Kuřecí maso", nazev: "Kuře na paprice, rýže", cena: 119 },
    { kategorie: "Salát", nazev: "Zeleninový salát 100g", cena: 20 },
  ],
  "2026-02-18": [
    { kategorie: "Polévka", nazev: "Hovězí vývar", cena: 35 },
    { kategorie: "Kuřecí maso", nazev: "Kuře na paprice, rýže", cena: 119 },
    { kategorie: "Salát", nazev: "Zeleninový salát 100g", cena: 20 },
  ],
  "2026-02-19": [
    { kategorie: "Polévka", nazev: "Hovězí vývar", cena: 35 },
    { kategorie: "Kuřecí maso", nazev: "Kuře na paprice, rýže", cena: 119 },
    { kategorie: "Salát", nazev: "Zeleninový salát 100g", cena: 20 },
  ],
  "2026-02-20": [
    { kategorie: "Polévka", nazev: "Hovězí vývar", cena: 35 },
    { kategorie: "Kuřecí maso", nazev: "Kuře na paprice, rýže", cena: 119 },
    { kategorie: "Salát", nazev: "Zeleninový salát 100g", cena: 20 },
  ],
  "2026-02-21": [
    { kategorie: "Polévka", nazev: "Hovězí vývar", cena: 35 },
    { kategorie: "Kuřecí maso", nazev: "Kuře na paprice, rýže", cena: 119 },
    { kategorie: "Salát", nazev: "Zeleninový salát 100g", cena: 20 },
  ],
  // klidně může zůstat, ale v neděli se to už nevykreslí (viz !zavreno níže)
  "2026-02-22": [{ kategorie: "Zavřeno", nazev: "V neděli je zavřeno", cena: 0 }],
};

function toISODate(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const yyyy = x.getFullYear();
  const mm = String(x.getMonth() + 1).padStart(2, "0");
  const dd = String(x.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDayLabel(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const wd = new Intl.DateTimeFormat("cs-CZ", { weekday: "short" }).format(d).replace(".", "");
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${wd} ${dd}.${mm}.`;
}

function formatPrice(cena: number | null) {
  return cena == null ? "—" : `${cena} Kč`;
}

function weekdayCs(iso: string) {
  return new Date(iso + "T00:00:00").getDay();
}
function isSunday(iso: string) {
  return weekdayCs(iso) === 0;
}
function isSaturday(iso: string) {
  return weekdayCs(iso) === 6;
}
function isTodayIso(iso: string) {
  return iso === toISODate(new Date());
}
function after1300Now() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  return h > 13 || (h === 13 && m > 0);
}

/** ===== VALIDACE JMÉNO / TELEFON ===== */
function digitsOnly(s: string) {
  return s.replace(/\D/g, "");
}
function normalizePhone(input: string) {
  let raw = input.replace(/[^\d+\s]/g, "");
  raw = raw.replace(/\s+/g, "");

  let prefix = "";
  let digits = raw;

  if (digits.startsWith("+")) {
    prefix = "+";
    digits = digits.slice(1);
  } else if (digits.startsWith("00")) {
    prefix = "00";
    digits = digits.slice(2);
  }

  digits = digits.replace(/\D/g, "");

  if (digits.startsWith("420")) {
    const rest = digits.slice(3).slice(0, 9);
    const g1 = rest.slice(0, 3);
    const g2 = rest.slice(3, 6);
    const g3 = rest.slice(6, 9);
    const groups = [g1, g2, g3].filter(Boolean).join(" ");
    return `${prefix}420${groups ? " " + groups : ""}`.trim();
  }

  const d = digits.slice(0, 9);
  const g1 = d.slice(0, 3);
  const g2 = d.slice(3, 6);
  const g3 = d.slice(6, 9);
  return [g1, g2, g3].filter(Boolean).join(" ");
}
function isValidCzPhone(phone: string) {
  const d = digitsOnly(phone);
  if (d.length === 14 && d.startsWith("00420")) {
    const rest = d.slice(5);
    return rest.length === 9 && rest[0] !== "0";
  }
  if (d.length === 12 && d.startsWith("420")) {
    const rest = d.slice(3);
    return rest.length === 9 && rest[0] !== "0";
  }
  if (d.length === 9) return d[0] !== "0";
  return false;
}
function normalizeName(input: string) {
  let s = input.replace(/[^A-Za-zÀ-ž\s'-]/g, "");
  const endsWithSpace = /\s$/.test(s);
  s = s.replace(/\s+/g, " ");
  s = s.replace(/^\s+/, "");
  if (endsWithSpace) s = s + " ";
  if (s.length > 60) s = s.slice(0, 60);
  return s;
}
function isValidFullName(name: string) {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length < 2) return false;
  if (parts.some((p) => p.length < 2)) return false;
  const lettersCount = (name.match(/[A-Za-zÀ-ž]/g) ?? []).length;
  if (lettersCount < 4) return false;
  return true;
}

/**
 * BASE týden: Po–Ne
 * Když je dnes neděle (od 00:00), bereme už příští týden.
 */
function computeBaseMonday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;
  d.setDate(d.getDate() - diffToMonday);
  return d;
}

export default function Page() {
  const [selectedDate, setSelectedDate] = useState<string>(() => toISODate(new Date()));
  const [rows, setRows] = useState<MenuRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // jen 2 týdny: 0 = aktuální, 1 = příští
  const [weekOffset, setWeekOffset] = useState<0 | 1>(0);

  // 2 kroky: cart = menu + košík, checkout = souhrn + doručení + údaje
  const [checkoutStep, setCheckoutStep] = useState<"cart" | "checkout">("cart");

  // tick kvůli neděli po půlnoci
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [zpusob, setZpusob] = useState<Zpusob>("vyzvednuti");
  const [baleni, setBaleni] = useState<Baleni>("plast");

  const [jmeno, setJmeno] = useState("");
  const [telefon, setTelefon] = useState("");
  const [adresa, setAdresa] = useState("");
  const [poznamka, setPoznamka] = useState("");

  const [placing, setPlacing] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [info, setInfo] = useState<Baleni | null>(null);

  // když se košík vyprázdní, vrať se na menu/košík
  useEffect(() => {
    if (cart.length === 0) setCheckoutStep("cart");
  }, [cart.length]);

  const baseMonday = useMemo(() => computeBaseMonday(), [tick]);
  const baseMondayISO = useMemo(() => toISODate(baseMonday), [baseMonday]);

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

  useEffect(() => {
    if (!days.includes(selectedDate)) setSelectedDate(days[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, weekOffset]);

  const total = useMemo(() => cart.reduce((sum, it) => sum + it.cena * it.qty, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((sum, it) => sum + it.qty, 0), [cart]);

  const zavreno = useMemo(() => isSunday(selectedDate), [selectedDate]);
  const sobota = useMemo(() => isSaturday(selectedDate), [selectedDate]);
  const po1300Dnes = useMemo(() => isTodayIso(selectedDate) && after1300Now(), [selectedDate]);

  const cartByDay = useMemo(() => {
    const m = new Map<string, CartItem[]>();
    for (const it of cart) {
      const arr = m.get(it.datum) ?? [];
      arr.push(it);
      m.set(it.datum, arr);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [cart]);

  // helper pro qty daného key
  function getQty(key: string) {
    const item = cart.find((x) => x.key === key);
    return item ? item.qty : 0;
  }

  useEffect(() => {
    if (sobota && zpusob === "rozvoz") setZpusob("vyzvednuti");
  }, [sobota, zpusob]);

  useEffect(() => {
    let cancelled = false;

    async function loadData(day: string) {
      setLoading(true);
      setErr(null);
      setOkMsg(null);

      const { data, error } = await supabase
        .from("jidelnik")
        .select(
          `
          id,
          datum,
          poradi,
          dostupne,
          jidlo:jidla!jidelnik_legacy_fk (
            legacy_id,
            nazev,
            cena,
            kategorie
          )
        `
        )
        .eq("datum", day)
        .eq("dostupne", true)
        .order("poradi", { ascending: true });

      if (cancelled) return;

      if (error) {
        setErr(error.message);
        setRows([]);
      } else {
        setRows(((data ?? []) as unknown as MenuRow[]).filter((r) => r.jidlo !== null));
      }

      setLoading(false);
    }

    void loadData(selectedDate);

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  function addDbToCart(r: MenuRow) {
    if (!r.jidlo) return;
    if (r.jidlo.cena == null) return;

    const key = `db:${selectedDate}:${r.id}`;

    setCart((prev) => {
      const idx = prev.findIndex((x) => x.key === key);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [
        ...prev,
        {
          key,
          source: "db",
          datum: selectedDate,
          legacy_id: r.jidlo!.legacy_id,
nazev: r.jidlo!.nazev,
cena: r.jidlo!.cena ?? 0,
          qty: 1,
        },
      ];
    });
  }

  function addMockToCart(dayIso: string, it: MockItem) {
    const key = `mock:${dayIso}:${it.kategorie}:${it.nazev}:${it.cena}`;

    setCart((prev) => {
      const idx = prev.findIndex((x) => x.key === key);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [...prev, { key, source: "mock", datum: dayIso, nazev: it.nazev, cena: it.cena, qty: 1 }];
    });
  }

  function inc(key: string) {
    setCart((prev) => prev.map((x) => (x.key === key ? { ...x, qty: x.qty + 1 } : x)));
  }
  function dec(key: string) {
    setCart((prev) =>
      prev.map((x) => (x.key === key ? { ...x, qty: Math.max(0, x.qty - 1) } : x)).filter((x) => x.qty > 0)
    );
  }
  function removeItem(key: string) {
    setCart((prev) => prev.filter((x) => x.key !== key));
  }
  function clearCart() {
    setCart([]);
  }

  const canOrder = useMemo(() => {
    if (zavreno) return { ok: false, reason: "V neděli je zavřeno." };
    if (po1300Dnes) return { ok: false, reason: "Na dnešek lze objednat jen do 13:00." };
    if (cart.length === 0) return { ok: false, reason: "Košík je prázdný." };

    if (!isValidFullName(jmeno)) return { ok: false, reason: "Zadej jméno i příjmení (např. Jan Novák)." };
    if (!isValidCzPhone(telefon))
      return { ok: false, reason: "Zadej platné tel. číslo (777 123 456 / +420… / 00420…)." };

    if (zpusob === "rozvoz" && !adresa.trim()) return { ok: false, reason: "Pro rozvoz vyplň adresu." };
    if (sobota && zpusob === "rozvoz") return { ok: false, reason: "V sobotu nerozvážíme." };
    return { ok: true, reason: "" };
  }, [zavreno, po1300Dnes, cart.length, jmeno, telefon, zpusob, adresa, sobota]);

  async function placeOrder() {
    setErr(null);
    setOkMsg(null);

    if (!canOrder.ok) {
      setErr(canOrder.reason);
      return;
    }

    const dbItems = cart.filter((x) => x.source === "db");
    const mockItems = cart.filter((x) => x.source === "mock");

    if (dbItems.length === 0 && mockItems.length > 0) {
      setErr("Provizorní menu zatím nejde odeslat jako objednávku. (Musí být v databázi.)");
      return;
    }
    if (mockItems.length > 0) {
      setErr("Objednávka obsahuje provizorní položky. Zatím prosím objednej jen položky z databáze.");
      return;
    }

    setPlacing(true);

    try {
      const legacyIds = Array.from(new Set(dbItems.map((x) => x.legacy_id!).filter(Boolean)));

      const { data: jidlaData, error: jidlaErr } = await supabase
        .from("jidla")
        .select("id, legacy_id")
        .in("legacy_id", legacyIds);

      if (jidlaErr) throw new Error(jidlaErr.message);

      const map = new Map<number, string>();
      (jidlaData ?? []).forEach((x: any) => map.set(x.legacy_id, x.id));

      for (const it of dbItems) {
        if (it.legacy_id == null || !map.has(it.legacy_id)) {
          throw new Error(`Nemůžu najít jidlo_id pro legacy_id=${it.legacy_id}.`);
        }
      }

      const { data: objednavka, error: objedErr } = await supabase
        .from("objednavky")
        .insert({
          datum: selectedDate,
          zpusob,
          jmeno: jmeno.trim(),
          telefon: normalizePhone(telefon).trim(),
          adresa: zpusob === "rozvoz" ? adresa.trim() : null,
          poznamka: poznamka.trim() ? poznamka.trim() : null,
          celkem_kc: total,
          stav: "nova",
          platba: "hotove",
          baleni,
          zdroj: "web",
        })
        .select("id")
        .single();

      if (objedErr) throw new Error(objedErr.message);

      const payload = dbItems.map((it) => ({
        objednavka_id: objednavka.id,
        jidlo_id: map.get(it.legacy_id!)!,
        mnozstvi: it.qty,
        cena_kc: it.cena,
      }));

      const { error: polErr } = await supabase.from("objednavky_polozky").insert(payload);
      if (polErr) throw new Error(polErr.message);

      setOkMsg("Objednávka odeslána ✅");
      clearCart();
      setPoznamka("");
      if (zpusob === "rozvoz") setAdresa("");
      setCheckoutStep("cart");
    } catch (e: any) {
      setErr(e?.message ?? "Něco se pokazilo při odeslání objednávky.");
    } finally {
      setPlacing(false);
    }
  }

  const mockForDay = PROVIZORNI_MENU[selectedDate];

  const addBtnClass = (disabled: boolean) =>
    "rounded-xl px-4 py-2 text-sm font-semibold transition border " +
    (disabled
      ? "bg-gray-200 text-gray-500 border-gray-200 cursor-not-allowed"
      : "bg-white text-green-700 border-green-600 hover:bg-green-600 hover:text-white hover:border-green-600");

  const inputClass =
    "w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200";

  const textareaClass =
    "min-h-[80px] w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200";

  const qtyBtnClass =
    "h-9 w-9 rounded-lg border border-gray-300 bg-white text-gray-800 font-bold transition hover:bg-green-600 hover:text-white hover:border-green-600 active:scale-[0.98]";

  const nameTouched = jmeno.trim().length > 0;
  const phoneTouched = telefon.trim().length > 0;

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 to-white px-6 py-10">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8 text-center">
          <div className="mx-auto flex items-center justify-center gap-3">
            <img src="/logo.png" alt="Logo Jiřka" className="h-12 w-12 rounded-xl object-contain" />
            <h1 className="text-4xl font-extrabold text-green-700">Jídelníček Jiřka</h1>
          </div>

          <div className="mx-auto mt-3 h-1 w-28 rounded-full bg-yellow-400" />
          <p className="mt-3 text-sm text-gray-500">
            Vyber den a objednej. Rozvoz Po–Pá, sobota jen vyzvednutí, neděle zavřeno.
          </p>
        </header>

        {/* ===== KROK 1: MENU + KOŠÍK ===== */}
        {checkoutStep === "cart" ? (
          <>
            <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => setWeekOffset(0)}
                disabled={weekOffset === 0}
                className={
                  "rounded-xl px-3 py-2 text-sm font-semibold transition border " +
                  (weekOffset === 0
                    ? "bg-gray-200 text-gray-500 border-gray-200 cursor-not-allowed"
                    : "bg-white text-green-700 border-green-200 hover:bg-green-100")
                }
                title={weekOffset === 0 ? "Jsi na prvním týdnu" : "Zpět na první týden"}
              >
                ←
              </button>

              {days.map((day) => {
                const active = day === selectedDate;
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(day)}
                    className={
                      "rounded-xl px-4 py-2 text-sm font-semibold transition " +
                      (active
                        ? "bg-green-600 text-white shadow-md"
                        : "bg-white text-green-700 border border-green-200 hover:bg-green-100")
                    }
                    title={day}
                  >
                    {formatDayLabel(day)}
                  </button>
                );
              })}

              <button
                onClick={() => setWeekOffset(1)}
                disabled={weekOffset === 1}
                className={
                  "rounded-xl px-3 py-2 text-sm font-semibold transition border " +
                  (weekOffset === 1
                    ? "bg-gray-200 text-gray-500 border-gray-200 cursor-not-allowed"
                    : "bg-white text-green-700 border-green-200 hover:bg-green-100")
                }
                title={weekOffset === 1 ? "Další týdny nejsou dostupné" : "Přejít na příští týden"}
              >
                →
              </button>
            </div>

            {/* širší košík */}
            <div className="grid gap-6 lg:grid-cols-[1fr_480px]">
              <section>
                {zavreno && (
                  <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-red-700 font-semibold">
                    V neděli je zavřeno.
                  </div>
                )}

                {sobota && !zavreno && (
                  <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-800 font-semibold">
                    V sobotu nerozvážíme – pouze vyzvednutí.
                  </div>
                )}

                {po1300Dnes && (
                  <div className="mb-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-yellow-800 font-semibold">
                    Na dnešek lze objednat jen do 13:00.
                  </div>
                )}

                {loading && <p className="text-center text-gray-500">Načítám menu…</p>}
                {!loading && err && <p className="text-center text-red-600">Chyba: {err}</p>}
                {!loading && okMsg && <p className="text-center text-green-700 font-semibold">{okMsg}</p>}

                {!loading && !err && rows.length === 0 && !mockForDay && (
                  <p className="text-center text-gray-500">Pro tento den zatím není menu.</p>
                )}

                {/* PROVIZORNÍ MENU (v neděli se neukazuje žádná karta) */}
                {!loading && !err && rows.length === 0 && mockForDay && !zavreno && (
                  <div className="grid gap-5">
                    {mockForDay.map((it, idx) => {
                      const disabled = zavreno || po1300Dnes || it.cena <= 0;
                      const key = `mock:${selectedDate}:${it.kategorie}:${it.nazev}:${it.cena}`;
                      const q = getQty(key);

                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-2xl border border-green-100 bg-white p-6 shadow-sm"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-green-700">{it.kategorie}</div>
                            <div className="truncate text-lg font-bold text-gray-800">{it.nazev}</div>
                          </div>

                          <div className="ml-6 flex items-center gap-4 shrink-0">
                            <div className="text-xl font-extrabold text-green-700">{it.cena} Kč</div>

                            {/* ✅ Přidat -> po kliknutí se změní na − qty + */}
                            {!disabled && q > 0 ? (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => dec(key)}
                                  className="h-9 w-9 rounded-lg border border-gray-400 bg-white text-gray-900 font-extrabold hover:bg-gray-100"
                                  aria-label="Odebrat"
                                >
                                  −
                                </button>

                                <div className="min-w-[26px] text-center text-sm font-extrabold text-gray-900">
                                  {q}
                                </div>

                                <button
                                  onClick={() => inc(key)}
                                  className="h-9 w-9 rounded-lg bg-green-600 text-white font-extrabold hover:brightness-95"
                                  aria-label="Přidat"
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  if (disabled) return;
                                  addMockToCart(selectedDate, it);
                                }}
                                disabled={disabled}
                                className={addBtnClass(disabled)}
                              >
                                Přidat
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* DB MENU */}
                <div className="grid gap-5">
                  {rows.map((r) => {
                    const disabled = zavreno || po1300Dnes || !r.jidlo || r.jidlo.cena == null;
                    const key = `db:${selectedDate}:${r.id}`;
                    const q = getQty(key);

                    return (
                      <div
                        key={r.id}
                        className="flex items-center justify-between rounded-2xl border border-green-100 bg-white p-6 shadow-sm transition hover:shadow-md"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-green-700">{r.jidlo?.kategorie ?? ""}</div>
                          <div className="truncate text-lg font-bold text-gray-800">{r.jidlo?.nazev ?? "—"}</div>
                        </div>

                        <div className="ml-6 flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            <div className="text-xl font-extrabold text-green-700">{formatPrice(r.jidlo?.cena ?? null)}</div>
                          </div>

                          {/* ✅ Přidat -> po kliknutí se změní na − qty + */}
                          {!disabled && q > 0 ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => dec(key)}
                                className="h-9 w-9 rounded-lg border border-gray-400 bg-white text-gray-900 font-extrabold hover:bg-gray-100"
                                aria-label="Odebrat"
                              >
                                −
                              </button>

                              <div className="min-w-[26px] text-center text-sm font-extrabold text-gray-900">
                                {q}
                              </div>

                              <button
                                onClick={() => inc(key)}
                                className="h-9 w-9 rounded-lg bg-green-600 text-white font-extrabold hover:brightness-95"
                                aria-label="Přidat"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                if (disabled) return;
                                addDbToCart(r);
                              }}
                              disabled={disabled}
                              className={addBtnClass(disabled)}
                            >
                              Přidat
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* KOŠÍK */}
              <aside className="rounded-2xl border border-green-100 bg-white p-6 shadow-sm h-fit sticky top-6 flex flex-col max-h-[calc(100vh-3rem)]">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-extrabold text-green-700">Košík</h2>
                  <div className="text-sm text-gray-500">{cartCount} ks</div>
                </div>

                <div className="mt-5 flex-1 overflow-auto pr-1">
                  {cart.length === 0 ? (
                    <div className="text-sm text-gray-500">Zatím nic v košíku.</div>
                  ) : (
                    <div className="grid gap-6 pb-2">
                      {cartByDay.map(([day, items]) => (
                        <div key={day} className="rounded-2xl border border-gray-100 bg-gray-50/40 p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <div className="text-sm font-extrabold text-gray-800">{formatDayLabel(day)}</div>
                            <div className="text-xs text-gray-500">{items.reduce((s, x) => s + x.qty, 0)} ks</div>
                          </div>

                          <div className="grid gap-3">
                            {items.map((it) => (
                              <div key={it.key} className="rounded-2xl border border-gray-100 bg-white p-4">
                                <div className="text-sm font-semibold text-gray-800 leading-snug">{it.nazev}</div>

                                <div className="mt-3 flex items-center justify-between">
                                  <div className="text-base text-green-700 font-extrabold">{it.cena} Kč</div>

                                  <div className="flex items-center gap-2">
                                    <button onClick={() => dec(it.key)} className={qtyBtnClass}>
                                      −
                                    </button>
                                    <div className="min-w-[28px] text-center text-sm font-semibold text-gray-900">
                                      {it.qty}
                                    </div>
                                    <button onClick={() => inc(it.key)} className={qtyBtnClass}>
                                      +
                                    </button>
                                    <button
                                      onClick={() => removeItem(it.key)}
                                      className="ml-3 text-xs text-red-600 hover:underline"
                                    >
                                      odstranit
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-5 border-t pt-5 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">Celkem</div>
                    <div className="text-lg font-extrabold text-green-700">{total} Kč</div>
                  </div>

                  <div className="mt-5 grid gap-3">
                    <button
                      onClick={() => setCheckoutStep("checkout")}
                      disabled={cart.length === 0}
                      className={
                        "w-full rounded-xl px-4 py-3 text-sm font-extrabold transition " +
                        (cart.length === 0
                          ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                          : "bg-green-600 text-white hover:brightness-95")
                      }
                    >
                      Pokračovat →
                    </button>

                    {cart.length > 0 && (
                      <button onClick={clearCart} className="text-xs text-gray-500 hover:underline">
                        vymazat košík
                      </button>
                    )}
                  </div>
                </div>
              </aside>
            </div>
          </>
        ) : (
          /* ===== KROK 2: SOUHRN + DORUČENÍ + ÚDAJE ===== */
          <div className="mx-auto w-full max-w-4xl">
            <div className="mb-6 flex items-center justify-between">
              <button
                onClick={() => setCheckoutStep("cart")}
                className="rounded-xl border border-green-200 bg-white px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-50"
              >
                ← Zpět
              </button>

              <div className="text-center">
                <div className="text-xl font-extrabold text-green-700">Souhrn objednávky</div>
                <div className="text-xs text-gray-500">
                  {cartCount} ks • {total} Kč
                </div>
              </div>

              <div className="w-[72px]" />
            </div>

            <div className="rounded-2xl border border-green-100 bg-white p-6 shadow-sm">
              <div className="text-sm font-extrabold text-gray-800 mb-4">Položky</div>

              {cart.length === 0 ? (
                <div className="text-sm text-gray-500">Košík je prázdný.</div>
              ) : (
                <div className="grid gap-5">
                  {cartByDay.map(([day, items]) => {
                    const daySum = items.reduce((s, x) => s + x.cena * x.qty, 0);
                    return (
                      <div key={day} className="rounded-2xl border border-gray-100 bg-gray-50/40 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-sm font-extrabold text-gray-800">{formatDayLabel(day)}</div>
                          <div className="text-xs text-gray-500">{daySum} Kč</div>
                        </div>

                        <div className="grid gap-2">
                          {items.map((it) => (
                            <div
                              key={it.key}
                              className="flex items-center justify-between rounded-xl bg-white border border-gray-100 px-3 py-2"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-gray-800">{it.nazev}</div>
                                <div className="text-xs text-gray-500">
                                  {it.qty}× {it.cena} Kč
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <button onClick={() => dec(it.key)} className={qtyBtnClass}>
                                  −
                                </button>
                                <div className="min-w-[28px] text-center text-sm font-semibold text-gray-900">{it.qty}</div>
                                <button onClick={() => inc(it.key)} className={qtyBtnClass}>
                                  +
                                </button>
                                <button onClick={() => removeItem(it.key)} className="ml-2 text-xs text-red-600 hover:underline">
                                  odstranit
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-5 border-t pt-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">Celkem</div>
                <div className="text-lg font-extrabold text-green-700">{total} Kč</div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-green-100 bg-white p-6 shadow-sm">
              <div className="text-sm font-extrabold text-gray-800 mb-4">Doručení a údaje</div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setZpusob("vyzvednuti")}
                  className={
                    "rounded-xl px-3 py-2 text-sm font-semibold border " +
                    (zpusob === "vyzvednuti"
                      ? "bg-green-600 text-white border-green-600"
                      : "bg-white text-green-700 border-green-200 hover:bg-green-50")
                  }
                >
                  Vyzvednutí
                </button>

                <button
                  onClick={() => setZpusob("rozvoz")}
                  disabled={sobota || zavreno}
                  className={
                    "rounded-xl px-3 py-2 text-sm font-semibold border " +
                    (sobota || zavreno
                      ? "bg-gray-200 text-gray-500 border-gray-200 cursor-not-allowed"
                      : zpusob === "rozvoz"
                      ? "bg-green-600 text-white border-green-600"
                      : "bg-white text-green-700 border-green-200 hover:bg-green-50")
                  }
                >
                  Rozvoz
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-gray-200 p-3">
                <div className="text-sm font-extrabold text-gray-800 mb-2">Způsob balení</div>

                <div className="grid gap-2">
                  <button
                    onClick={() => setBaleni("plast")}
                    className={
                      "flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-semibold " +
                      (baleni === "plast"
                        ? "bg-green-50 border-green-300 text-green-800"
                        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50")
                    }
                  >
                    <span>🥡 Plastová krabička (+8 Kč)</span>
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setBaleni("eko")}
                      className={
                        "flex-1 flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-semibold " +
                        (baleni === "eko"
                          ? "bg-green-50 border-green-300 text-green-800"
                          : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50")
                      }
                    >
                      <span>♻️ Eko krabička (záloha 80 Kč)</span>
                    </button>
                    <button
                      onClick={() => setInfo("eko")}
                      className="w-10 rounded-xl border border-gray-200 hover:bg-gray-50"
                      title="Informace"
                    >
                      ?
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setBaleni("jidlonosic")}
                      className={
                        "flex-1 flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-semibold " +
                        (baleni === "jidlonosic"
                          ? "bg-green-50 border-green-300 text-green-800"
                          : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50")
                      }
                    >
                      <span>🍲 Vlastní jídlonosič</span>
                    </button>
                    <button
                      onClick={() => setInfo("jidlonosic")}
                      className="w-10 rounded-xl border border-gray-200 hover:bg-gray-50"
                      title="Informace"
                    >
                      ?
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                <input
                  value={jmeno}
                  onChange={(e) => setJmeno(normalizeName(e.target.value))}
                  placeholder="Jméno a příjmení*"
                  className={inputClass}
                  autoComplete="name"
                />
                {nameTouched && !isValidFullName(jmeno) && (
                  <div className="text-xs text-red-600">Zadej prosím jméno i příjmení.</div>
                )}

                <input
                  value={telefon}
                  onChange={(e) => setTelefon(normalizePhone(e.target.value))}
                  placeholder="Telefon*"
                  inputMode="tel"
                  className={inputClass}
                  autoComplete="tel"
                />
                {phoneTouched && !isValidCzPhone(telefon) && (
                  <div className="text-xs text-red-600">Telefon musí být platné CZ číslo.</div>
                )}

                {zpusob === "rozvoz" && (
                  <input
                    value={adresa}
                    onChange={(e) => setAdresa(e.target.value)}
                    placeholder="Adresa pro rozvoz*"
                    className={inputClass}
                    autoComplete="street-address"
                  />
                )}

                <textarea
                  value={poznamka}
                  onChange={(e) => setPoznamka(e.target.value)}
                  placeholder="Poznámka (např. bez cibule)"
                  className={textareaClass}
                />

                <button
                  onClick={placeOrder}
                  disabled={placing || !canOrder.ok}
                  className={addBtnClass(placing || !canOrder.ok) + " w-full py-3 text-sm font-extrabold"}
                  title={!canOrder.ok ? canOrder.reason : "Odeslat objednávku"}
                >
                  {placing ? "Odesílám…" : "Objednat"}
                </button>

                {!canOrder.ok && <div className="text-xs text-gray-500">{canOrder.reason}</div>}
                {err && <div className="text-xs text-red-600">Chyba: {err}</div>}
                {okMsg && <div className="text-xs text-green-700 font-semibold">{okMsg}</div>}
              </div>
            </div>
          </div>
        )}

        {/* MODÁL INFO */}
        {info && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lg">
              <div className="text-lg font-extrabold text-green-700">
                {info === "eko" ? "♻️ Eko krabička" : "🍲 Vlastní jídlonosič"}
              </div>

              <div className="mt-3 text-sm text-gray-700 leading-relaxed">
                {info === "eko" ? (
                  <>
                    Eko krabička je vratná. Platí se záloha <b>80 Kč</b>. Zálohu vám vrátíme při vrácení krabičky (na kredit nebo
                    hotově/kartou na prodejně).
                  </>
                ) : (
                  <>
                    Jídlo vám dáme do vašeho vlastního jídlonosiče (ešusu). Při rozvozu nám obvykle předáte prázdný nosič a my vám
                    přivezeme plný.
                  </>
                )}
              </div>

              <button
                onClick={() => setInfo(null)}
                className="mt-5 w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-extrabold text-white hover:brightness-95"
              >
                Zavřít
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
