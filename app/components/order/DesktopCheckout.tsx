"use client";

import { useEffect, useMemo, useState } from "react";
import { getMyProfile } from "@/lib/auth";
import {
  useOrder,
  type PackagingMode,
  type PaymentMethod,
  type DeliveryMode,
  type CartItem,
  type TimesByDay,
} from "@/app/components/order/order-context";
import { createOrder } from "@/app/components/order/create-order";

// -------------------- Pomocné --------------------
type DayTime = { from: string; to: string } | null;

function uniqSorted(arr: string[]) {
  return Array.from(new Set(arr)).sort();
}

function isISODate(x: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(x);
}

// jednoduché sloty
function buildSlotsForDay(_iso: string) {
  return [
    { from: "10:00", to: "10:30" },
    { from: "10:30", to: "11:00" },
    { from: "11:00", to: "11:30" },
    { from: "11:30", to: "12:00" },
    { from: "12:00", to: "12:30" },
    { from: "12:30", to: "13:00" },
    { from: "13:00", to: "13:30" },
    { from: "13:30", to: "14:00" },
  ];
}

function dayLabelCz(iso: string) {
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("cs-CZ", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtTime(t: DayTime) {
  if (!t) return "";
  return `${t.from}–${t.to}`;
}

export default function DesktopCheckout() {
  const {
    cart,
    cartCount,
    total,

    name,
    setName,
    phone,
    setPhone,
    address,
    setAddress,
    note,
    setNote,

    deliveryMode,
    setDeliveryMode,

    packagingMode,
    setPackagingMode,

    payment,
    setPayment,
    paymentTouched,
    setPaymentTouched,

    userCredit,
    setUserCredit,

    timesByDay,
    setTimesByDay,

    setCartStep,
    clearCart,
  } = useOrder();

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [timeOpen, setTimeOpen] = useState(false);
  const [sameTimeForAll, setSameTimeForAll] = useState(false);

  // dny v košíku
  const cartDays = useMemo(() => {
    return uniqSorted(cart.map((it) => it.datum).filter((d) => isISODate(d)));
  }, [cart]);

  // autofill z profilu
  useEffect(() => {
    let alive = true;

    (async () => {
      setLoadingProfile(true);
      try {
        const p = await getMyProfile();
        if (!alive) return;

        if (p) {
          if (!name && p.full_name) setName(p.full_name);
          if (!phone && p.phone) setPhone(p.phone);
          if (!address && p.address) setAddress(p.address);

          if (typeof (p as any).kredit === "number") {
            setUserCredit((p as any).kredit);
          }
        }
      } finally {
        if (alive) setLoadingProfile(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // default timesByDay pro dny v košíku
  useEffect(() => {
    if (cartDays.length === 0) return;

    setTimesByDay((prev) => {
      const next: TimesByDay = { ...(prev ?? {}) };
      let changed = false;

      for (const iso of cartDays) {
        if (next[iso] === undefined) {
          next[iso] = null;
          changed = true;
        }
      }

      for (const k of Object.keys(next)) {
        if (!cartDays.includes(k)) {
          delete next[k];
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [cartDays, setTimesByDay]);

  // -------------------- UI styly --------------------
  const box = "rounded-2xl bg-white shadow-sm ring-1 ring-black/5";
  const row = "flex items-center justify-between gap-4 px-5 py-4";
  const leftLabel = "text-sm font-bold text-gray-600";
  const optionField =
    "w-full rounded-2xl bg-gray-50 ring-1 ring-black/5 px-4 py-3 text-left hover:bg-gray-100/60 transition";

  // -------------------- výpočty --------------------
  const deliveryLabel = useMemo(() => {
    if (deliveryMode === "delivery") return "Doručení";
    if (deliveryMode === "pickup") return "Osobní odběr";
    return "—";
  }, [deliveryMode]);

  const packagingLabel = useMemo(() => {
    if (packagingMode === "own") return "Vlastní nádoba";
    if (packagingMode === "plastic") return "Krabička (záloha)";
    if (packagingMode === "rekrabicka") return "Rekrabička";
    return "—";
  }, [packagingMode]);

  const paymentLabel = useMemo(() => {
    if (payment === "cash") return "Hotově";
    if (payment === "card_online") return "Kartou online";
    if (payment === "card_delivery") return deliveryMode === "pickup" ? "Kartou na místě" : "Kartou při doručení";
    if (payment === "credit") return "Kredit";
    return "—";
  }, [payment, deliveryMode]);

  const canUseCredit = (userCredit ?? 0) >= (total ?? 0);

  // -------------------- validace --------------------
  function validate() {
    if (!cart || cart.length === 0) return "Košík je prázdný.";
    if (!name?.trim()) return "Vyplň jméno.";
    if (!phone?.trim()) return "Vyplň telefon.";
    if (deliveryMode === "delivery" && !address?.trim()) return "Vyplň adresu pro doručení.";
    if (!payment) return "Vyber způsob platby.";
    if (payment === "credit" && !canUseCredit) return "Nemáš dost kreditu na tuhle objednávku.";

    return null;
  }

  // -------------------- akce --------------------
  function setTimeForDay(dayISO: string, next: DayTime) {
    const normalized = next ? { from: next.from, to: next.to } : null;

    if (sameTimeForAll && normalized) {
      setTimesByDay((prev) => {
        const out: TimesByDay = { ...(prev ?? {}) };
        for (const d of cartDays) {
          out[d] = normalized;
        }
        return out;
      });
      return;
    }

    setTimesByDay((prev) => {
      const out: TimesByDay = { ...(prev ?? {}) };
      out[dayISO] = normalized;
      return out;
    });
  }

  async function finishOrder() {
    if (saving) return;

    setMsg(null);
    setPaymentTouched(true);

    const err = validate();
    if (err) {
      setMsg(err);
      return;
    }

    setSaving(true);

    try {
      const orderId = await createOrder({
        full_name: name.trim(),
        phone: phone.trim(),
        address: deliveryMode === "delivery" ? address.trim() : "",
        note: note ?? "",
        delivery_mode: deliveryMode,
        packaging_mode: packagingMode,
        payment_method: payment,
        times_by_day: timesByDay ?? {},
        cart: cart as CartItem[],
      });

      clearCart();
      setMsg(`Objednávka odeslána ✅ (ID: ${orderId})`);
      setCartStep("summary");
    } catch (e: any) {
      setMsg(e?.message ?? "Nepodařilo se vytvořit objednávku.");
    } finally {
      setSaving(false);
    }
  }

  // -------------------- render --------------------
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 items-center gap-4">
        <div>
          <button
            type="button"
            onClick={() => setCartStep("summary")}
            className="rounded-2xl bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 ring-1 ring-green-600/25 hover:bg-green-100/60"
          >
            ← Zpět
          </button>
        </div>

        <div className="text-center">
          <div className="whitespace-nowrap text-2xl font-extrabold text-green-700">
            Dokončení
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm font-semibold text-gray-500">{cartCount} ks</div>
        </div>
      </div>

      {msg ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm font-semibold text-gray-800 shadow-sm">
          {msg}
        </div>
      ) : null}

      <div className={box}>
        <div className={row}>
          <div className={leftLabel}>Způsob převzetí</div>
          <div className="w-[420px] max-w-full">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeliveryMode("delivery" as DeliveryMode);
                  if (payment === "card_delivery" || payment === "card_online" || payment === "cash" || payment === "credit") {
                    return;
                  }
                }}
                className={[
                  "rounded-2xl px-4 py-3 text-sm font-extrabold ring-1 transition",
                  deliveryMode === "delivery"
                    ? "bg-green-600 text-white ring-green-600"
                    : "bg-gray-50 text-gray-900 ring-black/10 hover:bg-gray-100",
                ].join(" ")}
              >
                Doručení
              </button>

              <button
                type="button"
                onClick={() => {
                  setDeliveryMode("pickup" as DeliveryMode);
                  if (payment === "card_online") {
                    setPayment("card_delivery" as PaymentMethod);
                  }
                }}
                className={[
                  "rounded-2xl px-4 py-3 text-sm font-extrabold ring-1 transition",
                  deliveryMode === "pickup"
                    ? "bg-green-600 text-white ring-green-600"
                    : "bg-gray-50 text-gray-900 ring-black/10 hover:bg-gray-100",
                ].join(" ")}
              >
                Odběr
              </button>
            </div>

            <div className="mt-2 text-xs font-semibold text-gray-500">
              Vybráno: <span className="text-gray-900">{deliveryLabel}</span>
            </div>
          </div>
        </div>

        <div className="h-px bg-gray-100" />

        <div className={row}>
          <div className={leftLabel}>Jméno</div>
          <div className="w-[420px] max-w-full">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl bg-gray-50 px-4 py-3 text-sm font-semibold outline-none ring-1 ring-black/5 focus:ring-2 focus:ring-green-600/30"
              placeholder={loadingProfile ? "Načítám…" : "Zadej jméno"}
            />
          </div>
        </div>

        <div className="h-px bg-gray-100" />

        <div className={row}>
          <div className={leftLabel}>Telefon</div>
          <div className="w-[420px] max-w-full">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-2xl bg-gray-50 px-4 py-3 text-sm font-semibold outline-none ring-1 ring-black/5 focus:ring-2 focus:ring-green-600/30"
              placeholder={loadingProfile ? "Načítám…" : "Zadej telefon"}
            />
          </div>
        </div>

        <div className="h-px bg-gray-100" />

        <div className={row}>
          <div className={leftLabel}>Adresa</div>
          <div className="w-[420px] max-w-full">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-2xl bg-gray-50 px-4 py-3 text-sm font-semibold outline-none ring-1 ring-black/5 focus:ring-2 focus:ring-green-600/30"
              placeholder={
                loadingProfile
                  ? "Načítám…"
                  : deliveryMode === "pickup"
                  ? "Při osobním odběru není potřeba"
                  : "Zadej adresu"
              }
              disabled={deliveryMode === "pickup"}
            />
          </div>
        </div>

        <div className="h-px bg-gray-100" />

        <div className={row}>
          <div className={leftLabel}>Poznámka</div>
          <div className="w-[420px] max-w-full">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-[80px] w-full rounded-2xl bg-gray-50 px-4 py-3 text-sm font-semibold outline-none ring-1 ring-black/5 focus:ring-2 focus:ring-green-600/30"
              placeholder="Např. zvonek, patro, alergie…"
            />
          </div>
        </div>

        <div className="h-px bg-gray-100" />

        <div className={row}>
          <div className={leftLabel}>Preferuji čas</div>
          <div className="w-[420px] max-w-full">
            <button type="button" className={optionField} onClick={() => setTimeOpen((v) => !v)}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[15px] font-extrabold text-gray-900">Vybrat čas</div>
                  <div className="mt-1 text-xs font-semibold text-gray-500">
                    {cartDays.length === 0
                      ? "Košík je prázdný"
                      : "Nastav čas pro jednotlivé dny (volitelné)."}
                  </div>
                </div>
                <span className="shrink-0 text-lg font-extrabold text-green-700/70">
                  {timeOpen ? "˄" : "˅"}
                </span>
              </div>
            </button>

            {timeOpen ? (
              <div className="mt-3 rounded-2xl bg-gray-50 p-4 ring-1 ring-black/5">
                <label className="flex items-center gap-3 text-sm font-bold text-gray-700">
                  <input
                    type="checkbox"
                    checked={sameTimeForAll}
                    onChange={(e) => setSameTimeForAll(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Stejný čas pro všechny dny
                </label>

                <div className="mt-4 grid gap-3">
                  {cartDays.map((dayISO) => {
                    const val = (timesByDay?.[dayISO] ?? null) as DayTime;
                    const slots = buildSlotsForDay(dayISO);

                    return (
                      <div key={dayISO} className="rounded-2xl bg-white p-3 ring-1 ring-black/5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-extrabold text-gray-900">
                            {dayLabelCz(dayISO)}
                          </div>
                          <div className="text-xs font-semibold text-gray-500">
                            {val ? fmtTime(val) : "—"}
                          </div>
                        </div>

                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <select
                            value={val ? `${val.from}-${val.to}` : ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (!v) {
                                setTimeForDay(dayISO, null);
                                return;
                              }

                              const [from, to] = v.split("-");
                              if (!from || !to) {
                                setTimeForDay(dayISO, null);
                                return;
                              }

                              setTimeForDay(dayISO, { from, to });
                            }}
                            className="col-span-2 rounded-xl bg-gray-50 px-3 py-2 text-sm font-semibold outline-none ring-1 ring-black/5"
                          >
                            <option value="">Bez preferovaného času</option>
                            {slots.map((s) => (
                              <option key={`${s.from}-${s.to}`} value={`${s.from}-${s.to}`}>
                                {s.from}–{s.to}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="h-px bg-gray-100" />

        <div className={row}>
          <div className={leftLabel}>Platba</div>
          <div className="w-[420px] max-w-full">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPayment("cash" as PaymentMethod);
                  setPaymentTouched(true);
                }}
                className={[
                  "rounded-2xl px-3 py-3 text-sm font-extrabold ring-1 transition",
                  payment === "cash"
                    ? "bg-green-600 text-white ring-green-600"
                    : "bg-gray-50 text-gray-900 ring-black/10 hover:bg-gray-100",
                ].join(" ")}
              >
                Hotově
              </button>

              <button
                type="button"
                onClick={() => {
                  setPayment("card_delivery" as PaymentMethod);
                  setPaymentTouched(true);
                }}
                className={[
                  "rounded-2xl px-3 py-3 text-sm font-extrabold ring-1 transition",
                  payment === "card_delivery"
                    ? "bg-green-600 text-white ring-green-600"
                    : "bg-gray-50 text-gray-900 ring-black/10 hover:bg-gray-100",
                ].join(" ")}
              >
                {deliveryMode === "pickup" ? "Kartou na místě" : "Kartou při doručení"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setPayment("card_online" as PaymentMethod);
                  setPaymentTouched(true);
                }}
                className={[
                  "rounded-2xl px-3 py-3 text-sm font-extrabold ring-1 transition",
                  payment === "card_online"
                    ? "bg-green-600 text-white ring-green-600"
                    : "bg-gray-50 text-gray-900 ring-black/10 hover:bg-gray-100",
                ].join(" ")}
              >
                Kartou online
              </button>

              <button
                type="button"
                onClick={() => {
                  setPayment("credit" as PaymentMethod);
                  setPaymentTouched(true);
                }}
                disabled={!canUseCredit}
                className={[
                  "rounded-2xl px-3 py-3 text-sm font-extrabold ring-1 transition",
                  payment === "credit"
                    ? "bg-green-600 text-white ring-green-600"
                    : "bg-gray-50 text-gray-900 ring-black/10 hover:bg-gray-100",
                  !canUseCredit ? "cursor-not-allowed opacity-50" : "",
                ].join(" ")}
              >
                Kredit
              </button>
            </div>

            <div className="mt-2 text-xs font-semibold text-gray-500">
              Vybráno: <span className="text-gray-900">{paymentLabel}</span>
              {paymentTouched && !payment ? (
                <span className="ml-2 font-extrabold text-red-600">Vyber platbu</span>
              ) : null}
            </div>

            <div className="mt-1 text-xs font-semibold text-gray-500">
              Kredit: <span className="text-gray-900">{userCredit ?? 0} Kč</span>{" "}
              {!canUseCredit ? (
                <span className="ml-2 text-gray-500">(na tuto objednávku nestačí)</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="h-px bg-gray-100" />

        <div className={row}>
          <div className={leftLabel}>Balení</div>
          <div className="w-[420px] max-w-full">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPackagingMode("own" as PackagingMode)}
                className={[
                  "rounded-2xl px-3 py-3 text-sm font-extrabold ring-1 transition",
                  packagingMode === "own"
                    ? "bg-green-600 text-white ring-green-600"
                    : "bg-gray-50 text-gray-900 ring-black/10 hover:bg-gray-100",
                ].join(" ")}
              >
                Vlastní
              </button>

              <button
                type="button"
                onClick={() => setPackagingMode("plastic" as PackagingMode)}
                className={[
                  "rounded-2xl px-3 py-3 text-sm font-extrabold ring-1 transition",
                  packagingMode === "plastic"
                    ? "bg-green-600 text-white ring-green-600"
                    : "bg-gray-50 text-gray-900 ring-black/10 hover:bg-gray-100",
                ].join(" ")}
              >
                Krabička
              </button>

              <button
                type="button"
                onClick={() => setPackagingMode("rekrabicka" as PackagingMode)}
                className={[
                  "rounded-2xl px-3 py-3 text-sm font-extrabold ring-1 transition",
                  packagingMode === "rekrabicka"
                    ? "bg-green-600 text-white ring-green-600"
                    : "bg-gray-50 text-gray-900 ring-black/10 hover:bg-gray-100",
                ].join(" ")}
              >
                Rekrabička
              </button>
            </div>

            <div className="mt-2 text-xs font-semibold text-gray-500">
              Vybráno: <span className="text-gray-900">{packagingLabel}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-black/5">
          <div className="text-xs font-semibold text-gray-500">Celkem</div>
          <div className="text-2xl font-extrabold text-gray-900">{total} Kč</div>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={finishOrder}
          className={[
            "rounded-2xl bg-green-600 px-6 py-4 text-base font-extrabold text-white shadow-sm transition hover:bg-green-700",
            saving ? "cursor-not-allowed opacity-60" : "",
          ].join(" ")}
        >
          {saving ? "Odesílám…" : "Odeslat objednávku"}
        </button>
      </div>
    </div>
  );
}