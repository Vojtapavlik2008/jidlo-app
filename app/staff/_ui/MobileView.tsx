"use client";

import Link from "next/link";
import type { StaffHubTile } from "../page";

function Tile({
  href,
  title,
  bg,
  variant = "bottom",
}: {
  href: string;
  title: string;
  bg: string;
  variant?: "top" | "bottom";
}) {
  const isTop = variant === "top";

  return (
    <Link
      href={href}
      className={[
        "flex w-full items-center justify-center rounded-[24px] px-4 text-center font-extrabold text-white shadow-md ring-1 ring-black/5 transition active:scale-[0.99] hover:brightness-95",
        isTop ? "min-h-[82px] text-[16px]" : "min-h-[74px] text-[15px]",
      ].join(" ")}
      style={{ backgroundColor: bg }}
    >
      <span>{title}</span>
    </Link>
  );
}

function WebButton() {
  return (
    <Link
      href="/"
      className="inline-flex h-[36px] min-w-[104px] items-center justify-center gap-2 rounded-2xl bg-white px-3 text-[12px] font-extrabold text-[#2f406b] ring-1 ring-black/10 transition hover:bg-gray-50"
    >
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-50 text-[11px] text-green-700 ring-1 ring-green-200">
        🌐
      </span>
      <span>Web</span>
      <span className="text-[11px] opacity-70">→</span>
    </Link>
  );
}

export default function MobileView({ tiles }: { tiles: StaffHubTile[] }) {
  const firstRow = tiles.slice(0, 2);
  const middleTiles = tiles.slice(2, 6);
  const deliveryTile = tiles[6];

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-20 border-b border-black/5 bg-white/95 backdrop-blur">
        <div className="mx-auto w-full max-w-md px-3 pb-2 pt-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[26px] font-extrabold leading-none text-gray-900">
                Rozcestník
              </h1>
              <p className="mt-1 text-[12px] font-semibold text-gray-500">
                Personální rozcestník
              </p>
            </div>

            <div className="-mt-[2px] shrink-0">
              <WebButton />
            </div>
          </div>

          <div className="mt-3 h-[3px] w-full rounded-full bg-green-600" />
        </div>
      </div>

      <div className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-md flex-col px-3 pb-4 pt-5">
        <div className="grid grid-cols-2 gap-3">
          {firstRow.map((tile) => (
            <Tile
              key={tile.href}
              href={tile.href}
              title={tile.title}
              bg={tile.bg}
              variant={tile.variant}
            />
          ))}
        </div>

        <div className="mt-14 grid grid-cols-2 gap-3">
          {middleTiles.map((tile) => (
            <Tile
              key={tile.href}
              href={tile.href}
              title={tile.title}
              bg={tile.bg}
              variant={tile.variant}
            />
          ))}
        </div>

        <div className="flex-1" />

        {deliveryTile ? (
          <div className="pt-3">
            <Tile
              href={deliveryTile.href}
              title={deliveryTile.title}
              bg="#16a34a"
              variant={deliveryTile.variant}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
