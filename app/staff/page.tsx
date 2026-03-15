"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

function Tile({
  href,
  title,
  bg,
  variant = "top",
}: {
  href: string;
  title: string;
  bg: string;
  variant?: "top" | "bottom";
}) {
  const isTop = variant === "top";

  const minH = isTop
    ? "min-h-[78px] sm:min-h-[90px] md:min-h-[110px]"
    : "min-h-[70px] sm:min-h-[86px] md:min-h-[100px]";
  const text = "text-[16px] sm:text-[18px] md:text-2xl";
  const pad = "px-4 sm:px-6 md:px-10";

  return (
    <Link
      href={href}
      className={
        "flex w-full items-center justify-center rounded-3xl text-center font-extrabold text-white shadow-md ring-1 ring-black/5 transition hover:brightness-95 " +
        pad +
        " " +
        minH
      }
      style={{ backgroundColor: bg }}
    >
      <span className={text}>{title}</span>
    </Link>
  );
}

function PinDot({ filled }: { filled: boolean }) {
  return (
    <div
      className={[
        "h-4 w-4 rounded-full border transition",
        filled ? "border-white bg-white" : "border-white/50 bg-transparent",
      ].join(" ")}
    />
  );
}

function KeyButton({
  children,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-16 rounded-2xl bg-white/10 text-2xl font-extrabold text-white",
        "ring-1 ring-white/15 transition hover:bg-white/15 active:scale-[0.98]",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function StaffHubPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [sleepMode, setSleepMode] = useState(false);
  const [sleepCanWake, setSleepCanWake] = useState(false);

  const [lockOpen, setLockOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function syncFullscreen() {
      setIsFullscreen(!!document.fullscreenElement);
    }

    function onPointerDown(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (sleepMode || lockOpen) return;
      if (e.key === "Escape") setMenuOpen(false);
    }

    syncFullscreen();
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [sleepMode, lockOpen]);

  useEffect(() => {
    if (!sleepMode) {
      setSleepCanWake(false);
      return;
    }

    const arm = window.setTimeout(() => {
      setSleepCanWake(true);
    }, 700);

    const wakeToLock = () => {
      if (!sleepCanWake) return;
      setSleepMode(false);
      setSleepCanWake(false);
      setMenuOpen(false);
      setLockOpen(true);
      setPin("");
      setPinError(null);
    };

    const onMove = () => wakeToLock();
    const onClick = () => wakeToLock();
    const onTouch = () => wakeToLock();
    const onKey = () => wakeToLock();

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("click", onClick, { passive: true });
    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("keydown", onKey);

    return () => {
      window.clearTimeout(arm);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("click", onClick);
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("keydown", onKey);
    };
  }, [sleepMode, sleepCanWake]);

  useEffect(() => {
    if (!lockOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (pinBusy) return;

      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        addDigit(e.key);
        return;
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        removeDigit();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        clearPin();
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        unlockWithPin();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lockOpen, pinBusy, pin]);

  useEffect(() => {
    const shouldLockScroll = sleepMode || lockOpen;
    const prevOverflow = document.body.style.overflow;

    if (shouldLockScroll) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [sleepMode, lockOpen]);

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
      setMenuOpen(false);
    } catch (e) {
      console.error("Fullscreen error:", e);
    }
  }

  async function enterSleepMode() {
    setMenuOpen(false);
    setPin("");
    setPinError(null);
    setSleepCanWake(false);

    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {
      console.error("Sleep fullscreen error:", e);
    }

    setSleepMode(true);
  }

  function addDigit(digit: string) {
    if (pinBusy) return;
    if (pin.length >= 4) return;
    setPinError(null);
    setPin((prev) => prev + digit);
  }

  function removeDigit() {
    if (pinBusy) return;
    setPinError(null);
    setPin((prev) => prev.slice(0, -1));
  }

  function clearPin() {
    if (pinBusy) return;
    setPinError(null);
    setPin("");
  }

  async function unlockWithPin() {
    if (pinBusy) return;

    if (!/^\d{4}$/.test(pin)) {
      setPinError("Zadej PIN o délce 4 až 6 číslic.");
      return;
    }

    setPinBusy(true);
    setPinError(null);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;

      if (!token) {
        setPinError("Nejsi přihlášený.");
        return;
      }

      const r = await fetch("/api/staff/unlock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pin }),
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        setPinError(j?.error || "Nepodařilo se ověřit PIN.");
        return;
      }

      setLockOpen(false);
      setPin("");
      setPinError(null);
      setMenuOpen(false);
    } catch (e: any) {
      setPinError(e?.message || "Nepodařilo se ověřit PIN.");
    } finally {
      setPinBusy(false);
    }
  }

  return (
    <>
      <div className="min-h-screen bg-white">
        <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 sm:py-7 md:py-8">
          <div className="mb-5 flex items-start justify-between sm:mb-7 md:mb-10">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">
                <span className="sm:hidden">Rozcestník</span>
                <span className="hidden sm:inline">Personální rozcestník</span>
              </h1>
              <p className="mt-1 text-sm font-semibold text-gray-500">Administrace jídelny</p>
            </div>

            <Link
              href="/"
              className="rounded-2xl bg-white px-4 py-2 text-sm font-extrabold text-gray-900 ring-1 ring-black/10 transition hover:bg-gray-50"
            >
              Web →
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:gap-8">
            <Tile href="/staff/objednavka" title="Objednávka (pokladna)" bg="#16a34a" variant="top" />
            <Tile href="/staff/online-objednavka" title="Online objednávky" bg="#047857" variant="top" />
          </div>

          <div className="h-28 sm:h-36 md:flex-1" />

          <div className="grid grid-cols-2 gap-3 pb-4 sm:gap-5 sm:pb-8 md:gap-8 md:pb-10">
            <Tile href="/staff/seznam-zakazniku" title="Seznam zákazníků" bg="#dc2626" variant="bottom" />
            <Tile href="/staff/objednavka-z-jidelnicku" title="Objednávka z jídelníčku" bg="#1333ea" variant="bottom" />
            <Tile href="/staff/sprava-menu" title="Správa menu" bg="#9333ea" variant="bottom" />
            <Tile href="/staff/reporty" title="Reporty a administrace" bg="#475569" variant="bottom" />
          </div>
        </div>

        <div ref={menuRef} className="fixed bottom-6 right-6 z-[100] hidden md:block">
          {menuOpen ? (
            <div className="mb-3 w-[260px] overflow-hidden rounded-[24px] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.18)] ring-1 ring-black/10">
              <div className="border-b border-gray-100 px-4 py-3">
                <div className="text-sm font-extrabold text-gray-900">Ovládání</div>
                <div className="mt-1 text-xs font-semibold text-gray-500">Rychlé akce pro desktop</div>
              </div>

              <div className="p-2">
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="flex w-full items-center justify-between rounded-[18px] px-4 py-3 text-left transition hover:bg-gray-50"
                >
                  <div>
                    <div className="text-sm font-extrabold text-gray-900">
                      {isFullscreen ? "Ukončit celou obrazovku" : "Celá obrazovka"}
                    </div>
                  </div>
                  <div className="text-xl">{isFullscreen ? "🗗" : "🗖"}</div>
                </button>

                <button
                  type="button"
                  onClick={enterSleepMode}
                  className="mt-2 flex w-full items-center justify-between rounded-[18px] px-4 py-3 text-left transition hover:bg-gray-50"
                >
                  <div>
                    <div className="text-sm font-extrabold text-gray-900">Vypnout</div>
                    <div className="mt-1 text-xs font-semibold text-gray-500">režim spánku</div>
                  </div>
                  <div className="text-xl">🌙</div>
                </button>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="grid h-16 w-16 place-items-center rounded-full bg-[#111827] text-2xl text-white shadow-[0_18px_40px_rgba(0,0,0,0.25)] transition hover:scale-[1.03] hover:bg-black active:scale-[0.98]"
            title="Otevřít ovládání"
          >
            ⏻
          </button>
        </div>
      </div>

      {sleepMode ? (
        <div className="fixed inset-0 z-[9998] cursor-none bg-black" aria-hidden="true" />
      ) : null}

      {lockOpen ? (
        <div className="fixed inset-0 z-[9999] bg-[#05070b] text-white">
          <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-6 py-10">
            <div className="w-full max-w-[560px] rounded-[36px] bg-white/5 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)] ring-1 ring-white/10 backdrop-blur-sm sm:p-8">
              <div className="text-center">
                <div className="text-sm font-bold uppercase tracking-[0.25em] text-white/50">
                  vojta.pokus.web
                </div>
                <h2 className="mt-3 text-3xl font-extrabold">Odemknutí obrazovky</h2>
                <div className="mt-2 text-sm font-semibold text-white/60">
                  Zadej staff PIN
                </div>
              </div>

              <div className="mt-8 flex items-center justify-center gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <PinDot key={i} filled={i < pin.length} />
                ))}
              </div>

              <div className="mt-3 text-center text-sm font-semibold text-white/70">
                {pin.length}/4 číslic
              </div>

              {pinError ? (
                <div className="mt-4 rounded-2xl bg-red-500/15 px-4 py-3 text-center text-sm font-bold text-red-200 ring-1 ring-red-400/20">
                  {pinError}
                </div>
              ) : null}

              <div className="mt-8 grid grid-cols-3 gap-3">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                  <KeyButton key={d} onClick={() => addDigit(d)}>
                    {d}
                  </KeyButton>
                ))}

                <KeyButton onClick={clearPin} className="text-base">
                  C
                </KeyButton>

                <KeyButton onClick={() => addDigit("0")}>0</KeyButton>

                <KeyButton onClick={removeDigit} className="text-base">
                  ←
                </KeyButton>
              </div>

              <button
                type="button"
                onClick={unlockWithPin}
                disabled={pinBusy}
                className="mt-4 h-16 w-full rounded-2xl bg-white text-lg font-extrabold text-black transition hover:brightness-95 disabled:opacity-60"
              >
                {pinBusy ? "Ověřuji…" : "Odemknout"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}