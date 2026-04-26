"use client";

import Link from "next/link";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { StaffHubTile } from "../page";

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

export default function DesktopView({
  topTiles,
  bottomTiles,
  menuOpen,
  setMenuOpen,
  isFullscreen,
  toggleFullscreen,
  enterSleepMode,
  menuRef,
}: {
  topTiles: StaffHubTile[];
  bottomTiles: StaffHubTile[];
  menuOpen: boolean;
  setMenuOpen: Dispatch<SetStateAction<boolean>>;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  enterSleepMode: () => void;
  menuRef: MutableRefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 sm:py-7 md:py-8">
      <div className="mb-5 flex items-start justify-between sm:mb-7 md:mb-10">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">
            Personální rozcestník
          </h1>
          
        </div>

        <Link
          href="/"
          className="rounded-2xl bg-white px-4 py-2 text-sm font-extrabold text-gray-900 ring-1 ring-black/10 transition hover:bg-gray-50"
        >
          Web →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-5 md:gap-8">
        {topTiles.map((tile) => (
          <Tile
            key={tile.href}
            href={tile.href}
            title={tile.title}
            bg={tile.bg}
            variant={tile.variant}
          />
        ))}
      </div>

      <div className="h-28 sm:h-36 md:flex-1" />

      <div className="grid grid-cols-2 gap-5 pb-8 md:gap-8 md:pb-10">
        {bottomTiles.map((tile) => (
          <Tile
            key={tile.href}
            href={tile.href}
            title={tile.title}
            bg={tile.bg}
            variant={tile.variant}
          />
        ))}
      </div>

      <div ref={menuRef} className="fixed bottom-6 right-6 z-[100]">
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
  );
}
