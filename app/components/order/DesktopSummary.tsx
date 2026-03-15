"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useOrder } from "@/app/components/order/order-context";
import { formatDayLabel } from "@/app/components/order/_helpers";

export default function DesktopSummary() {
  const router = useRouter();
  const { cart, cartCount, total, setCartStep } = useOrder();

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
    <div className="grid gap-4">
      <div className="grid grid-cols-3 items-center gap-4">
        <div>
          <button
            type="button"
            onClick={() => {
              setCartStep("summary");
              router.push("/");
            }}
            className="rounded-2xl bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 ring-1 ring-green-600/25 hover:bg-green-100/60"
          >
            ← Zpět
          </button>
        </div>

        <div className="text-center">
          <div className="whitespace-nowrap text-2xl font-extrabold text-green-700">
            Košík
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm font-semibold text-gray-500">{cartCount} ks</div>
        </div>
      </div>

      {cart.length === 0 ? (
        <div className="rounded-2xl bg-white p-4 text-gray-600 ring-1 ring-black/5">
          Košík je prázdný.
        </div>
      ) : (
        <>
          {byDay.map(([day, items]) => {
            const dayQty = items.reduce((s, x) => s + x.qty, 0);
            const dayTotal = items.reduce((s, x) => s + x.cena * x.qty, 0);

            return (
              <div
                key={day}
                className="rounded-2xl bg-white p-3 shadow-sm ring-2 ring-green-600/40"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-extrabold text-gray-800">
                    {formatDayLabel(day)}
                  </div>
                  <div className="text-xs font-semibold text-gray-500">
                    {dayQty} ks
                  </div>
                </div>

                <div className="grid gap-2">
                  {items.map((it) => (
                    <div
                      key={it.key}
                      className="rounded-xl bg-green-50 px-3 py-2 ring-1 ring-green-600/25"
                    >
                      <div className="flex items-center gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-gray-900">
                            {it.nazev}
                          </div>
                          <div className="text-xs font-semibold text-gray-500">
                            {it.cena} Kč / ks
                          </div>
                        </div>

                        <div className="shrink-0 text-sm font-bold text-gray-700">
                          {it.qty} ks
                        </div>

                        <div className="shrink-0 text-sm font-bold text-green-700">
                          {it.cena * it.qty} Kč
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-green-100 pt-3">
                  <div className="text-sm font-bold text-gray-700">Součet dne</div>
                  <div className="text-sm font-extrabold text-green-700">{dayTotal} Kč</div>
                </div>
              </div>
            );
          })}

          <div className="flex items-center justify-between rounded-2xl bg-green-50 p-4 ring-1 ring-green-600/20">
            <div className="text-lg font-extrabold text-gray-900">Celkem</div>
            <div className="text-xl font-extrabold text-green-700">{total} Kč</div>
          </div>

          <button
            type="button"
            onClick={() => setCartStep("checkout")}
            className="w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-extrabold text-white transition hover:brightness-95"
          >
            Pokračovat na dokončení
          </button>
        </>
      )}
    </div>
  );
}