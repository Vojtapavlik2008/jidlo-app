"use client";

import Link from "next/link";
import { type RefObject, useMemo, useRef } from "react";
import {
  AlphaKeyboard,
  CalendarPopover,
  IconButton,
  NumericKeyboardCard,
  WeekDropdown,
} from "./widgets";
import type { Jidlo } from "./MobileView";

export function DesktopView(props: {
  weekLabel: string;
  weekMonday: string;
  weekOptions: { key: string; label: string }[];
  onPickWeek: (monday: string) => void;

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
  onRemoveSelected: (legacyId: number) => void;

  search: string;
  setSearch: (v: string) => void;
  searchRef: RefObject<HTMLInputElement>;
  alphaKbOpen: boolean;
  setAlphaKbOpen: (v: boolean) => void;

  searchResults: Jidlo[];
  onPickSearchResult: (legacyId: number) => void;

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
    onPickWeek,

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
    onRemoveSelected,

    search,
    setSearch,
    searchRef,
    alphaKbOpen,
    setAlphaKbOpen,

    searchResults,
    onPickSearchResult,

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

  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const pageMax = "max-w-[1200px]";
  const leftMax = "max-w-[820px]";
  const headerWrap = `mx-auto w-full ${pageMax} px-6 pt-6`;

  const pillBase =
    "rounded-full px-4 py-2 text-sm font-extrabold leading-none ring-1 ring-green-200/80 transition whitespace-nowrap";
  const pillOn = "bg-green-600 text-white ring-green-600";
  const pillOff = "bg-white text-green-800 hover:bg-green-50";

  const boxOuter =
    "rounded-[34px] bg-green-50/40 ring-2 ring-green-200/70 p-6 md:p-8";
  const boxInner =
    "rounded-[28px] bg-green-50/50 ring-2 ring-green-200/70 p-6 md:p-7";

  const inputArea =
    "w-full rounded-[18px] bg-white px-6 py-5 text-[15px] font-semibold text-gray-900 placeholder:text-gray-400 " +
    "ring-1 ring-green-200/90 focus:outline-none focus:ring-2 focus:ring-green-500/30";

  const searchInput =
    "w-full h-12 rounded-full bg-white px-6 pr-16 text-[15px] font-semibold text-gray-900 placeholder:text-gray-400 " +
    "ring-1 ring-green-200/90 focus:outline-none focus:ring-2 focus:ring-green-500/30";

  const saveBtn =
    "rounded-full bg-green-600 px-10 py-3.5 text-sm font-extrabold text-white shadow-sm hover:brightness-95 disabled:opacity-50 transition";

  const weekIndex = useMemo(() => {
    const i = weekOptions.findIndex((w) => w.key === weekMonday);
    return i < 0 ? 0 : i;
  }, [weekOptions, weekMonday]);

  const canPrevWeek = weekIndex > 0;
  const canNextWeek = weekIndex < weekOptions.length - 1;

  const pickWeekByIndex = (i: number) => {
    const w = weekOptions[i];
    if (!w) return;
    onPickWeek(w.key);
    setActiveDay(w.key);
    setCalOpen(false);
  };

  return (
    <div className="hidden md:block">
      <div className={headerWrap}>
        <div className="flex justify-center">
          <div className={`w-full ${leftMax}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="text-3xl font-extrabold text-gray-900">Správa menu</div>

              <div className="flex items-center gap-3">
                <Link
                  href="/staff/jidla"
                  className="rounded-full bg-white px-7 py-2.5 text-sm font-extrabold text-green-800 ring-1 ring-green-200/80 hover:bg-green-50 transition"
                >
                  Upravit jídla
                </Link>

                <Link
                  href="/staff"
                  className="rounded-full bg-white px-7 py-2.5 text-sm font-extrabold text-green-800 ring-1 ring-green-200/80 hover:bg-green-50 transition"
                >
                  ← Zpět na rozcestník
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`mx-auto w-full ${pageMax} px-6 pb-16`}>
        <div
          className={[
            "mt-6 grid gap-8 items-start",
            numKbOpen ? "md:grid-cols-[820px_360px] justify-center" : "md:grid-cols-1",
          ].join(" ")}
        >
          <div className={numKbOpen ? "" : "flex justify-center"}>
            <section className={`${boxOuter} w-full ${leftMax}`}>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-3xl font-extrabold text-gray-900">Zadávání jídel</div>
                  <div className="mt-2 text-sm text-gray-600">Týden: {weekLabel}</div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-sm font-extrabold text-gray-700">Vyber týden:</div>

                  <IconButton
                    title="Předchozí týden"
                    onClick={() => pickWeekByIndex(weekIndex - 1)}
                    disabled={!canPrevWeek}
                  >
                    ←
                  </IconButton>

                  <WeekDropdown
                    valueKey={weekMonday}
                    options={weekOptions}
                    onPick={(monday) => {
                      onPickWeek(monday);
                      setActiveDay(monday);
                      setCalOpen(false);
                    }}
                  />

                  <IconButton
                    title="Další týden"
                    onClick={() => pickWeekByIndex(weekIndex + 1)}
                    disabled={!canNextWeek}
                  >
                    →
                  </IconButton>

                  <div className="relative">
                    <button
                      ref={calBtnRef}
                      type="button"
                      onClick={() => setCalOpen((v) => !v)}
                      className="h-11 w-11 rounded-full bg-white ring-2 ring-green-200/80 hover:bg-green-50 transition font-extrabold flex items-center justify-center"
                      title="Kalendář"
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
  const monday = startWeekOf(iso);
  onPickWeek(monday);
  setActiveDay(iso);
  setCalOpen(false);
  requestAnimationFrame(() => inputRef.current?.focus());
}}                    />
                  </div>
                </div>
              </div>

              {/* Day pills (Po–Ne) */}
              <div className="mt-6 flex flex-nowrap gap-2 overflow-x-auto pt-1 pb-2">
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
              </div>

              <div className={`mt-7 ${boxInner}`}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-3xl font-extrabold text-gray-900">
                      {dayLabels[days.indexOf(activeDay)] ?? ""} {prettyCZLong(activeDay)}
                    </div>
                    <div className="mt-1 text-sm text-gray-700">
                      Zadej čísla jídel pro tento den.
                      {missing.length > 0 && (
                        <span className="ml-2 font-extrabold text-red-600">
                          Neexistuje: {missing.join(", ")}
                        </span>
                      )}
                    </div>
                  </div>

                  <button onClick={onSave} disabled={saving} className={saveBtn} type="button">
                    {saving ? "Ukládám…" : "Uložit"}
                  </button>
                </div>

                <div className="mt-5 relative">
                  <textarea
                    ref={inputRef}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="např. 1, 5, 12"
                    rows={2}
                    className={inputArea + " pr-16"}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setNumKbOpen(true);
                      setAlphaKbOpen(false);
                    }}
                    className="absolute right-4 top-4 h-11 w-11 rounded-[18px] bg-white ring-1 ring-green-200/80 hover:bg-green-50 transition font-extrabold"
                    title="Numerická klávesnice"
                  >
                    ⌨
                  </button>
                </div>

                {msg && (
                  <div className="mt-4 rounded-2xl bg-white ring-1 ring-green-200/70 px-4 py-3 text-sm text-gray-800">
                    {msg}
                  </div>
                )}

                <div className="mt-6 rounded-[22px] bg-white ring-1 ring-green-200/70 p-5">
                  <div className="text-sm font-extrabold text-gray-900">Vybraná jídla</div>

                  {selected.length === 0 ? (
                    <div className="mt-2 text-sm text-gray-500">Zatím nic vybrané.</div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {selected.map((j) => (
                        <div
                          key={j.id}
                          className="flex items-center justify-between gap-3 rounded-2xl bg-green-50/60 ring-1 ring-green-200/80 px-5 py-4"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate">
                              <span className="font-extrabold text-green-900">{j.legacy_id}</span> –{" "}
                              {j.nazev}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-sm font-extrabold text-green-900 whitespace-nowrap">
                              {j.cena ?? "—"} Kč
                            </div>
                            <button
                              type="button"
                              onClick={() => onRemoveSelected(j.legacy_id)}
                              className="h-10 rounded-full bg-white px-5 text-sm font-extrabold text-red-600 ring-1 ring-red-200 hover:bg-red-50 transition"
                            >
                              Smazat
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-5 rounded-[22px] bg-white ring-1 ring-green-200/70 p-5">
                  <div className="text-sm font-extrabold text-gray-900">Vyhledávání podle názvu jídla</div>

                  <div className="mt-3 relative">
                    <input
                      ref={searchRef}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Začni psát název jídla..."
                      className={searchInput}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setAlphaKbOpen(true);
                        setNumKbOpen(false);
                        requestAnimationFrame(() => searchRef.current?.focus());
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-11 w-11 rounded-[18px] bg-white ring-1 ring-green-200/80 hover:bg-green-50 transition font-extrabold"
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
                      onSwitchToNumeric={() => {
                        setAlphaKbOpen(false);
                        setNumKbOpen(true);
                      }}
                    />
                  ) : null}

                  {search.trim().length > 0 ? (
                    <div className="mt-4 rounded-2xl bg-green-50/50 ring-1 ring-green-200/70 p-4">
                      <div className="text-xs font-extrabold text-gray-700 mb-2">Nalezené položky</div>
                      <div className="space-y-2 max-h-44 overflow-auto pr-1">
                        {searchResults.map((j) => (
                          <button
                            key={j.id}
                            type="button"
                            onClick={() => onPickSearchResult(j.legacy_id)}
                            className="w-full text-left rounded-xl bg-white ring-1 ring-green-200/70 px-4 py-3 hover:bg-green-50 transition"
                          >
                            <div className="text-sm font-semibold text-gray-900">
                              <span className="font-extrabold text-green-900">{j.legacy_id}</span> – {j.nazev}
                            </div>
                          </button>
                        ))}
                        {searchResults.length === 0 ? (
                          <div className="text-sm text-gray-500">Nic nenalezeno.</div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          </div>

          {numKbOpen ? (
            <div className="md:sticky md:top-6">
              <NumericKeyboardCard
                onClose={() => setNumKbOpen(false)}
                onInsert={onNumInsert}
                onBackspace={onNumBackspace}
                onClear={onNumClear}
                onDone={onNumDone}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}