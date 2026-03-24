"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import DesktopView from "./_ui/DesktopView";
import MobileView from "./_ui/MobileView";

export type StaffHubTile = {
  href: string;
  title: string;
  bg: string;
  variant?: "top" | "bottom";
};

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

  const desktopTopTiles: StaffHubTile[] = [
    {
      href: "/staff/objednavka",
      title: "Objednávka (pokladna)",
      bg: "#16a34a",
      variant: "top",
    },
    {
      href: "/staff/online-objednavka",
      title: "Online objednávky",
      bg: "#047857",
      variant: "top",
    },
  ];

  const desktopBottomTiles: StaffHubTile[] = [
    {
      href: "/staff/seznam-zakazniku",
      title: "Seznam zákazníků",
      bg: "#dc2626",
      variant: "bottom",
    },
    {
      href: "/staff/objednavka-z-jidelnicku",
      title: "Objednávka z jídelníčku",
      bg: "#1333ea",
      variant: "bottom",
    },
    {
      href: "/staff/sprava-menu",
      title: "Správa menu",
      bg: "#9333ea",
      variant: "bottom",
    },
    {
      href: "/staff/reporty",
      title: "Reporty a administrace",
      bg: "#475569",
      variant: "bottom",
    },
  ];

  const mobileTiles: StaffHubTile[] = [
    {
      href: "/staff/objednavka",
      title: "Objednávka (pokladna)",
      bg: "#16a34a",
      variant: "top",
    },
    {
      href: "/staff/online-objednavka",
      title: "Online objednávky",
      bg: "#047857",
      variant: "top",
    },
    {
      href: "/staff/seznam-zakazniku",
      title: "Seznam zákazníků",
      bg: "#dc2626",
      variant: "bottom",
    },
    {
      href: "/staff/objednavka-z-jidelnicku",
      title: "Objednávka z jídelníčku",
      bg: "#1333ea",
      variant: "bottom",
    },
    {
      href: "/staff/sprava-menu",
      title: "Správa menu",
      bg: "#9333ea",
      variant: "bottom",
    },
    {
      href: "/staff/reporty",
      title: "Reporty a administrace",
      bg: "#475569",
      variant: "bottom",
    },
    {
      href: "/staff/reporty/rozvozy",
      title: "Rozvozy",
      bg: "#b91c1c",
      variant: "bottom",
    },
  ];

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
      setPinError("Zadej PIN o délce 4 číslic.");
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
        <div className="block md:hidden">
          <MobileView tiles={mobileTiles} />
        </div>

        <div className="hidden md:block">
          <DesktopView
            topTiles={desktopTopTiles}
            bottomTiles={desktopBottomTiles}
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
            isFullscreen={isFullscreen}
            toggleFullscreen={toggleFullscreen}
            enterSleepMode={enterSleepMode}
            menuRef={menuRef}
          />
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
