"use client";

import DesktopCheckout from "./DesktopCheckout";

// ✅ Zatím použijeme stejný UI jako desktop (už je kompaktní)
// Později když budeš chtít, uděláme čistě mobilní layout.
export default function MobileCheckout() {
  return <DesktopCheckout />;
}