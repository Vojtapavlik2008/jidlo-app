"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { HTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getMyProfile } from "@/lib/auth";

import { useOrder } from "@/app/components/order/order-context";
import type {
  CartItem,
  TimesByDay,
  DeliveryMode,
  PackagingMode,
  PaymentMethod,
  DbMenuRow,
} from "@/app/components/order/order-context";

/** ===================== DB: createOrder ===================== */
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
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) throw new Error("Nejsi přihlášený.");

  const total = params.cart.reduce((s, it) => s + it.cena * it.qty, 0);

  const { data: order, error: e1 } = await supabase
    .from("orders")
    .insert({
      user_id: uid,
      full_name: params.full_name.trim() || null,
      phone: params.phone.replace(/\D/g, "").slice(0, 9) || null,
      address: params.address.trim() || null,
      note: params.note.trim() || null,
      delivery_mode: params.delivery_mode,
      packaging_mode: params.packaging_mode,
      payment_method: params.payment_method,
      times_by_day: params.times_by_day,
      status: "new",
      total,
    })
    .select("id")
    .single();

  if (e1) throw new Error(e1.message);
  if (!order?.id) throw new Error("Nepovedlo se vytvořit objednávku.");

  const items = params.cart.map((it) => ({
    order_id: order.id,
    datum: it.datum,
    jidlo_id: it.jidlo_id,
    name: it.nazev,
    unit_price: it.cena,
    qty: it.qty,
    line_total: it.cena * it.qty,
  }));

  const { error: e2 } = await supabase.from("order_items").insert(items);
  if (e2) throw new Error(e2.message);

  return order.id as string;
}

/** ===================== Helpers ===================== */
function digitsOnly(s: string) {
  return (s ?? "").replace(/\D/g, "");
}

function formatPhoneCz(raw: string) {
  const d = digitsOnly(raw).slice(0, 9);
  const a = d.slice(0, 3);
  const b = d.slice(3, 6);
  const c = d.slice(6, 9);
  return [a, b, c].filter(Boolean).join(" ").trim();
}

function toISODateLocal(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const dd = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function isSunday(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.getDay() === 0;
}

function baseMondayAutoNextWeekend(now: Date) {
  const x = new Date(now);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(x);
  monday.setDate(monday.getDate() - diffToMonday);

  if (day === 6 || day === 0) monday.setDate(monday.getDate() + 7);
  return monday;
}

function formatRangeShort(fromIso: string, toIso: string) {
  if (!fromIso || !toIso) return "";

  const f = new Date(fromIso + "T00:00:00");
  const t = new Date(toIso + "T00:00:00");

  if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return "";

  const fDd = String(f.getDate()).padStart(2, "0");
  const fMm = String(f.getMonth() + 1).padStart(2, "0");
  const tDd = String(t.getDate()).padStart(2, "0");
  const tMm = String(t.getMonth() + 1).padStart(2, "0");
  return `${fDd}.${fMm}.–${tDd}.${tMm}.`;
}

function formatDayShort(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const map = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];
  return map[d.getDay()];
}

function formatCartDay(iso: string) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";

  const wd = new Intl.DateTimeFormat("cs-CZ", { weekday: "short" })
    .format(d)
    .replace(".", "")
    .toLowerCase();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${wd} ${dd}.${mm}.`;
}

function formatWeekdayOnlyLong(iso: string) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat("cs-CZ", { weekday: "long" })
    .format(d)
    .replace(/^\w/, (c) => c.toUpperCase());
}

function formatDateShortNoLeadingZero(iso: string) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

function formatSelectedDaySmart(iso: string) {
  if (!iso) return "";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(iso + "T00:00:00");
  if (Number.isNaN(target.getTime())) return "";

  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  const dateTxt = formatDateShortNoLeadingZero(iso);

  if (diffDays === 0) return `Dnes · ${dateTxt}`;
  if (diffDays === 1) return `Zítra · ${dateTxt}`;

  return `${formatWeekdayOnlyLong(iso)} · ${dateTxt}`;
}

function isTodayIso(iso: string) {
  return iso === toISODateLocal(new Date());
}

function isPastDay(iso: string) {
  return iso < toISODateLocal(new Date());
}

function canAddToCartForDay(iso: string) {
  const todayIso = toISODateLocal(new Date());

  if (isSunday(iso)) return false;
  if (iso < todayIso) return false;

  if (iso === todayIso) {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    return minutes < 13 * 60;
  }

  return true;
}

function orderDayHint(iso: string) {
  const todayIso = toISODateLocal(new Date());

  if (isSunday(iso)) return "V neděli je zavřeno.";
  if (iso < todayIso) return "Objednávat lze jen na dnešek do 13:00 nebo na budoucí dny.";
  if (iso === todayIso && !canAddToCartForDay(iso)) return "Na dnešek šlo objednat jen do 13:00.";

  return null;
}

/** ===================== Allergen map ===================== */
const ALLERGENS: Record<number, string> = {
  1: "Obiloviny obsahující lepek",
  2: "Korýši",
  3: "Vejce",
  4: "Ryby",
  5: "Arašídy",
  6: "Sójové boby",
  7: "Mléko",
  8: "Skořápkové plody",
  9: "Celer",
  10: "Hořčice",
  11: "Sezamová semena",
  12: "Oxid siřičitý a siřičitany",
  13: "Vlčí bob (lupina)",
  14: "Měkkýši",
};

function parseAllergenIds(raw: string): number[] {
  const parts = raw
    .split(/[,\s;]+/g)
    .map((x) => x.trim())
    .filter(Boolean);

  const ids: number[] = [];
  for (const p of parts) {
    const n = Number(p);
    if (Number.isFinite(n) && n >= 1 && n <= 14) ids.push(n);
  }
  return Array.from(new Set(ids)).sort((a, b) => a - b);
}

function allergenNamesFromColumn(raw: string | null | undefined) {
  if (!raw?.trim()) return [];
  const ids = parseAllergenIds(raw);
  if (ids.length) return ids.map((id) => ALLERGENS[id] ?? `Alergen ${id}`);
  return raw
    .split(/[\n,;]/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** ===================== Types ===================== */
type MenuRow = {
  datum: string;
  poradi: number;
  jidlo_id: string;
  jidla: {
    nazev: string;
    cena: number | null;
    kategorie: string | null;
    alergeny?: string | null;
  } | null;
};

type SystemItemRow = {
  id: number;
  section: string;
  item_key: string | null;
  label: string | null;
  value_text: string | null;
  value_number: number | null;
  sort_order: number | null;
  is_active: boolean | null;
};

type MobileViewProps = {
  onOpenCart?: () => void;
};

/** ===================== Auth Modal ===================== */
function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMsg(null);
    setBusy(false);
  }, [open]);

  async function upsertProfile(userId: string) {
    const payload: any = {
      id: userId,
      full_name: fullName.trim() || null,
      phone: digitsOnly(phone).slice(0, 9) || null,
      address: address.trim() || null,
      email: email.trim() || null,
    };
    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
    if (error) throw error;
    window.dispatchEvent(new Event("profile-updated"));
  }

  async function doLogin() {
    setBusy(true);
    setMsg(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setMsg(error.message);
        return;
      }
      const uid = data.user?.id;
      if (uid && (fullName.trim() || phone.trim() || address.trim())) {
        try {
          await upsertProfile(uid);
        } catch {}
      }
      onClose();
    } catch (e: any) {
      setMsg(e?.message ?? "Chyba při přihlášení");
    } finally {
      setBusy(false);
    }
  }

  async function doRegister() {
    setBusy(true);
    setMsg(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) {
        setMsg(error.message);
        return;
      }
      const uid = data.user?.id;
      if (uid) await upsertProfile(uid);

      setMsg("Hotovo. Pokud máš potvrzení emailem, zkontroluj email. Pak se přihlas.");
      setTab("login");
      setPassword("");
    } catch (e: any) {
      setMsg(e?.message ?? "Chyba při registraci");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const phoneDigits = digitsOnly(phone);
  const phoneOk = tab === "login" ? true : phoneDigits.length === 9;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/40" aria-label="Zavřít" />
      <div className="relative w-full max-w-md rounded-3xl bg-white p-4 shadow-2xl ring-1 ring-black/10">
        <div className="flex items-center justify-between gap-2">
          <div className="text-base font-extrabold text-green-700">
            {tab === "login" ? "Přihlášení" : "Registrace"}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-2xl bg-white font-extrabold ring-1 ring-black/10 hover:bg-gray-50"
          >
            ✕
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTab("login")}
            className={[
              "rounded-2xl px-3 py-2.5 text-sm font-extrabold ring-1 transition",
              tab === "login"
                ? "bg-green-600 text-white ring-green-600"
                : "bg-white text-gray-900 ring-black/10 hover:bg-gray-50",
            ].join(" ")}
          >
            Přihlásit
          </button>
          <button
            type="button"
            onClick={() => setTab("register")}
            className={[
              "rounded-2xl px-3 py-2.5 text-sm font-extrabold ring-1 transition",
              tab === "register"
                ? "bg-green-600 text-white ring-green-600"
                : "bg-white text-gray-900 ring-black/10 hover:bg-gray-50",
            ].join(" ")}
          >
            Registrovat
          </button>
        </div>

        <div className="mt-3 space-y-2.5">
          <label className="block">
            <div className="mb-1 text-[11px] font-extrabold text-gray-600">Email</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@domena.cz"
              inputMode="email"
              autoComplete="email"
              className="w-full rounded-2xl bg-white px-3 py-2.5 text-sm font-semibold outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-green-600"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-[11px] font-extrabold text-gray-600">Heslo</div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              autoComplete={tab === "login" ? "current-password" : "new-password"}
              className="w-full rounded-2xl bg-white px-3 py-2.5 text-sm font-semibold outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-green-600"
            />
            <div className="mt-1 text-[11px] text-gray-500">Min. 6 znaků.</div>
          </label>

          {tab === "register" ? (
            <>
              <label className="block">
                <div className="mb-1 text-[11px] font-extrabold text-gray-600">Jméno a příjmení</div>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Vojtěch Pavlík"
                  autoComplete="name"
                  className="w-full rounded-2xl bg-white px-3 py-2.5 text-sm font-semibold outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-green-600"
                />
              </label>

              <label className="block">
                <div className="mb-1 text-[11px] font-extrabold text-gray-600">Telefon</div>
                <input
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneCz(e.target.value))}
                  placeholder="777 777 777"
                  inputMode="numeric"
                  autoComplete="tel"
                  className="w-full rounded-2xl bg-white px-3 py-2.5 text-sm font-semibold outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-green-600"
                />
                {!phoneOk ? (
                  <div className="mt-1 text-[11px] font-bold text-red-600">Telefon musí mít 9 číslic.</div>
                ) : null}
              </label>

              <label className="block">
                <div className="mb-1 text-[11px] font-extrabold text-gray-600">Adresa</div>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ulice 1, Praha"
                  autoComplete="street-address"
                  className="w-full rounded-2xl bg-white px-3 py-2.5 text-sm font-semibold outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-green-600"
                />
              </label>
            </>
          ) : null}

          {msg ? (
            <div className="rounded-2xl bg-neutral-50 px-3 py-2 text-[12px] font-bold text-neutral-700 ring-1 ring-black/10">
              {msg}
            </div>
          ) : null}

          <button
            type="button"
            onClick={tab === "login" ? doLogin : doRegister}
            disabled={busy || !email.trim() || password.length < 6 || (tab === "register" && !phoneOk)}
            className="w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {busy ? "Počkej…" : tab === "login" ? "Přihlásit" : "Vytvořit účet"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** ===================== Allergens Modal ===================== */
function AllergensModal({
  open,
  onClose,
  title,
  allergens,
  category,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  allergens: string[];
  category?: string | null;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/40" aria-label="Zavřít" />
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/10">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 pb-2 pt-3">
          <div className="text-[15px] font-extrabold text-gray-900">Informace o jídle</div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-2xl bg-white font-extrabold ring-1 ring-black/10 hover:bg-gray-50"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[70dvh] overflow-auto px-4 pb-4">
          <div className="mt-3 text-[16px] font-extrabold text-[#1f2f56]">{title}</div>

          <div className="mt-3 rounded-2xl bg-white p-3 ring-1 ring-black/10">
            <div className="text-[12px] font-extrabold uppercase tracking-wide text-gray-500">Alergeny</div>

            {allergens.length === 0 ? (
              <div className="mt-2 text-[13px] text-gray-700">Nejsou uvedené alergeny.</div>
            ) : (
              <div className="mt-2 space-y-1.5">
                {allergens.map((a, idx) => (
                  <div key={idx} className="text-[13px] text-gray-800">
                    • {a}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 rounded-2xl bg-white p-3 ring-1 ring-black/10">
            <div className="text-[12px] font-extrabold uppercase tracking-wide text-gray-500">Kategorie</div>
            <div className="mt-2 text-[13px] text-gray-800">{category?.trim() || "Neuvedeno"}</div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-2xl bg-green-600 px-4 py-3 text-[13px] font-extrabold text-white hover:bg-green-700"
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
}

/** ===================== Packaging Info Modal ===================== */
function PackagingInfoModal({
  open,
  onClose,
  title,
  imgSrc,
  lines,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  imgSrc: string;
  lines: string[];
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[270] flex items-center justify-center p-4">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/40" aria-label="Zavřít" />
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/10">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 pb-2 pt-3">
          <div className="text-[14px] font-extrabold text-gray-900">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-2xl bg-white font-extrabold ring-1 ring-black/10 hover:bg-gray-50"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white ring-1 ring-black/10">
              <Image src={imgSrc} alt={title} width={56} height={56} />
            </div>

            <div className="min-w-0">
              <div className="text-[13px] font-extrabold text-gray-900">{title}</div>
              <div className="mt-1 space-y-1">
                {lines.map((x, i) => (
                  <div key={i} className="text-[13px] text-gray-700">
                    {x}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-2xl bg-green-600 px-4 py-3 text-[13px] font-extrabold text-white hover:bg-green-700"
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
}

/** ===================== Cart Sheet ===================== */
function CartSheet({
  open,
  onClose,
  authed,
  onNeedLogin,
  credit,
}: {
  open: boolean;
  onClose: () => void;
  authed: boolean;
  onNeedLogin: () => void;
  credit: number;
}) {
  const {
    cart,
    cartCount,
    total,
    addOne,
    removeOne,
    clearCart,
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
    timesByDay,
    setTimesByDay,
  } = useOrder();

  const [step, setStep] = useState<"cart" | "checkout" | "done">("cart");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const [pickOpen, setPickOpen] = useState<null | "delivery" | "packaging" | "payment">(null);

  const [packInfoOpen, setPackInfoOpen] = useState(false);
  const [packInfoTitle, setPackInfoTitle] = useState("");
  const [packInfoImg, setPackInfoImg] = useState("");
  const [packInfoLines, setPackInfoLines] = useState<string[]>([]);

  const didAutofillRef = useRef(false);

  type DayTime = { from: string; to: string } | null;

  const [timeOpen, setTimeOpen] = useState(false);
  const [sameTimeForAll, setSameTimeForAll] = useState(false);
  const [activeTimeDay, setActiveTimeDay] = useState<string | null>(null);

  useEffect(() => {
    if (open) return;
    setStep("cart");
    setBusy(false);
    setMsg(null);
    setOrderId(null);
    setPickOpen(null);
    setTimeOpen(false);
    setSameTimeForAll(false);
    setActiveTimeDay(null);
  }, [open]);

  useEffect(() => {
    if (!open) {
      didAutofillRef.current = false;
      return;
    }
    if (!authed) return;
    if (step !== "checkout") return;
    if (didAutofillRef.current) return;
    didAutofillRef.current = true;

    let alive = true;
    (async () => {
      try {
        const p = await getMyProfile();
        if (!alive || !p) return;

        setName((prev) => (prev.trim() ? prev : String(p.full_name ?? "")));
        setPhone((prev) => {
          if (digitsOnly(prev).length === 9) return prev;
          const raw = String((p as any)?.phone ?? "");
          if (!raw) return prev;
          return formatPhoneCz(raw);
        });
        setAddress((prev) => (prev.trim() ? prev : String((p as any)?.address ?? "")));
      } catch {}
    })();

    return () => {
      alive = false;
    };
  }, [open, authed, step, setName, setPhone, setAddress]);

  const grouped = useMemo(() => {
    const m = new Map<string, CartItem[]>();
    cart.forEach((it) => {
      if (!m.has(it.datum)) m.set(it.datum, []);
      m.get(it.datum)!.push(it);
    });
    const days = Array.from(m.keys()).sort();
    return days.map((d) => ({
      datum: d,
      items: (m.get(d) ?? []).slice().sort((a, b) => a.nazev.localeCompare(b.nazev, "cs")),
    }));
  }, [cart]);

  const itemsTotal = useMemo(() => cart.reduce((s, it) => s + it.cena * it.qty, 0), [cart]);
  const deliveryFee = deliveryMode === "delivery" && cartCount > 0 ? 10 : 0;

  function isSoupItem(it: CartItem) {
    const anyIt = it as any;
    const cat = (anyIt?.kategorie ?? anyIt?.category ?? "") as string;
    if (cat && /pol[eě]v/i.test(cat)) return true;
    return /pol[eě]v/i.test(it.nazev);
  }

  const packagingFee = useMemo(() => {
    if (cartCount === 0) return 0;
    let fee = 0;

    if (packagingMode === "plastic") {
      for (const it of cart) fee += (isSoupItem(it) ? 7 : 8) * it.qty;
      return fee;
    }

    if (packagingMode === "rekrabicka") {
      for (const it of cart) fee += (isSoupItem(it) ? 7 : 80) * it.qty;
      return fee;
    }

    return 0;
  }, [cart, cartCount, packagingMode]);

  const payTotal = itemsTotal + deliveryFee + packagingFee;
  const canPayCredit = credit >= payTotal && payTotal > 0;

  const pill = "rounded-2xl ring-1 ring-black/10 bg-white";
  const pillSoft = "rounded-2xl ring-1 ring-green-200/70 bg-green-50/40";
  const btnPrimary =
    "rounded-2xl px-4 py-3 text-[13px] font-extrabold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50";
  const btnGhost =
    "rounded-2xl px-4 py-3 text-[13px] font-extrabold bg-white ring-1 ring-black/10 hover:bg-gray-50";
  const qtyBtn =
    "h-8 w-8 rounded-xl bg-white ring-1 ring-black/10 text-gray-900 font-extrabold hover:bg-gray-50 active:scale-[0.98] disabled:opacity-40";

  const cartDays = useMemo(() => Array.from(new Set(cart.map((it) => it.datum))).sort(), [cart]);

  const timeSlots = useMemo(() => {
    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    const toStr = (n: number) => {
      const h = String(Math.floor(n / 60)).padStart(2, "0");
      const m = String(n % 60).padStart(2, "0");
      return `${h}:${m}`;
    };
    const start = toMin("10:00");
    const end = toMin("13:30");
    const step = 30;
    const out: { from: string; to: string; label: string }[] = [];
    for (let t = start; t + step <= end; t += step) {
      const from = toStr(t);
      const to = toStr(t + step);
      out.push({ from, to, label: `${from}–${to}` });
    }
    return out;
  }, []);

  useEffect(() => {
    if (!timeOpen) return;
    const first = cartDays[0] ?? null;
    setActiveTimeDay((prev) => (prev && cartDays.includes(prev) ? prev : first));
    if (cartDays.length <= 1) setSameTimeForAll(false);
  }, [timeOpen, cartDays]);

  function pickTime(slot: { from: string; to: string }) {
    if (!activeTimeDay) return;

    const current = (timesByDay as any)?.[activeTimeDay] as DayTime;
    const isSame = !!current && current.from === slot.from && current.to === slot.to;

    if (sameTimeForAll && cartDays.length > 1) {
      setTimesByDay((prev: any) => {
        const next = { ...(prev ?? {}) };
        for (const d of cartDays) next[d] = isSame ? null : { from: slot.from, to: slot.to };
        return next;
      });
      return;
    }

    setTimesByDay((prev: any) => {
      const next = { ...(prev ?? {}) };
      next[activeTimeDay] = isSame ? null : { from: slot.from, to: slot.to };
      return next;
    });
  }

  const timeSummary = useMemo(() => {
    if (cartDays.length === 0) return "Vybrat čas";
    const pickedDays = cartDays.filter((d) => (timesByDay as any)?.[d]);
    if (pickedDays.length === 0) return "Vybrat čas";

    if (cartDays.length === 1) {
      const d = cartDays[0];
      const t = (timesByDay as any)?.[d] as DayTime;
      if (!t) return "Vybrat čas";
      return `${formatCartDay(d)} ${t.from}–${t.to}`;
    }

    if (sameTimeForAll) {
      const d = pickedDays[0];
      const t = (timesByDay as any)?.[d] as DayTime;
      if (!t) return "Vybrat čas";
      return `Všechny dny ${t.from}–${t.to}`;
    }

    const d0 = pickedDays[0];
    const t0 = (timesByDay as any)?.[d0] as DayTime;
    if (!t0) return "Vybrat čas";
    return `${formatCartDay(d0)} ${t0.from}–${t0.to}${pickedDays.length > 1 ? ` +${pickedDays.length - 1}` : ""}`;
  }, [cartDays, timesByDay, sameTimeForAll]);

  const evalScrollHint = () => {
    const el = scrollRef.current;
    if (!el) return;
    const moreDown = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
    setCanScrollDown(moreDown);
  };

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(evalScrollHint, 50);
    return () => clearTimeout(t);
  }, [open, cartCount, step]);

  async function submitOrder() {
    setBusy(true);
    setMsg(null);
    try {
      if (!authed) {
        setMsg("Nejdřív se přihlas.");
        onNeedLogin();
        return;
      }

      if (!name.trim() || digitsOnly(phone).length !== 9) {
        setMsg("Vyplň jméno a telefon (9 číslic).");
        return;
      }
      if (deliveryMode === "delivery" && !address.trim()) {
        setMsg("Vyplň adresu pro doručení.");
        return;
      }

      if (payment === "credit" && credit < payTotal) {
        setMsg("Nemáš dostatečný kredit.");
        return;
      }

      const id = await createOrder({
        full_name: name,
        phone,
        address,
        note,
        delivery_mode: deliveryMode,
        packaging_mode: packagingMode,
        payment_method: payment,
        times_by_day: timesByDay,
        cart,
      });

      setOrderId(id);
      clearCart();
      setStep("done");
    } catch (e: any) {
      setMsg(e?.message ?? "Nepovedlo se odeslat objednávku.");
    } finally {
      setBusy(false);
    }
  }

  function PickerSheet({
    open,
    title,
    options,
    value,
    onPick,
    onClose,
  }: {
    open: boolean;
    title: string;
    options: { id: string; label: string; sub?: string }[];
    value: string;
    onPick: (id: string) => void;
    onClose: () => void;
  }) {
    if (!open) return null;

    return (
      <div className="fixed inset-0 z-[260] flex items-center justify-center p-4">
        <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Zavřít" />
        <div className="relative max-h-[80dvh] w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/10">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 pb-2 pt-3">
            <div className="text-[14px] font-extrabold text-gray-900">{title}</div>
            <button
              type="button"
              onClick={onClose}
              className="h-10 w-10 rounded-2xl bg-white font-extrabold ring-1 ring-black/10 hover:bg-gray-50"
            >
              ✕
            </button>
          </div>

          <div className="max-h-[70dvh] space-y-2 overflow-auto p-3">
            {options.map((o) => {
              const active = o.id === value;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onPick(o.id);
                    onClose();
                  }}
                  className={[
                    "w-full rounded-2xl px-4 py-3 text-left ring-1 transition",
                    active ? "bg-green-50 ring-green-300/70" : "bg-white ring-black/10 hover:bg-gray-50",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[13px] font-extrabold text-gray-900">{o.label}</div>
                      {o.sub ? <div className="text-[12px] text-gray-500">{o.sub}</div> : null}
                    </div>
                    <div className="shrink-0 font-extrabold text-green-700">{active ? "✓" : ""}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const RowPick = useCallback(
    ({ label, value, onClick }: { label: string; value: string; onClick: () => void }) => (
      <div className={pill + " p-3"}>
        <div className="flex items-center justify-between gap-3">
          <div className="text-[12px] font-extrabold text-gray-700">{label}</div>
          <button
            type="button"
            onClick={onClick}
            className="min-w-[170px] max-w-[220px] truncate rounded-2xl bg-green-50 px-3 py-2 text-[12px] font-extrabold text-green-800 ring-1 ring-green-200 hover:bg-green-100"
            title={value}
          >
            {value} <span className="ml-1 opacity-70">▾</span>
          </button>
        </div>
      </div>
    ),
    [pill]
  );

  const RowInput = useCallback(
    ({
      label,
      value,
      onChange,
      placeholder,
      inputMode,
      autoComplete,
    }: {
      label: string;
      value: string;
      onChange: (v: string) => void;
      placeholder?: string;
      inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
      autoComplete?: string;
    }) => (
      <div className={pill + " p-3"}>
        <div className="flex items-center justify-between gap-3">
          <div className="shrink-0 text-[12px] font-extrabold text-gray-700">{label}</div>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            inputMode={inputMode}
            autoComplete={autoComplete}
            className="w-[210px] max-w-[210px] rounded-2xl bg-white px-3 py-2.5 text-[13px] font-semibold outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-green-600"
          />
        </div>
      </div>
    ),
    [pill]
  );

  const RowTextarea = useCallback(
    ({
      label,
      value,
      onChange,
      placeholder,
    }: {
      label: string;
      value: string;
      onChange: (v: string) => void;
      placeholder?: string;
    }) => (
      <div className={pill + " p-3"}>
        <div className="text-[12px] font-extrabold text-gray-700">{label}</div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="mt-2 min-h-[70px] w-full rounded-2xl bg-white px-3 py-3 text-[13px] font-semibold outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-green-600"
        />
      </div>
    ),
    [pill]
  );

  if (!open) return null;

  const packagingLabel =
    packagingMode === "plastic" ? "Plastová krabička" : packagingMode === "rekrabicka" ? "REkrabička" : "Jídlonosič";

  const paymentLabel =
    payment === "cash"
      ? "Hotově"
      : payment === "card_delivery"
      ? "Kartou"
      : payment === "card_online"
      ? "Kartou online"
      : `Kredit (${credit} Kč)`;

  function PackagingPicker() {
    if (pickOpen !== "packaging") return null;

    const optionCls = (active: boolean) =>
      [
        "w-full rounded-2xl px-4 py-3 ring-1 transition select-none",
        active ? "bg-green-50 ring-green-300/70" : "bg-white ring-black/10 hover:bg-gray-50",
      ].join(" ");

    const infoBtn =
      "h-9 w-9 rounded-2xl bg-white ring-1 ring-black/10 hover:bg-gray-50 font-extrabold flex items-center justify-center";

    const pricePill =
      "rounded-full bg-green-50 text-green-700 ring-1 ring-green-200 px-2 py-1 text-[11px] font-extrabold leading-none whitespace-nowrap";

    const PriceLines = ({ lines }: { lines: string[] }) => (
      <div className="flex flex-col items-end gap-1">
        {lines.map((t, i) => (
          <div key={i} className={pricePill}>
            {t}
          </div>
        ))}
      </div>
    );

    return (
      <div className="fixed inset-0 z-[260] flex items-center justify-center p-4">
        <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setPickOpen(null)} />
        <div className="relative max-h-[80dvh] w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/10">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 pb-2 pt-3">
            <div className="text-[14px] font-extrabold text-gray-900">Balení</div>
            <button
              type="button"
              onClick={() => setPickOpen(null)}
              className="h-10 w-10 rounded-2xl bg-white font-extrabold ring-1 ring-black/10 hover:bg-gray-50"
            >
              ✕
            </button>
          </div>

          <div className="max-h-[70dvh] space-y-2 overflow-auto p-3">
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setPackagingMode("plastic");
                setPickOpen(null);
              }}
              className={optionCls(packagingMode === "plastic")}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-[13px] font-extrabold text-gray-900">Plastová krabička</div>
                <div className="flex items-center gap-2">
                  <PriceLines lines={["+8 Kč jídlo", "+7 Kč polévka"]} />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPackInfoTitle("Plastová krabička");
                      setPackInfoImg("/baleni/plast.png");
                      setPackInfoLines(["+8 Kč / jídlo", "+7 Kč / polévka (počítá se podle položek v košíku)."]);
                      setPackInfoOpen(true);
                    }}
                    className={infoBtn}
                    aria-label="Info"
                  >
                    i
                  </button>
                  {packagingMode === "plastic" ? <div className="font-extrabold text-green-700">✓</div> : null}
                </div>
              </div>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setPackagingMode("rekrabicka");
                setPickOpen(null);
              }}
              className={optionCls(packagingMode === "rekrabicka")}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-[13px] font-extrabold text-gray-900">REkrabička</div>
                <div className="flex items-center gap-2">
                  <PriceLines lines={["Záloha 80 Kč", "+7 Kč polévka"]} />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPackInfoTitle("REkrabička");
                      setPackInfoImg("/baleni/rekrabicka.png");
                      setPackInfoLines([
                        "Záloha 80 Kč za každé hlavní jídlo (1 krabička = 1 jídlo).",
                        "Polévka +7 Kč.",
                      ]);
                      setPackInfoOpen(true);
                    }}
                    className={infoBtn}
                    aria-label="Info"
                  >
                    i
                  </button>
                  {packagingMode === "rekrabicka" ? <div className="font-extrabold text-green-700">✓</div> : null}
                </div>
              </div>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setPackagingMode("own");
                setPickOpen(null);
              }}
              className={optionCls(packagingMode === "own")}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-[13px] font-extrabold text-gray-900">Jídlonosič</div>
                <div className="flex items-center gap-2">
                  <PriceLines lines={["Bez poplatku"]} />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPackInfoTitle("Jídlonosič");
                      setPackInfoImg("/baleni/jidlonosic.png");
                      setPackInfoLines(["Bez poplatku."]);
                      setPackInfoOpen(true);
                    }}
                    className={infoBtn}
                    aria-label="Info"
                  >
                    i
                  </button>
                  {packagingMode === "own" ? <div className="font-extrabold text-green-700">✓</div> : null}
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 pt-0">
            <button
              type="button"
              onClick={() => setPickOpen(null)}
              className="w-full rounded-2xl bg-white px-4 py-3 text-[13px] font-extrabold ring-1 ring-black/10 hover:bg-gray-50"
            >
              Zavřít
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/40" aria-label="Zavřít" />

      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/10">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 pb-2 pt-3">
          <div className="text-[14px] font-extrabold text-gray-900">
            {step === "cart" && "Košík"}
            {step === "checkout" && "Dokončení"}
            {step === "done" && "Hotovo"}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-2xl bg-white font-extrabold ring-1 ring-black/10 hover:bg-gray-50"
          >
            ✕
          </button>
        </div>

        {step === "cart" ? (
          <div className="relative">
            <div ref={scrollRef} onScroll={evalScrollHint} className="max-h-[70dvh] overflow-auto px-4 pb-28 pt-3">
              {cartCount === 0 ? (
                <div className="rounded-2xl bg-neutral-50 p-3 text-[13px] text-gray-600 ring-1 ring-black/10">
                  Košík je prázdný.
                </div>
              ) : (
                <div className="space-y-2">
                  {grouped.map((g) => (
                    <div key={g.datum} className={pillSoft + " p-3"}>
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-[12px] font-extrabold text-gray-700">{formatCartDay(g.datum)}</div>
                        <div className="rounded-full bg-white/80 px-2 py-1 text-[11px] font-extrabold text-green-700 ring-1 ring-green-200/70">
                          {g.items.reduce((s, it) => s + it.qty, 0)} ks
                        </div>
                      </div>

                      <div className="space-y-2">
                        {g.items.map((it) => {
                          const row: DbMenuRow = {
                            datum: it.datum,
                            poradi: 0,
                            jidlo_id: it.jidlo_id,
                            jidla: { nazev: it.nazev, cena: it.cena, kategorie: null },
                          };

                          return (
                            <div
                              key={it.key}
                              className="flex items-center gap-2 border-b border-green-200/50 py-2 last:border-b-0"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="break-words text-[14px] font-extrabold leading-snug text-gray-900">
                                  {it.nazev}
                                </div>
                                <div className="mt-0.5 text-[12px] text-gray-500">
                                  {it.cena} Kč · {it.qty}× ={" "}
                                  <span className="font-extrabold text-green-700">{it.cena * it.qty} Kč</span>
                                </div>
                              </div>

                              <div className="flex shrink-0 items-center gap-1.5">
                                <button type="button" onClick={() => removeOne(it.datum, row)} className={qtyBtn}>
                                  −
                                </button>
                                <div className="w-6 text-center text-[13px] font-extrabold">{it.qty}</div>
                                <button type="button" onClick={() => addOne(it.datum, row)} className={qtyBtn}>
                                  +
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {canScrollDown ? (
              <div className="pointer-events-none absolute bottom-[84px] left-0 right-0">
                <div className="h-10 bg-gradient-to-t from-white to-transparent" />
                <div className="-mt-6 flex justify-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow ring-1 ring-black/10">
                    ↓
                  </div>
                </div>
              </div>
            ) : null}

            <div className="absolute bottom-0 left-0 right-0 border-t border-gray-100 bg-white">
              <div className="px-4 py-3">
                <div className={pill + " p-3"}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-bold text-gray-500">Celkem</div>
                      <div className="text-[18px] font-extrabold text-gray-900">{total} Kč</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setStep("checkout")}
                      disabled={cartCount === 0}
                      className={btnPrimary}
                    >
                      Dokončit →
                    </button>
                  </div>

                  {authed && credit > 0 ? (
                    <div className="mt-2 text-[12px] text-gray-500">
                      Kredit: <span className="font-extrabold text-green-700">{credit} Kč</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {step === "checkout" ? (
          <div className="relative">
            <div className="max-h-[75dvh] overflow-auto px-4 pb-44 pt-3">
              {!authed ? (
                <div className="rounded-2xl bg-yellow-50 p-3 text-[13px] font-bold text-yellow-800 ring-1 ring-yellow-200">
                  Pro dokončení se musíš přihlásit.
                </div>
              ) : null}

              <div className="mt-3 space-y-2.5">
                <RowPick
                  label="Způsob převzetí"
                  value={deliveryMode === "delivery" ? "Doručení (Doprava 10 Kč)" : "Osobní odběr"}
                  onClick={() => setPickOpen("delivery")}
                />

                <RowInput
                  label="Jméno"
                  value={name}
                  onChange={setName}
                  placeholder="Vojtěch Pavlík"
                  autoComplete="name"
                />

                <RowInput
                  label="Telefon"
                  value={phone}
                  onChange={(v) => setPhone(formatPhoneCz(v))}
                  placeholder="777 777 777"
                  inputMode="numeric"
                  autoComplete="tel"
                />

                {deliveryMode === "delivery" ? (
                  <RowInput
                    label="Adresa"
                    value={address}
                    onChange={setAddress}
                    placeholder="Ulice a č.p., město"
                    autoComplete="street-address"
                  />
                ) : null}

                <RowPick label="Balení" value={packagingLabel} onClick={() => setPickOpen("packaging")} />

                <div className={pill + " p-3"}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[12px] font-extrabold text-gray-700">Preferuji čas doručení</div>
                      <div className="text-[11px] text-gray-500">(volitelné)</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setTimeOpen(true)}
                      className="min-w-[170px] max-w-[220px] truncate rounded-2xl bg-green-50 px-3 py-2 text-[12px] font-extrabold text-green-800 ring-1 ring-green-200 hover:bg-green-100"
                      title={timeSummary}
                      disabled={cartCount === 0}
                    >
                      {timeSummary} <span className="ml-1 opacity-70">›</span>
                    </button>
                  </div>
                </div>

                <RowPick label="Platba" value={paymentLabel} onClick={() => setPickOpen("payment")} />
                <RowTextarea label="Poznámka" value={note} onChange={setNote} placeholder="Např. bez cibule, zazvonit…" />

                {cartCount > 0 ? (
                  <div className={pillSoft + " p-3"}>
                    <div className="mb-2 text-[12px] font-extrabold text-gray-700">Rekapitulace</div>
                    <div className="flex items-center justify-between text-[13px] text-gray-700">
                      <span>Jídla</span>
                      <span className="font-extrabold">{itemsTotal} Kč</span>
                    </div>

                    {deliveryMode === "delivery" && cartCount > 0 ? (
                      <div className="flex items-center justify-between text-[13px] text-gray-700">
                        <span>Doprava</span>
                        <span className="font-extrabold">10 Kč</span>
                      </div>
                    ) : null}

                    {packagingFee > 0 ? (
                      <div className="flex items-center justify-between text-[13px] text-gray-700">
                        <span>Balení</span>
                        <span className="font-extrabold">{packagingFee} Kč</span>
                      </div>
                    ) : null}

                    <div className="mt-2 flex items-center justify-between border-t border-green-200/60 pt-2">
                      <span className="text-[12px] font-bold text-gray-600">Celkem</span>
                      <span className="text-[16px] font-extrabold text-green-700">{payTotal} Kč</span>
                    </div>
                  </div>
                ) : null}

                {msg ? (
                  <div className="rounded-2xl bg-neutral-50 px-3 py-2 text-[12px] font-bold text-neutral-700 ring-1 ring-black/10">
                    {msg}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 border-t border-gray-100 bg-white">
              <div className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setStep("cart")} className={btnGhost}>
                    ← Zpět
                  </button>

                  <button
                    type="button"
                    onClick={submitOrder}
                    disabled={busy || cartCount === 0 || (payment === "credit" && !canPayCredit)}
                    className={"flex-1 " + btnPrimary}
                  >
                    {busy ? "Odesílám…" : `${payment === "card_online" ? "Zaplatit" : "Odeslat"} (${payTotal} Kč)`}
                  </button>
                </div>

                {!authed ? (
                  <button type="button" onClick={onNeedLogin} className={btnGhost + " mt-2 w-full"}>
                    Přihlásit se
                  </button>
                ) : null}
              </div>
            </div>

            <PickerSheet
              open={pickOpen === "delivery"}
              title="Způsob převzetí"
              value={deliveryMode}
              onClose={() => setPickOpen(null)}
              onPick={(id) => setDeliveryMode(id as DeliveryMode)}
              options={[
                { id: "delivery", label: "Doručení", sub: "Doprava 10 Kč" },
                { id: "pickup", label: "Osobní odběr", sub: "Bez dopravy" },
              ]}
            />

            <PackagingPicker />

            <PickerSheet
              open={pickOpen === "payment"}
              title="Platba"
              value={payment}
              onClose={() => setPickOpen(null)}
              onPick={(id) => setPayment(id as PaymentMethod)}
              options={[
                { id: "cash", label: "Hotově" },
                { id: "card_delivery", label: "Kartou" },
                { id: "card_online", label: "Kartou online" },
                { id: "credit", label: `Kredit (${credit} Kč)`, sub: canPayCredit ? "" : "Nedostatek kreditu" },
              ]}
            />

            <PackagingInfoModal
              open={packInfoOpen}
              onClose={() => setPackInfoOpen(false)}
              title={packInfoTitle}
              imgSrc={packInfoImg}
              lines={packInfoLines}
            />
          </div>
        ) : null}

        {timeOpen ? (
          <div className="fixed inset-0 z-[275] flex items-center justify-center p-4">
            <button
              type="button"
              onClick={() => setTimeOpen(false)}
              className="absolute inset-0 bg-black/40"
              aria-label="Zavřít"
            />

            <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/10">
              <div className="flex items-start justify-between border-b border-gray-100 px-4 pb-2 pt-3">
                <div>
                  <div className="text-[18px] font-extrabold text-gray-900">Čas doručení</div>
                  <div className="text-[12px] font-semibold text-gray-600">10:00 – 13:30 (po 30 min) • (volitelné)</div>
                </div>

                <button
                  type="button"
                  onClick={() => setTimeOpen(false)}
                  className="h-10 w-10 rounded-2xl bg-white font-extrabold ring-1 ring-black/10 hover:bg-gray-50"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 p-4">
                <div className="flex flex-wrap gap-2">
                  {cartDays.map((d) => {
                    const active = d === activeTimeDay;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setActiveTimeDay(d)}
                        className={[
                          "rounded-full px-3 py-2 text-[12px] font-extrabold ring-1 transition",
                          active
                            ? "bg-green-600 text-white ring-green-600"
                            : "bg-white text-gray-900 ring-black/10 hover:bg-gray-50",
                        ].join(" ")}
                      >
                        {formatCartDay(d)}
                      </button>
                    );
                  })}
                </div>

                {cartDays.length > 1 ? (
                  <label className="flex select-none items-center gap-2 text-[13px] font-semibold text-gray-700">
                    <input
                      type="checkbox"
                      checked={sameTimeForAll}
                      onChange={(e) => setSameTimeForAll(e.target.checked)}
                    />
                    Stejný čas pro všechny dny
                  </label>
                ) : null}

                <div className="grid grid-cols-2 gap-2">
                  {timeSlots.map((s) => {
                    const cur = activeTimeDay ? ((timesByDay as any)?.[activeTimeDay] as DayTime) : null;
                    const active = !!cur && cur.from === s.from && cur.to === s.to;

                    return (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => pickTime({ from: s.from, to: s.to })}
                        className={[
                          "rounded-2xl px-3 py-3 text-[14px] font-extrabold ring-1 transition",
                          active
                            ? "bg-green-50 text-green-800 ring-green-300/70"
                            : "bg-white text-gray-900 ring-black/10 hover:bg-gray-50",
                        ].join(" ")}
                        disabled={!activeTimeDay}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setTimeOpen(false)}
                    className="rounded-2xl bg-green-600 px-6 py-3 text-[13px] font-extrabold text-white hover:bg-green-700"
                  >
                    Hotovo
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {step === "done" ? (
          <div className="px-4 pb-4">
            <div className="mt-3 rounded-2xl bg-green-50 p-4 text-green-800 ring-1 ring-green-200">
              <div className="text-[15px] font-extrabold">Objednávka odeslaná ✅</div>
              {orderId ? <div className="mt-1 text-[12px] font-bold text-green-900/80">ID: {orderId}</div> : null}
              <div className="mt-1 text-[13px] font-semibold">Děkujeme! Brzy ji připravíme.</div>

              <button type="button" onClick={onClose} className={"mt-3 w-full " + btnPrimary}>
                Zavřít
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** ===================== Day picker modal ===================== */
function DayPickerModal({
  open,
  onClose,
  weekOffset,
  setWeekOffset,
  tabDays,
  selectedDate,
  setSelectedDate,
}: {
  open: boolean;
  onClose: () => void;
  weekOffset: 0 | 1;
  setWeekOffset: (v: 0 | 1) => void;
  tabDays: string[];
  selectedDate: string;
  setSelectedDate: (d: string) => void;
}) {
  if (!open) return null;

  const rangeLabel = tabDays.length ? formatRangeShort(tabDays[0], tabDays[tabDays.length - 1]) : "";
  const weekText = weekOffset === 0 ? "Tento týden" : "Příští týden";

  return (
    <div className="fixed inset-0 z-[230] flex items-center justify-center p-4">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/40" aria-label="Zavřít" />
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/10">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 pb-2 pt-3">
          <div>
            <div className="text-[15px] font-extrabold text-gray-900">Vybrat den</div>
            <div className="mt-0.5 text-[12px] font-semibold text-green-700">{weekText}</div>
            <div className="text-[12px] font-semibold text-gray-500">{rangeLabel}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-2xl bg-white font-extrabold ring-1 ring-black/10 hover:bg-gray-50"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              disabled={weekOffset === 0}
              className="h-11 rounded-2xl bg-white font-extrabold ring-1 ring-black/10 disabled:opacity-40"
            >
              ‹
            </button>

            <div className="rounded-2xl bg-[#f6fbf7] px-3 py-3 text-center ring-1 ring-green-200/80">
              <div className="text-[11px] font-bold uppercase tracking-wide text-green-700">{weekText}</div>
              <div className="mt-0.5 text-[13px] font-extrabold text-[#1f2f56]">{rangeLabel}</div>
            </div>

            <button
              type="button"
              onClick={() => setWeekOffset(1)}
              disabled={weekOffset === 1}
              className="h-11 rounded-2xl bg-white font-extrabold ring-1 ring-black/10 disabled:opacity-40"
            >
              ›
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {tabDays.map((d) => {
              const active = d === selectedDate;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setSelectedDate(d);
                    onClose();
                  }}
                  className={[
                    "w-full rounded-2xl px-4 py-3 text-left ring-1 transition",
                    active
                      ? "bg-green-600 text-white ring-green-600"
                      : "bg-white text-gray-900 ring-black/10 hover:bg-gray-50",
                  ].join(" ")}
                >
                  <div className="text-[13px] font-extrabold">{formatSelectedDaySmart(d)}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** ===================== Main MobileView ===================== */
export default function MobileView({ onOpenCart }: MobileViewProps) {
  const router = useRouter();

  type Section = "daily" | "order" | "cart" | "jirka" | "about";
  const [activeSection, setActiveSection] = useState<Section>("daily");

  const [userName, setUserName] = useState("");
  const [credit, setCredit] = useState(0);
  const [authed, setAuthed] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const [role, setRole] = useState<"customer" | "staff">("customer");
  const [menuOpen, setMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const [cartOpen, setCartOpen] = useState(false);

  const openCart = useCallback(() => {
    if (onOpenCart) {
      onOpenCart();
      return;
    }
    setCartOpen(true);
  }, [onOpenCart]);

  const [algOpen, setAlgOpen] = useState(false);
  const [algTitle, setAlgTitle] = useState("");
  const [algList, setAlgList] = useState<string[]>([]);
  const [algCategory, setAlgCategory] = useState<string | null>("");

  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [flashKey, setFlashKey] = useState<string | null>(null);

  const { cart, cartCount, total, keyFor, addOne, removeOne } = useOrder();

  const [systemItems, setSystemItems] = useState<SystemItemRow[]>([]);
  const [loadingSystemItems, setLoadingSystemItems] = useState(true);

  useEffect(() => {
    const onDoc = (e: PointerEvent) => {
      const el = userMenuRef.current;
      if (!el) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (el.contains(target)) return;
      setMenuOpen(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!alive) return;

        setAuthed(!!data.session?.user);

        const p = await getMyProfile();
        if (!alive) return;

        setUserName((p?.full_name ?? "").toString());
        setCredit(Number((p as any)?.kredit ?? 0) || 0);
        setRole(((p as any)?.role as any) === "staff" ? "staff" : "customer");
      } catch (e) {
        console.error(e);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      (async () => {
        try {
          if (!alive) return;
          setAuthed(!!sess?.user);

          const p = await getMyProfile();
          if (!alive) return;

          setUserName((p?.full_name ?? "").toString());
          setCredit(Number((p as any)?.kredit ?? 0) || 0);
          setRole(((p as any)?.role as any) === "staff" ? "staff" : "customer");
          setMenuOpen(false);
        } catch (e) {
          console.error(e);
        }
      })();
    });

    const onProfileUpdated = async () => {
      const p = await getMyProfile();
      setUserName((p?.full_name ?? "").toString());
      setCredit(Number((p as any)?.kredit ?? 0) || 0);
      setRole(((p as any)?.role as any) === "staff" ? "staff" : "customer");
    };

    window.addEventListener("profile-updated", onProfileUpdated);

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
      window.removeEventListener("profile-updated", onProfileUpdated);
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadSystemItems() {
      setLoadingSystemItems(true);

      const { data, error } = await supabase
        .from("system_items")
        .select("id, section, item_key, label, value_text, value_number, sort_order, is_active")
        .eq("is_active", true)
        .order("section", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true });

      if (!alive) return;

      if (error) {
        console.error("loadSystemItems error:", error);
        setSystemItems([]);
        setLoadingSystemItems(false);
        return;
      }

      setSystemItems((data ?? []) as SystemItemRow[]);
      setLoadingSystemItems(false);
    }

    loadSystemItems();
    return () => {
      alive = false;
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setMenuOpen(false);
  }

  const shopHoursRows = useMemo(
    () => systemItems.filter((x) => x.section === "opening_hours_shop"),
    [systemItems]
  );

  const canteenHoursRows = useMemo(
    () => systemItems.filter((x) => x.section === "opening_hours_canteen"),
    [systemItems]
  );

  const aboutTextRow = useMemo(
    () => systemItems.find((x) => x.section === "about_text" && x.item_key === "main") ?? null,
    [systemItems]
  );

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const baseMondayISO = useMemo(() => toISODateLocal(baseMondayAutoNextWeekend(new Date())), [tick]);
  const [weekOffset, setWeekOffset] = useState<0 | 1>(0);

  useEffect(() => {
    setWeekOffset(0);
  }, [baseMondayISO]);

  const days = useMemo(() => {
    const base = new Date(baseMondayISO + "T00:00:00");
    base.setDate(base.getDate() + weekOffset * 7);

    const arr: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      arr.push(toISODateLocal(d));
    }
    return arr;
  }, [baseMondayISO, weekOffset]);

  const tabDays = useMemo(() => days.slice(0, 6), [days]);

 const [selectedDate, setSelectedDate] = useState<string>(toISODateLocal(new Date()));

  useEffect(() => {
    const todayIso = toISODateLocal(new Date());

    setSelectedDate((prev) => {
      if (prev && tabDays.includes(prev)) {
        if (prev === todayIso) return prev;
        if (tabDays.includes(todayIso) && todayIso > prev) return todayIso;
        return prev;
      }
      return tabDays.includes(todayIso) ? todayIso : tabDays[0] ?? "";
    });
  }, [tabDays, tick]);

  const zavreno = isSunday(selectedDate);
  const rangeLabel = tabDays.length ? formatRangeShort(tabDays[0], tabDays[tabDays.length - 1]) : "";
  const weekText = weekOffset === 0 ? "Tento týden" : "Příští týden";

  const [menuByDate, setMenuByDate] = useState<Record<string, MenuRow[]>>({});
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadMenu() {
      if (!days?.length) return;
      setLoadingMenu(true);
      setErr(null);

      const { data, error } = await supabase
        .from("menu_den")
        .select("datum, poradi, jidlo_id, jidla:jidlo_id(nazev, cena, kategorie, alergeny, aktivni)")
        .in("datum", days)
        .order("datum", { ascending: true })
        .order("poradi", { ascending: true });

      if (!alive) return;

      if (error) {
        console.error("Mobile loadMenu error:", error);
        setErr(error.message);
        setMenuByDate({});
        setLoadingMenu(false);
        return;
      }

      const rows = (data ?? [])
        .map((r: any) => ({
          datum: r.datum as string,
          poradi: Number(r.poradi ?? 0),
          jidlo_id: r.jidlo_id as string | null,
          jidla: r.jidla ?? null,
        }))
        .filter((r: any) => !!r.jidlo_id && !!r.jidla && (r.jidla.aktivni ?? true))
        .map((r: any) => ({
          datum: r.datum,
          poradi: r.poradi,
          jidlo_id: r.jidlo_id as string,
          jidla: {
            nazev: r.jidla.nazev as string,
            cena: r.jidla.cena as number | null,
            kategorie: r.jidla.kategorie as string | null,
            alergeny: (r.jidla.alergeny ?? null) as string | null,
          },
        })) as MenuRow[];

      const map: Record<string, MenuRow[]> = {};
      for (const d of days) map[d] = [];
      for (const r of rows) {
        if (!map[r.datum]) map[r.datum] = [];
        map[r.datum].push(r);
      }

      setMenuByDate(map);
      setLoadingMenu(false);
    }

    loadMenu();
    return () => {
      alive = false;
    };
  }, [days]);

  const items = (menuByDate[selectedDate] ?? []).filter((x) => x.jidla).slice(0, 50);

  function UserArea() {
    if (!authed) {
      return (
        <button
          type="button"
          onClick={() => setAuthOpen(true)}
          className="rounded-2xl bg-green-600 px-3 py-2 text-[12px] font-extrabold text-white hover:bg-green-700"
        >
          Přihlásit
        </button>
      );
    }

    const name = userName.trim() || "Uživatel";

    return (
      <div className="relative" ref={userMenuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="max-w-[150px] truncate rounded-2xl bg-white px-3 py-2 text-[12px] font-extrabold ring-1 ring-black/10 hover:bg-gray-50"
          title={name}
        >
          <span className="truncate">
            {name}
            {role !== "staff" ? ` · ${credit} Kč` : ""}
          </span>
          <span className="ml-2 inline-block opacity-80">▾</span>
        </button>

        {menuOpen ? (
          <div className="absolute right-0 top-[46px] z-[120] w-64 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/10">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                router.push("/profil");
              }}
              className="w-full px-4 py-3 text-left text-sm font-extrabold hover:bg-gray-50"
            >
              Nastavení profilu
            </button>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                router.push("/kredit");
              }}
              className="w-full px-4 py-3 text-left text-sm font-extrabold hover:bg-gray-50"
            >
              Dobít kredit
            </button>

            <div className="h-px bg-gray-100" />

            <button
              type="button"
              onClick={signOut}
              className="w-full px-4 py-3 text-left text-sm font-extrabold text-red-600 hover:bg-red-50"
            >
              Odhlásit
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  function StaffShortcut() {
    if (role !== "staff" || !authed) return null;

    return (
      <button
        type="button"
        onClick={() => router.push("/staff")}
        className="rounded-2xl bg-green-50 px-3 py-2 text-[12px] font-extrabold text-green-800 ring-1 ring-green-200 hover:bg-green-100"
      >
        Rozcestník
      </button>
    );
  }

  function SectionHeaderDaily() {
    return (
      <div className="px-1 pt-1">
        <div className="flex items-start justify-between gap-3">
          <div className="text-[24px] font-extrabold leading-none text-green-700">Denní menu</div>

          <button
            type="button"
            onClick={() => setDayPickerOpen(true)}
            className="pt-1 text-right text-[14px] font-bold text-gray-700 underline decoration-1 underline-offset-4"
          >
            {formatSelectedDaySmart(selectedDate)}
          </button>
        </div>
      </div>
    );
  }

  function SectionHeaderOrder() {
    return (
      <div className="space-y-3 px-1 pt-1">
        <div className="text-[24px] font-extrabold leading-none text-green-700">Objednávka jídel</div>

        <div className="rounded-[26px] border border-[#dbeee2] bg-white px-4 py-3 shadow-sm ring-1 ring-green-100/70">
          <div className="grid grid-cols-[40px_1fr_40px] items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              disabled={weekOffset === 0}
              className="h-10 rounded-2xl bg-white font-extrabold text-gray-700 ring-1 ring-black/10 disabled:opacity-35"
            >
              ‹
            </button>

            <button
              type="button"
              onClick={() => setDayPickerOpen(true)}
              className="rounded-2xl bg-[#f7fbf8] px-3 py-2 text-center ring-1 ring-green-200/80 transition hover:bg-[#eef8f1]"
            >
              <div className="text-[11px] font-bold uppercase tracking-wide text-green-700">{weekText}</div>
              <div className="mt-0.5 text-[13px] font-extrabold text-[#1f2f56]">{rangeLabel}</div>
            </button>

            <button
              type="button"
              onClick={() => setWeekOffset(1)}
              disabled={weekOffset === 1}
              className="h-10 rounded-2xl bg-white font-extrabold text-gray-700 ring-1 ring-black/10 disabled:opacity-35"
            >
              ›
            </button>
          </div>

          <div className="mt-3 grid grid-cols-6 gap-1.5">
            {tabDays.map((d) => {
              const active = d === selectedDate;
              const disabled = isPastDay(d);

              return (
                <button
                  key={d}
                  type="button"
                  disabled={disabled}
                  onClick={() => setSelectedDate(d)}
                  className={[
                    "rounded-2xl px-2 py-2 text-center ring-1 transition",
                    disabled
                      ? "cursor-not-allowed bg-gray-50 text-gray-300 ring-gray-200"
                      : active
                      ? "bg-green-600 text-white ring-green-600"
                      : "bg-white text-gray-800 ring-black/10 hover:bg-gray-50",
                  ].join(" ")}
                >
                  <div className="text-[11px] font-extrabold">{formatDayShort(d)}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function MenuList({ mode }: { mode: "daily" | "order" }) {
    if (loadingMenu) return <div className="text-[13px] text-gray-500">Načítám…</div>;
    if (err) return <div className="text-[13px] font-bold text-red-600">{err}</div>;
    if (items.length === 0) return <div className="text-[13px] text-gray-500">Zatím nebylo zveřejněné menu.</div>;

    return (
      <div className="space-y-2">
        {items.map((r) => {
          const k = keyFor(selectedDate, r.jidlo_id);
          const qty = cart.find((x) => x.key === k)?.qty ?? 0;

          const row: DbMenuRow = {
            datum: r.datum,
            poradi: r.poradi,
            jidlo_id: r.jidlo_id,
            jidla: r.jidla,
          };

          const title = r.jidla?.nazev ?? "";
          const price = r.jidla?.cena ?? 0;
          const category = r.jidla?.kategorie ?? "";
          const allergenList = allergenNamesFromColumn(r.jidla?.alergeny ?? "");
          const orderDisabled = !canAddToCartForDay(selectedDate);
          const isFlashing = flashKey === k;

          return (
            <div
              key={k}
              className={[
                "rounded-[24px] border px-3 py-3 shadow-sm transition duration-200",
                qty > 0 && mode === "order" ? "border-green-300/80 bg-green-50" : "border-black/10 bg-white",
                isFlashing ? "scale-[1.01]" : "scale-100",
              ].join(" ")}
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className="truncate text-[15px] font-extrabold text-[#1f2f56]">{title}</div>

                    <button
                      type="button"
                      onClick={() => {
                        setAlgTitle(title);
                        setAlgList(allergenList);
                        setAlgCategory(category);
                        setAlgOpen(true);
                      }}
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#7ac796] bg-white text-[11px] font-extrabold text-[#067647]"
                      aria-label="Informace"
                      title="Informace"
                    >
                      i
                    </button>
                  </div>

                  {!!category ? <div className="mt-0.5 text-[12px] font-medium text-gray-500">{category}</div> : null}
                </div>

                <div className="flex shrink-0 items-center gap-3 self-stretch">
                  <div className="flex h-full min-w-[58px] items-center justify-center whitespace-nowrap text-[15px] font-extrabold text-[#067647]">
                    {price} Kč
                  </div>

                  {mode === "order" ? (
                    qty === 0 ? (
                      <button
                        type="button"
                        disabled={orderDisabled}
                        onClick={() => {
                          if (orderDisabled) return;
                          addOne(selectedDate, row);
                          setFlashKey(k);
                          window.setTimeout(() => setFlashKey((prev) => (prev === k ? null : prev)), 220);
                        }}
                        className={[
                          "rounded-2xl px-3 py-2 text-[12px] font-extrabold ring-1 transition",
                          orderDisabled
                            ? "cursor-not-allowed bg-gray-50 text-gray-300 ring-gray-200"
                            : "bg-white text-green-700 ring-green-600/70 hover:bg-green-600 hover:text-white",
                        ].join(" ")}
                      >
                        Přidat
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => removeOne(selectedDate, row)}
                          className="h-8 w-8 rounded-xl bg-white font-extrabold text-gray-900 ring-1 ring-black/10 hover:bg-gray-50"
                        >
                          −
                        </button>
                        <div className="w-6 text-center text-[12px] font-extrabold">{qty}</div>
                        <button
                          type="button"
                          onClick={() => {
                            if (orderDisabled) return;
                            addOne(selectedDate, row);
                            setFlashKey(k);
                            window.setTimeout(() => setFlashKey((prev) => (prev === k ? null : prev)), 220);
                          }}
                          className="h-8 w-8 rounded-xl bg-white font-extrabold text-gray-900 ring-1 ring-black/10 hover:bg-gray-50"
                        >
                          +
                        </button>
                      </div>
                    )
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function JirkaSection() {
    const photoSources = ["/fotky/obchod-1.jpg", "/fotky/obchod-2.jpg", "/fotky/jidelna-1.jpg"];

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3">
          {photoSources.map((src) => (
            <div key={src} className="overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ring-black/10">
              <img src={src} alt="Jiřka" className="h-44 w-full object-cover" />
            </div>
          ))}
        </div>

        <div className="rounded-[24px] border border-[#dbeee2] bg-white px-4 py-3">
          <div className="text-[16px] font-extrabold text-green-700">Jídelna</div>
          <div className="mt-2 space-y-1.5">
            {loadingSystemItems ? (
              <div className="text-[13px] text-gray-500">Načítám…</div>
            ) : canteenHoursRows.length === 0 ? (
              <div className="text-[13px] text-gray-500">Otevírací doba zatím není vyplněná.</div>
            ) : (
              canteenHoursRows.map((row) => (
                <div key={`canteen-${row.id}`} className="text-[13px] text-gray-700">
                  <span className="font-extrabold text-[#1f2f56]">{row.label ?? "Den"}:</span>{" "}
                  <span className="font-semibold">{row.value_text ?? "—"}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[24px] border border-[#dbeee2] bg-white px-4 py-3">
          <div className="text-[16px] font-extrabold text-green-700">Obchod</div>
          <div className="mt-2 space-y-1.5">
            {loadingSystemItems ? (
              <div className="text-[13px] text-gray-500">Načítám…</div>
            ) : shopHoursRows.length === 0 ? (
              <div className="text-[13px] text-gray-500">Otevírací doba zatím není vyplněná.</div>
            ) : (
              shopHoursRows.map((row) => (
                <div key={`shop-${row.id}`} className="text-[13px] text-gray-700">
                  <span className="font-extrabold text-[#1f2f56]">{row.label ?? "Den"}:</span>{" "}
                  <span className="font-semibold">{row.value_text ?? "—"}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  function AboutSection() {
    return (
      <div className="space-y-3">
        <div className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-black/10">
          <div className="text-[15px] font-extrabold text-green-700">Jiřka</div>
          <div className="mt-2 whitespace-pre-line text-[14px] leading-6 text-gray-700">
            {loadingSystemItems
              ? "Načítám text…"
              : aboutTextRow?.value_text ||
                "Sem si potom doplníš článek o Jiřce, historii, nabídce a dalších informacích."}
          </div>
        </div>

        <div className="rounded-[24px] bg-green-50 p-4 ring-1 ring-green-100">
          <div className="text-[13px] font-extrabold uppercase tracking-wide text-green-700">Adresa</div>
          <div className="mt-1 text-[14px] font-semibold text-gray-700">Havlíčkova 72, 29001 Poděbrady</div>
        </div>

        <div className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-black/10">
          <div className="text-[13px] font-extrabold uppercase tracking-wide text-green-700">IČO</div>
          <div className="mt-1 text-[14px] font-semibold text-gray-700">Doplníme později</div>
        </div>

        <div className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-black/10">
          <div className="text-[13px] font-extrabold uppercase tracking-wide text-green-700">Kontakt</div>
          <div className="mt-1 text-[14px] font-semibold text-gray-700">Doplníme později</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-white pb-40">
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      <AllergensModal
        open={algOpen}
        onClose={() => setAlgOpen(false)}
        title={algTitle}
        allergens={algList}
        category={algCategory}
      />

      <DayPickerModal
        open={dayPickerOpen}
        onClose={() => setDayPickerOpen(false)}
        weekOffset={weekOffset}
        setWeekOffset={setWeekOffset}
        tabDays={tabDays}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
      />

      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        authed={authed}
        onNeedLogin={() => setAuthOpen(true)}
        credit={credit}
      />

      <div className="sticky top-0 z-40 border-b border-black/5 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-md px-3 pb-2 pt-2">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <Image
                src="/logo-na-mobil.png"
                alt="Jiřka"
                width={230}
                height={95}
                className="h-auto w-[172px] object-contain"
                priority
              />
              <div className="-mt-1 pl-1 text-[11px] font-semibold tracking-[0.01em] text-gray-500">
                rozvoz obědů po Poděbradech
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2 pt-1">
              <div className="flex items-center gap-2">
                <StaffShortcut />
                <UserArea />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-md space-y-3 px-3 pb-3 pt-2">
        {activeSection === "daily" && <SectionHeaderDaily />}
        {activeSection === "order" && <SectionHeaderOrder />}

        {(activeSection === "daily" || activeSection === "order") && zavreno ? (
          <div className="rounded-2xl bg-red-50 p-3 font-semibold text-red-700 ring-2 ring-red-200/60">
            V neděli je zavřeno.
          </div>
        ) : null}

        {activeSection === "order" && orderDayHint(selectedDate) ? (
          <div className="rounded-2xl bg-neutral-50 p-3 text-[13px] font-semibold text-gray-600 ring-1 ring-black/10">
            {orderDayHint(selectedDate)}
          </div>
        ) : null}

        {activeSection === "daily" && <MenuList mode="daily" />}
        {activeSection === "order" && <MenuList mode="order" />}
        {activeSection === "jirka" && <JirkaSection />}
        {activeSection === "about" && <AboutSection />}
      </div>

      {activeSection === "order" ? (
        <div className="fixed bottom-[68px] left-0 right-0 z-40">
          <div className="mx-auto max-w-md px-3">
            <button
              type="button"
              onClick={() => openCart()}
              className={[
                "w-full rounded-[24px] border px-4 py-3 text-left shadow-xl transition active:scale-[0.99]",
                cartCount > 0
                  ? "border-green-600 bg-green-600 text-white"
                  : "border-[#dbeee2] bg-white text-gray-900 hover:bg-gray-50",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className={`text-[16px] font-extrabold ${cartCount > 0 ? "text-white" : "text-[#1f2f56]"}`}>
                    Objednávka
                  </div>
                  <div className={`mt-0.5 text-[12px] font-semibold ${cartCount > 0 ? "text-white/85" : "text-gray-500"}`}>
                    {cartCount > 0 ? `${cartCount} ks v košíku` : "Zatím nic vybráno"}
                  </div>
                </div>

                <div className={`shrink-0 text-[18px] font-extrabold ${cartCount > 0 ? "text-white" : "text-green-700"}`}>
                  {total} Kč
                </div>
              </div>
            </button>
          </div>
        </div>
      ) : null}

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white">
        <div className="mx-auto grid max-w-md grid-cols-5 text-[11px] font-semibold text-gray-600">
          {[
            { id: "daily", label: "Menu", icon: "📋" },
            { id: "order", label: "Objednat", icon: "🍽️" },
            { id: "cart", label: "Košík", icon: "🛒" },
            { id: "jirka", label: "Jiřka", icon: "🏪" },
            { id: "about", label: "O nás", icon: "ℹ️" },
          ].map((x) => {
            const isActive = activeSection === x.id || (x.id === "cart" && cartOpen);

            return (
              <button
                key={x.id}
                onClick={() => {
                  if (x.id === "cart") {
                    openCart();
                    return;
                  }
                  setActiveSection(x.id as Section);
                }}
                className={`flex flex-col items-center py-2 ${isActive ? "text-green-700" : "text-gray-500"}`}
              >
                <span className="relative text-lg leading-none">
                  {x.icon}
                  {x.id === "cart" && cartCount > 0 ? (
                    <span className="absolute -right-3 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-green-600 px-1 text-[11px] font-extrabold text-white">
                      {cartCount}
                    </span>
                  ) : null}
                </span>
                {x.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
