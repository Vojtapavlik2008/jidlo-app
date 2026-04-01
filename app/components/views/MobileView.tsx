"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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

function formatMoney(n: number) {
  return `${Math.round(Number(n || 0))} Kč`;
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

type OrderSummaryRow = {
  id: string;
  created_at: string | null;
  total: number | null;
  status: string | null;
  delivery_mode: string | null;
};

type MobileViewProps = {
  onOpenCart?: () => void;
};

type LanguageCode = "cs" | "en" | "uk" | "de" | "es";

/** ===================== Reusable UI ===================== */
function CheckIcon({ show }: { show: boolean }) {
  if (!show) return <span className="inline-flex h-5 w-5" />;
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-[11px] font-extrabold text-white">
      ✓
    </span>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-7 w-12 items-center rounded-full transition",
        checked ? "bg-green-600" : "bg-gray-300",
      ].join(" ")}
      aria-pressed={checked}
    >
      <span
        className={[
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
          checked ? "translate-x-6" : "translate-x-1",
        ].join(" ")}
      />
    </button>
  );
}

function BaseModal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center p-4">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/40" aria-label="Zavřít" />
      <div className={`relative w-full ${maxWidth} overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/10`}>
        <div className="flex items-center justify-between border-b border-gray-100 px-4 pb-2 pt-3">
          <div className="text-[15px] font-extrabold text-gray-900">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-2xl bg-white font-extrabold ring-1 ring-black/10 hover:bg-gray-50"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** ===================== Auth Modal ===================== */
function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [password2, setPassword2] = useState("");
  const [agree, setAgree] = useState(false);

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
      setPassword2("");
    } catch (e: any) {
      setMsg(e?.message ?? "Chyba při registraci");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const emailOk = /\S+@\S+\.\S+/.test(email.trim());
  const fullNameOk = fullName.trim().length >= 2;
  const phoneOk = digitsOnly(phone).length === 9;
  const addressOk = address.trim().length >= 5;
  const passwordOk = password.length >= 6;
  const password2Ok = password2 === password && password2.length >= 6;

  const canRegister =
    emailOk && fullNameOk && phoneOk && addressOk && passwordOk && password2Ok && agree;

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
            <div className="flex items-center gap-2 rounded-2xl bg-white px-3 ring-1 ring-black/10 focus-within:ring-2 focus-within:ring-green-600">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@domena.cz"
                inputMode="email"
                autoComplete="email"
                className="h-11 flex-1 bg-transparent text-sm font-semibold outline-none"
              />
              <CheckIcon show={emailOk} />
            </div>
          </label>

          <label className="block">
            <div className="mb-1 text-[11px] font-extrabold text-gray-600">Heslo</div>
            <div className="flex items-center gap-2 rounded-2xl bg-white px-3 ring-1 ring-black/10 focus-within:ring-2 focus-within:ring-green-600">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                type="password"
                autoComplete={tab === "login" ? "current-password" : "new-password"}
                className="h-11 flex-1 bg-transparent text-sm font-semibold outline-none"
              />
              <CheckIcon show={tab === "login" ? password.length > 0 : passwordOk} />
            </div>
          </label>

          {tab === "register" ? (
            <>
              <label className="block">
                <div className="mb-1 text-[11px] font-extrabold text-gray-600">Jméno a příjmení</div>
                <div className="flex items-center gap-2 rounded-2xl bg-white px-3 ring-1 ring-black/10 focus-within:ring-2 focus-within:ring-green-600">
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Vojtěch Pavlík"
                    autoComplete="name"
                    className="h-11 flex-1 bg-transparent text-sm font-semibold outline-none"
                  />
                  <CheckIcon show={fullNameOk} />
                </div>
              </label>

              <label className="block">
                <div className="mb-1 text-[11px] font-extrabold text-gray-600">Telefon</div>
                <div className="flex items-center gap-2 rounded-2xl bg-white px-3 ring-1 ring-black/10 focus-within:ring-2 focus-within:ring-green-600">
                  <input
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneCz(e.target.value))}
                    placeholder="777 777 777"
                    inputMode="numeric"
                    autoComplete="tel"
                    className="h-11 flex-1 bg-transparent text-sm font-semibold outline-none"
                  />
                  <CheckIcon show={phoneOk} />
                </div>
              </label>

              <label className="block">
                <div className="mb-1 text-[11px] font-extrabold text-gray-600">Adresa</div>
                <div className="flex items-center gap-2 rounded-2xl bg-white px-3 ring-1 ring-black/10 focus-within:ring-2 focus-within:ring-green-600">
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Ulice 1, Poděbrady"
                    autoComplete="street-address"
                    className="h-11 flex-1 bg-transparent text-sm font-semibold outline-none"
                  />
                  <CheckIcon show={addressOk} />
                </div>
              </label>

              <label className="block">
                <div className="mb-1 text-[11px] font-extrabold text-gray-600">Heslo znovu</div>
                <div className="flex items-center gap-2 rounded-2xl bg-white px-3 ring-1 ring-black/10 focus-within:ring-2 focus-within:ring-green-600">
                  <input
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    placeholder="••••••••"
                    type="password"
                    autoComplete="new-password"
                    className="h-11 flex-1 bg-transparent text-sm font-semibold outline-none"
                  />
                  <CheckIcon show={password2Ok} />
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-2xl bg-green-50 px-3 py-3 ring-1 ring-green-100">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  className="mt-1"
                />
                <div className="text-[12px] font-semibold text-gray-700">
                  Souhlasím s podmínkami a se zpracováním osobních údajů.
                </div>
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
            disabled={busy || !emailOk || !passwordOk || (tab === "register" && !canRegister)}
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

/** ===================== Settings modals ===================== */
function ChangePasswordModal({
  open,
  onClose,
  email,
}: {
  open: boolean;
  onClose: () => void;
  email: string;
}) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function savePassword() {
    setBusy(true);
    setMsg(null);
    try {
      if (newPassword.length < 6) {
        setMsg("Nové heslo musí mít alespoň 6 znaků.");
        return;
      }
      if (newPassword !== newPassword2) {
        setMsg("Nová hesla se neshodují.");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setMsg(error.message);
        return;
      }

      setMsg("Heslo bylo změněno.");
      setOldPassword("");
      setNewPassword("");
      setNewPassword2("");
    } catch (e: any) {
      setMsg(e?.message ?? "Nepovedlo se změnit heslo.");
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    setBusy(true);
    setMsg(null);
    try {
      if (!email) {
        setMsg("Chybí email u profilu.");
        return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}` : undefined,
      });
      if (error) {
        setMsg(error.message);
        return;
      }
      setMsg("Na email byl odeslán odkaz pro obnovu hesla.");
    } catch (e: any) {
      setMsg(e?.message ?? "Nepovedlo se odeslat email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <BaseModal open={open} onClose={onClose} title="Změnit heslo">
      <div className="space-y-3 p-4">
        <label className="block">
          <div className="mb-1 text-[11px] font-extrabold text-gray-600">Staré heslo</div>
          <input
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            type="password"
            className="w-full rounded-2xl bg-white px-3 py-3 text-sm font-semibold outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-green-600"
          />
        </label>

        <label className="block">
          <div className="mb-1 text-[11px] font-extrabold text-gray-600">Nové heslo</div>
          <input
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            type="password"
            className="w-full rounded-2xl bg-white px-3 py-3 text-sm font-semibold outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-green-600"
          />
        </label>

        <label className="block">
          <div className="mb-1 text-[11px] font-extrabold text-gray-600">Nové heslo znovu</div>
          <input
            value={newPassword2}
            onChange={(e) => setNewPassword2(e.target.value)}
            type="password"
            className="w-full rounded-2xl bg-white px-3 py-3 text-sm font-semibold outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-green-600"
          />
        </label>

        <button
          type="button"
          onClick={forgotPassword}
          className="text-[12px] font-bold text-gray-600 underline underline-offset-4"
        >
          Zapomenuté heslo
        </button>

        {msg ? (
          <div className="rounded-2xl bg-neutral-50 px-3 py-2 text-[12px] font-bold text-neutral-700 ring-1 ring-black/10">
            {msg}
          </div>
        ) : null}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl bg-white px-4 py-3 text-[13px] font-extrabold ring-1 ring-black/10 hover:bg-gray-50"
          >
            Zpět
          </button>
          <button
            type="button"
            onClick={savePassword}
            disabled={busy}
            className="flex-1 rounded-2xl bg-green-600 px-4 py-3 text-[13px] font-extrabold text-white hover:bg-green-700 disabled:opacity-50"
          >
            Uložit
          </button>
        </div>
      </div>
    </BaseModal>
  );
}

function NotificationsModal({
  open,
  onClose,
  news,
  setNews,
  survey,
  setSurvey,
  review,
  setReview,
}: {
  open: boolean;
  onClose: () => void;
  news: boolean;
  setNews: (v: boolean) => void;
  survey: boolean;
  setSurvey: (v: boolean) => void;
  review: boolean;
  setReview: (v: boolean) => void;
}) {
  return (
    <BaseModal open={open} onClose={onClose} title="Oznámení">
      <div className="space-y-3 p-4">
        <div className="rounded-2xl bg-white p-3 ring-1 ring-black/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[13px] font-extrabold text-gray-900">Novinky a akční nabídky</div>
              <div className="mt-1 text-[12px] text-gray-500">E-mail</div>
            </div>
            <Toggle checked={news} onChange={setNews} />
          </div>
        </div>

        <div className="rounded-2xl bg-white p-3 ring-1 ring-black/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[13px] font-extrabold text-gray-900">Dotazník spokojenosti</div>
              <div className="mt-1 text-[12px] text-gray-500">Ohodnoťte, jak se vám líbí Jiřka.</div>
            </div>
            <Toggle checked={survey} onChange={setSurvey} />
          </div>
        </div>

        <div className="rounded-2xl bg-white p-3 ring-1 ring-black/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[13px] font-extrabold text-gray-900">Hodnocení o zakoupeném produktu</div>
              <div className="mt-1 text-[12px] text-gray-500">Krátké hodnocení po nákupu jídla.</div>
            </div>
            <Toggle checked={review} onChange={setReview} />
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-2xl bg-green-600 px-4 py-3 text-[13px] font-extrabold text-white hover:bg-green-700"
        >
          Hotovo
        </button>
      </div>
    </BaseModal>
  );
}

function LanguageModal({
  open,
  onClose,
  value,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  value: LanguageCode;
  onPick: (v: LanguageCode) => void;
}) {
  const items: { id: LanguageCode; label: string; flag: string }[] = [
    { id: "cs", label: "Čeština", flag: "🇨🇿" },
    { id: "en", label: "English", flag: "🇬🇧" },
    { id: "uk", label: "Українська", flag: "🇺🇦" },
    { id: "de", label: "Deutsch", flag: "🇩🇪" },
    { id: "es", label: "Español", flag: "🇪🇸" },
  ];

  return (
    <BaseModal open={open} onClose={onClose} title="Jazyk">
      <div className="space-y-2 p-4">
        {items.map((item) => {
          const active = item.id === value;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onPick(item.id);
                onClose();
              }}
              className={[
                "flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left ring-1 transition",
                active ? "bg-green-50 ring-green-300/70" : "bg-white ring-black/10 hover:bg-gray-50",
              ].join(" ")}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{item.flag}</span>
                <span className="text-[13px] font-extrabold text-gray-900">{item.label}</span>
              </div>
              <span className="font-extrabold text-green-700">{active ? "✓" : ""}</span>
            </button>
          );
        })}
      </div>
    </BaseModal>
  );
}

function SettingsModal({
  open,
  onClose,
  userName,
  userEmail,
  phone,
  address,
  onSaved,
  darkMode,
  setDarkMode,
  onOpenPassword,
  onOpenNotifications,
  onOpenLanguage,
  onOpenTopUp,
  onOpenOrders,
}: {
  open: boolean;
  onClose: () => void;
  userName: string;
  userEmail: string;
  phone: string;
  address: string;
  onSaved: (payload: { full_name: string; phone: string; address: string }) => Promise<void>;
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  onOpenPassword: () => void;
  onOpenNotifications: () => void;
  onOpenLanguage: () => void;
  onOpenTopUp: () => void;
  onOpenOrders: () => void;
}) {
  const [name, setName] = useState(userName);
  const [phoneLocal, setPhoneLocal] = useState(phone);
  const [addressLocal, setAddressLocal] = useState(address);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(userName);
    setPhoneLocal(phone);
    setAddressLocal(address);
    setMsg(null);
  }, [open, userName, phone, address]);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await onSaved({
        full_name: name.trim(),
        phone: digitsOnly(phoneLocal).slice(0, 9),
        address: addressLocal.trim(),
      });
      setMsg("Profil byl uložen.");
    } catch (e: any) {
      setMsg(e?.message ?? "Nepovedlo se uložit profil.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <BaseModal open={open} onClose={onClose} title="Nastavení profilu">
      <div className="max-h-[78dvh] overflow-auto p-4">
        <div className="space-y-3">
          <label className="block">
            <div className="mb-1 text-[11px] font-extrabold text-gray-600">Jméno a příjmení</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl bg-white px-3 py-3 text-sm font-semibold outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-green-600"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-[11px] font-extrabold text-gray-600">Email</div>
            <input
              value={userEmail}
              readOnly
              className="w-full rounded-2xl bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-500 outline-none ring-1 ring-black/10"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-[11px] font-extrabold text-gray-600">Telefon</div>
            <input
              value={phoneLocal}
              onChange={(e) => setPhoneLocal(formatPhoneCz(e.target.value))}
              inputMode="numeric"
              className="w-full rounded-2xl bg-white px-3 py-3 text-sm font-semibold outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-green-600"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-[11px] font-extrabold text-gray-600">Adresa</div>
            <input
              value={addressLocal}
              onChange={(e) => setAddressLocal(e.target.value)}
              className="w-full rounded-2xl bg-white px-3 py-3 text-sm font-semibold outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-green-600"
            />
          </label>

          <button
            type="button"
            onClick={onOpenPassword}
            className="text-[12px] font-bold text-gray-600 underline underline-offset-4"
          >
            Změnit heslo
          </button>

          <div className="rounded-2xl bg-white p-3 ring-1 ring-black/10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-extrabold text-gray-900">Tmavý režim</div>
                <div className="mt-1 text-[12px] text-gray-500">
                  Přepnutí mezi světlým a tmavým vzhledem.
                </div>
              </div>
              <Toggle checked={darkMode} onChange={setDarkMode} />
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenNotifications}
            className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-left ring-1 ring-black/10 hover:bg-gray-50"
          >
            <div>
              <div className="text-[13px] font-extrabold text-gray-900">Oznámení</div>
              <div className="mt-1 text-[12px] text-gray-500">Novinky, dotazníky a hodnocení</div>
            </div>
            <div className="font-extrabold text-gray-500">›</div>
          </button>

          <button
            type="button"
            onClick={onOpenTopUp}
            className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-left ring-1 ring-black/10 hover:bg-gray-50"
          >
            <div>
              <div className="text-[13px] font-extrabold text-gray-900">Dobít kredit</div>
              <div className="mt-1 text-[12px] text-gray-500">Rychlé dobití kreditu</div>
            </div>
            <div className="font-extrabold text-gray-500">›</div>
          </button>

          <button
            type="button"
            onClick={onOpenLanguage}
            className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-left ring-1 ring-black/10 hover:bg-gray-50"
          >
            <div>
              <div className="text-[13px] font-extrabold text-gray-900">Jazyk</div>
              <div className="mt-1 text-[12px] text-gray-500">Vyber jazyk zobrazení</div>
            </div>
            <div className="font-extrabold text-gray-500">›</div>
          </button>

          <button
            type="button"
            onClick={onOpenOrders}
            className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-left ring-1 ring-black/10 hover:bg-gray-50"
          >
            <div>
              <div className="text-[13px] font-extrabold text-gray-900">Objednávky</div>
              <div className="mt-1 text-[12px] text-gray-500">Přehled posledních objednávek</div>
            </div>
            <div className="font-extrabold text-gray-500">›</div>
          </button>

          {msg ? (
            <div className="rounded-2xl bg-neutral-50 px-3 py-2 text-[12px] font-bold text-neutral-700 ring-1 ring-black/10">
              {msg}
            </div>
          ) : null}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-2xl bg-white px-4 py-3 text-[13px] font-extrabold ring-1 ring-black/10 hover:bg-gray-50"
            >
              Zpět
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="flex-1 rounded-2xl bg-green-600 px-4 py-3 text-[13px] font-extrabold text-white hover:bg-green-700 disabled:opacity-50"
            >
              Uložit
            </button>
          </div>
        </div>
      </div>
    </BaseModal>
  );
}

function OrdersModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<OrderSummaryRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user?.id;
        if (!uid) {
          if (alive) setRows([]);
          return;
        }

        const { data, error } = await supabase
          .from("orders")
          .select("id, created_at, total, status, delivery_mode")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(20);

        if (!alive) return;

        if (error) {
          setRows([]);
          return;
        }

        setRows((data ?? []) as OrderSummaryRow[]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [open]);

  return (
    <BaseModal open={open} onClose={onClose} title="Objednávky">
      <div className="max-h-[75dvh] overflow-auto p-4">
        {loading ? (
          <div className="text-[13px] text-gray-500">Načítám…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-neutral-50 p-3 text-[13px] text-gray-600 ring-1 ring-black/10">
            Zatím tu nejsou žádné objednávky.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.id} className="rounded-2xl bg-white p-3 ring-1 ring-black/10">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13px] font-extrabold text-gray-900">Objednávka #{row.id.slice(0, 8)}</div>
                    <div className="mt-1 text-[12px] text-gray-500">
                      {row.created_at
                        ? new Date(row.created_at).toLocaleString("cs-CZ")
                        : "—"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[13px] font-extrabold text-green-700">
                      {formatMoney(Number(row.total ?? 0))}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">
                      {row.delivery_mode === "delivery" ? "Doručení" : "Osobní odběr"}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-2xl bg-green-600 px-4 py-3 text-[13px] font-extrabold text-white hover:bg-green-700"
        >
          Zavřít
        </button>
      </div>
    </BaseModal>
  );
}

function TopUpModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (amount: number, method: string) => void;
}) {
  const [amount, setAmount] = useState("500");
  const [method, setMethod] = useState("card");

  const n = Number(digitsOnly(amount) || 0);
  const valid = n >= 500;

  return (
    <BaseModal open={open} onClose={onClose} title="Dobít kredit">
      <div className="space-y-3 p-4">
        <label className="block">
          <div className="mb-1 text-[11px] font-extrabold text-gray-600">Zadat částku</div>
          <input
            value={amount}
            onChange={(e) => setAmount(digitsOnly(e.target.value))}
            inputMode="numeric"
            min={500}
            className="w-full rounded-2xl bg-white px-3 py-3 text-sm font-semibold outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-green-600"
            placeholder="Minimálně 500"
          />
          <div className="mt-1 text-[11px] text-gray-500">Minimálně 500 Kč</div>
        </label>

        <div className="rounded-2xl bg-white p-3 ring-1 ring-black/10">
          <div className="mb-2 text-[11px] font-extrabold text-gray-600">Vybrat platbu</div>
          <div className="space-y-2">
            {[
              { id: "card", label: "Zadat kartu" },
              { id: "applepay", label: "Apple Pay" },
              { id: "googlepay", label: "Google Pay" },
            ].map((x) => {
              const active = method === x.id;
              return (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => setMethod(x.id)}
                  className={[
                    "flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left ring-1 transition",
                    active ? "bg-green-50 ring-green-300/70" : "bg-white ring-black/10 hover:bg-gray-50",
                  ].join(" ")}
                >
                  <span className="text-[13px] font-extrabold text-gray-900">{x.label}</span>
                  <span className="font-extrabold text-green-700">{active ? "✓" : ""}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl bg-white px-4 py-3 text-[13px] font-extrabold ring-1 ring-black/10 hover:bg-gray-50"
          >
            Zpět
          </button>
          <button
            type="button"
            disabled={!valid}
            onClick={() => onConfirm(n, method)}
            className="flex-1 rounded-2xl bg-green-600 px-4 py-3 text-[13px] font-extrabold text-white hover:bg-green-700 disabled:opacity-50"
          >
            Zaplatit
          </button>
        </div>
      </div>
    </BaseModal>
  );
}

function FakeGatewayModal({
  open,
  onClose,
  onPay,
}: {
  open: boolean;
  onClose: () => void;
  onPay: () => void;
}) {
  return (
    <BaseModal open={open} onClose={onClose} title="Platba online">
      <div className="space-y-4 p-4">
        <div className="rounded-2xl bg-yellow-50 p-4 text-[13px] font-semibold text-yellow-800 ring-1 ring-yellow-200">
          Později přidáme platební bránu.
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl bg-white px-4 py-3 text-[13px] font-extrabold ring-1 ring-black/10 hover:bg-gray-50"
          >
            Zpět
          </button>
          <button
            type="button"
            onClick={onPay}
            className="flex-1 rounded-2xl bg-green-600 px-4 py-3 text-[13px] font-extrabold text-white hover:bg-green-700"
          >
            Zaplatit
          </button>
        </div>
      </div>
    </BaseModal>
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
  const router = useRouter();

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

  const [gatewayOpen, setGatewayOpen] = useState(false);

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
    setGatewayOpen(false);
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

        setName((prev) => (prev.trim() ? prev : String((p as any).full_name ?? "")));
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

  async function finalizeOrder() {
    setBusy(true);
    setMsg(null);
    try {
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
      setGatewayOpen(false);
    } catch (e: any) {
      setMsg(e?.message ?? "Nepovedlo se odeslat objednávku.");
    } finally {
      setBusy(false);
    }
  }

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

      if (payment === "card_online") {
        setGatewayOpen(true);
        return;
      }

      await finalizeOrder();
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
      inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
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

  const mapQuery = encodeURIComponent(address?.trim() || "Havlíčkova 72, Poděbrady");

  return (

    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/40" aria-label="Zavřít" />

      <div className="relative w-full max-w-[680px] overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/10">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 pb-2 pt-3">
          <div className="text-[14px] font-extrabold text-gray-900">
            {step === "cart" && "Košík"}
            {step === "checkout" && "Dokončení"}
            {step === "done" && "Souhrn objednávky"}
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
                  {grouped.map((g) => {
                    const dayCount = g.items.reduce((s, it) => s + it.qty, 0);
                    const dayTotal = g.items.reduce((s, it) => s + it.cena * it.qty, 0);

                    return (
                      <div key={g.datum} className={pillSoft + " p-3"}>
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <div className="rounded-xl bg-white px-2.5 py-1.5 text-[12px] font-extrabold text-[#1f2f56] ring-1 ring-black/10">
                            {formatCartDay(g.datum)}
                          </div>
                          <div className="rounded-xl bg-white px-2.5 py-1.5 text-[12px] font-extrabold text-green-700 ring-1 ring-green-200/80">
                            {dayCount} ks
                          </div>
                          <div className="rounded-xl bg-white px-2.5 py-1.5 text-[12px] font-extrabold text-green-700 ring-1 ring-green-200/80">
                            {dayTotal} Kč
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
                                  <div className="mt-0.5 text-[12px] font-bold text-green-700">
                                    {it.cena * it.qty} Kč
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
                    );
                  })}
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
          <div className="max-h-[78dvh] overflow-auto px-4 pb-4 pt-3">
            <div className="rounded-2xl bg-green-50 p-4 ring-1 ring-green-200">
              <div className="text-[16px] font-extrabold text-green-800">Souhrn objednávky</div>
              {orderId ? (
                <div className="mt-1 text-[12px] font-bold text-green-900/80">Objednávka #{orderId}</div>
              ) : null}
            </div>

            <div className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-black/10">
              <div className="text-[12px] font-extrabold uppercase tracking-wide text-gray-500">Fakturační údaje</div>
              <div className="mt-2 space-y-1 text-[14px] text-gray-800">
                <div><span className="font-extrabold">Jméno:</span> {name || "—"}</div>
                <div><span className="font-extrabold">Telefon:</span> {phone || "—"}</div>
                <div><span className="font-extrabold">Adresa:</span> {address || "—"}</div>
                <div><span className="font-extrabold">Platba:</span> {paymentLabel}</div>
                <div><span className="font-extrabold">Balení:</span> {packagingLabel}</div>
              </div>
            </div>

            <div className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-black/10">
              <div className="text-[12px] font-extrabold uppercase tracking-wide text-gray-500">Mapa</div>
              <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-black/10">
                <iframe
                  title="Mapa doručení"
                  src={`https://www.google.com/maps?q=${mapQuery}&z=15&output=embed`}
                  className="h-[220px] w-full border-0"
                  loading="lazy"
                />
              </div>
            </div>

            <div className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-black/10">
              <div className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-gray-500">Položky</div>
              <div className="space-y-2">
                {grouped.map((g) => (
                  <div key={g.datum} className="rounded-2xl bg-neutral-50 p-3 ring-1 ring-black/5">
                    <div className="mb-2 text-[12px] font-extrabold text-[#1f2f56]">{formatCartDay(g.datum)}</div>
                    {g.items.map((it) => (
                      <div key={it.key} className="flex items-center justify-between gap-3 py-1 text-[13px] text-gray-800">
                        <div className="min-w-0 flex-1">
                          {it.nazev} <span className="text-gray-500">× {it.qty}</span>
                        </div>
                        <div className="shrink-0 font-extrabold text-green-700">{it.cena * it.qty} Kč</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="mt-3 border-t border-gray-100 pt-3 text-[14px]">
                <div className="flex items-center justify-between">
                  <span>Jídla</span>
                  <span className="font-extrabold">{itemsTotal} Kč</span>
                </div>
                {deliveryFee > 0 ? (
                  <div className="mt-1 flex items-center justify-between">
                    <span>Doprava</span>
                    <span className="font-extrabold">{deliveryFee} Kč</span>
                  </div>
                ) : null}
                {packagingFee > 0 ? (
                  <div className="mt-1 flex items-center justify-between">
                    <span>Balení</span>
                    <span className="font-extrabold">{packagingFee} Kč</span>
                  </div>
                ) : null}
                <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
                  <span className="font-bold">Celkem</span>
                  <span className="text-[16px] font-extrabold text-green-700">{payTotal} Kč</span>
                </div>
              </div>
            </div>

            <div className="mt-3 text-center text-[11px] font-semibold text-gray-500">
              Pro změnu údajů v objednávce nás kontaktujte na tel. 325 612 154
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                router.push("/");
              }}
              className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-[13px] font-extrabold ring-1 ring-black/10 hover:bg-gray-50"
            >
              Přejít na hlavní stránku
            </button>
          </div>
        ) : null}

        <FakeGatewayModal
          open={gatewayOpen}
          onClose={() => setGatewayOpen(false)}
          onPay={finalizeOrder}
        />
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
            <div className="mt-0.5 text-[11px] font-semibold text-green-700">{weekText}</div>
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
              <div className="text-[10px] font-bold uppercase tracking-wide text-green-700">{weekText}</div>
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
              const today = isTodayIso(d);

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
                      : today
                      ? "bg-white text-gray-900 ring-2 ring-green-500 hover:bg-gray-50"
                      : "bg-white text-gray-900 ring-black/10 hover:bg-gray-50",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[13px] font-extrabold">{formatSelectedDaySmart(d)}</div>
                    {!active && today ? (
                      <div className="rounded-full bg-green-50 px-2 py-1 text-[10px] font-extrabold text-green-700 ring-1 ring-green-200">
                        Dnes
                      </div>
                    ) : null}
                  </div>
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
  const [userEmail, setUserEmail] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [userAddress, setUserAddress] = useState("");
  const [credit, setCredit] = useState(0);
  const [authed, setAuthed] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const [role, setRole] = useState<"customer" | "staff">("customer");
  const [menuOpen, setMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const [cartOpen, setCartOpen] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const [fakeTopupGatewayOpen, setFakeTopupGatewayOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);

  const [darkMode, setDarkMode] = useState(false);
  const [notifNews, setNotifNews] = useState(false);
  const [notifSurvey, setNotifSurvey] = useState(false);
  const [notifReview, setNotifReview] = useState(false);
  const [language, setLanguage] = useState<LanguageCode>("cs");

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
    const savedDark = typeof window !== "undefined" ? localStorage.getItem("jirka-dark-mode") : null;
    const savedLang = typeof window !== "undefined" ? localStorage.getItem("jirka-language") : null;
    const savedNews = typeof window !== "undefined" ? localStorage.getItem("jirka-notif-news") : null;
    const savedSurvey = typeof window !== "undefined" ? localStorage.getItem("jirka-notif-survey") : null;
    const savedReview = typeof window !== "undefined" ? localStorage.getItem("jirka-notif-review") : null;

    if (savedDark) setDarkMode(savedDark === "1");
    if (savedLang && ["cs", "en", "uk", "de", "es"].includes(savedLang)) {
      setLanguage(savedLang as LanguageCode);
    }
    if (savedNews) setNotifNews(savedNews === "1");
    if (savedSurvey) setNotifSurvey(savedSurvey === "1");
    if (savedReview) setNotifReview(savedReview === "1");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("jirka-dark-mode", darkMode ? "1" : "0");
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("jirka-language", language);
  }, [language]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("jirka-notif-news", notifNews ? "1" : "0");
    localStorage.setItem("jirka-notif-survey", notifSurvey ? "1" : "0");
    localStorage.setItem("jirka-notif-review", notifReview ? "1" : "0");
  }, [notifNews, notifSurvey, notifReview]);

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
        setUserEmail((p as any)?.email?.toString?.() ?? data.session?.user?.email ?? "");
        setUserPhone((p as any)?.phone?.toString?.() ?? "");
        setUserAddress((p as any)?.address?.toString?.() ?? "");
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
          setUserEmail((p as any)?.email?.toString?.() ?? sess?.user?.email ?? "");
          setUserPhone((p as any)?.phone?.toString?.() ?? "");
          setUserAddress((p as any)?.address?.toString?.() ?? "");
          setCredit(Number((p as any)?.kredit ?? 0) || 0);
          setRole(((p as any)?.role as any) === "staff" ? "staff" : "customer");
          setMenuOpen(false);
        } catch (e) {
          console.error(e);
        }
      })();
    });

    const onProfileUpdated = async () => {
      const { data } = await supabase.auth.getSession();
      const p = await getMyProfile();
      setUserName((p?.full_name ?? "").toString());
      setUserEmail((p as any)?.email?.toString?.() ?? data.session?.user?.email ?? "");
      setUserPhone((p as any)?.phone?.toString?.() ?? "");
      setUserAddress((p as any)?.address?.toString?.() ?? "");
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

  async function saveProfile(payload: { full_name: string; phone: string; address: string }) {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    const email = data.session?.user?.email ?? userEmail;

    if (!uid) throw new Error("Nejsi přihlášený.");

    const { error } = await supabase.from("profiles").upsert(
      {
        id: uid,
        full_name: payload.full_name || null,
        phone: payload.phone || null,
        address: payload.address || null,
        email: email || null,
      },
      { onConflict: "id" }
    );

    if (error) throw new Error(error.message);

    setUserName(payload.full_name);
    setUserPhone(payload.phone);
    setUserAddress(payload.address);
    window.dispatchEvent(new Event("profile-updated"));
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

  async function handleFakeTopupConfirm() {
    setFakeTopupGatewayOpen(false);
    setTopupOpen(false);
  }

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
          className="max-w-[235px] rounded-2xl bg-white px-3 py-2 text-right text-[11px] font-extrabold leading-[1.15] ring-1 ring-black/10 hover:bg-gray-50"
          title={`${name}${role !== "staff" ? ` • ${credit} Kč` : ""}`}
        >
          <span className="block whitespace-normal break-words text-[#1f2f56]">
            {name}
            {role !== "staff" ? ` • ${credit} Kč` : ""}
          </span>
          <span className="mt-0.5 inline-block opacity-80">▾</span>
        </button>

        {menuOpen ? (
          <div className="absolute right-0 top-[56px] z-[120] w-64 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/10">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setSettingsOpen(true);
              }}
              className="w-full px-4 py-3 text-left text-sm font-extrabold hover:bg-gray-50"
            >
              Nastavení
            </button>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setOrdersOpen(true);
              }}
              className="w-full px-4 py-3 text-left text-sm font-extrabold hover:bg-gray-50"
            >
              Objednávky
            </button>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setTopupOpen(true);
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
              Odhlásit se
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
      <div className="px-0.5 pt-0.5">
        <div className="flex items-start justify-between gap-3">
          <div className="text-[23px] font-extrabold leading-none text-green-700">Denní menu</div>

          <button
            type="button"
            onClick={() => setDayPickerOpen(true)}
            className="pt-1 text-right text-[13px] font-bold text-gray-700 underline decoration-1 underline-offset-4"
          >
            {formatSelectedDaySmart(selectedDate)}
          </button>
        </div>
      </div>
    );
  }

  function SectionHeaderOrder() {
    return (
      <div className="space-y-2.5 px-0.5 pt-0.5">
        <div className="text-[23px] font-extrabold leading-none text-green-700">Objednávka jídel</div>

        <div className="rounded-[24px] border border-[#dbeee2] bg-white px-3 py-3 shadow-sm ring-1 ring-green-100/70">
          <div className="grid grid-cols-[38px_1fr_38px] items-center gap-2">
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
              <div className="text-[9px] font-bold uppercase tracking-wide text-green-700">{weekText}</div>
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
              const today = isTodayIso(d);

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
                      : today
                      ? "bg-white text-gray-800 ring-2 ring-green-500 hover:bg-gray-50"
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
        <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-3">
          {photoSources.map((src) => (
            <div key={src} className="overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ring-black/10">
              <img src={src} alt="Jiřka" className="h-44 w-full object-cover min-[560px]:h-36" />
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
          <div className="mt-1 text-[14px] font-semibold text-gray-700">325 612 154</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-[100dvh] pb-40 ${darkMode ? "bg-[#0f172a]" : "bg-white"}`}>
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

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        userName={userName}
        userEmail={userEmail}
        phone={userPhone}
        address={userAddress}
        onSaved={saveProfile}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onOpenPassword={() => setPasswordOpen(true)}
        onOpenNotifications={() => setNotificationsOpen(true)}
        onOpenLanguage={() => setLanguageOpen(true)}
        onOpenTopUp={() => setTopupOpen(true)}
        onOpenOrders={() => setOrdersOpen(true)}
      />

      <ChangePasswordModal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        email={userEmail}
      />

      <NotificationsModal
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        news={notifNews}
        setNews={setNotifNews}
        survey={notifSurvey}
        setSurvey={setNotifSurvey}
        review={notifReview}
        setReview={setNotifReview}
      />

      <LanguageModal
        open={languageOpen}
        onClose={() => setLanguageOpen(false)}
        value={language}
        onPick={setLanguage}
      />

      <OrdersModal open={ordersOpen} onClose={() => setOrdersOpen(false)} />

      <TopUpModal
        open={topupOpen}
        onClose={() => setTopupOpen(false)}
        onConfirm={() => setFakeTopupGatewayOpen(true)}
      />

      <FakeGatewayModal
        open={fakeTopupGatewayOpen}
        onClose={() => setFakeTopupGatewayOpen(false)}
        onPay={handleFakeTopupConfirm}
      />

      <div className="sticky top-0 z-40 border-b border-black/5 bg-white/95 backdrop-blur">
        <div className="mx-auto w-full max-w-[680px] px-3 pb-2 pt-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Image
                src="/logo-na-mobil.png"
                alt="Jiřka"
                width={230}
                height={95}
                className="-ml-8 -mt-8 h-auto w-[200px] object-contain min-[560px]:w-[205px]"
                priority
              />
            </div>

            <div className="flex shrink-0 items-start gap-2 pt-1">
              <StaffShortcut />
              <UserArea />
            </div>
          </div>

          <div className="relative z-10 -mt-12 pl-10 text-[11px] font-semibold tracking-[0.01em] text-gray-500">
            rozvoz obědů po Poděbradech
          </div>

          <div className="mt-1 h-[3px] w-full rounded-full bg-green-600" />
        </div>
      </div>

      <div className="mx-auto w-full max-w-[680px] space-y-3 px-3 pb-3 pt-3">
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
          <div className="mx-auto w-full max-w-[680px] px-3">
            <button
              type="button"
              onClick={() => openCart()}
              className={[
                "w-full rounded-[22px] border px-4 py-3 text-left shadow-xl transition active:scale-[0.99]",
                cartCount > 0
                  ? "border-green-600 bg-green-600 text-white"
                  : "border-[#dbeee2] bg-white text-gray-900 hover:bg-gray-50",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-3">
                <div className={`text-[16px] font-extrabold ${cartCount > 0 ? "text-white" : "text-[#1f2f56]"}`}>
                  Objednávka
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
        <div className="mx-auto grid w-full max-w-[680px] grid-cols-5 text-[11px] font-semibold text-gray-600">
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
