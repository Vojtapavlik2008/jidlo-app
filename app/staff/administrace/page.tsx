"use client";

import Link from "next/link";

function Tile({
  href,
  title,
  bg,
  variant = "top",
}: {
  href: string;
  title: string;
  bg: string; // např. "#16a34a"
  variant?: "top" | "bottom";
}) {
  const isTop = variant === "top";

  return (
    <Link
      href={href}
      className={
        "w-full rounded-3xl shadow-md transition hover:brightness-95 ring-1 ring-black/5 " +
        "text-white font-extrabold text-center " +
        "flex items-center justify-center px-10"
      }
      // ✅ NATVRDO: nejde přebít tailwindem ani jiným className
      style={{
  backgroundColor: bg,
  minHeight: isTop ? 110 : 100,
}}

    >
      <span className={isTop ? "text-2xl" : "text-2xl"}>{title}</span>
    </Link>
  );
}

export default function StaffHubPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-6xl px-6 py-8 min-h-screen flex flex-col">
        {/* HLAVIČKA */}
        <div className="flex items-start justify-between mb-10">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">
              Personální rozcestník
            </h1>
            <p className="mt-1 text-sm font-semibold text-gray-500">
              Administrace jídelny
            </p>
          </div>

          <Link
            href="/"
            className="rounded-2xl px-4 py-2 text-sm font-extrabold text-gray-900 bg-white ring-1 ring-black/10 hover:bg-gray-50 transition"
          >
            Web →
          </Link>
        </div>

        {/* ===== HORNÍ 2 ===== */}
        <div className="grid gap-8 md:grid-cols-2">
          <Tile
            href="/staff/pokladna"
            title="Objednávka (pokladna)"
            bg="#16a34a" // green-600
            variant="top"
          />
          <Tile
            href="/staff/online-objednavky"
            title="Online objednávky"
            bg="#047857" // emerald-700
            variant="top"
          />
        </div>

        <div className="flex-1" />

        {/* ===== DOLNÍ 4 ===== */}
        <div className="grid gap-8 md:grid-cols-2 pb-10">
          <Tile
            href="/staff/zakaznici"
            title="Seznam zákazníků"
            bg="#dc2626" // ✅ červená (red-600)
            variant="bottom"
          />
          <Tile
            href="/staff/sprava-menu"
            title="Správa menu"
            bg="#9333ea" // purple-600
            variant="bottom"
          />
          <Tile
            href="/staff/reporty"
            title="Reporty"
            bg="#475569" // slate-600
            variant="bottom"
          />
          <Tile
            href="/staff/admin"
            title="Administrace"
            bg="#2563eb" // blue-600
            variant="bottom"
          />
        </div>
      </div>
    </div>
  );
}
