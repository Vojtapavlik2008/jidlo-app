"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { supabase } from "@/lib/supabase";

// ================== Types ==================
type Jidlo = {
  id: string; // uuid
  legacy_id: number;
  nazev: string;
  cena: number | null;
  kategorie?: string | null;
  aktivni?: boolean | null;
};

type MenuDenRow = {
  datum: string; // YYYY-MM-DD
  poradi: number;
  jidlo_id: string;
};

// ================== Date helpers (lokálně) ==================
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
function startOfWeekMondayISO(iso: string) {
  const d = fromISOToLocalDate(iso);
  const dow = d.getDay(); // 0=Ne..6=So
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return toISODateLocal(d);
}
function prettyCZShort(iso: string) {
  const d = fromISOToLocalDate(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}. ${mm}.`;
}
function prettyCZLong(iso: string) {
  const d = fromISOToLocalDate(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}. ${mm}. ${yy}`;
}
function parseNums(text: string) {
  return text
    .split(/[,;\n\s]+/g)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n > 0);
}
function uniqKeepOrder(nums: number[]) {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const n of nums) {
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

// ================== Calendar popover (omezený na dnes..+21 dní) ==================
function CalendarPopover({
  open,
  anchorRef,
  valueISO,
  minISO,
  maxISO,
  onPick,
  onClose,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLButtonElement>;
  valueISO: string;
  minISO: string;
  maxISO: string;
  onPick: (iso: string) => void;
  onClose: () => void;
}) {
  const popRef = useRef<HTMLDivElement | null>(null);
  const [cursor, setCursor] = useState(() => fromISOToLocalDate(valueISO));

  useEffect(() => setCursor(fromISOToLocalDate(valueISO)), [valueISO]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const a = anchorRef.current;
      const p = popRef.current;
      const t = e.target as Node;
      if (p && p.contains(t)) return;
      if (a && a.contains(t)) return;
      onClose();
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  const month = cursor.getMonth();
  const year = cursor.getFullYear();

  const first = new Date(year, month, 1);
  const firstDow = first.getDay(); // 0=Ne..6=So
  const startOffset = firstDow === 0 ? 6 : firstDow - 1; // Monday-start
  const start = new Date(year, month, 1 - startOffset);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }

  const monthName = cursor.toLocaleDateString("cs-CZ", { month: "long", year: "numeric" });

  let style: CSSProperties = { position: "absolute", zIndex: 50 };
  const rect = anchorRef.current?.getBoundingClientRect();
  if (rect) {
    style.left = rect.left + window.scrollX - 140;
    style.top = rect.bottom + window.scrollY + 10;
  }

  const headCell = "w-10 text-center text-xs font-extrabold text-gray-500";
  const dayBtnBase =
    "w-10 h-10 rounded-full ring-1 ring-green-200/80 text-sm font-extrabold transition";

  const min = fromISOToLocalDate(minISO);
  const max = fromISOToLocalDate(maxISO);
  const canPick = (iso: string) => {
    const d = fromISOToLocalDate(iso);
    return d >= min && d <= max;
  };

  return (
    <div
      ref={popRef}
      style={style}
      className="w-[360px] rounded-[28px] bg-white ring-2 ring-green-200/80 shadow-2xl p-4"
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            const d = new Date(cursor);
            d.setMonth(d.getMonth() - 1);
            setCursor(d);
          }}
          className="rounded-full px-4 py-2 font-extrabold text-gray-900 ring-2 ring-green-200/80 hover:bg-green-50 transition"
        >
          ←
        </button>

        <div className="text-sm font-extrabold text-gray-900 capitalize">{monthName}</div>

        <button
          type="button"
          onClick={() => {
            const d = new Date(cursor);
            d.setMonth(d.getMonth() + 1);
            setCursor(d);
          }}
          className="rounded-full px-4 py-2 font-extrabold text-gray-900 ring-2 ring-green-200/80 hover:bg-green-50 transition"
        >
          →
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {["po", "út", "st", "čt", "pá", "so", "ne"].map((x) => (
          <div key={x} className={headCell}>
            {x}
          </div>
        ))}

        {days.map((d, i) => {
          const inMonth = d.getMonth() === month;
          const iso = toISODateLocal(d);
          const isToday = iso === toISODateLocal(new Date());
          const ok = canPick(iso);

          return (
            <button
              key={i}
              type="button"
              disabled={!ok}
              onClick={() => ok && onPick(iso)}
              className={[
                dayBtnBase,
                inMonth ? "text-gray-900" : "text-gray-300",
                isToday ? "ring-2 ring-green-600" : "",
                ok ? "hover:bg-green-50" : "opacity-35 cursor-not-allowed",
              ].join(" ")}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={onClose}
          type="button"
          className="rounded-full bg-white px-6 py-2 text-sm font-extrabold text-gray-900 ring-2 ring-green-200/80 hover:bg-green-50 transition"
        >
          OK
        </button>
      </div>
    </div>
  );
}

// ================== Numeric keyboard (vpravo vedle) ==================
function NumericKeyboardCard({
  open,
  onClose,
  onInsert,
  onBackspace,
  onClear,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onInsert: (ch: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onDone: () => void;
}) {
  if (!open) return null;

  const card =
    "rounded-[28px] bg-white ring-2 ring-green-200/80 shadow-[0_18px_60px_rgba(0,0,0,0.14)] p-6";
  const key =
    "h-14 rounded-2xl bg-white ring-1 ring-green-200/80 text-lg font-extrabold text-gray-900 hover:bg-green-50 transition";
  const btnRed =
    "h-11 rounded-full bg-white px-6 text-sm font-extrabold text-red-600 ring-1 ring-red-200 hover:bg-red-50 transition";
  const btnGreen =
    "h-11 rounded-full bg-green-600 px-10 text-sm font-extrabold text-white hover:brightness-95 transition";

  return (
    <div className={card}>
      <div className="flex items-center justify-between">
        <div className="text-lg font-extrabold text-gray-900">Numerická klávesnice</div>
        <button
          onClick={onClose}
          className="h-11 w-11 rounded-full bg-white ring-1 ring-gray-200 hover:bg-gray-50 transition text-xl font-extrabold text-gray-900"
          title="Zavřít"
          type="button"
        >
          ×
        </button>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button key={n} className={key} onClick={() => onInsert(String(n))} type="button">
            {n}
          </button>
        ))}
        <button className={key} onClick={() => onInsert(", ")} type="button">
          ,
        </button>
        <button className={key} onClick={() => onInsert("0")} type="button">
          0
        </button>
        <button className={key} onClick={onBackspace} title="Smazat znak" type="button">
          ⌫
        </button>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <button className={btnRed} onClick={onClear} type="button">
          Vymazat vše
        </button>
        <button className={btnGreen} onClick={onDone} type="button">
          Hotovo
        </button>
      </div>
    </div>
  );
}

// ================== StaffMenuEditor ==================
export default function StaffMenuEditor() {
  const todayISO = toISODateLocal(new Date());
  const maxISO = addDaysISO(todayISO, 21); // dnes + 3 týdny

  // aktuální týden
  const [weekMonday, setWeekMonday] = useState(() => startOfWeekMondayISO(todayISO));

  // Po–So pro zvolený týden
  const days = useMemo(() => [0, 1, 2, 3, 4, 5].map((i) => addDaysISO(weekMonday, i)), [weekMonday]);
  const dayLabels = ["Po", "Út", "St", "Čt", "Pá", "So"];

  // aktivní den (klikem na pill nebo z kalendáře)
  const [activeDay, setActiveDay] = useState(() => todayISO);

  useEffect(() => {
    if (!days.includes(activeDay)) setActiveDay(days[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekMonday]);

  // week dropdown: aktuální + 3 týdny
  const weekOptions = useMemo(() => {
    const base = startOfWeekMondayISO(todayISO);
    return [0, 1, 2, 3].map((w) => {
      const monday = addDaysISO(base, w * 7);
      const saturday = addDaysISO(monday, 5);
      return { key: monday, label: `${prettyCZShort(monday)} – ${prettyCZShort(saturday)}` };
    });
  }, [todayISO]);

  // DB data
  const [jidla, setJidla] = useState<Jidlo[]>([]);
  const byLegacy = useMemo(() => {
    const m = new Map<number, Jidlo>();
    for (const j of jidla) m.set(j.legacy_id, j);
    return m;
  }, [jidla]);

  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // calendar
  const [calOpen, setCalOpen] = useState(false);
  const calBtnRef = useRef<HTMLButtonElement>(null!);

  // numeric keyboard panel
  const [numKbOpen, setNumKbOpen] = useState(false);

  // ===== load jidla
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("jidla")
        .select("id, legacy_id, nazev, cena, kategorie, aktivni")
        .order("legacy_id", { ascending: true });

      if (error) {
        console.error(error);
        setMsg("Chyba: nejdou načíst jídla (zkontroluj RLS/select).");
        return;
      }
      setJidla((data ?? []) as Jidlo[]);
    })();
  }, []);

  // ===== load menu for range: 4 týdny dopředu
  const rangeFrom = useMemo(() => startOfWeekMondayISO(todayISO), [todayISO]);
  const rangeTo = useMemo(() => addDaysISO(rangeFrom, 27), [rangeFrom]); // 4 týdny Po–So

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg(null);
      try {
        const { data, error } = await supabase
          .from("menu_den")
          .select("datum, poradi, jidlo_id")
          .gte("datum", rangeFrom)
          .lte("datum", rangeTo)
          .order("datum", { ascending: true })
          .order("poradi", { ascending: true });

        if (error) throw error;

        const byDay: Record<string, string[]> = {};
        for (const row of (data ?? []) as MenuDenRow[]) {
          byDay[row.datum] ??= [];
          byDay[row.datum].push(row.jidlo_id);
        }

        const uuidToLegacy = new Map<string, number>();
        for (const j of jidla) uuidToLegacy.set(j.id, j.legacy_id);

        const next: Record<string, string> = {};
        let cur = rangeFrom;
        while (cur <= rangeTo) {
          const uuids = byDay[cur] ?? [];
          const nums = uuids.map((u) => uuidToLegacy.get(u)).filter(Boolean) as number[];
          if (nums.length) next[cur] = nums.join(", ");
          cur = addDaysISO(cur, 1);
        }

        setInputs((prev) => ({ ...prev, ...next }));
      } catch (e: any) {
        console.error(e);
        setMsg(e?.message ?? "Chyba: nejde načíst menu_den.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jidla.length]);

  async function legacyToUuid(nums: number[]) {
    if (nums.length === 0) return [];
    const { data, error } = await supabase.from("jidla").select("id, legacy_id").in("legacy_id", nums);
    if (error) throw error;

    const map = new Map<number, string>();
    for (const r of (data ?? []) as any[]) map.set(r.legacy_id, r.id);
    return nums.map((n) => map.get(n)).filter(Boolean) as string[];
  }

  async function saveDay(datum: string) {
    setSaving(true);
    setMsg(null);
    try {
      const nums = uniqKeepOrder(parseNums(inputs[datum] ?? ""));
      const uuids = await legacyToUuid(nums);

      const del = await supabase.from("menu_den").delete().eq("datum", datum);
      if (del.error) throw del.error;

      if (uuids.length > 0) {
        const rows = uuids.map((jidlo_id, idx) => ({ datum, poradi: idx + 1, jidlo_id }));
        const ins = await supabase.from("menu_den").insert(rows);
        if (ins.error) throw ins.error;
      }

      setMsg(`Uloženo: ${prettyCZLong(datum)} (položek: ${uuids.length})`);
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "Chyba při ukládání.");
    } finally {
      setSaving(false);
    }
  }

  // selected foods
  const activeNums = useMemo(() => uniqKeepOrder(parseNums(inputs[activeDay] ?? "")), [inputs, activeDay]);

  const selected = useMemo(() => {
    const found: Jidlo[] = [];
    const missing: number[] = [];
    for (const n of activeNums) {
      const j = byLegacy.get(n);
      if (j) found.push(j);
      else missing.push(n);
    }
    return { found, missing };
  }, [activeNums, byLegacy]);

  // UI styles
  const pillBase = "rounded-full px-5 py-2.5 text-sm font-extrabold ring-1 ring-green-200/80 transition";
  const pillOn = "bg-green-600 text-white ring-green-600";
  const pillOff = "bg-white text-green-800 hover:bg-green-50";

  const input =
    "w-full rounded-[18px] bg-white px-6 py-5 text-[15px] font-semibold text-gray-900 placeholder:text-gray-400 " +
    "ring-1 ring-green-200/90 focus:outline-none focus:ring-2 focus:ring-green-500/30";

  const saveBtn =
    "rounded-full bg-green-600 px-10 py-3.5 text-sm font-extrabold text-white shadow-sm hover:brightness-95 disabled:opacity-50 transition";

  const weekLabel = `${prettyCZShort(days[0])} – ${prettyCZShort(days[days.length - 1])}`;

  return (
    <div className="mx-auto w-full max-w-[980px]">
      <div className={"grid gap-8 items-start " + (numKbOpen ? "md:grid-cols-[1fr_360px]" : "md:grid-cols-1")}>
        {/* LEFT */}
        <section className="rounded-[34px] bg-green-50/40 ring-2 ring-green-200/70 p-6 md:p-8 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-5xl font-extrabold text-gray-900">Zadávání jídel</div>
              <div className="mt-2 text-sm text-gray-600">Týden: {weekLabel}</div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-sm font-extrabold text-gray-700">Vyber týden:</div>

              <select
                value={weekMonday}
                onChange={(e) => {
                  setWeekMonday(e.target.value);
                  setCalOpen(false);
                }}
                className="rounded-full bg-white px-6 py-2.5 text-sm font-extrabold text-gray-900 ring-2 ring-green-200/80 focus:outline-none"
              >
                {weekOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>

              <button
                ref={calBtnRef}
                onClick={() => setCalOpen((v) => !v)}
                className="h-11 w-11 rounded-full bg-white ring-2 ring-green-200/80 hover:bg-green-50 transition font-extrabold"
                title="Kalendář"
                type="button"
              >
                📅
              </button>

              <CalendarPopover
                open={calOpen}
                anchorRef={calBtnRef}
                valueISO={activeDay}
                minISO={todayISO}
                maxISO={maxISO}
                onClose={() => setCalOpen(false)}
                onPick={(iso) => {
                  setActiveDay(iso);
                  setWeekMonday(startOfWeekMondayISO(iso));
                  setCalOpen(false);
                }}
              />
            </div>
          </div>

          {/* pills */}
          <div className="mt-6 flex flex-wrap gap-2">
            {days.map((d, idx) => (
              <button
                key={d}
                onClick={() => setActiveDay(d)}
                className={pillBase + " " + (activeDay === d ? pillOn : pillOff)}
                type="button"
              >
                {dayLabels[idx]}{" "}
                <span className={activeDay === d ? "text-white/85" : "text-green-800/70"}>
                  ({prettyCZShort(d)})
                </span>
              </button>
            ))}
            {loading && <div className="ml-2 self-center text-sm font-semibold text-gray-500">Načítám…</div>}
          </div>

          {/* day card */}
          <div className="mt-7 rounded-[28px] bg-green-50/50 ring-2 ring-green-200/70 p-6 md:p-7">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-4xl font-extrabold text-gray-900">{prettyCZLong(activeDay)}</div>
                <div className="mt-1 text-sm text-gray-700">
                  Zadej čísla jídel pro tento den.
                  {selected.missing.length > 0 && (
                    <span className="ml-2 font-extrabold text-red-600">Neexistuje: {selected.missing.join(", ")}</span>
                  )}
                </div>
              </div>

              <button onClick={() => saveDay(activeDay)} disabled={saving} className={saveBtn} type="button">
                {saving ? "Ukládám…" : "Uložit"}
              </button>
            </div>

            <div className="mt-5 relative">
              <textarea
                value={inputs[activeDay] ?? ""}
                onChange={(e) => setInputs((prev) => ({ ...prev, [activeDay]: e.target.value }))}
                placeholder="např. 1, 5, 12"
                rows={2}
                className={input + " pr-16"}
              />
              <button
                type="button"
                onClick={() => setNumKbOpen(true)}
                className="absolute right-4 top-4 h-11 w-11 rounded-[18px] bg-white ring-1 ring-green-200/80 hover:bg-green-50 transition font-extrabold"
                title="Numerická klávesnice"
              >
                123
              </button>
            </div>

            {msg && (
              <div className="mt-4 rounded-2xl bg-white ring-1 ring-green-200/70 px-4 py-3 text-sm text-gray-800">
                {msg}
              </div>
            )}

            <div className="mt-6 rounded-[22px] bg-white ring-1 ring-green-200/70 p-5">
              <div className="text-sm font-extrabold text-gray-900">Vybraná jídla</div>

              {selected.found.length === 0 ? (
                <div className="mt-2 text-sm text-gray-500">Zatím nic vybrané.</div>
              ) : (
                <div className="mt-3 space-y-3">
                  {selected.found.map((j) => (
                    <div
                      key={j.id}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-green-50/60 ring-1 ring-green-200/80 px-5 py-4"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">
                          <span className="font-extrabold text-green-900">{j.legacy_id}</span> – {j.nazev}
                        </div>
                      </div>
                      <div className="text-sm font-extrabold text-green-900 whitespace-nowrap">{j.cena ?? "—"} Kč</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 text-xs text-gray-500">
              Ukládá se do <b>menu_den</b> přes UUID, ty zadáváš čísla <b>legacy_id</b>. Neděle se nezobrazuje.
            </div>
          </div>
        </section>

        {/* RIGHT */}
        {numKbOpen ? (
          <div className="md:sticky md:top-6">
            <NumericKeyboardCard
              open={numKbOpen}
              onClose={() => setNumKbOpen(false)}
              onInsert={(ch) => {
                const cur = inputs[activeDay] ?? "";
                setInputs((prev) => ({ ...prev, [activeDay]: cur + ch }));
              }}
              onBackspace={() => {
                const cur = inputs[activeDay] ?? "";
                setInputs((prev) => ({ ...prev, [activeDay]: cur.slice(0, -1) }));
              }}
              onClear={() => setInputs((prev) => ({ ...prev, [activeDay]: "" }))}
              onDone={() => setNumKbOpen(false)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}