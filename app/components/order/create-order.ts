import { supabase } from "@/lib/supabase";
import type {
  CartItem,
  TimesByDay,
  DeliveryMode,
  PackagingMode,
  PaymentMethod,
} from "@/app/components/order/order-context";

function isValidIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

export async function createOrder(params: {
  full_name: string;
  phone: string;
  address: string;
  note: string;
  delivery_mode: DeliveryMode;
  packaging_mode: PackagingMode;
  payment_method: PaymentMethod;
  times_by_day: TimesByDay;
  cart: CartItem[];
}) {
  const { data: sess, error: sessError } = await supabase.auth.getSession();
  if (sessError) {
    throw new Error("Nepodařilo se ověřit přihlášení.");
  }

  const uid = sess.session?.user?.id;
  if (!uid) {
    throw new Error("Nejsi přihlášený.");
  }

  const fullName = params.full_name?.trim() ?? "";
  const phone = params.phone?.trim() ?? "";
  const address = params.address?.trim() ?? "";
  const note = params.note?.trim() ?? "";

  if (!fullName) throw new Error("Chybí jméno.");
  if (!phone) throw new Error("Chybí telefon.");

  if (params.delivery_mode === "delivery" && !address) {
    throw new Error("Chybí adresa pro doručení.");
  }

  if (!Array.isArray(params.cart) || params.cart.length === 0) {
    throw new Error("Košík je prázdný.");
  }

  const cleanedCart: CartItem[] = params.cart
    .map((it) => ({
      key: String(it.key ?? ""),
      datum: String(it.datum ?? ""),
      jidlo_id: String(it.jidlo_id ?? ""),
      nazev: String(it.nazev ?? "").trim(),
      cena: Number(it.cena ?? 0),
      qty: Number(it.qty ?? 0),
    }))
    .filter(
      (it) =>
        !!it.key &&
        !!it.jidlo_id &&
        !!it.nazev &&
        isValidIsoDate(it.datum) &&
        Number.isFinite(it.cena) &&
        it.cena >= 0 &&
        Number.isInteger(it.qty) &&
        it.qty > 0
    );

  if (cleanedCart.length === 0) {
    throw new Error("Košík neobsahuje žádné platné položky.");
  }

  const total = Number(
    cleanedCart.reduce((sum, it) => sum + it.cena * it.qty, 0).toFixed(2)
  );

  if (total <= 0) {
    throw new Error("Celková cena objednávky musí být větší než 0 Kč.");
  }

  const cleanedTimesByDay: TimesByDay = {};
  const rawTimes = params.times_by_day ?? {};

  for (const [day, value] of Object.entries(rawTimes)) {
    if (!isValidIsoDate(day)) continue;

    if (value === null) {
      cleanedTimesByDay[day] = null;
      continue;
    }

    if (
      value &&
      typeof value === "object" &&
      isValidTime(value.from) &&
      isValidTime(value.to)
    ) {
      cleanedTimesByDay[day] = {
        from: value.from,
        to: value.to,
      };
    }
  }

  const payload = {
    user_id: uid,
    full_name: fullName,
    phone,
    address: params.delivery_mode === "delivery" ? address : "",
    note,

    delivery_mode: params.delivery_mode,
    packaging_mode: params.packaging_mode,
    payment_method: params.payment_method,

    times_by_day: cleanedTimesByDay,
    cart: cleanedCart,

    total,
    status: "new",
  };

  const { data, error } = await supabase
    .from("orders")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message || "Nepodařilo se uložit objednávku.");
  }

  if (!data?.id) {
    throw new Error("Objednávka byla uložena, ale nevrátilo se její ID.");
  }

  return data.id as string;
}