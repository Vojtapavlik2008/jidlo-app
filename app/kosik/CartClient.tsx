"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CartItem = {
  key: string;
  datum: string; // YYYY-MM-DD
  nazev: string;
  cena: number;
  qty: number;
};

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("cart") || "[]");
  } catch {
    return [];
  }
}

function saveCart(cart: CartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("cart", JSON.stringify(cart));
}

function fmtCzk(n: number) {
  return `${n} Kč`;
}

export default function CartClient() {
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    setCart(loadCart());
  }, []);

  useEffect(() => {
    saveCart(cart);
  }, [cart]);

  const grouped = useMemo(() => {
    const map = new Map<string, CartItem[]>();
    for (const it of cart) {
      if (!map.has(it.datum)) map.set(it.datum, []);
      map.get(it.datum)!.push(it);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [cart]);

  const totalQty = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);
  const totalPrice = useMemo(() => cart.reduce((s, i) => s + i.qty * i.cena, 0), [cart]);

  function inc(key: string) {
    setCart((prev) =>
      prev.map((i) => (i.key === key ? { ...i, qty: i.qty + 1 } : i))
    );
  }

  function dec(key: string) {
    setCart((prev) =>
      prev
        .map((i) => (i.key === key ? { ...i, qty: i.qty - 1 } : i))
        .filter((i) => i.qty > 0)
    );
  }

  function clear() {
    setCart([]);
  }

  return (
    <div className="space-y-4">
      {/* Horní lišta */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full px-5 py-2 font-semibold border text-green-700 hover:bg-green-50"
        >
          ← Zpět
        </Link>

        <div className="text-sm font-semibold text-gray-600">{totalQty} ks</div>
      </div>

      <div className="text-3xl font-extrabold text-center">Košík</div>

      {/* Seznam */}
      <div className="space-y-3">
        {grouped.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 text-center text-gray-600">
            Košík je prázdný.
          </div>
        ) : (
          grouped.map(([datum, items]) => (
            <div key={datum} className="rounded-2xl border bg-white overflow-hidden">
              <div className="px-5 py-3 font-extrabold border-b bg-green-50">
                {datum}
              </div>

              <div className="divide-y">
                {items.map((it) => (
                  <div key={it.key} className="px-5 py-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold truncate">{it.nazev}</div>
                      <div className="text-sm text-gray-600">{fmtCzk(it.cena)}</div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => dec(it.key)}
                        className="w-10 h-10 rounded-full border font-extrabold hover:bg-gray-50"
                      >
                        −
                      </button>

                      <div className="w-10 text-center font-extrabold">{it.qty}</div>

                      <button
                        onClick={() => inc(it.key)}
                        className="w-10 h-10 rounded-full border font-extrabold hover:bg-gray-50"
                      >
                        +
                      </button>
                    </div>

                    <div className="w-24 text-right font-extrabold text-green-700 shrink-0">
                      {fmtCzk(it.qty * it.cena)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Celkem */}
      <div className="rounded-2xl border bg-green-50 px-5 py-4 flex items-center justify-between">
        <div className="text-xl font-extrabold">Celkem</div>
        <div className="text-2xl font-extrabold text-green-700">{fmtCzk(totalPrice)}</div>
      </div>

      {/* Akce */}
      <div className="flex gap-3">
        <button
          onClick={clear}
          className="rounded-xl px-5 py-3 font-bold border hover:bg-gray-50"
        >
          Vyprázdnit
        </button>

        <Link
          href="/dokonceni"
          className="flex-1 rounded-xl px-5 py-3 font-extrabold text-center bg-green-600 text-white hover:bg-green-700"
        >
          Pokračovat na dokončení
        </Link>
      </div>
    </div>
  );
}