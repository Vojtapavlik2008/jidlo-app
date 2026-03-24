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
        "flex w-full items-center justify-center rounded-[24px] text-center font-extrabold text-white shadow-md ring-1 ring-black/5 transition hover:brightness-95",
        isTop ? "min-h-[76px] px-4 text-[16px]" : "min-h-[68px] px-4 text-[15px]",
      ].join(" ")}
      style={{ backgroundColor: bg }}
    >
      <span>{title}</span>
    </Link>
  );
}

export default function MobileView({ tiles }: { tiles: StaffHubTile[] }) {
  const firstRow = tiles.slice(0, 2);
  const rest = tiles.slice(2, 6);
  const deliveryTile = tiles[6];

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[26px] font-extrabold leading-none text-gray-900">
              Rozcestník
            </h1>
            <p className="mt-1 text-[12px] font-semibold text-gray-500">
              Personální rozcestník
            </p>
          </div>

          <Link
            href="/"
            className="shrink-0 rounded-2xl bg-white px-3 py-2 text-[13px] font-extrabold text-gray-900 ring-1 ring-black/10"
          >
            Web →
          </Link>
        </div>

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

        <div className="mt-16" />

        <div className="grid grid-cols-2 gap-3">
          {rest.map((tile) => (
            <Tile
              key={tile.href}
              href={tile.href}
              title={tile.title}
              bg={tile.bg}
              variant={tile.variant}
            />
          ))}
        </div>

        {deliveryTile ? (
          <div className="mt-3">
            <Tile
              href={deliveryTile.href}
              title={deliveryTile.title}
              bg="#4ade80"
              variant={deliveryTile.variant}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
