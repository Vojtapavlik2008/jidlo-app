"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Tile = {
  title: string;
  href: string;
  color: string;
  icon: string;
  desc?: string;
};

function BigTile({ t }: { t: Tile }) {
  return (
    <Link
      href={t.href}
      className="group rounded-[28px] px-8 py-10 text-white shadow-[0_14px_34px_rgba(0,0,0,0.08)] transition hover:brightness-95"
      style={{ backgroundColor: t.color }}
    >
      <div className="flex items-center justify-between gap-6">
        <div>
          <div className="text-3xl font-extrabold leading-tight">{t.title}</div>
          {t.desc ? (
            <div className="mt-3 text-base font-semibold text-white/90">{t.desc}</div>
          ) : null}
        </div>

<div className="text-red-600 font-bold text-2xl">TEST DESKTOPVIEW</div>

        <div className="grid h-16 w-16 place-items-center rounded-[22px] bg-white/15 text-3xl">
          {t.icon}
        </div>
      </div>
    </Link>
  );
}

function SmallTile({ t }: { t: Tile }) {
  return (
    <Link
      href={t.href}
      className="group rounded-[26px] px-7 py-8 text-white shadow-[0_12px_30px_rgba(0,0,0,0.08)] transition hover:brightness-95"
      style={{ backgroundColor: t.color }}
    >
      <div className="flex items-start justify-between gap-5">
        <div>
          <div className="text-2xl font-extrabold leading-tight">{t.title}</div>
          {t.desc ? (
            <div className="mt-3 text-sm font-semibold text-white/90">{t.desc}</div>
          ) : null}
        </div>

        <div className="grid h-14 w-14 place-items-center rounded-[20px] bg-white/15 text-2xl">
          {t.icon}
        </div>
      </div>
    </Link>
  );
}

export default function DesktopView({ tiles }: { tiles: Tile[] }) {
  const router = useRouter();

  const top = tiles.slice(0, 2);
  const bottom = tiles.slice(2, 6);

  const [menuOpen, setMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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
      if (e.key === "Escape") {
        setMenuOpen(false);
      }
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
  }, []);

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

  async function lockApp() {
    if (loggingOut) return;

    try {
      setLoggingOut(true);
      await supabase.auth.signOut();
      setMenuOpen(false);
      router.replace("/");
      router.refresh();
    } catch (e) {
      console.error("Sign out error:", e);
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <>
      <div className="mt-8">
        <div className="grid grid-cols-2 gap-8">
          {top.map((t) => (
            <BigTile key={t.href} t={t} />
          ))}
        </div>

        <div className="mt-10 grid grid-cols-2 gap-8">
          {bottom.map((t) => (
            <SmallTile key={t.href} t={t} />
          ))}
        </div>
      </div>

      <div ref={menuRef} className="fixed bottom-6 right-6 z-[100]">
        {menuOpen ? (
          <div className="mb-3 w-[260px] overflow-hidden rounded-[24px] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.18)] ring-1 ring-black/10">
            <div className="border-b border-gray-100 px-4 py-3">
              <div className="text-sm font-extrabold text-gray-900">Ovládání</div>
              <div className="mt-1 text-xs font-semibold text-gray-500">
                Rychlé akce pro desktop
              </div>
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
                  <div className="mt-1 text-xs font-semibold text-gray-500">
                    Režim podobný F11
                  </div>
                </div>
                <div className="text-xl">{isFullscreen ? "🗗" : "🗖"}</div>
              </button>

              <button
                type="button"
                onClick={lockApp}
                disabled={loggingOut}
                className="mt-2 flex w-full items-center justify-between rounded-[18px] px-4 py-3 text-left transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div>
                  <div className="text-sm font-extrabold text-gray-900">
                    {loggingOut ? "Odhlašuji…" : "Uzamknout / odhlásit"}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-gray-500">
                    Nejbližší varianta k Windows + L
                  </div>
                </div>
                <div className="text-xl">🔒</div>
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
    </>
  );
}