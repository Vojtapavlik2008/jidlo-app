"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MobileView, type Jidlo } from "./_ui/MobileView";
import { DesktopView } from "./_ui/DesktopView";

type MenuDenRow = {
  datum: string;
  poradi: number;
  jidlo_id: string;
};

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
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return toISODateLocal(d);
}

function isSundayISO(iso: string) {
  const d = fromISOToLocalDate(iso);
  return d.getDay() === 0;
}

function nextMondayFromISO(iso: string) {
  const monThis = startOfWeekMondayISO(iso);
  return addDaysISO(monThis, 7);
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
  return `${dd}. ${mm}.`;
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

function removeOneNumFromText(text: string, legacyId: number) {
  const nums = uniqKeepOrder(parseNums(text));
  const next = nums.filter((n) => n !== legacyId);
  return next.join(", ");
}

export default function StaffMenuEditor() {
  const rawTodayISO = toISODateLocal(new Date());
  const uiTodayISO = isSundayISO(rawTodayISO) ? nextMondayFromISO(rawTodayISO) : rawTodayISO;

  const rangeFrom = uiTodayISO;
  const rangeTo = addDaysISO(uiTodayISO, 27);

  const [weekMonday, setWeekMonday] = useState(() => startOfWeekMondayISO(uiTodayISO));

  const days = useMemo(
    () => [0, 1, 2, 3, 4, 5].map((i) => addDaysISO(weekMonday, i)),
    [weekMonday]
  );

  const dayLabels = ["Po", "Út", "St", "Čt", "Pá", "So"];

  const [activeDay, setActiveDay] = useState(() => {
    const currentWeekMonday = startOfWeekMondayISO(uiTodayISO);
    const initialDays = [0, 1, 2, 3, 4, 5].map((i) => addDaysISO(currentWeekMonday, i));
    return initialDays.includes(uiTodayISO) ? uiTodayISO : currentWeekMonday;
  });

  useEffect(() => {
    if (!days.includes(activeDay)) {
      setActiveDay(days[0]);
    }
  }, [days, activeDay]);

  const weekOptions = useMemo(() => {
    const baseMon = startOfWeekMondayISO(uiTodayISO);
    return [0, 1, 2, 3].map((w) => {
      const monday = addDaysISO(baseMon, w * 7);
      const saturday = addDaysISO(monday, 5);
      return {
        key: monday,
        label: `${prettyCZShort(monday)} – ${prettyCZShort(saturday)}`,
      };
    });
  }, [uiTodayISO]);

  const weekLabel = `${prettyCZShort(days[0])} – ${prettyCZShort(days[days.length - 1])}`;

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

  const [calOpen, setCalOpen] = useState(false);
  const calBtnRefMobile = useRef<HTMLButtonElement>(null!);
  const calBtnRefDesktop = useRef<HTMLButtonElement>(null!);

  const [numKbOpen, setNumKbOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null!);
  const [alphaKbOpen, setAlphaKbOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setMsg(null);
      try {
        const r = await fetch("/api/staff/jidla", { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || "Chyba při načítání jídel.");
        setJidla((j?.data ?? []) as Jidlo[]);
      } catch (e: any) {
        console.error(e);
        setMsg(e?.message ?? "Chyba: nejdou načíst jídla.");
      }
    })();
  }, []);

  useEffect(() => {
    if (jidla.length === 0) return;

    (async () => {
      setLoading(true);
      setMsg(null);

      try {
        const qs = new URLSearchParams({ from: rangeFrom, to: rangeTo });
        const r = await fetch(`/api/staff/menu-den?${qs.toString()}`, { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || "Chyba při načítání menu_den.");

        const data = (j?.data ?? []) as MenuDenRow[];

        const byDay: Record<string, string[]> = {};
        for (const row of data) {
          byDay[row.datum] ??= [];
          byDay[row.datum].push(row.jidlo_id);
        }

        const uuidToLegacy = new Map<string, number>();
        for (const food of jidla) uuidToLegacy.set(food.id, food.legacy_id);

        const next: Record<string, string> = {};
        let cursor = rangeFrom;

        while (cursor <= rangeTo) {
          const uuids = byDay[cursor] ?? [];
          const nums = uuids.map((u) => uuidToLegacy.get(u)).filter(Boolean) as number[];
          next[cursor] = nums.length ? nums.join(", ") : "";
          cursor = addDaysISO(cursor, 1);
        }

        setInputs(next);
      } catch (e: any) {
        console.error(e);
        setMsg(e?.message ?? "Chyba při načítání menu.");
      } finally {
        setLoading(false);
      }
    })();
  }, [jidla, rangeFrom, rangeTo]);

  async function saveDay(datum: string) {
    setSaving(true);
    setMsg(null);

    try {
      const legacyIds = uniqKeepOrder(parseNums(inputs[datum] ?? ""));

      const r = await fetch("/api/staff/menu-den", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ datum, legacyIds }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Chyba při ukládání.");

      setMsg(`Uloženo: ${prettyCZLong(datum)} (položek: ${j?.count ?? legacyIds.length})`);
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "Chyba při ukládání.");
    } finally {
      setSaving(false);
    }
  }

  const activeNums = useMemo(
    () => uniqKeepOrder(parseNums(inputs[activeDay] ?? "")),
    [inputs, activeDay]
  );

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

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [] as Jidlo[];

    return jidla.filter((j) => j.nazev.toLowerCase().includes(q)).slice(0, 20);
  }, [search, jidla]);

  const onNumInsert = (ch: string) => {
    if (!/^[0-9,\s]$/.test(ch)) return;
    const cur = inputs[activeDay] ?? "";
    setInputs((prev) => ({ ...prev, [activeDay]: cur + ch }));
  };

  const onNumBackspace = () => {
    const cur = inputs[activeDay] ?? "";
    setInputs((prev) => ({ ...prev, [activeDay]: cur.slice(0, -1) }));
  };

  const onNumClear = () => {
    setInputs((prev) => ({ ...prev, [activeDay]: "" }));
  };

  const onNumDone = () => {
    setNumKbOpen(false);
  };

  return (
    <>
      {loading ? (
        <div className="mx-auto hidden max-w-[1200px] px-6 pt-6 text-sm text-gray-500 md:block">
          Načítám…
        </div>
      ) : null}

      <div className="md:hidden">
        <MobileView
          weekLabel={weekLabel}
          weekMonday={weekMonday}
          weekOptions={weekOptions}
          setWeekMonday={setWeekMonday}
          calOpen={calOpen}
          setCalOpen={setCalOpen}
          calBtnRef={calBtnRefMobile}
          todayISO={rangeFrom}
          maxISO={rangeTo}
          days={days}
          dayLabels={dayLabels}
          activeDay={activeDay}
          setActiveDay={setActiveDay}
          value={inputs[activeDay] ?? ""}
          setValue={(next) => setInputs((prev) => ({ ...prev, [activeDay]: next }))}
          saving={saving}
          onSave={() => saveDay(activeDay)}
          msg={msg}
          missing={selected.missing}
          selected={selected.found}
          search={search}
          setSearch={setSearch}
          searchRef={searchRef}
          alphaKbOpen={alphaKbOpen}
          setAlphaKbOpen={setAlphaKbOpen}
          onSwitchToNumeric={() => {
            setAlphaKbOpen(false);
            setNumKbOpen(true);
          }}
          numKbOpen={numKbOpen}
          setNumKbOpen={setNumKbOpen}
          onNumInsert={onNumInsert}
          onNumBackspace={onNumBackspace}
          onNumClear={onNumClear}
          onNumDone={onNumDone}
          prettyCZShort={prettyCZShort}
          prettyCZLong={prettyCZLong}
          startWeekOf={startOfWeekMondayISO}
        />
      </div>

      <div className="hidden md:block">
        <DesktopView
          weekLabel={weekLabel}
          weekMonday={weekMonday}
          weekOptions={weekOptions}
          onPickWeek={(monday) => {
            setWeekMonday(monday);
            setCalOpen(false);
          }}
          calOpen={calOpen}
          setCalOpen={setCalOpen}
          calBtnRef={calBtnRefDesktop}
          todayISO={rangeFrom}
          maxISO={rangeTo}
          days={days}
          dayLabels={dayLabels}
          activeDay={activeDay}
          setActiveDay={setActiveDay}
          value={inputs[activeDay] ?? ""}
          setValue={(next) => setInputs((prev) => ({ ...prev, [activeDay]: next }))}
          saving={saving}
          onSave={() => saveDay(activeDay)}
          msg={msg}
          missing={selected.missing}
          selected={selected.found}
          onRemoveSelected={(legacyId) =>
            setInputs((prev) => ({
              ...prev,
              [activeDay]: removeOneNumFromText(prev[activeDay] ?? "", legacyId),
            }))
          }
          search={search}
          setSearch={setSearch}
          searchRef={searchRef}
          alphaKbOpen={alphaKbOpen}
          setAlphaKbOpen={setAlphaKbOpen}
          searchResults={searchResults}
          onPickSearchResult={(legacyId) => {
            const cur = inputs[activeDay] ?? "";
            const nums = uniqKeepOrder([...parseNums(cur), legacyId]);
            setInputs((prev) => ({ ...prev, [activeDay]: nums.join(", ") }));
            setSearch("");
            setAlphaKbOpen(false);
          }}
          numKbOpen={numKbOpen}
          setNumKbOpen={setNumKbOpen}
          onNumInsert={onNumInsert}
          onNumBackspace={onNumBackspace}
          onNumClear={onNumClear}
          onNumDone={onNumDone}
          prettyCZShort={prettyCZShort}
          prettyCZLong={prettyCZLong}
          startWeekOf={startOfWeekMondayISO}
        />
      </div>
    </>
  );
}