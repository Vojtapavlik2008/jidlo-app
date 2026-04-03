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
      className="inline-flex h-[40px] min-w-[118px] items-center justify-center rounded-[22px] border border-[#a9e5ba] bg-[#edf9f0] px-5 text-[13px] font-extrabold text-[#2f6e43] shadow-sm transition hover:bg-[#e3f5e7]"
    >
      Web <span className="ml-2 text-[13px]">→</span>
    </Link>
  );
}

export default function MobileView({ tiles }: { tiles: StaffHubTile[] }) {
  const pokladnaTile = tiles[0];
  const onlineTile = tiles[1];
  const customersTile = tiles[2];
  const menuOrderTile = tiles[3];
  const menuManageTile = tiles[4];
  const reportsTile = tiles[5];
  const deliveryTile = tiles[6];

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-20 border-b border-black/5 bg-white/95 backdrop-blur">
        <div className="mx-auto w-full max-w-md px-3 pb-2 pt-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[26px] font-extrabold leading-none text-gray-900">
                Rozcestník
              </h1>
              <p className="mt-1 text-[12px] font-semibold text-gray-500">
                Personální rozcestník
              </p>
            </div>

            <div className="shrink-0 pt-1">
              <WebButton />
            </div>
          </div>

          <div className="mt-4 h-[4px] w-full rounded-full bg-green-600" />
        </div>
      </div>

      <div className="mx-auto flex min-h-[calc(100vh-84px)] w-full max-w-md flex-col px-3 pb-4 pt-5">
        <div className="grid grid-cols-2 gap-3">
          {pokladnaTile ? (
            <Tile
              href={pokladnaTile.href}
              title={pokladnaTile.title}
              bg={pokladnaTile.bg}
              variant="top"
            />
          ) : null}

          {onlineTile ? (
            <Tile
              href={onlineTile.href}
              title={onlineTile.title}
              bg={onlineTile.bg}
              variant="top"
            />
          ) : null}
        </div>

       <div className="h-[100px] shrink-0" />

<div className="mt-auto mb-[140px] space-y-3">
  <div className="grid grid-cols-2 gap-3">
    {customersTile ? (
      <Tile
        href={customersTile.href}
        title={customersTile.title}
        bg={customersTile.bg}
        variant="bottom"
      />
    ) : null}

    {menuOrderTile ? (
      <Tile
        href={menuOrderTile.href}
        title={menuOrderTile.title}
        bg={menuOrderTile.bg}
        variant="bottom"
      />
    ) : null}
  </div>

  <div className="grid grid-cols-2 gap-3">
    {menuManageTile ? (
      <Tile
        href={menuManageTile.href}
        title={menuManageTile.title}
        bg={menuManageTile.bg}
        variant="bottom"
      />
    ) : null}

    {reportsTile ? (
      <Tile
        href={reportsTile.href}
        title="Reporty"
        bg={reportsTile.bg}
        variant="bottom"
      />
    ) : null}
  </div>

  {deliveryTile ? (
    <Tile
      href={deliveryTile.href}
      title={deliveryTile.title}
      bg="#16a34a"
      variant="bottom"
    />
  ) : null}
</div>
      </div>
    </div>
  );
}
