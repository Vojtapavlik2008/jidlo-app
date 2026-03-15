"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
  type ReactNode,
} from "react";

// ================== Small icon button ==================
export function IconButton({
  title,
  onClick,
  children,
  className = "",
  disabled = false,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={
        "h-11 w-11 rounded-full bg-white ring-2 ring-green-200/80 hover:bg-green-50 transition font-extrabold flex items-center justify-center " +
        (disabled ? "opacity-40 cursor-not-allowed hover:bg-white " : "") +
        className
      }
    >
      {children}
    </button>
  );
}

// ================== Week dropdown popover (desktop) ==================
export function WeekDropdown({
  valueKey,
  options,
  onPick,
}: {
  valueKey: string;
  options: { key: string; label: string }[];
  onPick: (mondayISO: string) => void;
}) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

useEffect(() => {
  if (!open) return;

  const onPointerDown = (e: PointerEvent) => {
    const t = e.target as Node;

    // klik na tlačítko dropdownu = nechat otevřené
    if (btnRef.current?.contains(t)) return;

    // klik uvnitř popupu = nechat otevřené
    if (popRef.current?.contains(t)) return;

    // jinak zavřít
    setOpen(false);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
  };

  // ✅ pointerdown + capture = stabilní, nebude to zavírat při klikání uvnitř
  window.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("keydown", onKey);

  return () => {
    window.removeEventListener("pointerdown", onPointerDown, true);
    window.removeEventListener("keydown", onKey);
  };
}, [open]);

  const currentLabel = options.find((o) => o.key === valueKey)?.label ?? "";

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-11 rounded-full bg-white px-5 text-sm font-extrabold text-gray-900 ring-2 ring-green-200/80 hover:bg-green-50 transition inline-flex items-center gap-2"
      >
        <span>{currentLabel}</span>
        <span className="text-gray-700">▾</span>
      </button>

      {open ? (
        <div
          ref={popRef}
          className="absolute left-0 top-[52px] z-[60] w-[260px] rounded-[20px] bg-white ring-2 ring-green-200/80 shadow-2xl overflow-hidden"
        >
          {options.map((o, idx) => {
            const active = o.key === valueKey;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => {
                  onPick(o.key);
                  setOpen(false);
                }}
                className={[
                  "w-full text-left px-5 py-4 text-sm font-extrabold transition",
                  idx === 0 ? "" : "border-t border-green-200/60",
                  active
                    ? "bg-green-50 text-green-900"
                    : "bg-white text-gray-900 hover:bg-green-50",
                ].join(" ")}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// ================== Calendar popover ==================
function fromISOToLocalDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
function toISODateLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function CalendarPopover({
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

  if (!open) return null;

  const month = cursor.getMonth();
  const year = cursor.getFullYear();

  const first = new Date(year, month, 1);
  const firstDow = first.getDay(); // 0=Ne..6=So
  const startOffset = firstDow === 0 ? 6 : firstDow - 1; // pondělí-start
  const start = new Date(year, month, 1 - startOffset);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }

  const monthName = cursor.toLocaleDateString("cs-CZ", {
    month: "long",
    year: "numeric",
  });

  // pozice popoveru u tlačítka
  let style: CSSProperties = { position: "fixed", zIndex: 70 };
  const rect = anchorRef.current?.getBoundingClientRect();
  if (rect) {
    const popW = 360;
    const margin = 12;

    let left = rect.left;
    let top = rect.bottom + 12;

    const maxLeft = window.innerWidth - popW - margin;
    if (left > maxLeft) left = maxLeft;
    if (left < margin) left = margin;

    // kdyby se nevešel dolů, dáme ho nad tlačítko
    const popH = 420;
    if (top + popH > window.innerHeight - margin) top = rect.top - popH - 12;
    if (top < margin) top = margin;

    style.left = left;
    style.top = top;
  }

  const min = fromISOToLocalDate(minISO);
  const max = fromISOToLocalDate(maxISO);

  const canPick = (iso: string) => {
    const d = fromISOToLocalDate(iso);
    return d >= min && d <= max;
  };

  const headCell = "w-10 text-center text-xs font-extrabold text-gray-500";
  const dayBtnBase =
    "w-10 h-10 rounded-full ring-2 ring-green-200/70 text-sm font-extrabold transition";

  return (
    <>
      {/* ✅ Backdrop – klik mimo zavře (bez window listenerů) */}
      <button
        type="button"
        className="fixed inset-0 z-[69] cursor-default"
        onClick={onClose}
        aria-label="Zavřít kalendář"
      />

      {/* ✅ Popover – kliky uvnitř se nepropagují do backdropu */}
      <div
        ref={popRef}
        style={style}
        className="w-[360px] rounded-[28px] bg-white ring-2 ring-green-200/80 shadow-2xl p-4"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              // ✅ bezpečné přepínání měsíců: vždy z 1. dne měsíce
              const d = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
              d.setMonth(d.getMonth() - 1);
              setCursor(d);
            }}
            className="h-10 w-10 rounded-full ring-2 ring-green-200/80 hover:bg-green-50 transition font-extrabold flex items-center justify-center"
            title="Předchozí měsíc"
          >
            ←
          </button>

          <div className="text-sm font-extrabold text-gray-900 capitalize">
            {monthName}
          </div>

          <button
            type="button"
            onClick={() => {
              const d = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
              d.setMonth(d.getMonth() + 1);
              setCursor(d);
            }}
            className="h-10 w-10 rounded-full ring-2 ring-green-200/80 hover:bg-green-50 transition font-extrabold flex items-center justify-center"
            title="Další měsíc"
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
            const ok = canPick(iso);
            const isSelected = iso === valueISO;

            return (
              <button
                key={i}
                type="button"
                disabled={!ok}
                onClick={() => ok && onPick(iso)}
                className={[
                  dayBtnBase,
                  // ✅ když jde vybrat, ukaž normálně (i když je mimo měsíc)
                  ok ? "text-gray-900" : inMonth ? "text-gray-900" : "text-gray-300",
                  ok ? "hover:bg-green-50" : "opacity-30 cursor-not-allowed",
                  isSelected ? "bg-green-600 text-white ring-green-600" : "bg-white",
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
    </>
  );
}

// ================== Numeric keyboard ==================
export function NumericKeyboardCard({
  title = "Numerická klávesnice",
  onClose,
  onInsert,
  onBackspace,
  onClear,
  onDone,
  compact = false,
}: {
  title?: string;
  onClose: () => void;
  onInsert: (ch: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onDone: () => void;
  compact?: boolean;
}) {
  const card =
    "rounded-[28px] bg-white ring-2 ring-green-200/80 shadow-[0_18px_60px_rgba(0,0,0,0.14)] " +
    (compact ? "p-4" : "p-6");
  const key =
    "h-14 rounded-2xl bg-white ring-1 ring-green-200/80 text-lg font-extrabold text-gray-900 hover:bg-green-50 transition";
  const btnRed =
    "h-11 rounded-full bg-white px-6 text-sm font-extrabold text-red-600 ring-1 ring-red-200 hover:bg-red-50 transition";
  const btnGreen =
    "h-11 rounded-full bg-green-600 px-10 text-sm font-extrabold text-white hover:brightness-95 transition";

  return (
    <div className={card}>
      <div className="flex items-center justify-between">
        <div className="text-lg font-extrabold text-gray-900">{title}</div>
        <button
          onClick={onClose}
          className="h-11 w-11 rounded-full bg-white ring-1 ring-gray-200 hover:bg-gray-50 transition text-xl font-extrabold text-gray-900"
          title="Zavřít"
          type="button"
        >
          ×
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            className={key}
            onClick={() => onInsert(String(n))}
            type="button"
          >
            {n}
          </button>
        ))}
        <button className={key} onClick={() => onInsert(", ")} type="button">
          ,
        </button>
        <button className={key} onClick={() => onInsert("0")} type="button">
          0
        </button>
        <button
          className={key}
          onClick={onBackspace}
          title="Smazat znak"
          type="button"
        >
          ⌫
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
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

// ================== Alpha keyboard ==================
function insertIntoInput(
  ref: RefObject<HTMLInputElement>,
  text: string,
  setValue: (v: string | ((p: string) => string)) => void
) {
  const el = ref.current;
  if (!el) {
    setValue((prev: any) => (typeof prev === "string" ? prev + text : text));
    return;
  }
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const next = el.value.slice(0, start) + text + el.value.slice(end);
  setValue(next);
  requestAnimationFrame(() => {
    el.focus();
    const caret = start + text.length;
    el.setSelectionRange(caret, caret);
  });
}

function backspaceInInput(
  ref: RefObject<HTMLInputElement>,
  setValue: (v: string | ((p: string) => string)) => void
) {
  const el = ref.current;
  if (!el) return;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  if (start !== end) {
    const next = el.value.slice(0, start) + el.value.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, start);
    });
    return;
  }
  if (start <= 0) return;
  const next = el.value.slice(0, start - 1) + el.value.slice(end);
  setValue(next);
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(start - 1, start - 1);
  });
}

export function AlphaKeyboard({
  onClose,
  inputRef,
  setValue,
  onSwitchToNumeric,
}: {
  onClose: () => void;
  inputRef: RefObject<HTMLInputElement>;
  setValue: (next: string | ((p: string) => string)) => void;
  onSwitchToNumeric: () => void;
}) {
  const [shift, setShift] = useState(false);

  const keyBase =
    "h-12 rounded-2xl bg-white ring-1 ring-green-200/80 text-[15px] font-extrabold text-gray-900 hover:bg-green-50 transition";
  const wide =
    "h-12 rounded-2xl bg-white ring-1 ring-green-200/80 text-[15px] font-extrabold text-gray-900 hover:bg-green-50 transition";

  const row1 = ["ě", "š", "č", "ř", "ž", "ý", "á", "í", "é"];
  const row2 = ["q", "w", "e", "r", "t", "z", "u", "i", "o", "p"];
  const row3 = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
  const row4 = ["y", "x", "c", "v", "b", "n", "m"];

  const applyShift = (ch: string) => (shift ? ch.toUpperCase() : ch);

  return (
    <div className="mt-3 rounded-[18px] bg-green-50/60 ring-1 ring-green-200/70 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-extrabold text-gray-900">Klávesnice</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => backspaceInInput(inputRef, setValue as any)}
            className="h-10 w-10 rounded-2xl bg-white ring-1 ring-green-200/80 hover:bg-green-50 transition font-extrabold"
            title="Smazat"
          >
            ⌫
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-2xl bg-white px-4 ring-1 ring-green-200/80 hover:bg-green-50 transition text-xs font-extrabold"
          >
            Zavřít
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        <div className="grid grid-cols-9 gap-2">
          {row1.map((k) => (
            <button
              key={k}
              type="button"
              className={keyBase}
              onClick={() =>
                insertIntoInput(inputRef, applyShift(k), setValue as any)
              }
            >
              {applyShift(k)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-10 gap-2">
          {row2.map((k) => (
            <button
              key={k}
              type="button"
              className={keyBase}
              onClick={() =>
                insertIntoInput(inputRef, applyShift(k), setValue as any)
              }
            >
              {applyShift(k)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-9 gap-2">
          {row3.map((k) => (
            <button
              key={k}
              type="button"
              className={keyBase}
              onClick={() =>
                insertIntoInput(inputRef, applyShift(k), setValue as any)
              }
            >
              {applyShift(k)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2 justify-center">
          {row4.map((k) => (
            <button
              key={k}
              type="button"
              className={keyBase}
              onClick={() =>
                insertIntoInput(inputRef, applyShift(k), setValue as any)
              }
            >
              {applyShift(k)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[120px_1fr_120px] gap-2">
          <button
            type="button"
            className={wide}
            onClick={() => setShift((v) => !v)}
          >
            Shift
          </button>
          <button
            type="button"
            className={wide}
            onClick={() => insertIntoInput(inputRef, " ", setValue as any)}
          >
            Mezera
          </button>
          <button type="button" className={wide} onClick={onSwitchToNumeric}>
            123
          </button>
        </div>
      </div>
    </div>
  );
}