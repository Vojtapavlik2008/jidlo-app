"use client";

import { useEffect, useMemo, useState } from "react";

// ---- local date helpers ----
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
function mondayOfISO(iso: string) {
  const d = fromISOToLocalDate(iso);
  const dow = d.getDay(); // 0=Ne..6=So
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return toISODateLocal(d);
}
function isSundayISO(iso: string) {
  return fromISOToLocalDate(iso).getDay() === 0;
}
function prettyCZ(iso: string) {
  const d = fromISOToLocalDate(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}. ${mm}.`;
}
function dayLabel(iso: string) {
  const names = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];
  const d = fromISOToLocalDate(iso);
  return names[d.getDay()] ?? "";
}

type MenuItem = {
  datum: string;
  poradi: number;
  jidlo_id: string;
  jidla: { nazev: string; cena: number | null; kategorie: string } | null;
};

async function fetchMenu(from: string, to: string): Promise<MenuItem[]> {
  const qs = new URLSearchParams({ from, to });
  const r = await fetch(`/api/menu?${qs.toString()}`, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || "Chyba při načítání menu.");
  return (j?.data ?? []) as MenuItem[];
}

export default function Page() {
  const rawToday = toISODateLocal(new Date());
  const today = isSundayISO(rawToday) ? addDaysISO(rawToday, 1) : rawToday;

  const weekMon = useMemo(() => mondayOfISO(today), [today]);
  const days = useMemo(() => [0, 1, 2, 3, 4, 5].map((i) => addDaysISO(weekMon, i)), [weekMon]);

  const [selected, setSelected] = useState(() => (days.includes(today) ? today : days[0]));
  useEffect(() => setSelected(days.includes(today) ? today : days[0]), [days, today]);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [menuByDate, setMenuByDate] = useState<Record<string, MenuItem[]>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setMsg(null);
      try {
        const rows = await fetchMenu(days[0], days[days.length - 1]);
        if (!alive) return;

        const map: Record<string, MenuItem[]> = {};
        for (const d of days) map[d] = [];
        for (const r of rows) {
          map[r.datum] ??= [];
          map[r.datum].push(r);
        }
        setMenuByDate(map);
      } catch (e: any) {
        console.error(e);
        if (!alive) return;
        setMenuByDate({});
        setMsg(e?.message ?? "Chyba při načítání menu.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [days]);

  const items = (menuByDate[selected] ?? []).filter((x) => x.jidla);

  const pill = (on: boolean) =>
    "rounded-full px-4 py-2 text-sm font-extrabold transition " +
    (on ? "bg-green-600 text-white" : "bg-white text-green-700 ring-1 ring-black/10 hover:bg-green-50");

  return (
    <main className="min-h-screen px-4 py-8 md:px-10">
      <div className="mx-auto max-w-[900px] grid gap-4">
        <div className="rounded-[28px] bg-white ring-1 ring-green-200/70 shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-6">
          <h1 className="text-3xl font-extrabold text-green-700">Denní menu</h1>
          <div className="mt-1 text-sm text-gray-600">
            Týden {prettyCZ(days[0])} – {prettyCZ(days[days.length - 1])}
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {days.map((d) => (
              <button key={d} type="button" onClick={() => setSelected(d)} className={pill(d === selected)}>
                {dayLabel(d)} {prettyCZ(d)}
              </button>
            ))}
          </div>

          {msg ? (
            <div className="mt-4 rounded-2xl bg-red-50 ring-1 ring-red-200 px-4 py-3 text-sm text-red-700 font-semibold">
              {msg}
            </div>
          ) : null}

          {loading ? (
            <div className="mt-4 rounded-2xl bg-gray-50 ring-1 ring-black/5 px-4 py-3 text-sm font-semibold text-gray-600">
              Načítám menu…
            </div>
          ) : items.length === 0 ? (
            <div className="mt-4 rounded-2xl bg-gray-50 ring-1 ring-black/5 px-4 py-3 text-sm font-semibold text-gray-600">
              Zatím nebylo zveřejněné menu.
            </div>
          ) : (
            <div className="mt-4 grid gap-2">
              {items.map((r, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-2xl px-4 py-3 bg-white ring-1 ring-black/5"
                >
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-green-700">{r.jidla?.kategorie ?? ""}</div>
                    <div className="truncate text-[15px] font-semibold text-gray-900">{r.jidla?.nazev ?? ""}</div>
                  </div>
                  <div className="shrink-0 text-[15px] font-extrabold text-green-700">
                    {r.jidla?.cena ?? ""} Kč
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-xs text-gray-500 px-2">
          Pozn.: v neděli automaticky ukazujeme pondělí (nevaří se).
        </div>
      </div>
    </main>
  );
}