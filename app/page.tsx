"use client";

import { useState } from "react";
import { useIsMobile } from "@/app/components/hooks/useIsMobile";
import { useOrder } from "@/app/components/order/order-context";

import MobileView from "@/app/components/views/MobileView";
import DesktopView from "@/app/components/views/DesktopView";

import DesktopSummary from "@/app/components/order/DesktopSummary";
import DesktopCheckout from "@/app/components/order/DesktopCheckout";

export default function Page() {
  const isMobile = useIsMobile();
  const [cartOpen, setCartOpen] = useState(false);
  const { cartStep } = useOrder();

  if (isMobile) {
    return <MobileView />;
  }

  return (
    <>
      <DesktopView onOpenCart={() => setCartOpen(true)} />

      {cartOpen && (
        <div className="fixed inset-0 z-[9999]">
          <button
            aria-label="Zavřít souhrn"
            onClick={() => setCartOpen(false)}
            className="absolute inset-0 bg-black/40"
          />

          <div className="absolute left-1/2 top-10 w-[min(980px,92vw)] -translate-x-1/2">
            <div className="overflow-hidden rounded-3xl border bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <button
                  onClick={() => setCartOpen(false)}
                  className="inline-flex items-center gap-2 rounded-full border px-5 py-2 font-semibold text-green-700 hover:bg-green-50"
                >
                  ← Zavřít
                </button>

                <div className="text-xl font-extrabold">
                  {cartStep === "checkout" ? "Dokončení objednávky" : "Souhrn objednávky"}
                </div>

                <div className="w-[96px]" />
              </div>

              <div className="p-5">
                {cartStep === "checkout" ? <DesktopCheckout /> : <DesktopSummary />}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
