"use client";

import Link from "next/link";
import { useMemo, type RefObject } from "react";
import { AlphaKeyboard, CalendarPopover, IconButton, NumericKeyboardCard } from "./widgets";

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
    dayLabels,
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
    alphaKbOpen,
    setAlphaKbOpen,
    onSwitchToNumeric,
    numKbOpen,
    setNumKbOpen,
    onNumInsert,
    onNumBackspace,
    onNumClear,
    onNumDone,
    prettyCZShort,
    prettyCZLong,
    startWeekOf,
  } = props;

  const outer = "rounded-[26px] bg-green-50/40 ring-2 ring-green-200/70 p-4";
  const inner = "rounded-[22px] bg-green-50/50 ring-2 ring-green-200/70 p-4";
  const inputArea =
    "w-full rounded-[16px] bg-white px-4 py-4 text-[14px] font-semibold text-gray-900 placeholder:text-gray-400 " +
    "ring-1 ring-green-200/90 focus:outline-none focus:ring-2 focus:ring-green-500/30";

  const weekIndex = useMemo(() => {
    const i = weekOptions.findIndex((w) => w.key === weekMonday);
    return i < 0 ? 0 : i;
  }, [weekOptions, weekMonday]);

  const canPrevWeek = weekIndex > 0;
  const canNextWeek = weekIndex < weekOptions.length - 1;

  const pickWeek = (monday: string) => {
    setWeekMonday(monday);
    setActiveDay(monday);
    setCalOpen(false);
  };

  return (
    <div className="md:hidden">
      <div className="flex items-center justify-between">
        <div className="text-xl font-extrabold text-gray-900">Menu</div>
        <Link
          href="/staff"
          className="rounded-full bg-white px-4 py-2 text-sm font-extrabold text-green-800 ring-1 ring-green-200/80 hover:bg-green-50 transition"
        >
          ← Rozcestník
        </Link>
      </div>

      <section className={"mt-4 " + outer}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-3xl font-extrabold text-gray-900"></div>
            <div className="mt-1 text-xs text-gray-600">T: {weekLabel}</div>
          </div>

          <div className="flex items-center gap-2">
            <IconButton
              title="Předchozí týden"
              onClick={() => pickWeek(weekOptions[weekIndex - 1]?.key ?? weekMonday)}
              disabled={!canPrevWeek}
            >
              ←
            </IconButton>

            <select
              value={weekMonday}
              onChange={(e) => pickWeek(e.target.value)}
              className="h-10 rounded-full bg-white px-3 text-xs font-extrabold text-gray-900 ring-2 ring-green-200/80 focus:outline-none"
            >
              {weekOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>

            <IconButton
              title="Další týden"
              onClick={() => pickWeek(weekOptions[weekIndex + 1]?.key ?? weekMonday)}
              disabled={!canNextWeek}
            >
              →
            </IconButton>

            <button
              ref={calBtnRef}
              onClick={() => setCalOpen((v) => !v)}
              className="h-10 w-10 rounded-full bg-white ring-2 ring-green-200/80 hover:bg-green-50 transition font-extrabold"
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
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {days.map((d, idx) => (
            <button
              key={d}
              onClick={() => setActiveDay(d)}
              className={
                "rounded-full px-4 py-2 text-xs font-extrabold ring-1 ring-green-200/80 transition " +
                (activeDay === d
                  ? "bg-green-600 text-white ring-green-600"
                  : "bg-white text-green-800 hover:bg-green-50")
              }
              type="button"
            >
              {dayLabels[idx]}{" "}
              <span className={activeDay === d ? "text-white/80" : "text-green-800/70"}>
                ({prettyCZShort(d)})
              </span>
            </button>
          ))}
        </div>

        <div className={"mt-4 " + inner}>
          <div className="text-sm font-extrabold text-gray-900">Zadat čísla</div>
          <div className="mt-1 text-xs text-gray-600">
            Den: <span className="font-extrabold">{prettyCZLong(activeDay)}</span>
            {missing.length > 0 ? (
              <span className="ml-2 font-extrabold text-red-600">
                Neexistuje: {missing.join(", ")}
              </span>
            ) : null}
          </div>

          <div className="mt-3 relative">
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="např. 1, 5, 12"
              rows={2}
              className={inputArea + " pr-14"}
            />
            <button
              type="button"
              onClick={() => {
                setNumKbOpen(true);
                setAlphaKbOpen(false);
              }}
              className="absolute right-3 top-3 h-10 w-10 rounded-[16px] bg-white ring-1 ring-green-200/80 hover:bg-green-50 transition font-extrabold"
              title="Numerická klávesnice"
            >
              123
            </button>
          </div>

          <button
            onClick={onSave}
            disabled={saving}
            className="mt-3 w-full rounded-full bg-green-600 py-3 text-sm font-extrabold text-white shadow-sm hover:brightness-95 disabled:opacity-50 transition"
            type="button"
          >
            {saving ? "Ukládám…" : "Uložit"}
          </button>

          {msg ? (
            <div className="mt-3 rounded-2xl bg-white ring-1 ring-green-200/70 px-3 py-2 text-xs text-gray-800">
              {msg}
            </div>
          ) : null}

          <div className="mt-4 rounded-[18px] bg-white ring-1 ring-green-200/70 p-4">
            <div className="text-xs font-extrabold text-gray-900">Vybraná jídla</div>

            {selected.length === 0 ? (
              <div className="mt-2 text-xs text-gray-500">Zatím nic vybrané.</div>
            ) : (
              <div className="mt-3 space-y-2">
                {selected.map((j) => (
                  <div
                    key={j.id}
                    className="flex items-center justify-between gap-2 rounded-2xl bg-green-50/60 ring-1 ring-green-200/80 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-gray-900 truncate">
                        <span className="font-extrabold text-green-900">{j.legacy_id}</span> – {j.nazev}
                      </div>
                    </div>
                    <div className="text-xs font-extrabold text-green-900 whitespace-nowrap">
                      {j.cena ?? "—"} Kč
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 rounded-[18px] bg-white ring-1 ring-green-200/70 p-4">
            <div className="text-xs font-extrabold text-gray-900">Vyhledávání</div>

            <div className="mt-2 relative">
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Začni psát název…"
                className="w-full h-11 rounded-full bg-white px-4 pr-14 text-[14px] font-semibold text-gray-900 placeholder:text-gray-400 ring-1 ring-green-200/90 focus:outline-none focus:ring-2 focus:ring-green-500/30"
              />
              <button
                type="button"
                onClick={() => {
                  setAlphaKbOpen(true);
                  setNumKbOpen(false);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-[16px] bg-white ring-1 ring-green-200/80 hover:bg-green-50 transition font-extrabold"
                title="Klávesnice"
              >
                ⌨
              </button>
            </div>

            {alphaKbOpen ? (
              <AlphaKeyboard
                onClose={() => setAlphaKbOpen(false)}
                inputRef={searchRef}
                setValue={setSearch as any}
                onSwitchToNumeric={onSwitchToNumeric}
              />
            ) : null}
          </div>
        </div>
      </section>

      {numKbOpen ? (
        <>
          <button
            type="button"
            onClick={() => setNumKbOpen(false)}
            className="fixed inset-0 z-40 bg-black/30"
            aria-label="Zavřít"
          />
          <div className="fixed inset-x-0 bottom-0 z-50 p-3">
            <div className="mx-auto w-full max-w-[560px]">
              <NumericKeyboardCard
                compact
                onClose={() => setNumKbOpen(false)}
                onInsert={onNumInsert}
                onBackspace={onNumBackspace}
                onClear={onNumClear}
                onDone={onNumDone}
              />
            </div>
          </div>
          <div className="h-[340px]" />
        </>
      ) : null}
    </div>
  );
}