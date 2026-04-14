"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { CalendarPopover } from "./widgets";

export type Jidlo = {
  id: string;
  legacy_id: number;
  nazev: string;
  cena: number | null;
};

export function MobileView(props: {
  weekLabel: string;
  weekMonday: string;
  weekOptions: { key: string; label: string }[];
  setWeekMonday: (x: string) => void;

  calOpen: boolean;
  setCalOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  calBtnRef: RefObject<HTMLButtonElement>;
  todayISO: string;
  maxISO: string;

  days: string[];
  dayLabels: string[];
  activeDay: string;
  setActiveDay: (iso: string) => void;

  value: string;
  setValue: (next: string) => void;

  saving: boolean;
  onSave: () => void;

  msg: string | null;
  missing: number[];

  selected: Jidlo[];

  search: string;
  setSearch: (v: string) => void;
  searchRef: RefObject<HTMLInputElement>;
  alphaKbOpen: boolean;
  setAlphaKbOpen: (v: boolean) => void;
  onSwitchToNumeric: () => void;

  numKbOpen: boolean;
  setNumKbOpen: (v: boolean) => void;
  onNumInsert: (ch: string) => void;
  onNumBackspace: () => void;
  onNumClear: () => void;
  onNumDone: () => void;

  prettyCZShort: (iso: string) => string;
  prettyCZLong: (iso: string) => string;
  startWeekOf: (iso: string) => string;
}) {
  const {
    weekLabel,
    weekMonday,
    weekOptions,
    setWeekMonday,
    calOpen,
    setCalOpen,
    calBtnRef,
    todayISO,
    maxISO,
    days,
    activeDay,
    setActiveDay,
    value,
    setValue,
    saving,
    onSave,
    msg,
    missing,
    selected,
    search,
    setSearch,
    searchRef,
    setAlphaKbOpen,
    setNumKbOpen,
    prettyCZLong,
    startWeekOf,
  } = props;

  const [weekMenuOpen, setWeekMenuOpen] = useState(false);
  const weekMenuRef = useRef<HTMLDivElement | null>(null);

  const outer = "rounded-[26px] bg-green-50/45 ring-2 ring-green-200/70 p-3";
  const panel = "rounded-[24px] bg-white ring-2 ring-green-200/70 p-3";
  const softCard = "rounded-[20px] bg-green-50/55 ring-1 ring-green-200/80 p-3";

  const weekIndex = useMemo(() => {
    const i = weekOptions.findIndex((w) => w.key === weekMonday);
    return i < 0 ? 0 : i;
  }, [weekOptions, weekMonday]);

  const canPrevWeek = weekIndex > 0;
  const canNextWeek = weekIndex < weekOptions.length - 1;

  const pickWeek = (monday: string) => {
    setWeekMonday(monday);
    setActiveDay(monday);
    setWeekMenuOpen(false);
    setCalOpen(false);
  };

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!weekMenuRef.current) return;
      if (!weekMenuRef.current.contains(e.target as Node)) {
        setWeekMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const shortDayTabs = ["Po", "Út", "St", "Čt", "Pá", "So"];

  return (
    <div className="md:hidden px-3 pb-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[24px] leading-none font-extrabold text-gray-950">
          Správa menu
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/staff/jidla"
            className="inline-flex h-11 items-center justify-center rounded-full bg-white px-4 text-[12px] font-extrabold text-slate-700 shadow-sm ring-2 ring-slate-200 transition hover:bg-slate-50"
          >
            Upravit jídla
          </Link>

          <Link
            href="/staff"
            className="inline-flex h-11 items-center justify-center rounded-full bg-green-50 px-4 text-[12px] font-extrabold text-green-900 shadow-sm ring-2 ring-green-200 transition hover:bg-green-100/70"
          >
            Rozcestník
          </Link>
        </div>
      </div>

      <div className="mt-3 h-[4px] w-full rounded-full bg-green-600/90" />

      <section className={"mt-3 " + outer}>
        <div className={"relative " + panel}>
          <div className="flex items-center gap-2">
            <button
              title="Předchozí týden"
              onClick={() => pickWeek(weekOptions[weekIndex - 1]?.key ?? weekMonday)}
              disabled={!canPrevWeek}
              type="button"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[20px] ring-2 ring-green-200/80 transition hover:bg-green-50 disabled:opacity-40"
            >
              ←
            </button>

            <div className="relative min-w-0 flex-1" ref={weekMenuRef}>
              <button
                type="button"
                onClick={() => setWeekMenuOpen((v) => !v)}
                className="flex h-11 w-full items-center justify-between gap-2 rounded-full bg-green-50 px-4 text-left ring-2 ring-green-200/80 transition hover:bg-green-100/70"
              >
                <span className="min-w-0 truncate text-[14px] font-extrabold text-gray-900">
                  {weekLabel}
                </span>

                <span className="shrink-0 text-[11px] font-black leading-none text-green-800">
                  <span className="block">▲</span>
                  <span className="-mt-0.5 block">▼</span>
                </span>
              </button>

              {weekMenuOpen ? (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-72 overflow-auto rounded-[18px] bg-white p-2 shadow-lg ring-1 ring-green-200/90">
                  {weekOptions.map((o) => {
                    const active = o.key === weekMonday;
                    return (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => pickWeek(o.key)}
                        className={
                          "mb-1 flex w-full items-center justify-between rounded-[14px] px-3 py-2 text-left text-sm font-bold transition last:mb-0 " +
                          (active
                            ? "bg-green-600 text-white"
                            : "bg-green-50 text-gray-900 hover:bg-green-100")
                        }
                      >
                        <span>{o.label}</span>
                        {active ? <span>✓</span> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <button
              title="Další týden"
              onClick={() => pickWeek(weekOptions[weekIndex + 1]?.key ?? weekMonday)}
              disabled={!canNextWeek}
              type="button"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[20px] ring-2 ring-green-200/80 transition hover:bg-green-50 disabled:opacity-40"
            >
              →
            </button>

            <button
              ref={calBtnRef}
              onClick={() => setCalOpen((v) => !v)}
              className="h-11 w-11 shrink-0 rounded-full bg-white text-[18px] ring-2 ring-green-200/80 transition hover:bg-green-50"
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
                setWeekMonday(startWeekOf(iso));
                setActiveDay(iso);
                setCalOpen(false);
              }}
            />
          </div>

          <div className="mt-3 grid grid-cols-6 gap-2">
            {days.map((d, idx) => {
              const active = activeDay === d;
              return (
                <button
                  key={d}
                  onClick={() => setActiveDay(d)}
                  type="button"
                  className={
                    "h-11 rounded-full px-0 text-[12px] font-extrabold ring-1 transition " +
                    (active
                      ? "bg-green-600 text-white ring-green-600"
                      : "bg-white text-green-800 ring-green-200/80 hover:bg-green-50")
                  }
                >
                  {shortDayTabs[idx] ?? "Den"}
                </button>
              );
            })}
          </div>
        </div>

        <div className={"mt-3 " + panel}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[16px] font-extrabold text-gray-900">
                {prettyCZLong(activeDay)}
              </div>
              <div className="mt-0.5 text-[11px] text-gray-600">
                Zadej čísla jídel pro tento den
              </div>
            </div>

            <button
              onClick={onSave}
              disabled={saving}
              className="shrink-0 rounded-full bg-green-600 px-5 py-2.5 text-[12px] font-extrabold text-white shadow-sm transition hover:brightness-95 disabled:opacity-50"
              type="button"
            >
              {saving ? "Ukládám…" : "Uložit"}
            </button>
          </div>

          <div className="mt-3">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onFocus={() => {
                setNumKbOpen(false);
                setAlphaKbOpen(false);
              }}
              placeholder="např. 1, 5, 12"
              inputMode="decimal"
              enterKeyHint="done"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="h-12 w-full rounded-[18px] bg-green-50 px-4 text-[15px] font-semibold text-gray-900 placeholder:text-gray-400 ring-2 ring-green-200/80 focus:outline-none focus:ring-2 focus:ring-green-500/30"
            />
          </div>

          {missing.length > 0 ? (
            <div className="mt-2 rounded-2xl bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700 ring-1 ring-red-200">
              Neexistuje: {missing.join(", ")}
            </div>
          ) : null}

          {msg ? (
            <div className="mt-2 rounded-2xl bg-white px-3 py-2 text-[12px] text-gray-800 ring-1 ring-green-200/70">
              {msg}
            </div>
          ) : null}

          <div className={"mt-3 " + softCard}>
            <div className="text-[12px] font-extrabold text-gray-900">
              Vybraná jídla
            </div>

            {selected.length === 0 ? (
              <div className="mt-2 text-[12px] text-gray-500">
                Zatím nic vybrané.
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                {selected.map((j) => (
                  <div
                    key={j.id}
                    className="flex items-center justify-between gap-2 rounded-[16px] bg-white px-3 py-2 ring-1 ring-green-200/80"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-semibold text-gray-900">
                        <span className="font-extrabold text-green-900">
                          {j.legacy_id}
                        </span>{" "}
                        – {j.nazev}
                      </div>
                    </div>

                    <div className="shrink-0 whitespace-nowrap text-[12px] font-extrabold text-green-900">
                      {j.cena ?? "—"} Kč
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={"mt-3 " + softCard}>
            <div className="text-[12px] font-extrabold text-gray-900">
              Vyhledávání
            </div>

            <div className="mt-2">
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => {
                  setNumKbOpen(false);
                  setAlphaKbOpen(false);
                }}
                placeholder="Začni psát název…"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="h-12 w-full rounded-[16px] bg-white px-4 text-[14px] font-semibold text-gray-900 placeholder:text-gray-400 ring-1 ring-green-200/90 focus:outline-none focus:ring-2 focus:ring-green-500/30"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}