"use client";

import Link from "next/link";

type Tile = {
  title: string;
  href: string;
  color: string;
  icon: string;
  desc?: string;
};

export default function MobileView({ tiles }: { tiles: Tile[] }) {
  // mobil: 1 sloupec, na větším mobilu klidně 2
  const grid = "mt-5 grid gap-4 grid-cols-1 sm:grid-cols-2";
  const tileBase =
    "w-full rounded-3xl p-5 text-white shadow-[0_12px_30px_rgba(0,0,0,0.08)] " +
    "transition active:scale-[0.99] hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-black/10";

  return (
    <div className={grid}>
      {tiles.map((t) => (
        <Link key={t.href} href={t.href} className={`${tileBase} ${t.color}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-lg font-extrabold leading-tight">{t.title}</div>
              {t.desc ? (
                <div className="mt-2 text-sm font-semibold text-white/85">{t.desc}</div>
              ) : null}
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-2xl">
              {t.icon}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end text-sm font-extrabold text-white/90">
            Otevřít <span className="ml-2 text-lg">›</span>
          </div>
        </Link>
      ))}
    </div>
  );
}