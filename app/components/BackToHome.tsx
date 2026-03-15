"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BackToHome() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-6xl px-6 py-6">
        <Link
          href="/"
          className="inline-flex items-center gap-3 rounded-2xl border-2 border-green-600 px-6 py-3 text-lg font-semibold text-green-700 transition hover:bg-green-600 hover:text-white"
        >
          ← Zpět
        </Link>
      </div>
    </div>
  );
}