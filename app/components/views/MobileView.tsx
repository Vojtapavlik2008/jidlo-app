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

  // ⚠️ Tohle ukládá jen cenu jídel (bez poplatků za dopravu/balení).
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

// ✅ nikdy nepoužívej toISOString() pro lokální datum (posouvá o den)
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
  const day = x.getDay(); // 0=ne, 1=po, ..., 6=so
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(x);
  monday.setDate(monday.getDate() - diffToMonday);
  if (day === 6 || day === 0) monday.setDate(monday.getDate() + 7);
  return monday;
}
function formatRangeShort(fromIso: string, toIso: string) {
  const f = new Date(fromIso + "T00:00:00");
  const t = new Date(toIso + "T00:00:00");
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
  const d = new Date(iso + "T00:00:00");
  const wd = new Intl.DateTimeFormat("cs-CZ", { weekday: "short" })
    .format(d)
    .replace(".", "")
    .toLowerCase();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${wd} ${dd}.${mm}.`;
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

/** ===================== Auth Modal (center) ===================== */
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
      if (uid) {
        if (fullName.trim() || phone.trim() || address.trim()) {
          try {
            await upsertProfile(uid);
          } catch {}
        }
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
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
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
      <div className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl ring-1 ring-black/10 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-base font-extrabold text-green-700">{tab === "login" ? "Přihlášení" : "Registrace"}</div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-2xl bg-white ring-1 ring-black/10 hover:bg-gray-50 font-extrabold"
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
            <div className="text-[11px] font-extrabold text-gray-600 mb-1">Email</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@domena.cz"
              inputMode="email"
              autoComplete="email"
              className="w-full rounded-2xl bg-white ring-1 ring-black/10 px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-green-600"
            />
          </label>

          <label className="block">
            <div className="text-[11px] font-extrabold text-gray-600 mb-1">Heslo</div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              autoComplete={tab === "login" ? "current-password" : "new-password"}
              className="w-full rounded-2xl bg-white ring-1 ring-black/10 px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-green-600"
            />
            <div className="mt-1 text-[11px] text-gray-500">Min. 6 znaků.</div>
          </label>

          {tab === "register" ? (
            <>
              <label className="block">
                <div className="text-[11px] font-extrabold text-gray-600 mb-1">Jméno a příjmení</div>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Vojtěch Pavlík"
                  autoComplete="name"
                  className="w-full rounded-2xl bg-white ring-1 ring-black/10 px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-green-600"
                />
              </label>

              <label className="block">
                <div className="text-[11px] font-extrabold text-gray-600 mb-1">Telefon</div>
                <input
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneCz(e.target.value))}
                  placeholder="777 777 777"
                  inputMode="numeric"
                  autoComplete="tel"
                  className="w-full rounded-2xl bg-white ring-1 ring-black/10 px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-green-600"
                />
                {!phoneOk ? <div className="mt-1 text-[11px] font-bold text-red-600">Telefon musí mít 9 číslic.</div> : null}
              </label>

              <label className="block">
                <div className="text-[11px] font-extrabold text-gray-600 mb-1">Adresa</div>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ulice 1, Praha"
                  autoComplete="street-address"
                  className="w-full rounded-2xl bg-white ring-1 ring-black/10 px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-green-600"
                />
              </label>
            </>
          ) : null}

          {msg ? (
            <div className="rounded-2xl bg-neutral-50 text-neutral-700 ring-1 ring-black/10 px-3 py-2 text-[12px] font-bold">
              {msg}
            </div>
          ) : null}

          <button
            type="button"
            onClick={tab === "login" ? doLogin : doRegister}
            disabled={busy || !email.trim() || password.length < 6 || (tab === "register" && !phoneOk)}
            className="w-full rounded-2xl px-4 py-3 text-sm font-extrabold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
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
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  allergens: string[];
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/40" aria-label="Zavřít" />
      <div className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl ring-1 ring-black/10 overflow-hidden">
        <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-gray-100">
          <div className="text-[14px] font-extrabold text-gray-900">Alergeny</div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-2xl bg-white ring-1 ring-black/10 hover:bg-gray-50 font-extrabold"
          >
            ✕
          </button>
        </div>

        <div className="px-4 pb-4 max-h-[70dvh] overflow-auto">
          <div className="mt-3 text-[13px] font-extrabold text-gray-900">{title}</div>

          {allergens.length === 0 ? (
            <div className="mt-2 rounded-2xl bg-neutral-50 ring-1 ring-black/10 p-3 text-[13px] text-gray-700">
              Nejsou uvedené alergeny.
            </div>
          ) : (
            <div className="mt-2 rounded-2xl bg-white ring-1 ring-black/10 p-3">
              <div className="space-y-2">
                {allergens.map((a, idx) => (
                  <div key={idx} className="text-[13px] text-gray-800">
                    • {a}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full rounded-2xl px-4 py-3 text-[13px] font-extrabold bg-green-600 text-white hover:bg-green-700"
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
      <div className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl ring-1 ring-black/10 overflow-hidden">
        <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-gray-100">
          <div className="text-[14px] font-extrabold text-gray-900">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-2xl bg-white ring-1 ring-black/10 hover:bg-gray-50 font-extrabold"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-14 w-14 rounded-2xl bg-white ring-1 ring-black/10 overflow-hidden flex items-center justify-center shrink-0">
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
            className="mt-4 w-full rounded-2xl px-4 py-3 text-[13px] font-extrabold bg-green-600 text-white hover:bg-green-700"
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
}

/** ===================== Cart Sheet (modal) ===================== */
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
    setTimesByDay, // ✅ MUSÍ BÝT TADY
  } = useOrder();

  const [step, setStep] = useState<"cart" | "checkout" | "done">("cart");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  // scroll hint
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);
const didAutofillRef = useRef(false);

  // picker state
  const [pickOpen, setPickOpen] = useState<null | "delivery" | "packaging" | "payment">(null);

  // packaging info modal state
  const [packInfoOpen, setPackInfoOpen] = useState(false);
  const [packInfoTitle, setPackInfoTitle] = useState("");
  const [packInfoImg, setPackInfoImg] = useState("");
  const [packInfoLines, setPackInfoLines] = useState<string[]>([]);

  // reset při zavření
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

// ===== Autofill z profilu (jen jednou za otevření + nepřepisuje při psaní) =====
useEffect(() => {
  // reset po zavření
  if (!open) {
    didAutofillRef.current = false;
    return;
  }

  // autofill má smysl jen když je otevřený košík a jsme v checkoutu
  if (!authed) return;
  if (step !== "checkout") return;

  // jen jednou za otevření košíku
  if (didAutofillRef.current) return;
  didAutofillRef.current = true;

  let alive = true;

  (async () => {
    try {
      const p = await getMyProfile();
      if (!alive || !p) return;

      // ✅ doplň jen když je prázdné / nevalidní – jinak nech uživatele psát
      setName((prev) => (prev.trim() ? prev : String(p.full_name ?? "")));

      setPhone((prev) => {
        // když už je tel. validní, nech ho
        if (digitsOnly(prev).length === 9) return prev;

        const raw = String((p as any)?.phone ?? "");
        if (!raw) return prev;
        return formatPhoneCz(raw);
      });

      setAddress((prev) => (prev.trim() ? prev : String((p as any)?.address ?? "")));
    } catch {
      // ignore
    }
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

  // ====== Fees (UI) ======
  const itemsTotal = useMemo(() => cart.reduce((s, it) => s + it.cena * it.qty, 0), [cart]);
  const deliveryFee = deliveryMode === "delivery" && cartCount > 0 ? 10 : 0;

  function isSoupItem(it: CartItem) {
    const anyIt = it as any;
    const cat = (anyIt?.kategorie ?? anyIt?.category ?? "") as string;
    if (cat && /pol[eě]v/i.test(cat)) return true;
    return /pol[eě]v/i.test(it.nazev);
  }

  // REkrabička: 80 Kč / jídlo, polévka +7; Plast: jídlo 8 / polévka 7
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

    return 0; // own zdarma
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
        <div className="relative w-full max-w-md max-h-[80dvh] rounded-3xl bg-white shadow-2xl ring-1 ring-black/10 overflow-hidden">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-gray-100">
            <div className="text-[14px] font-extrabold text-gray-900">{title}</div>
            <button
              type="button"
              onClick={onClose}
              className="h-10 w-10 rounded-2xl bg-white ring-1 ring-black/10 hover:bg-gray-50 font-extrabold"
            >
              ✕
            </button>
          </div>

          <div className="p-3 space-y-2 overflow-auto max-h-[70dvh]">
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
                    "w-full text-left rounded-2xl px-4 py-3 ring-1 transition",
                    active ? "bg-green-50 ring-green-300/70" : "bg-white ring-black/10 hover:bg-gray-50",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[13px] font-extrabold text-gray-900">{o.label}</div>
                      {o.sub ? <div className="text-[12px] text-gray-500">{o.sub}</div> : null}
                    </div>
                    <div className="shrink-0 text-green-700 font-extrabold">{active ? "✓" : ""}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ✅ stabilní render – nepadá focus v inputech
  const RowPick = useCallback(
    ({ label, value, onClick }: { label: string; value: string; onClick: () => void }) => (
      <div className={pill + " p-3"}>
        <div className="flex items-center justify-between gap-3">
          <div className="text-[12px] font-extrabold text-gray-700">{label}</div>
          <button
            type="button"
            onClick={onClick}
            className="min-w-[170px] max-w-[220px] truncate rounded-2xl px-3 py-2 text-[12px] font-extrabold bg-green-50 text-green-800 ring-1 ring-green-200 hover:bg-green-100"
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
          <div className="text-[12px] font-extrabold text-gray-700 shrink-0">{label}</div>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            inputMode={inputMode}
            autoComplete={autoComplete}
            className="w-[210px] max-w-[210px] rounded-2xl bg-white ring-1 ring-black/10 px-3 py-2.5 text-[13px] font-semibold outline-none focus:ring-2 focus:ring-green-600"
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
          className="mt-2 w-full min-h-[70px] rounded-2xl bg-white ring-1 ring-black/10 px-3 py-3 text-[13px] font-semibold outline-none focus:ring-2 focus:ring-green-600"
        />
      </div>
    ),
    [pill]
  );

  // ===== TIME PREFS (modal) =====
  type DayTime = { from: string; to: string } | null;

  const [timeOpen, setTimeOpen] = useState(false);
  const [sameTimeForAll, setSameTimeForAll] = useState(false);
  const [activeTimeDay, setActiveTimeDay] = useState<string | null>(null);

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

  // vyhodnocení scroll hintu
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  if (!open) return null;

  // labels
  const deliveryLabel = deliveryMode === "delivery" ? "Doručení" : "Osobní odběr";
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

        <div className="relative w-full max-w-md max-h-[80dvh] rounded-3xl bg-white shadow-2xl ring-1 ring-black/10 overflow-hidden">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-gray-100">
            <div className="text-[14px] font-extrabold text-gray-900">Balení</div>
            <button
              type="button"
              onClick={() => setPickOpen(null)}
              className="h-10 w-10 rounded-2xl bg-white ring-1 ring-black/10 hover:bg-gray-50 font-extrabold"
            >
              ✕
            </button>
          </div>

          <div className="p-3 space-y-2 overflow-auto max-h-[70dvh]">
            {/* PLASTIC */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setPackagingMode("plastic");
                setPickOpen(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setPackagingMode("plastic");
                  setPickOpen(null);
                }
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

                  {packagingMode === "plastic" ? <div className="text-green-700 font-extrabold">✓</div> : null}
                </div>
              </div>
            </div>

            {/* REKRABIČKA */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setPackagingMode("rekrabicka");
                setPickOpen(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setPackagingMode("rekrabicka");
                  setPickOpen(null);
                }
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
                      setPackInfoLines(["Záloha 80 Kč za každé hlavní jídlo (1 krabička = 1 jídlo).", "Polévka +7 Kč."]);
                      setPackInfoOpen(true);
                    }}
                    className={infoBtn}
                    aria-label="Info"
                  >
                    i
                  </button>

                  {packagingMode === "rekrabicka" ? <div className="text-green-700 font-extrabold">✓</div> : null}
                </div>
              </div>
            </div>

            {/* OWN */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setPackagingMode("own");
                setPickOpen(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setPackagingMode("own");
                  setPickOpen(null);
                }
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

                  {packagingMode === "own" ? <div className="text-green-700 font-extrabold">✓</div> : null}
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 pt-0">
            <button
              type="button"
              onClick={() => setPickOpen(null)}
              className="w-full rounded-2xl px-4 py-3 text-[13px] font-extrabold bg-white ring-1 ring-black/10 hover:bg-gray-50"
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

      <div className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl ring-1 ring-black/10 overflow-hidden">
        {/* Header */}
        <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-gray-100">
          <div className="text-[14px] font-extrabold text-gray-900">
            {step === "cart" && "Košík"}
            {step === "checkout" && "Dokončení"}
            {step === "done" && "Hotovo"}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-2xl bg-white ring-1 ring-black/10 hover:bg-gray-50 font-extrabold"
          >
            ✕
          </button>
        </div>

        {/* ====== CART ====== */}
        {step === "cart" ? (
          <div className="relative">
            <div ref={scrollRef} onScroll={evalScrollHint} className="px-4 pt-3 pb-28 max-h-[70dvh] overflow-auto">
              {cartCount === 0 ? (
                <div className="rounded-2xl bg-neutral-50 ring-1 ring-black/10 p-3 text-[13px] text-gray-600">
                  Košík je prázdný.
                </div>
              ) : (
                <div className="space-y-2">
                  {grouped.map((g) => (
                    <div key={g.datum} className={pillSoft + " p-3"}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-[12px] font-extrabold text-gray-700">{formatCartDay(g.datum)}</div>

                        <div className="text-[11px] font-extrabold text-green-700 bg-white/80 ring-1 ring-green-200/70 px-2 py-1 rounded-full">
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
                              className="flex items-center gap-2 py-2 border-b border-green-200/50 last:border-b-0"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-[14px] font-extrabold text-gray-900 leading-snug break-words">
                                  {it.nazev}
                                </div>

                                <div className="mt-0.5 text-[12px] text-gray-500">
                                  {it.cena} Kč · {it.qty}× ={" "}
                                  <span className="font-extrabold text-green-700">{it.cena * it.qty} Kč</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => removeOne(it.datum, row)}
                                  disabled={it.qty === 0}
                                  className={qtyBtn}
                                >
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
              <div className="pointer-events-none absolute left-0 right-0 bottom-[84px]">
                <div className="h-10 bg-gradient-to-t from-white to-transparent" />
                <div className="flex justify-center -mt-6">
                  <div className="h-10 w-10 rounded-full bg-white/90 ring-1 ring-black/10 shadow flex items-center justify-center text-gray-700">
                    ↓
                  </div>
                </div>
              </div>
            ) : null}

            <div className="absolute left-0 right-0 bottom-0 bg-white border-t border-gray-100">
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

        {/* ====== CHECKOUT ====== */}
        {step === "checkout" ? (
          <div className="relative">
            <div className="px-4 pt-3 pb-44 max-h-[75dvh] overflow-auto">
              {!authed ? (
                <div className="rounded-2xl bg-yellow-50 text-yellow-800 ring-1 ring-yellow-200 p-3 text-[13px] font-bold">
                  Pro dokončení se musíš přihlásit.
                </div>
              ) : null}

              <div className="mt-3 space-y-2.5">
                <RowPick
                  label="Způsob převzetí"
                  value={deliveryMode === "delivery" ? "Doručení (Doprava 10 Kč)" : "Osobní odběr"}
                  onClick={() => setPickOpen("delivery")}
                />

                <RowInput label="Jméno" value={name} onChange={setName} placeholder="Vojtěch Pavlík" autoComplete="name" />
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

                {/* ✅ Preferuji čas doručení */}
                <div className={pill + " p-3"}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[12px] font-extrabold text-gray-700">Preferuji čas doručení</div>
                      <div className="text-[11px] text-gray-500">(volitelné)</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setTimeOpen(true)}
                      className="min-w-[170px] max-w-[220px] truncate rounded-2xl px-3 py-2 text-[12px] font-extrabold bg-green-50 text-green-800 ring-1 ring-green-200 hover:bg-green-100"
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
                    <div className="text-[12px] font-extrabold text-gray-700 mb-2">Rekapitulace</div>
                    <div className="text-[13px] text-gray-700 flex items-center justify-between">
                      <span>Jídla</span>
                      <span className="font-extrabold">{itemsTotal} Kč</span>
                    </div>
                    {deliveryFee > 0 ? (
                      <div className="text-[13px] text-gray-700 flex items-center justify-between">
                        <span>Doprava</span>
                        <span className="font-extrabold">{deliveryFee} Kč</span>
                      </div>
                    ) : null}
                    {packagingFee > 0 ? (
                      <div className="text-[13px] text-gray-700 flex items-center justify-between">
                        <span>Balení</span>
                        <span className="font-extrabold">{packagingFee} Kč</span>
                      </div>
                    ) : null}
                    <div className="mt-2 pt-2 border-t border-green-200/60 flex items-center justify-between">
                      <span className="text-[12px] font-bold text-gray-600">Celkem</span>
                      <span className="text-[16px] font-extrabold text-green-700">{payTotal} Kč</span>
                    </div>
                  </div>
                ) : null}

                {msg ? (
                  <div className="rounded-2xl bg-neutral-50 text-neutral-700 ring-1 ring-black/10 px-3 py-2 text-[12px] font-bold">
                    {msg}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="absolute left-0 right-0 bottom-0 bg-white border-t border-gray-100">
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
                  <button type="button" onClick={onNeedLogin} className={btnGhost + " w-full mt-2"}>
                    Přihlásit se
                  </button>
                ) : null}
              </div>
            </div>

            {/* Pickers */}
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

        {/* ✅ TIME PREFS MODAL */}
        {timeOpen ? (
          <div className="fixed inset-0 z-[275] flex items-center justify-center p-4">
            <button
              type="button"
              onClick={() => setTimeOpen(false)}
              className="absolute inset-0 bg-black/40"
              aria-label="Zavřít"
            />

            <div className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl ring-1 ring-black/10 overflow-hidden">
              <div className="px-4 pt-3 pb-2 flex items-start justify-between border-b border-gray-100">
                <div>
                  <div className="text-[18px] font-extrabold text-gray-900">Čas doručení</div>
                  <div className="text-[12px] font-semibold text-gray-600">10:00 – 13:30 (po 30 min) • (volitelné)</div>
                </div>

                <button
                  type="button"
                  onClick={() => setTimeOpen(false)}
                  className="h-10 w-10 rounded-2xl bg-white ring-1 ring-black/10 hover:bg-gray-50 font-extrabold"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 space-y-3">
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
                  <label className="flex items-center gap-2 text-[13px] font-semibold text-gray-700 select-none">
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
                            ? "bg-green-50 ring-green-300/70 text-green-800"
                            : "bg-white ring-black/10 hover:bg-gray-50 text-gray-900",
                        ].join(" ")}
                        disabled={!activeTimeDay}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setTimeOpen(false)}
                    className="rounded-2xl px-6 py-3 text-[13px] font-extrabold bg-green-600 text-white hover:bg-green-700"
                  >
                    Hotovo
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* ====== DONE ====== */}
        {step === "done" ? (
          <div className="px-4 pb-4">
            <div className="mt-3 rounded-2xl bg-green-50 text-green-800 ring-1 ring-green-200 p-4">
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
/** ===================== Main MobileView ===================== */
export default function MobileView({
  onOpenCart,
}: {
  onOpenCart: () => void;
}) {
  const router = useRouter();

  type Section = "daily" | "order" | "shop" | "canteen" | "about";
  const [activeSection, setActiveSection] = useState<Section>("daily");

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

  // user
  const [userName, setUserName] = useState("");
  const [credit, setCredit] = useState(0);
  const [authed, setAuthed] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const [role, setRole] = useState<"customer" | "staff">("customer");
  const [menuOpen, setMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  // cart
  const [cartOpen, setCartOpen] = useState(false);

  // allergens modal
  const [algOpen, setAlgOpen] = useState(false);
  const [algTitle, setAlgTitle] = useState("");
  const [algList, setAlgList] = useState<string[]>([]);

  // system items
  const [systemItems, setSystemItems] = useState<SystemItemRow[]>([]);
  const [loadingSystemItems, setLoadingSystemItems] = useState(true);

  // order context
  const { cart, cartCount, total, keyFor, addOne, removeOne } = useOrder();

  // close dropdown on outside / esc
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

  // auth load
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

  // system items load
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

  // ===== week & days =====
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

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const todayIso = toISODateLocal(new Date());
    return tabDays.includes(todayIso) ? todayIso : tabDays[0];
  });

  useEffect(() => {
    const todayIso = toISODateLocal(new Date());
    setSelectedDate(tabDays.includes(todayIso) ? todayIso : tabDays[0]);
  }, [tabDays]);

  const zavreno = isSunday(selectedDate);
  const rangeLabel = useMemo(
    () => formatRangeShort(tabDays[0], tabDays[tabDays.length - 1]),
    [tabDays]
  );

  // ===== load menu (DB) =====
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

  function getTodayHoursFromRows(rows: SystemItemRow[]) {
    const d = new Date();
    const day = d.getDay();

    let key = "sun";
    if (day === 1) key = "mon";
    else if (day === 2) key = "tue";
    else if (day === 3) key = "wed";
    else if (day === 4) key = "thu";
    else if (day === 5) key = "fri";
    else if (day === 6) key = "sat";

    const row = rows.find((x) => x.item_key === key && x.is_active);
    if (!row?.value_text) return null;
    return `dnes ${row.value_text}`;
  }

  const shopHoursToday = useMemo(
    () => getTodayHoursFromRows(shopHoursRows),
    [shopHoursRows]
  );

  const canteenHoursToday = useMemo(
    () => getTodayHoursFromRows(canteenHoursRows),
    [canteenHoursRows]
  );

  const dayBtn = (active: boolean) =>
    [
      "h-10 rounded-2xl px-2 text-[12px] font-extrabold ring-1 transition",
      active
        ? "bg-green-600 text-white ring-green-600"
        : "bg-white text-gray-900 ring-black/10 hover:bg-gray-50",
    ].join(" ");

  const qtyBtn =
    "h-8 w-8 rounded-xl bg-white ring-1 ring-black/10 text-gray-900 font-extrabold hover:bg-gray-50 active:scale-[0.98] disabled:opacity-40";

  const addBtn =
    "rounded-xl px-3 py-2 text-[12px] font-extrabold transition ring-1 ring-green-600/70 text-green-700 bg-white hover:bg-green-600 hover:text-white hover:ring-green-600";

  function UserArea() {
    if (!authed) {
      return (
        <button
          type="button"
          onClick={() => setAuthOpen(true)}
          className="rounded-2xl px-3 py-2 text-[12px] font-extrabold bg-green-600 text-white hover:bg-green-700"
        >
          Přihlásit
        </button>
      );
    }

    const name = userName.trim() || "Uživatel";

    return (
      <div className="relative flex items-center gap-2" ref={userMenuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="max-w-[220px] truncate rounded-2xl px-3 py-2 text-[12px] font-extrabold bg-white ring-1 ring-black/10 hover:bg-gray-50"
          title={name}
        >
          <span className="truncate">
            {name}
            {credit > 0 ? ` · ${credit} Kč` : ""}
          </span>
          <span className="ml-2 inline-block opacity-80">▾</span>
        </button>

        {menuOpen ? (
          <div className="absolute right-0 top-[44px] w-64 rounded-2xl bg-white shadow-xl ring-1 ring-black/10 overflow-hidden z-[120]">
            {role === "staff" ? (
              <>
                <div className="px-4 pt-3 pb-2 text-[11px] font-extrabold text-gray-500">PERSONÁL</div>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/staff");
                  }}
                  className="w-full text-left px-4 py-3 text-sm font-extrabold hover:bg-gray-50"
                >
                  Rozcestník
                </button>
                <div className="h-px bg-gray-100" />
              </>
            ) : null}

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                router.push("/profil");
              }}
              className="w-full text-left px-4 py-3 text-sm font-extrabold hover:bg-gray-50"
            >
              Nastavení profilu
            </button>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                router.push("/kredit");
              }}
              className="w-full text-left px-4 py-3 text-sm font-extrabold hover:bg-gray-50"
            >
              Dobít kredit
            </button>

            <div className="h-px bg-gray-100" />

            <button
              type="button"
              onClick={signOut}
              className="w-full text-left px-4 py-3 text-sm font-extrabold text-red-600 hover:bg-red-50"
            >
              Odhlásit
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  function TopTabs() {
    const tabBase =
      "rounded-2xl px-3 py-2 text-[12px] font-extrabold ring-1 transition whitespace-nowrap";
    const active = "bg-green-600 text-white ring-green-600";
    const normal = "bg-white text-gray-900 ring-black/10 hover:bg-gray-50";

    const Tab = ({
      id,
      label,
      sub,
      icon,
    }: {
      id: Section;
      label: string;
      sub?: string | null;
      icon: string;
    }) => (
      <button
        type="button"
        onClick={() => setActiveSection(id)}
        className={`${tabBase} ${activeSection === id ? active : normal}`}
      >
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <span>{label}</span>
        </div>
        {sub ? <div className="mt-0.5 text-[10px] font-bold opacity-80">{sub}</div> : null}
      </button>
    );

    return (
      <div className="overflow-x-auto no-scrollbar">
        <div className="flex gap-2 min-w-max">
          <Tab id="daily" label="Denní menu" icon="📋" />
          <Tab id="order" label="Objednávka" icon="🍽️" />
          <Tab id="shop" label="Obchod" icon="🛒" sub={shopHoursToday} />
          <Tab id="canteen" label="Jídelna" icon="🏠" sub={canteenHoursToday} />
          <Tab id="about" label="O nás" icon="ℹ️" />
        </div>
      </div>
    );
  }

  function MenuList({ mode }: { mode: "daily" | "order" }) {
    if (loadingMenu) {
      return (
        <div className="rounded-3xl bg-white ring-1 ring-black/10 p-4 text-[13px] text-gray-500">
          Načítám menu…
        </div>
      );
    }

    if (err) {
      return (
        <div className="rounded-3xl bg-white ring-1 ring-black/10 p-4 text-[13px] font-bold text-red-600">
          {err}
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="rounded-3xl bg-white ring-1 ring-black/10 p-4 text-[13px] text-gray-500">
          Zatím nebylo zveřejněné menu.
        </div>
      );
    }

    return (
      <div className="space-y-2.5">
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
          const allergenList = allergenNamesFromColumn(r.jidla?.alergeny ?? "");

          return (
            <div
              key={k}
              className={
                "rounded-3xl px-4 py-3 transition ring-1 shadow-sm " +
                (qty > 0
                  ? "bg-green-50 ring-green-300/70"
                  : "bg-white ring-black/10")
              }
            >
              <div className="flex justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {r.jidla?.kategorie ? (
                    <div className="text-[11px] font-bold text-green-700">
                      {r.jidla.kategorie}
                    </div>
                  ) : null}

                  <div className="mt-0.5 text-[15px] font-extrabold text-[#1f2f56] leading-snug break-words">
                    {title}
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <div className="text-[14px] font-extrabold text-green-700">
                      {price} Kč
                    </div>

                    {allergenList.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAlgTitle(title);
                          setAlgList(allergenList);
                          setAlgOpen(true);
                        }}
                        className="h-6 w-6 rounded-full border border-[#7ac796] bg-white text-[11px] font-extrabold text-[#067647]"
                        title="Alergeny"
                      >
                        i
                      </button>
                    ) : null}
                  </div>
                </div>

                {mode === "order" ? (
                  <div className="flex flex-col items-end justify-center gap-2 shrink-0">
                    {qty === 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (zavreno) return;
                          addOne(selectedDate, row);
                        }}
                        className={addBtn}
                      >
                        Přidat
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => removeOne(selectedDate, row)}
                          className={qtyBtn}
                          disabled={qty === 0}
                        >
                          −
                        </button>
                        <div className="w-6 text-center text-[12px] font-extrabold">{qty}</div>
                        <button type="button" onClick={() => addOne(selectedDate, row)} className={qtyBtn}>
                          +
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function HoursPanel({
    title,
    folder,
    keys,
    hours,
  }: {
    title: string;
    folder: string;
    keys: string[];
    hours: SystemItemRow[];
  }) {
    return (
      <div className="space-y-3">
        <div className="rounded-3xl bg-white ring-1 ring-black/10 p-4 shadow-sm">
          <div className="text-xl font-extrabold text-green-700">{title}</div>
        </div>

        <div className="space-y-3">
          {keys.map((k) => (
            <div
              key={k}
              className="rounded-3xl overflow-hidden bg-white ring-1 ring-black/10 shadow-sm"
            >
              <img src={`${folder}/${k}`} alt={k} className="w-full h-52 object-cover" />
            </div>
          ))}
        </div>

        <div className="rounded-3xl bg-[#f7fbf8] p-4 ring-1 ring-green-100 shadow-sm">
          <div className="text-xl font-extrabold text-green-700">Otevírací doba</div>

          <div className="mt-3 grid gap-2">
            {loadingSystemItems ? (
              <div className="text-[13px] font-semibold text-gray-500">Načítám…</div>
            ) : hours.length === 0 ? (
              <div className="text-[13px] font-semibold text-gray-500">
                Otevírací doba zatím není vyplněná.
              </div>
            ) : (
              hours.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-green-100"
                >
                  <div className="text-[14px] font-extrabold text-[#1f2f56]">
                    {row.label ?? "Den"}
                  </div>
                  <div className="text-[14px] font-semibold text-gray-700 text-right">
                    {row.value_text ?? "—"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  function AboutPanel() {
    return (
      <div className="space-y-3">
        <div className="rounded-3xl bg-white ring-1 ring-black/10 p-4 shadow-sm">
          <div className="text-xl font-extrabold text-green-700">O nás</div>

          <div className="mt-3 text-[14px] leading-7 text-gray-600 whitespace-pre-line">
            {loadingSystemItems
              ? "Načítám text…"
              : aboutTextRow?.value_text || "Text zatím nebyl vyplněn."}
          </div>
        </div>

        <div className="rounded-3xl bg-green-50 px-4 py-4 ring-1 ring-green-100 shadow-sm">
          <div className="text-[12px] font-extrabold uppercase tracking-wide text-green-700">
            Adresa
          </div>
          <div className="mt-1 text-[14px] font-semibold text-gray-700">
            Havlíčkova 72, 29001, Poděbrady
          </div>
        </div>
      </div>
    );
  }

  function FixedCartBar() {
    if (activeSection !== "order") return null;

    return (
      <div className="fixed left-0 right-0 z-40" style={{ bottom: 20 }}>
        <div className="max-w-md mx-auto px-3">
          <div className="rounded-2xl bg-white shadow-lg ring-1 ring-black/10 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-gray-600">Objednávka</div>
                <div className="text-[13px] font-extrabold text-gray-900">
                  {cartCount} ks · {total} Kč
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCartOpen(true)}
                disabled={cartCount === 0}
                className="rounded-2xl px-4 py-2.5 text-[13px] font-extrabold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                Pokračovat →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const contentPadBottom = activeSection === "order" ? "pb-[110px]" : "pb-6";

  return (
    <div className={`min-h-[100dvh] bg-white ${contentPadBottom}`}>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <AllergensModal open={algOpen} onClose={() => setAlgOpen(false)} title={algTitle} allergens={algList} />

      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        authed={authed}
        onNeedLogin={() => setAuthOpen(true)}
        credit={credit}
      />

      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-md mx-auto px-3 py-3">
          <div className="flex items-start gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-12 w-12 rounded-3xl bg-white ring-1 ring-black/10 overflow-hidden flex items-center justify-center shrink-0">
                <Image src="/logo.png" alt="Jiřka" width={48} height={48} />
              </div>

              <div className="min-w-0">
                <div className="text-2xl font-extrabold text-green-700 leading-none">Jiřka</div>
                <div className="mt-1 text-[12px] text-gray-500">Jídelna • Zdravá výživa • Obchod</div>
                <div className="text-[12px] font-medium text-gray-500">Havlíčkova 72, Poděbrady</div>
              </div>
            </div>

            <div className="ml-auto shrink-0">
              <UserArea />
            </div>
          </div>

          <div className="mt-4 h-1 w-24 rounded-full bg-yellow-400" />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto px-3 py-3 space-y-3">
        <TopTabs />

        {(activeSection === "daily" || activeSection === "order") && (
          <>
            <div className="rounded-3xl ring-1 ring-black/10 bg-white shadow-sm px-3 py-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                disabled={weekOffset === 0}
                className="h-10 w-10 rounded-2xl bg-white ring-1 ring-black/10 font-extrabold text-gray-900 disabled:opacity-40"
              >
                ‹
              </button>

              <div className="min-w-0 text-center">
                <div className="text-[13px] font-extrabold text-gray-900">{rangeLabel}</div>
              </div>

              <button
                type="button"
                onClick={() => setWeekOffset(1)}
                disabled={weekOffset === 1}
                className="h-10 w-10 rounded-2xl bg-white ring-1 ring-black/10 font-extrabold text-gray-900 disabled:opacity-40"
              >
                ›
              </button>
            </div>

            <div className="rounded-3xl ring-1 ring-black/10 bg-white shadow-sm px-3 py-3">
              <div className="grid grid-cols-6 gap-2">
                {tabDays.map((d) => (
                  <button key={d} type="button" onClick={() => setSelectedDate(d)} className={dayBtn(d === selectedDate)}>
                    {formatDayShort(d)}
                  </button>
                ))}
              </div>
            </div>

            {zavreno ? (
              <div className="rounded-2xl bg-red-50 ring-2 ring-red-200/60 p-3 text-red-700 font-semibold">
                V neděli je zavřeno.
              </div>
            ) : null}
          </>
        )}

        {activeSection === "daily" && <MenuList mode="daily" />}
        {activeSection === "order" && <MenuList mode="order" />}

        {activeSection === "shop" && (
          <HoursPanel
            title="Obchod & Zdravá výživa"
            folder="/fotky"
            keys={["obchod-1.jpg", "obchod-2.jpg", "obchod-3.jpg"]}
            hours={shopHoursRows}
          />
        )}

        {activeSection === "canteen" && (
          <HoursPanel
            title="Jídelna"
            folder="/fotky"
            keys={["jidelna-1.jpg", "jidelna-2.jpg", "jidelna-3.jpg"]}
            hours={canteenHoursRows}
          />
        )}

        {activeSection === "about" && <AboutPanel />}
      </div>

      <FixedCartBar />
    </div>
  );
}