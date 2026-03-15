"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

export type DeliveryMode = "delivery" | "pickup";
export type PackagingMode = "plastic" | "rekrabicka" | "own";
export type PaymentMethod = "card_online" | "card_delivery" | "cash" | "credit";

export type DbMenuRow = {
  datum: string;
  poradi: number;
  jidlo_id: string;
  jidla: {
    nazev: string;
    cena: number | null;
    kategorie: string | null;
  } | null;
};

export type CartItem = {
  key: string;
  datum: string;
  jidlo_id: string;
  nazev: string;
  cena: number;
  qty: number;
};

export type DayTime = { from: string; to: string } | null;
export type TimesByDay = Record<string, DayTime>;

type CartStep = "summary" | "checkout";

type Ctx = {
  cart: CartItem[];
  cartCount: number;
  total: number;
  keyFor: (dayIso: string, jidlo_id: string) => string;
  addOne: (dayIso: string, r: DbMenuRow) => void;
  removeOne: (dayIso: string, r: DbMenuRow) => void;
  clearCart: () => void;

  cartStep: CartStep;
  setCartStep: React.Dispatch<React.SetStateAction<CartStep>>;

  name: string;
  setName: React.Dispatch<React.SetStateAction<string>>;
  phone: string;
  setPhone: React.Dispatch<React.SetStateAction<string>>;
  address: string;
  setAddress: React.Dispatch<React.SetStateAction<string>>;
  note: string;
  setNote: React.Dispatch<React.SetStateAction<string>>;

  deliveryMode: DeliveryMode;
  setDeliveryMode: React.Dispatch<React.SetStateAction<DeliveryMode>>;
  packagingMode: PackagingMode;
  setPackagingMode: React.Dispatch<React.SetStateAction<PackagingMode>>;

  payment: PaymentMethod;
  setPayment: React.Dispatch<React.SetStateAction<PaymentMethod>>;
  paymentTouched: boolean;
  setPaymentTouched: React.Dispatch<React.SetStateAction<boolean>>;
  userCredit: number;
  setUserCredit: React.Dispatch<React.SetStateAction<number>>;

  timesByDay: TimesByDay;
  setTimesByDay: React.Dispatch<React.SetStateAction<TimesByDay>>;
};

const OrderCtx = createContext<Ctx | null>(null);

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartStep, setCartStep] = useState<CartStep>("summary");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");

  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("delivery");
  const [packagingMode, setPackagingMode] = useState<PackagingMode>("plastic");

  const [payment, setPayment] = useState<PaymentMethod>("card_online");
  const [paymentTouched, setPaymentTouched] = useState(false);
  const [userCredit, setUserCredit] = useState(0);

  const [timesByDay, setTimesByDay] = useState<TimesByDay>({});

  const cartCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.qty, 0);
  }, [cart]);

  const total = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.cena * item.qty, 0);
  }, [cart]);

  function keyFor(dayIso: string, jidlo_id: string) {
    return `db:${dayIso}:${jidlo_id}`;
  }

  function addOne(dayIso: string, r: DbMenuRow) {
    const j = r.jidla;
    if (!j?.nazev) return;

    const cena = Number(j.cena ?? 0);
    const key = keyFor(dayIso, r.jidlo_id);

    setCart((prev) => {
      const idx = prev.findIndex((x) => x.key === key);

      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }

      return [
        ...prev,
        {
          key,
          datum: dayIso,
          jidlo_id: r.jidlo_id,
          nazev: j.nazev,
          cena,
          qty: 1,
        },
      ];
    });
  }

  function removeOne(dayIso: string, r: DbMenuRow) {
    const key = keyFor(dayIso, r.jidlo_id);

    setCart((prev) => {
      const idx = prev.findIndex((x) => x.key === key);
      if (idx < 0) return prev;

      const nextQty = prev[idx].qty - 1;
      if (nextQty <= 0) return prev.filter((x) => x.key !== key);

      const copy = [...prev];
      copy[idx] = { ...copy[idx], qty: nextQty };
      return copy;
    });
  }

  function clearCart() {
    setCart([]);
    setTimesByDay({});
    setCartStep("summary");
  }

  const value: Ctx = useMemo(
    () => ({
      cart,
      cartCount,
      total,
      keyFor,
      addOne,
      removeOne,
      clearCart,

      cartStep,
      setCartStep,

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
    }),
    [
      cart,
      cartCount,
      total,
      cartStep,
      name,
      phone,
      address,
      note,
      deliveryMode,
      packagingMode,
      payment,
      paymentTouched,
      userCredit,
      timesByDay,
    ]
  );

  return <OrderCtx.Provider value={value}>{children}</OrderCtx.Provider>;
}

export function useOrder() {
  const v = useContext(OrderCtx);
  if (!v) throw new Error("useOrder must be used inside <OrderProvider>.");
  return v;
}