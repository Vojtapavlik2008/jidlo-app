"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useOrder } from "./order-context";
import { formatDayLabel } from "./_helpers";

export default function MobileSummary() {
  const router = useRouter();
  const { cart, cartCount, total } = useOrder();

  const byDay = useMemo(() => {
    const m = new Map<string, typeof cart>();
    for (const it of cart) {
      const arr = m.get(it.datum) ?? [];
      arr.push(it);
      m.set(it.datum, arr);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [cart]);

  return (
    <div className="grid gap-3">
      <div className="rounded-3xl bg-white ring-1 ring-black/5 p-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/objednavka-jidel")}
            className="rounded-2xl px-3 py-2 text-sm font-extrabold bg-green-50 ring-1 ring-green-600/25 text-green-700"
          >
            ← Zpět
          </button>
          <div className="text-sm font-extrabold text-green-700">{cartCount} ks</div>
        </div>

        <div className="mt-2 text-lg font-extrabold text-green-700">Souhrn</div>
      </div>

      {cart.length === 0 ? (
        <div className="rounded-2xl bg-white p-4 text-gray-600 ring-1 ring-black/5">Košík je prázdný.</div>
      ) : (
        <>
          {byDay.map(([day, items2]) => (
            <div key={day} className="rounded-2xl bg-white p-3 ring-1 ring-black/5">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-extrabold text-gray-800">{formatDayLabel(day)}</div>
                <div className="text-xs font-semibold text-gray-500">
                  {items2.reduce((s, x) => s + x.qty, 0)} ks
                </div>
              </div>

              <div className="grid gap-2">
                {items2.map((it) => (
                  <div key={it.key} className="flex items-center justify-between rounded-xl bg-green-50 px-3 py-2 ring-1 ring-green-600/25">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-900">{it.nazev}</div>
                      <div className="text-xs font-semibold text-gray-500">{it.qty} ks</div>
                    </div>
                    <div className="shrink-0 text-sm font-extrabold text-green-700">{it.cena * it.qty} Kč</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="rounded-2xl bg-green-50 ring-1 ring-green-600/20 p-4 flex items-center justify-between">
            <div className="text-base font-extrabold text-gray-900">Celkem</div>
            <div className="text-lg font-extrabold text-green-700">{total} Kč</div>
          </div>

          <button
            type="button"
            onClick={() => router.push("/objednavka-jidel/dokonceni")}
            className="w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-extrabold text-white hover:brightness-95"
          >
            Dokončit
          </button>
        </>
      )}
    </div>
  );
}