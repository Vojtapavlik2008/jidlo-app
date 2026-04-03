"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getMyProfile } from "@/lib/auth";

import { useOrder } from "@/app/components/order/order-context";
import type { DbMenuRow } from "@/app/components/order/order-context";

/* ===================== Helpers ===================== */
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

function formatMoney(n: number) {
  return `${Math.round(Number(n || 0))} Kč`;
}

function isWithinTwoWeeksOrFuture(iso: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(iso + "T00:00:00");
  if (Number.isNaN(target.getTime())) return false;

  const diff = Math.floor((today.getTime() - target.getTime()) / 86400000);
  if (target >= today) return true;
  return diff <= 14;
}

function formatSelectedDaySmart(
  iso: string,
  t: (key: keyof typeof translations["cs"]) => string
) {
  if (!iso) return "";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(iso + "T00:00:00");
  if (Number.isNaN(target.getTime())) return "";
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  const dateTxt = formatDateShortNoLeadingZero(iso);

  if (diffDays === 0) return `${t("today")} · ${dateTxt}`;
  if (diffDays === 1) return `${t("tomorrow")} · ${dateTxt}`;
  return `${formatWeekdayOnlyLong(iso)} · ${dateTxt}`;
}

function orderDayHint(
  iso: string,
  t: (key: keyof typeof translations["cs"]) => string
) {
  const todayIso = toISODateLocal(new Date());

  if (isSunday(iso)) return t("closedSunday");
  if (iso < todayIso) return t("orderOnlyTodayFuture");
  if (iso === todayIso && !canAddToCartForDay(iso)) return t("todayUntil13");
  return null;
}

/* ===================== i18n ===================== */
const translations = {
  cs: {
    login: "Přihlášení",
    register: "Registrace",
    signIn: "Přihlásit",
    createAccount: "Vytvořit účet",
    email: "Email",
    password: "Heslo",
    fullName: "Jméno a příjmení",
    phone: "Telefon",
    address: "Adresa",
    agreeTerms: "Souhlasím s podmínkami a se zpracováním osobních údajů.",
    doneEmail: "Hotovo. Pokud máš potvrzení emailem, zkontroluj email. Pak se přihlas.",
    changePassword: "Změnit heslo",
    forgotPassword: "Zapomenuté heslo",
    oldPassword: "Staré heslo",
    newPassword: "Nové heslo",
    newPasswordAgain: "Nové heslo znovu",
    save: "Uložit",
    back: "Zpět",
    notifications: "Oznámení",
    newsOffers: "Novinky a akční nabídky",
    satisfactionSurvey: "Dotazník spokojenosti",
    productReview: "Hodnocení o zakoupeném produktu",
    weeklyMenuEmail: "Jídelníček na týden dopředu",
    weeklyMenuEmailSub: "Chci dostávat jídelníček v psané podobě e-mailem.",
    darkMode: "Tmavý režim",
    language: "Jazyk",
    topUpCredit: "Dobít kredit",
    orders: "Objednávky",
    settings: "Nastavení",
    personalData: "Osobní údaje",
    done: "Hotovo",
    pay: "Zaplatit",
    close: "Zavřít",
    today: "Dnes",
    tomorrow: "Zítra",
    closedSunday: "V neděli je zavřeno.",
    orderOnlyTodayFuture: "Objednávat lze jen na dnešek do 13:00 nebo na budoucí dny.",
    todayUntil13: "Na dnešek šlo objednat jen do 13:00.",
    dailyMenu: "Denní menu",
    orderMeals: "Objednávka jídel",
    menuShort: "Menu",
    orderShort: "Objednávka",
    cart: "Košík",
    jirka: "Jiřka",
    about: "O nás",
    add: "Přidat",
    loading: "Načítám…",
    noMenuYet: "Zatím nebylo zveřejněné menu.",
    routeTagline: "rozvoz obědů po Poděbradech",
    crossroads: "Rozcestník",
    logout: "Odhlásit se",
    noOrders: "Zatím tu nejsou žádné objednávky.",
    upcomingOrder: "Následující objednávka",
    pastOrder: "Vydaná objednávka",
    amount: "Zadat částku",
    min500: "Minimálně 500 Kč",
    choosePayment: "Vybrat platbu",
    cardEntry: "Zadat kartu",
    saveProfileOk: "Profil byl uložen.",
  },
  en: {
    login: "Login",
    register: "Register",
    signIn: "Sign in",
    createAccount: "Create account",
    email: "Email",
    password: "Password",
    fullName: "Full name",
    phone: "Phone",
    address: "Address",
    agreeTerms: "I agree to the terms and personal data processing.",
    doneEmail: "Done. Check your email if confirmation is needed, then sign in.",
    changePassword: "Change password",
    forgotPassword: "Forgot password",
    oldPassword: "Old password",
    newPassword: "New password",
    newPasswordAgain: "Repeat new password",
    save: "Save",
    back: "Back",
    notifications: "Notifications",
    newsOffers: "News and special offers",
    satisfactionSurvey: "Satisfaction survey",
    productReview: "Purchased product review",
    weeklyMenuEmail: "Weekly menu in advance",
    weeklyMenuEmailSub: "I want to receive the weekly menu by email.",
    darkMode: "Dark mode",
    language: "Language",
    topUpCredit: "Top up credit",
    orders: "Orders",
    settings: "Settings",
    personalData: "Personal details",
    done: "Done",
    pay: "Pay",
    close: "Close",
    today: "Today",
    tomorrow: "Tomorrow",
    closedSunday: "Closed on Sunday.",
    orderOnlyTodayFuture: "You can order only for today before 1 PM or future days.",
    todayUntil13: "Ordering for today was possible only until 1 PM.",
    dailyMenu: "Daily menu",
    orderMeals: "Meal order",
    menuShort: "Menu",
    orderShort: "Order",
    cart: "Cart",
    jirka: "Jiřka",
    about: "About",
    add: "Add",
    loading: "Loading…",
    noMenuYet: "Menu has not been published yet.",
    routeTagline: "lunch delivery in Poděbrady",
    crossroads: "Dashboard",
    logout: "Log out",
    noOrders: "No orders yet.",
    upcomingOrder: "Upcoming order",
    pastOrder: "Completed order",
    amount: "Enter amount",
    min500: "Minimum 500 CZK",
    choosePayment: "Choose payment",
    cardEntry: "Enter card",
    saveProfileOk: "Profile saved.",
  },
  uk: {
    login: "Вхід",
    register: "Реєстрація",
    signIn: "Увійти",
    createAccount: "Створити акаунт",
    email: "Електронна пошта",
    password: "Пароль",
    fullName: "Ім'я та прізвище",
    phone: "Телефон",
    address: "Адреса",
    agreeTerms: "Я погоджуюся з умовами та обробкою персональних даних.",
    doneEmail: "Готово. Перевірте пошту, якщо потрібне підтвердження, а poté увійдіть.",
    changePassword: "Змінити пароль",
    forgotPassword: "Забули пароль",
    oldPassword: "Старий пароль",
    newPassword: "Новий пароль",
    newPasswordAgain: "Повторіть новий пароль",
    save: "Зберегти",
    back: "Назад",
    notifications: "Сповіщення",
    newsOffers: "Новини та акції",
    satisfactionSurvey: "Опитування задоволеності",
    productReview: "Оцінка придбаного продукту",
    weeklyMenuEmail: "Меню на тиждень наперед",
    weeklyMenuEmailSub: "Я хочу отримувати тижневе меню електронною поштою.",
    darkMode: "Темний режим",
    language: "Мова",
    topUpCredit: "Поповнити кредит",
    orders: "Замовлення",
    settings: "Налаштування",
    personalData: "Особисті дані",
    done: "Готово",
    pay: "Оплатити",
    close: "Закрити",
    today: "Сьогодні",
    tomorrow: "Завтра",
    closedSunday: "У неділю зачинено.",
    orderOnlyTodayFuture: "Замовляти можна лише на сьогодні до 13:00 або на майбутні дні.",
    todayUntil13: "На сьогодні можна було замовити лише до 13:00.",
    dailyMenu: "Щоденне меню",
    orderMeals: "Замовлення їжі",
    menuShort: "Меню",
    orderShort: "Замовлення",
    cart: "Кошик",
    jirka: "Jiřka",
    about: "Про нас",
    add: "Додати",
    loading: "Завантаження…",
    noMenuYet: "Меню ще не опубліковано.",
    routeTagline: "доставка обідів у Подєбрадах",
    crossroads: "Панель",
    logout: "Вийти",
    noOrders: "Замовлень поки немає.",
    upcomingOrder: "Майбутнє замовлення",
    pastOrder: "Видане замовлення",
    amount: "Введіть суму",
    min500: "Мінімум 500 CZK",
    choosePayment: "Оберіть оплату",
    cardEntry: "Ввести картку",
    saveProfileOk: "Профіль збережено.",
  },
  de: {
    login: "Anmelden",
    register: "Registrieren",
    signIn: "Einloggen",
    createAccount: "Konto erstellen",
    email: "E-Mail",
    password: "Passwort",
    fullName: "Vor- und Nachname",
    phone: "Telefon",
    address: "Adresse",
    agreeTerms: "Ich stimme den Bedingungen und der Verarbeitung personenbezogener Daten zu.",
    doneEmail: "Fertig. Prüfe deine E-Mails und melde dich dann an.",
    changePassword: "Passwort ändern",
    forgotPassword: "Passwort vergessen",
    oldPassword: "Altes Passwort",
    newPassword: "Neues Passwort",
    newPasswordAgain: "Neues Passwort wiederholen",
    save: "Speichern",
    back: "Zurück",
    notifications: "Benachrichtigungen",
    newsOffers: "Neuigkeiten und Angebote",
    satisfactionSurvey: "Zufriedenheitsumfrage",
    productReview: "Bewertung des gekauften Produkts",
    weeklyMenuEmail: "Wochenmenü im Voraus",
    weeklyMenuEmailSub: "Ich möchte das Wochenmenü per E-Mail erhalten.",
    darkMode: "Dunkler Modus",
    language: "Sprache",
    topUpCredit: "Guthaben aufladen",
    orders: "Bestellungen",
    settings: "Einstellungen",
    personalData: "Persönliche Daten",
    done: "Fertig",
    pay: "Bezahlen",
    close: "Schließen",
    today: "Heute",
    tomorrow: "Morgen",
    closedSunday: "Sonntags geschlossen.",
    orderOnlyTodayFuture: "Bestellungen sind nur für heute bis 13:00 Uhr oder zukünftige Tage möglich.",
    todayUntil13: "Für heute konnte nur bis 13:00 Uhr bestellt werden.",
    dailyMenu: "Tagesmenü",
    orderMeals: "Essensbestellung",
    menuShort: "Menü",
    orderShort: "Bestellung",
    cart: "Warenkorb",
    jirka: "Jiřka",
    about: "Über uns",
    add: "Hinzufügen",
    loading: "Lädt…",
    noMenuYet: "Menü wurde noch nicht veröffentlicht.",
    routeTagline: "Mittagslieferung in Poděbrady",
    crossroads: "Übersicht",
    logout: "Abmelden",
    noOrders: "Noch keine Bestellungen.",
    upcomingOrder: "Kommende Bestellung",
    pastOrder: "Abgeschlossene Bestellung",
    amount: "Betrag eingeben",
    min500: "Mindestens 500 CZK",
    choosePayment: "Zahlung wählen",
    cardEntry: "Karte eingeben",
    saveProfileOk: "Profil gespeichert.",
  },
  es: {
    login: "Iniciar sesión",
    register: "Registrarse",
    signIn: "Entrar",
    createAccount: "Crear cuenta",
    email: "Correo",
    password: "Contraseña",
    fullName: "Nombre completo",
    phone: "Teléfono",
    address: "Dirección",
    agreeTerms: "Acepto los términos y el tratamiento de datos personales.",
    doneEmail: "Hecho. Revisa tu correo si hace falta confirmación y luego inicia sesión.",
    changePassword: "Cambiar contraseña",
    forgotPassword: "Olvidé mi contraseña",
    oldPassword: "Contraseña antigua",
    newPassword: "Nueva contraseña",
    newPasswordAgain: "Repetir nueva contraseña",
    save: "Guardar",
    back: "Atrás",
    notifications: "Notificaciones",
    newsOffers: "Novedades y ofertas",
    satisfactionSurvey: "Encuesta de satisfacción",
    productReview: "Valoración del producto comprado",
    weeklyMenuEmail: "Menú semanal con antelación",
    weeklyMenuEmailSub: "Quiero recibir el menú semanal por correo.",
    darkMode: "Modo oscuro",
    language: "Idioma",
    topUpCredit: "Recargar crédito",
    orders: "Pedidos",
    settings: "Configuración",
    personalData: "Datos personales",
    done: "Hecho",
    pay: "Pagar",
    close: "Cerrar",
    today: "Hoy",
    tomorrow: "Mañana",
    closedSunday: "Cerrado el domingo.",
    orderOnlyTodayFuture: "Se puede pedir solo para hoy antes de las 13:00 o para días futuros.",
    todayUntil13: "Para hoy se podía pedir solo hasta las 13:00.",
    dailyMenu: "Menú diario",
    orderMeals: "Pedido de comida",
    menuShort: "Menú",
    orderShort: "Pedido",
    cart: "Carrito",
    jirka: "Jiřka",
    about: "Sobre nosotros",
    add: "Añadir",
    loading: "Cargando…",
    noMenuYet: "El menú aún no se ha publicado.",
    routeTagline: "reparto de almuerzos en Poděbrady",
    crossroads: "Panel",
    logout: "Cerrar sesión",
    noOrders: "Todavía no hay pedidos.",
    upcomingOrder: "Pedido próximo",
    pastOrder: "Pedido completado",
    amount: "Introducir cantidad",
    min500: "Mínimo 500 CZK",
    choosePayment: "Elegir pago",
    cardEntry: "Introducir tarjeta",
    saveProfileOk: "Perfil guardado.",
  },
} as const;

type LanguageCode = keyof typeof translations;

/* ===================== Types ===================== */
type MenuRow = {
  datum: string;
  poradi: number;
  jidlo_id: string;
  jidla: {
    nazev: string;
    cena: number | null;
    kategorie: string | null;
    alergeny?: string | null;
    aktivni?: boolean | null;
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

type OrderRowLite = {
  id: string;
  created_at: string | null;
  datum: string | null;
  total: number | null;
  status: string | null;
  delivery_mode: string | null;
  name?: string | null;
};

type SettingsSection =
  | "menu"
  | "personal"
  | "notifications"
  | "language"
  | "topup"
  | "orders";

const COUNTRY_CODES = [
  { code: "CZ", flag: "🇨🇿", dial: "+420" },
  { code: "SK", flag: "🇸🇰", dial: "+421" },
  { code: "DE", flag: "🇩🇪", dial: "+49" },
  { code: "AT", flag: "🇦🇹", dial: "+43" },
  { code: "PL", flag: "🇵🇱", dial: "+48" },
  { code: "UA", flag: "🇺🇦", dial: "+380" },
  { code: "ES", flag: "🇪🇸", dial: "+34" },
  { code: "GB", flag: "🇬🇧", dial: "+44" },
] as const;

/* ===================== Allergens ===================== */
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

/* ===================== Shared UI ===================== */
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
  maxWidth = "max-w-lg",
  darkMode = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
  darkMode?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center p-4">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/40" aria-label="Zavřít" />
      <div
        className={[
          `relative w-full ${maxWidth} overflow-hidden rounded-3xl shadow-2xl ring-1`,
          darkMode ? "bg-slate-900 text-white ring-white/10" : "bg-white text-gray-900 ring-black/10",
        ].join(" ")}
      >
        <div className={`flex items-center justify-between px-5 pb-3 pt-4 ${darkMode ? "border-b border-white/10" : "border-b border-gray-100"}`}>
          <div className={`text-[16px] font-extrabold ${darkMode ? "text-white" : "text-gray-900"}`}>{title}</div>
          <button
            type="button"
            onClick={onClose}
            className={[
              "h-10 w-10 rounded-2xl font-extrabold ring-1",
              darkMode ? "bg-slate-800 text-white ring-white/10 hover:bg-slate-700" : "bg-white ring-black/10 hover:bg-gray-50",
            ].join(" ")}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AuthModal({
  open,
  onClose,
  t,
}: {
  open: boolean;
  onClose: () => void;
  t: (key: keyof typeof translations["cs"]) => string;
}) {
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
    const payload: Record<string, any> = {
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

      setMsg(t("doneEmail"));
      setTab("login");
      setPassword("");
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
  const canRegister = emailOk && fullNameOk && phoneOk && addressOk && passwordOk;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/40" aria-label="Zavřít" />
      <div className="relative w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-black/10">
        <div className="flex items-center justify-between gap-2">
          <div className="text-base font-extrabold text-green-700">
            {tab === "login" ? t("login") : t("register")}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-2xl bg-white font-extrabold ring-1 ring-black/10 hover:bg-gray-50"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
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
            {t("signIn")}
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
            {t("register")}
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <div className="mb-1 text-[11px] font-extrabold text-gray-600">{t("email")}</div>
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
            <div className="mb-1 text-[11px] font-extrabold text-gray-600">{t("password")}</div>
            <div className="flex items-center gap-2 rounded-2xl bg-white px-3 ring-1 ring-black/10 focus-within:ring-2 focus-within:ring-green-600">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                type="password"
                autoComplete={tab === "login" ? "current-password" : "new-password"}
                className="h-11 flex-1 bg-transparent text-sm font-semibold outline-none"
              />
              <CheckIcon show={passwordOk} />
            </div>
          </label>

          {tab === "register" ? (
            <>
              <label className="block">
                <div className="mb-1 text-[11px] font-extrabold text-gray-600">{t("fullName")}</div>
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
                <div className="mb-1 text-[11px] font-extrabold text-gray-600">{t("phone")}</div>
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
                <div className="mb-1 text-[11px] font-extrabold text-gray-600">{t("address")}</div>
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
            {busy ? "Počkej…" : tab === "login" ? t("signIn") : t("createAccount")}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChangePasswordModal({
  open,
  onClose,
  email,
  darkMode,
  t,
}: {
  open: boolean;
  onClose: () => void;
  email: string;
  darkMode: boolean;
  t: (key: keyof typeof translations["cs"]) => string;
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

  const inputCls = `w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none ring-1 ${
    darkMode ? "bg-slate-800 text-white ring-white/10 focus:ring-green-500" : "bg-white ring-black/10 focus:ring-2 focus:ring-green-600"
  }`;

  return (
    <BaseModal open={open} onClose={onClose} title={t("changePassword")} darkMode={darkMode}>
      <div className="space-y-3 p-5">
        <label className="block">
          <div className={`mb-1 text-[11px] font-extrabold ${darkMode ? "text-slate-300" : "text-gray-600"}`}>{t("oldPassword")}</div>
          <input value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} type="password" className={inputCls} />
        </label>

        <label className="block">
          <div className={`mb-1 text-[11px] font-extrabold ${darkMode ? "text-slate-300" : "text-gray-600"}`}>{t("newPassword")}</div>
          <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" className={inputCls} />
        </label>

        <label className="block">
          <div className={`mb-1 text-[11px] font-extrabold ${darkMode ? "text-slate-300" : "text-gray-600"}`}>{t("newPasswordAgain")}</div>
          <input value={newPassword2} onChange={(e) => setNewPassword2(e.target.value)} type="password" className={inputCls} />
        </label>

        <button
          type="button"
          onClick={forgotPassword}
          className={`text-[12px] font-bold underline underline-offset-4 ${darkMode ? "text-slate-300" : "text-gray-600"}`}
        >
          {t("forgotPassword")}
        </button>

        {msg ? (
          <div className={`rounded-2xl px-3 py-2 text-[12px] font-bold ring-1 ${darkMode ? "bg-slate-800 text-slate-100 ring-white/10" : "bg-neutral-50 text-neutral-700 ring-black/10"}`}>
            {msg}
          </div>
        ) : null}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 rounded-2xl px-4 py-3 text-[13px] font-extrabold ring-1 ${darkMode ? "bg-slate-800 text-white ring-white/10 hover:bg-slate-700" : "bg-white ring-black/10 hover:bg-gray-50"}`}
          >
            {t("back")}
          </button>
          <button
            type="button"
            onClick={savePassword}
            disabled={busy}
            className="flex-1 rounded-2xl bg-green-600 px-4 py-3 text-[13px] font-extrabold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {t("save")}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}

function SettingsModal({
  open,
  onClose,
  section,
  setSection,
  userName,
  userEmail,
  phone,
  address,
  onSaved,
  darkMode,
  setDarkMode,
  notifNews,
  setNotifNews,
  notifSurvey,
  setNotifSurvey,
  notifReview,
  setNotifReview,
  notifWeeklyMenu,
  setNotifWeeklyMenu,
  language,
  setLanguage,
  orders,
  onRefreshOrders,
  onTopup,
  onOpenPassword,
  t,
}: {
  open: boolean;
  onClose: () => void;
  section: SettingsSection;
  setSection: (v: SettingsSection) => void;
  userName: string;
  userEmail: string;
  phone: string;
  address: string;
  onSaved: (payload: { full_name: string; phone: string; address: string }) => Promise<void>;
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  notifNews: boolean;
  setNotifNews: (v: boolean) => void;
  notifSurvey: boolean;
  setNotifSurvey: (v: boolean) => void;
  notifReview: boolean;
  setNotifReview: (v: boolean) => void;
  notifWeeklyMenu: boolean;
  setNotifWeeklyMenu: (v: boolean) => void;
  language: LanguageCode;
  setLanguage: (v: LanguageCode) => void;
  orders: OrderRowLite[];
  onRefreshOrders: () => Promise<void>;
  onTopup: (amount: number, method: string) => Promise<void>;
  onOpenPassword: () => void;
  t: (key: keyof typeof translations["cs"]) => string;
}) {
  const [name, setName] = useState(userName);
  const [phoneLocal, setPhoneLocal] = useState(phone);
  const [addressLocal, setAddressLocal] = useState(address);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [topupAmount, setTopupAmount] = useState("500");
  const [topupMethod, setTopupMethod] = useState("card");

  useEffect(() => {
    if (!open) return;
    setName(userName);
    setPhoneLocal(phone);
    setAddressLocal(address);
    setMsg(null);
  }, [open, userName, phone, address]);

  async function savePersonal() {
    setBusy(true);
    setMsg(null);
    try {
      await onSaved({
        full_name: name.trim(),
        phone: digitsOnly(phoneLocal).slice(0, 9),
        address: addressLocal.trim(),
      });
      setMsg(t("saveProfileOk"));
    } catch (e: any) {
      setMsg(e?.message ?? "Nepovedlo se uložit profil.");
    } finally {
      setBusy(false);
    }
  }

  async function doTopup() {
    const amount = Number(digitsOnly(topupAmount) || 0);
    if (amount < 500) {
      setMsg(t("min500"));
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await onTopup(amount, topupMethod);
      setMsg(`Kredit byl navýšen o ${amount} Kč.`);
    } catch (e: any) {
      setMsg(e?.message ?? "Nepovedlo se dobít kredit.");
    } finally {
      setBusy(false);
    }
  }

  const cardCls = darkMode
    ? "bg-slate-800 text-white ring-white/10"
    : "bg-white text-gray-900 ring-black/10";

  const languageFlag =
    language === "cs" ? "🇨🇿" :
    language === "en" ? "🇬🇧" :
    language === "uk" ? "🇺🇦" :
    language === "de" ? "🇩🇪" :
    "🇪🇸";

  return (
    <BaseModal
      open={open}
      onClose={() => {
        setSection("menu");
        onClose();
      }}
      title={
        section === "menu"
          ? t("settings")
          : section === "personal"
          ? t("personalData")
          : section === "notifications"
          ? t("notifications")
          : section === "language"
          ? t("language")
          : section === "topup"
          ? t("topUpCredit")
          : t("orders")
      }
      darkMode={darkMode}
      maxWidth="max-w-2xl"
    >
      <div className="max-h-[78dvh] overflow-auto p-5">
        {section === "menu" ? (
          <div className="grid gap-3 md:grid-cols-2">
            <button type="button" onClick={() => setSection("personal")} className={`rounded-2xl px-4 py-4 text-left text-[13px] font-extrabold ring-1 ${cardCls}`}>{t("personalData")}</button>
            <button type="button" onClick={() => setSection("notifications")} className={`rounded-2xl px-4 py-4 text-left text-[13px] font-extrabold ring-1 ${cardCls}`}>{t("notifications")}</button>

            <div className={`flex items-center justify-between rounded-2xl px-4 py-4 text-left text-[13px] font-extrabold ring-1 ${cardCls}`}>
              <span>{t("darkMode")}</span>
              <Toggle checked={darkMode} onChange={setDarkMode} />
            </div>

            <button
              type="button"
              onClick={() => setSection("language")}
              className={`flex items-center justify-between rounded-2xl px-4 py-4 text-left text-[13px] font-extrabold ring-1 ${cardCls}`}
            >
              <span>{t("language")}</span>
              <span className="text-xl">{languageFlag}</span>
            </button>

            <button type="button" onClick={() => setSection("topup")} className={`rounded-2xl px-4 py-4 text-left text-[13px] font-extrabold ring-1 ${cardCls}`}>{t("topUpCredit")}</button>
            <button type="button" onClick={() => setSection("orders")} className={`rounded-2xl px-4 py-4 text-left text-[13px] font-extrabold ring-1 ${cardCls}`}>{t("orders")}</button>
          </div>
        ) : null}

        {section === "personal" ? (
          <div className="space-y-3">
            <label className="block">
              <div className={`mb-1 text-[11px] font-extrabold ${darkMode ? "text-slate-300" : "text-gray-600"}`}>{t("fullName")}</div>
              <input value={name} onChange={(e) => setName(e.target.value)} className={`w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none ring-1 ${darkMode ? "bg-slate-800 text-white ring-white/10" : "bg-white ring-black/10"}`} />
            </label>

            <label className="block">
              <div className={`mb-1 text-[11px] font-extrabold ${darkMode ? "text-slate-300" : "text-gray-600"}`}>{t("email")}</div>
              <input value={userEmail} readOnly className={`w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none ring-1 ${darkMode ? "bg-slate-800 text-slate-300 ring-white/10" : "bg-gray-50 text-gray-500 ring-black/10"}`} />
            </label>

            <label className="block">
              <div className={`mb-1 text-[11px] font-extrabold ${darkMode ? "text-slate-300" : "text-gray-600"}`}>{t("phone")}</div>
              <input value={phoneLocal} onChange={(e) => setPhoneLocal(formatPhoneCz(e.target.value))} inputMode="numeric" className={`w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none ring-1 ${darkMode ? "bg-slate-800 text-white ring-white/10" : "bg-white ring-black/10"}`} />
            </label>

            <label className="block">
              <div className={`mb-1 text-[11px] font-extrabold ${darkMode ? "text-slate-300" : "text-gray-600"}`}>{t("address")}</div>
              <input value={addressLocal} onChange={(e) => setAddressLocal(e.target.value)} className={`w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none ring-1 ${darkMode ? "bg-slate-800 text-white ring-white/10" : "bg-white ring-black/10"}`} />
            </label>

            {msg ? (
              <div className={`rounded-2xl px-3 py-2 text-[12px] font-bold ring-1 ${darkMode ? "bg-slate-800 text-slate-100 ring-white/10" : "bg-neutral-50 text-neutral-700 ring-black/10"}`}>
                {msg}
              </div>
            ) : null}

            <button type="button" onClick={onOpenPassword} className={`text-[12px] font-bold underline underline-offset-4 ${darkMode ? "text-slate-300" : "text-gray-600"}`}>
              {t("changePassword")}
            </button>

            <div className="flex gap-2">
              <button type="button" onClick={() => setSection("menu")} className={`flex-1 rounded-2xl px-4 py-3 text-[13px] font-extrabold ring-1 ${cardCls}`}>{t("back")}</button>
              <button type="button" onClick={savePersonal} disabled={busy} className="flex-1 rounded-2xl bg-green-600 px-4 py-3 text-[13px] font-extrabold text-white hover:bg-green-700 disabled:opacity-50">{t("save")}</button>
            </div>
          </div>
        ) : null}

        {section === "notifications" ? (
          <div className="space-y-3">
            {[
              { label: t("newsOffers"), sub: "E-mail", checked: notifNews, setChecked: setNotifNews },
              { label: t("satisfactionSurvey"), sub: "Ohodnoťte, jak se vám líbí Jiřka.", checked: notifSurvey, setChecked: setNotifSurvey },
              { label: t("productReview"), sub: "Krátké hodnocení po nákupu jídla.", checked: notifReview, setChecked: setNotifReview },
              { label: t("weeklyMenuEmail"), sub: t("weeklyMenuEmailSub"), checked: notifWeeklyMenu, setChecked: setNotifWeeklyMenu },
            ].map((item, idx) => (
              <div key={idx} className={`rounded-2xl p-4 ring-1 ${cardCls}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-extrabold">{item.label}</div>
                    <div className={`mt-1 text-[12px] ${darkMode ? "text-slate-300" : "text-gray-500"}`}>{item.sub}</div>
                  </div>
                  <Toggle checked={item.checked} onChange={item.setChecked} />
                </div>
              </div>
            ))}

            <button type="button" onClick={() => setSection("menu")} className={`w-full rounded-2xl px-4 py-3 text-[13px] font-extrabold ring-1 ${cardCls}`}>{t("back")}</button>
          </div>
        ) : null}

        {section === "language" ? (
          <div className="grid gap-2 md:grid-cols-2">
            {[
              { id: "cs", label: "Čeština", flag: "🇨🇿" },
              { id: "en", label: "English", flag: "🇬🇧" },
              { id: "uk", label: "Українська", flag: "🇺🇦" },
              { id: "de", label: "Deutsch", flag: "🇩🇪" },
              { id: "es", label: "Español", flag: "🇪🇸" },
            ].map((item) => {
              const active = item.id === language;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setLanguage(item.id as LanguageCode)}
                  className={[
                    "flex items-center justify-between rounded-2xl px-4 py-3 text-left ring-1",
                    active
                      ? "bg-green-50 text-gray-900 ring-green-300/70"
                      : darkMode
                      ? "bg-slate-800 text-white ring-white/10"
                      : "bg-white text-gray-900 ring-black/10",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{item.flag}</span>
                    <span className="text-[13px] font-extrabold">{item.label}</span>
                  </div>
                  <span className="font-extrabold text-green-700">{active ? "✓" : ""}</span>
                </button>
              );
            })}

            <button type="button" onClick={() => setSection("menu")} className={`md:col-span-2 mt-2 rounded-2xl px-4 py-3 text-[13px] font-extrabold ring-1 ${cardCls}`}>{t("back")}</button>
          </div>
        ) : null}

        {section === "topup" ? (
          <div className="space-y-3">
            <label className="block">
              <div className={`mb-1 text-[11px] font-extrabold ${darkMode ? "text-slate-300" : "text-gray-600"}`}>{t("amount")}</div>
              <input
                value={topupAmount}
                onChange={(e) => setTopupAmount(digitsOnly(e.target.value))}
                inputMode="numeric"
                className={`w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none ring-1 ${darkMode ? "bg-slate-800 text-white ring-white/10" : "bg-white ring-black/10"}`}
                placeholder="500"
              />
              <div className={`mt-1 text-[11px] ${darkMode ? "text-slate-300" : "text-gray-500"}`}>{t("min500")}</div>
            </label>

            <div className={`rounded-2xl p-3 ring-1 ${cardCls}`}>
              <div className={`mb-2 text-[11px] font-extrabold ${darkMode ? "text-slate-300" : "text-gray-600"}`}>{t("choosePayment")}</div>
              <div className="space-y-2">
                {[
                  { id: "card", label: t("cardEntry") },
                  { id: "applepay", label: "Apple Pay" },
                  { id: "googlepay", label: "Google Pay" },
                ].map((x) => {
                  const active = topupMethod === x.id;
                  return (
                    <button
                      key={x.id}
                      type="button"
                      onClick={() => setTopupMethod(x.id)}
                      className={[
                        "flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left ring-1",
                        active
                          ? "bg-green-50 text-gray-900 ring-green-300/70"
                          : darkMode
                          ? "bg-slate-900 text-white ring-white/10"
                          : "bg-white text-gray-900 ring-black/10",
                      ].join(" ")}
                    >
                      <span className="text-[13px] font-extrabold">{x.label}</span>
                      <span className="font-extrabold text-green-700">{active ? "✓" : ""}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {msg ? (
              <div className={`rounded-2xl px-3 py-2 text-[12px] font-bold ring-1 ${darkMode ? "bg-slate-800 text-slate-100 ring-white/10" : "bg-neutral-50 text-neutral-700 ring-black/10"}`}>
                {msg}
              </div>
            ) : null}

            <div className="flex gap-2">
              <button type="button" onClick={() => setSection("menu")} className={`flex-1 rounded-2xl px-4 py-3 text-[13px] font-extrabold ring-1 ${cardCls}`}>{t("back")}</button>
              <button type="button" onClick={doTopup} disabled={busy} className="flex-1 rounded-2xl bg-green-600 px-4 py-3 text-[13px] font-extrabold text-white hover:bg-green-700 disabled:opacity-50">{t("pay")}</button>
            </div>
          </div>
        ) : null}

        {section === "orders" ? (
          <div className="space-y-3">
            <button type="button" onClick={onRefreshOrders} className={`w-full rounded-2xl px-4 py-3 text-[13px] font-extrabold ring-1 ${cardCls}`}>
              Obnovit
            </button>

            {orders.length === 0 ? (
              <div className={`rounded-2xl p-3 text-[13px] ring-1 ${cardCls}`}>{t("noOrders")}</div>
            ) : (
              <div className="space-y-2">
                {orders.map((row) => {
                  const upcoming = !!row.datum && row.datum >= toISODateLocal(new Date());
                  return (
                    <div
                      key={row.id}
                      className={[
                        "rounded-2xl p-3 ring-1",
                        upcoming
                          ? "bg-green-50 text-gray-900 ring-green-300/70"
                          : darkMode
                          ? "bg-slate-800 text-white ring-white/10"
                          : "bg-gray-100 text-gray-800 ring-gray-200",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-extrabold">
                            {row.name || `Objednávka #${row.id.slice(0, 8)}`}
                          </div>
                          <div className={`mt-1 text-[11px] ${upcoming ? "text-green-700" : darkMode ? "text-slate-300" : "text-gray-500"}`}>
                            {upcoming ? t("upcomingOrder") : t("pastOrder")}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[12px] font-extrabold">
                            {row.datum ? formatCartDay(row.datum) : "—"}
                          </div>
                          <div className="mt-1 text-[13px] font-extrabold text-green-700">
                            {formatMoney(Number(row.total ?? 0))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button type="button" onClick={() => setSection("menu")} className={`w-full rounded-2xl px-4 py-3 text-[13px] font-extrabold ring-1 ${cardCls}`}>{t("back")}</button>
          </div>
        ) : null}
      </div>
    </BaseModal>
  );
}

function AllergensModal({
  open,
  onClose,
  title,
  allergens,
  category,
  darkMode,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  allergens: string[];
  category: string | null;
  darkMode: boolean;
}) {
  return (
    <BaseModal open={open} onClose={onClose} title={title || "Informace"} darkMode={darkMode} maxWidth="max-w-md">
      <div className="space-y-4 p-5">
        <div>
          <div className={`text-[11px] font-extrabold uppercase tracking-wide ${darkMode ? "text-slate-300" : "text-gray-500"}`}>
            Alergeny
          </div>

          {allergens.length > 0 ? (
            <div className="mt-2 space-y-2">
              {allergens.map((item, idx) => (
                <div
                  key={`${item}-${idx}`}
                  className={`rounded-2xl px-3 py-2 text-[13px] font-semibold ring-1 ${
                    darkMode ? "bg-slate-800 text-slate-100 ring-white/10" : "bg-neutral-50 text-gray-700 ring-black/10"
                  }`}
                >
                  {item}
                </div>
              ))}
            </div>
          ) : (
            <div className={`mt-2 rounded-2xl px-3 py-2 text-[13px] font-semibold ring-1 ${darkMode ? "bg-slate-800 text-slate-300 ring-white/10" : "bg-neutral-50 text-gray-500 ring-black/10"}`}>
              Bez uvedených alergenů.
            </div>
          )}
        </div>

        <div>
          <div className={`text-[11px] font-extrabold uppercase tracking-wide ${darkMode ? "text-slate-300" : "text-gray-500"}`}>
            Kategorie
          </div>

          <div className={`mt-2 rounded-2xl px-3 py-2 text-[13px] font-semibold ring-1 ${darkMode ? "bg-slate-800 text-slate-100 ring-white/10" : "bg-neutral-50 text-gray-700 ring-black/10"}`}>
            {category?.trim() ? category : "Neuvedeno"}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-2xl bg-green-600 px-4 py-3 text-[13px] font-extrabold text-white hover:bg-green-700"
        >
          Zavřít
        </button>
      </div>
    </BaseModal>
  );
}

function DayPickerModal({
  open,
  onClose,
  weekOffset,
  setWeekOffset,
  tabDays,
  selectedDate,
  setSelectedDate,
  darkMode,
  t,
}: {
  open: boolean;
  onClose: () => void;
  weekOffset: 0 | 1;
  setWeekOffset: (v: 0 | 1) => void;
  tabDays: string[];
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  darkMode: boolean;
  t: (key: keyof typeof translations["cs"]) => string;
}) {
  if (!open) return null;

  const rangeLabel = tabDays.length ? formatRangeShort(tabDays[0], tabDays[tabDays.length - 1]) : "";
  const weekText = weekOffset === 0 ? "Tento týden" : "Příští týden";

  return (
    <div className="fixed inset-0 z-[230] flex items-center justify-center p-4">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/40" aria-label="Zavřít" />
      <div className={`relative w-full max-w-md overflow-hidden rounded-3xl shadow-2xl ring-1 ${darkMode ? "bg-slate-900 text-white ring-white/10" : "bg-white ring-black/10"}`}>
        <div className={`flex items-center justify-between px-5 pb-3 pt-4 ${darkMode ? "border-b border-white/10" : "border-b border-gray-100"}`}>
          <div>
            <div className={`text-[15px] font-extrabold ${darkMode ? "text-white" : "text-gray-900"}`}>Vybrat den</div>
            <div className="mt-0.5 text-[11px] font-semibold text-green-700">{weekText}</div>
            <div className={`text-[12px] font-semibold ${darkMode ? "text-slate-300" : "text-gray-500"}`}>{rangeLabel}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`h-10 w-10 rounded-2xl font-extrabold ring-1 ${darkMode ? "bg-slate-800 text-white ring-white/10 hover:bg-slate-700" : "bg-white ring-black/10 hover:bg-gray-50"}`}
          >
            ✕
          </button>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-[52px_1fr_52px] items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              disabled={weekOffset === 0}
              className={`h-12 rounded-2xl font-extrabold ring-1 disabled:opacity-40 ${darkMode ? "bg-slate-800 text-white ring-white/10" : "bg-white ring-black/10"}`}
            >
              ‹
            </button>

            <div className={`rounded-2xl px-3 py-3 text-center ring-1 ${darkMode ? "bg-slate-800 ring-white/10" : "bg-[#f6fbf7] ring-green-200/80"}`}>
              <div className="text-[10px] font-bold uppercase tracking-wide text-green-700">{weekText}</div>
              <div className={`mt-0.5 text-[13px] font-extrabold ${darkMode ? "text-white" : "text-[#1f2f56]"}`}>{rangeLabel}</div>
            </div>

            <button
              type="button"
              onClick={() => setWeekOffset(1)}
              disabled={weekOffset === 1}
              className={`h-12 rounded-2xl font-extrabold ring-1 disabled:opacity-40 ${darkMode ? "bg-slate-800 text-white ring-white/10" : "bg-white ring-black/10"}`}
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
                      ? darkMode
                        ? "bg-slate-800 text-white ring-2 ring-green-500 hover:bg-slate-700"
                        : "bg-white text-gray-900 ring-2 ring-green-500 hover:bg-gray-50"
                      : darkMode
                      ? "bg-slate-800 text-white ring-white/10 hover:bg-slate-700"
                      : "bg-white text-gray-900 ring-black/10 hover:bg-gray-50",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[13px] font-extrabold">{formatSelectedDaySmart(d, t)}</div>
                    {!active && today ? (
                      <div className="rounded-full bg-green-50 px-2 py-1 text-[10px] font-extrabold text-green-700 ring-1 ring-green-200">
                        {t("today")}
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
/* ===================== DesktopView ===================== */
export default function DesktopView({
  onOpenCart,
}: {
  onOpenCart: () => void;
}) {
  const router = useRouter();
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  type Section = "daily" | "order" | "jirka" | "about";
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

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("menu");
  const [passwordOpen, setPasswordOpen] = useState(false);

  const [darkMode, setDarkMode] = useState(false);
  const [notifNews, setNotifNews] = useState(false);
  const [notifSurvey, setNotifSurvey] = useState(false);
  const [notifReview, setNotifReview] = useState(false);
  const [notifWeeklyMenu, setNotifWeeklyMenu] = useState(false);
  const [language, setLanguage] = useState<LanguageCode>("cs");

  const t = useCallback(
    (key: keyof typeof translations["cs"]) =>
      (translations[language] as Record<string, string>)[key] ?? translations.cs[key],
    [language]
  );

  const [algOpen, setAlgOpen] = useState(false);
  const [algTitle, setAlgTitle] = useState("");
  const [algList, setAlgList] = useState<string[]>([]);
  const [algCategory, setAlgCategory] = useState<string | null>("");

  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [flashKey, setFlashKey] = useState<string | null>(null);

  const { cart, cartCount, total, keyFor, addOne, removeOne } = useOrder();

  const [systemItems, setSystemItems] = useState<SystemItemRow[]>([]);
  const [loadingSystemItems, setLoadingSystemItems] = useState(true);
  const [orders, setOrders] = useState<OrderRowLite[]>([]);

  useEffect(() => {
    const savedDark = typeof window !== "undefined" ? localStorage.getItem("jirka-dark-mode") : null;
    const savedLang = typeof window !== "undefined" ? localStorage.getItem("jirka-language") : null;
    const savedNews = typeof window !== "undefined" ? localStorage.getItem("jirka-notif-news") : null;
    const savedSurvey = typeof window !== "undefined" ? localStorage.getItem("jirka-notif-survey") : null;
    const savedReview = typeof window !== "undefined" ? localStorage.getItem("jirka-notif-review") : null;
    const savedWeekly = typeof window !== "undefined" ? localStorage.getItem("jirka-notif-weekly-menu") : null;

    if (savedDark) setDarkMode(savedDark === "1");
    if (savedLang && ["cs", "en", "uk", "de", "es"].includes(savedLang)) setLanguage(savedLang as LanguageCode);
    if (savedNews) setNotifNews(savedNews === "1");
    if (savedSurvey) setNotifSurvey(savedSurvey === "1");
    if (savedReview) setNotifReview(savedReview === "1");
    if (savedWeekly) setNotifWeeklyMenu(savedWeekly === "1");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("jirka-dark-mode", darkMode ? "1" : "0");
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
    localStorage.setItem("jirka-notif-weekly-menu", notifWeeklyMenu ? "1" : "0");
  }, [notifNews, notifSurvey, notifReview, notifWeeklyMenu]);

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

  async function refreshOrders() {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) {
        setOrders([]);
        return;
      }

      const { data, error } = await supabase
        .from("orders")
        .select("id, created_at, datum, total, status, delivery_mode")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        setOrders([]);
        return;
      }

      const prepared = ((data ?? []) as OrderRowLite[]).filter((row) => {
        const iso = row.datum || (row.created_at ? toISODateLocal(new Date(row.created_at)) : "");
        return iso ? isWithinTwoWeeksOrFuture(iso) : false;
      });

      setOrders(prepared);
    } catch {
      setOrders([]);
    }
  }

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
        await refreshOrders();
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
          await refreshOrders();
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
      await refreshOrders();
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

  async function topupCredit(amount: number, _method: string) {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;
    if (!uid) throw new Error("Nejsi přihlášený.");

    const newCredit = credit + amount;

    const { error } = await supabase
      .from("profiles")
      .update({ kredit: newCredit })
      .eq("id", uid);

    if (error) throw new Error(error.message);

    setCredit(newCredit);
    setSettingsSection("topup");
    window.dispatchEvent(new Event("profile-updated"));
  }

  const shopHoursRows = useMemo(() => systemItems.filter((x) => x.section === "opening_hours_shop"), [systemItems]);
  const canteenHoursRows = useMemo(() => systemItems.filter((x) => x.section === "opening_hours_canteen"), [systemItems]);
  const aboutTextRow = useMemo(
    () => systemItems.find((x) => x.section === "about_text" && x.item_key === "main") ?? null,
    [systemItems]
  );

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((tt) => tt + 1), 60_000);
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
        console.error("Desktop loadMenu error:", error);
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
          className={`inline-flex h-[42px] min-w-[120px] items-center justify-center rounded-2xl px-4 text-[13px] font-extrabold ring-1 ${
            darkMode ? "bg-slate-800 text-white ring-white/10 hover:bg-slate-700" : "bg-white text-[#2f406b] ring-black/10 hover:bg-gray-50"
          }`}
        >
          {t("signIn")}
        </button>
      );
    }

    const name = userName.trim() || "Uživatel";
    const showCredit = role !== "staff" && credit > 0;

    return (
      <div className="relative shrink-0" ref={userMenuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className={`inline-flex h-[42px] min-w-[138px] items-center gap-2 rounded-2xl px-4 text-[13px] font-extrabold ring-1 ${
            darkMode ? "bg-slate-800 text-white ring-white/10 hover:bg-slate-700" : "bg-white text-[#2f406b] ring-black/10 hover:bg-gray-50"
          }`}
          title={showCredit ? `${name} · ${credit} Kč` : name}
        >
          <span className="min-w-0 flex-1 truncate text-left">{name}</span>

          {showCredit ? (
            <span className="shrink-0 rounded-full bg-green-50 px-2 py-[3px] text-[10px] leading-none text-green-700 ring-1 ring-green-200">
              {credit} Kč
            </span>
          ) : null}

          <span className="shrink-0 text-[10px] opacity-70">▾</span>
        </button>

        {menuOpen ? (
          <div className={`absolute right-0 top-[52px] z-[120] w-72 overflow-hidden rounded-2xl shadow-xl ring-1 ${darkMode ? "bg-slate-900 ring-white/10" : "bg-white ring-black/10"}`}>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setSettingsSection("menu");
                setSettingsOpen(true);
              }}
              className={`w-full px-4 py-3 text-left text-sm font-extrabold ${darkMode ? "text-white hover:bg-slate-800" : "hover:bg-gray-50"}`}
            >
              {t("settings")}
            </button>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setSettingsSection("orders");
                setSettingsOpen(true);
              }}
              className={`w-full px-4 py-3 text-left text-sm font-extrabold ${darkMode ? "text-white hover:bg-slate-800" : "hover:bg-gray-50"}`}
            >
              {t("orders")}
            </button>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setSettingsSection("topup");
                setSettingsOpen(true);
              }}
              className={`w-full px-4 py-3 text-left text-sm font-extrabold ${darkMode ? "text-white hover:bg-slate-800" : "hover:bg-gray-50"}`}
            >
              {t("topUpCredit")}
            </button>

            <div className={darkMode ? "h-px bg-white/10" : "h-px bg-gray-100"} />

            <button
              type="button"
              onClick={signOut}
              className={`w-full px-4 py-3 text-left text-sm font-extrabold text-red-600 ${darkMode ? "hover:bg-red-950/30" : "hover:bg-red-50"}`}
            >
              {t("logout")}
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
        className="inline-flex h-[42px] min-w-[128px] items-center justify-center rounded-2xl bg-green-50 px-4 text-[13px] font-extrabold text-green-800 ring-1 ring-green-200 hover:bg-green-100"
      >
        {t("crossroads")}
      </button>
    );
  }

  function SidebarItem({
    id,
    label,
    icon,
  }: {
    id: Section;
    label: string;
    icon: string;
  }) {
    const active = activeSection === id;

    return (
      <button
        type="button"
        onClick={() => setActiveSection(id)}
        className={[
          "flex w-full items-center gap-3 rounded-[24px] px-4 py-4 text-left transition ring-1",
          active
            ? "bg-green-600 text-white ring-green-600 shadow-lg shadow-green-600/15"
            : darkMode
            ? "bg-slate-900 text-white ring-white/10 hover:bg-slate-800"
            : "bg-white text-gray-900 ring-black/10 hover:bg-gray-50",
        ].join(" ")}
      >
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl ${active ? "bg-white/15" : darkMode ? "bg-slate-800" : "bg-green-50"}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className={`text-[14px] font-extrabold ${active ? "text-white" : darkMode ? "text-white" : "text-[#1f2f56]"}`}>{label}</div>
        </div>
      </button>
    );
  }

  function CartSidebarCard() {
    return (
      <div className={`rounded-[28px] p-5 ring-1 ${darkMode ? "bg-slate-900 ring-white/10" : "bg-white ring-black/10"} shadow-sm`}>
        <div className={`text-[12px] font-extrabold uppercase tracking-wide ${darkMode ? "text-slate-300" : "text-gray-500"}`}>
          {t("cart")}
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <div className={`text-[28px] font-extrabold leading-none ${darkMode ? "text-white" : "text-green-700"}`}>{total} Kč</div>
            <div className={`mt-1 text-[13px] font-semibold ${darkMode ? "text-slate-300" : "text-gray-500"}`}>{cartCount} ks</div>
          </div>

          {authed && credit >= 0 ? (
            <div className="rounded-2xl bg-green-50 px-3 py-2 text-right ring-1 ring-green-200">
              <div className="text-[10px] font-bold uppercase tracking-wide text-green-700">Kredit</div>
              <div className="text-[13px] font-extrabold text-green-700">{credit} Kč</div>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onOpenCart}
          className={[
            "mt-4 w-full rounded-2xl px-4 py-3 text-[14px] font-extrabold transition",
            cartCount > 0
              ? "bg-green-600 text-white hover:bg-green-700"
              : darkMode
              ? "bg-slate-800 text-white ring-1 ring-white/10 hover:bg-slate-700"
              : "bg-gray-100 text-gray-700 ring-1 ring-black/10 hover:bg-gray-200",
          ].join(" ")}
        >
          {t("orderShort")} → {t("cart")}
        </button>
      </div>
    );
  }

  function SectionHeaderDaily() {
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className={`text-[34px] font-extrabold leading-none ${darkMode ? "text-white" : "text-green-700"}`}>{t("dailyMenu")}</div>

          <button
            type="button"
            onClick={() => setDayPickerOpen(true)}
            className={`pt-1 text-right text-[15px] font-bold underline decoration-1 underline-offset-4 ${darkMode ? "text-slate-200" : "text-gray-700"}`}
          >
            {formatSelectedDaySmart(selectedDate, t)}
          </button>
        </div>

        <div className={`rounded-[28px] border px-4 py-4 shadow-sm ring-1 ${darkMode ? "border-white/10 bg-slate-900 ring-white/10" : "border-[#dbeee2] bg-white ring-green-100/70"}`}>
          <div className="grid grid-cols-[52px_1fr_52px] items-center gap-3">
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              disabled={weekOffset === 0}
              className={`h-12 rounded-2xl font-extrabold disabled:opacity-35 ${darkMode ? "bg-slate-800 text-white ring-1 ring-white/10" : "bg-white text-gray-700 ring-1 ring-black/10"}`}
            >
              ‹
            </button>

            <button
              type="button"
              onClick={() => setDayPickerOpen(true)}
              className={`rounded-2xl px-3 py-3 text-center ring-1 transition ${darkMode ? "bg-slate-800 ring-white/10 hover:bg-slate-700" : "bg-[#f7fbf8] ring-green-200/80 hover:bg-[#eef8f1]"}`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wide text-green-700">{weekText}</div>
              <div className={`mt-0.5 text-[15px] font-extrabold ${darkMode ? "text-white" : "text-[#1f2f56]"}`}>{rangeLabel}</div>
            </button>

            <button
              type="button"
              onClick={() => setWeekOffset(1)}
              disabled={weekOffset === 1}
              className={`h-12 rounded-2xl font-extrabold disabled:opacity-35 ${darkMode ? "bg-slate-800 text-white ring-1 ring-white/10" : "bg-white text-gray-700 ring-1 ring-black/10"}`}
            >
              ›
            </button>
          </div>

          <div className="mt-4 grid grid-cols-6 gap-2">
            {tabDays.map((d) => {
              const active = d === selectedDate;
              const today = isTodayIso(d);

              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDate(d)}
                  className={[
                    "rounded-2xl px-3 py-3 text-center ring-1 transition",
                    active
                      ? "bg-green-600 text-white ring-green-600"
                      : today
                      ? darkMode
                        ? "bg-slate-800 text-white ring-2 ring-green-500 hover:bg-slate-700"
                        : "bg-white text-gray-800 ring-2 ring-green-500 hover:bg-gray-50"
                      : darkMode
                      ? "bg-slate-800 text-white ring-white/10 hover:bg-slate-700"
                      : "bg-white text-gray-800 ring-black/10 hover:bg-gray-50",
                  ].join(" ")}
                >
                  <div className="text-[13px] font-extrabold">{formatDayShort(d)}</div>
                  <div className="mt-1 text-[11px] font-semibold opacity-80">{formatDateShortNoLeadingZero(d)}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function SectionHeaderOrder() {
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className={`text-[34px] font-extrabold leading-none ${darkMode ? "text-white" : "text-green-700"}`}>{t("orderMeals")}</div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDayPickerOpen(true)}
              className={`pt-1 text-right text-[15px] font-bold underline decoration-1 underline-offset-4 ${darkMode ? "text-slate-200" : "text-gray-700"}`}
            >
              {formatSelectedDaySmart(selectedDate, t)}
            </button>

            <button
              type="button"
              onClick={onOpenCart}
              className={[
                "inline-flex items-center gap-3 rounded-2xl px-4 py-3 ring-1 transition",
                cartCount > 0
                  ? "bg-green-50 text-green-700 ring-green-200 hover:bg-green-100"
                  : darkMode
                  ? "bg-slate-900 text-white ring-white/10 hover:bg-slate-800"
                  : "bg-white text-[#1f2f56] ring-black/10 hover:bg-gray-50",
              ].join(" ")}
            >
              <span className="text-[14px] font-extrabold">{t("orderShort")}</span>
              <span className="text-[14px] font-extrabold">{total} Kč</span>
            </button>
          </div>
        </div>

        <div className={`rounded-[28px] border px-4 py-4 shadow-sm ring-1 ${darkMode ? "border-white/10 bg-slate-900 ring-white/10" : "border-[#dbeee2] bg-white ring-green-100/70"}`}>
          <div className="grid grid-cols-[52px_1fr_52px] items-center gap-3">
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              disabled={weekOffset === 0}
              className={`h-12 rounded-2xl font-extrabold disabled:opacity-35 ${darkMode ? "bg-slate-800 text-white ring-1 ring-white/10" : "bg-white text-gray-700 ring-1 ring-black/10"}`}
            >
              ‹
            </button>

            <button
              type="button"
              onClick={() => setDayPickerOpen(true)}
              className={`rounded-2xl px-3 py-3 text-center ring-1 transition ${darkMode ? "bg-slate-800 ring-white/10 hover:bg-slate-700" : "bg-[#f7fbf8] ring-green-200/80 hover:bg-[#eef8f1]"}`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wide text-green-700">{weekText}</div>
              <div className={`mt-0.5 text-[15px] font-extrabold ${darkMode ? "text-white" : "text-[#1f2f56]"}`}>{rangeLabel}</div>
            </button>

            <button
              type="button"
              onClick={() => setWeekOffset(1)}
              disabled={weekOffset === 1}
              className={`h-12 rounded-2xl font-extrabold disabled:opacity-35 ${darkMode ? "bg-slate-800 text-white ring-1 ring-white/10" : "bg-white text-gray-700 ring-1 ring-black/10"}`}
            >
              ›
            </button>
          </div>

          <div className="mt-4 grid grid-cols-6 gap-2">
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
                    "rounded-2xl px-3 py-3 text-center ring-1 transition",
                    disabled
                      ? "cursor-not-allowed bg-gray-50 text-gray-300 ring-gray-200"
                      : active
                      ? "bg-green-600 text-white ring-green-600"
                      : today
                      ? darkMode
                        ? "bg-slate-800 text-white ring-2 ring-green-500 hover:bg-slate-700"
                        : "bg-white text-gray-800 ring-2 ring-green-500 hover:bg-gray-50"
                      : darkMode
                      ? "bg-slate-800 text-white ring-white/10 hover:bg-slate-700"
                      : "bg-white text-gray-800 ring-black/10 hover:bg-gray-50",
                  ].join(" ")}
                >
                  <div className="text-[13px] font-extrabold">{formatDayShort(d)}</div>
                  <div className="mt-1 text-[11px] font-semibold opacity-80">{formatDateShortNoLeadingZero(d)}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function MenuList({ mode }: { mode: "daily" | "order" }) {
    if (loadingMenu) return <div className={`text-[14px] ${darkMode ? "text-slate-300" : "text-gray-500"}`}>{t("loading")}</div>;
    if (err) return <div className="text-[14px] font-bold text-red-600">{err}</div>;
    if (items.length === 0) return <div className={`text-[14px] ${darkMode ? "text-slate-300" : "text-gray-500"}`}>{t("noMenuYet")}</div>;

    return (
      <div className="space-y-3">
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
                "rounded-[28px] border px-5 py-4 shadow-sm transition duration-200",
                qty > 0 && mode === "order"
                  ? "border-green-300/80 bg-green-50"
                  : darkMode
                  ? "border-white/10 bg-slate-900"
                  : "border-black/10 bg-white",
                isFlashing ? "scale-[1.005]" : "scale-100",
              ].join(" ")}
            >
              <div className="grid grid-cols-[minmax(0,1fr)_130px_170px] items-center gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className={`truncate text-[19px] font-extrabold ${darkMode ? "text-white" : "text-[#1f2f56]"}`}>{title}</div>

                    <button
                      type="button"
                      onClick={() => {
                        setAlgTitle(title);
                        setAlgList(allergenList);
                        setAlgCategory(category);
                        setAlgOpen(true);
                      }}
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#7ac796] bg-white text-[12px] font-extrabold text-[#067647]"
                      aria-label="Informace"
                      title="Informace"
                    >
                      i
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[19px] font-extrabold text-[#067647]">{price} Kč</div>
                </div>

                <div className="flex justify-end">
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
                          "rounded-2xl px-4 py-2.5 text-[13px] font-extrabold ring-1 transition",
                          orderDisabled
                            ? "cursor-not-allowed bg-gray-50 text-gray-300 ring-gray-200"
                            : "bg-white text-green-700 ring-green-600/70 hover:bg-green-600 hover:text-white",
                        ].join(" ")}
                      >
                        {t("add")}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => removeOne(selectedDate, row)}
                          className={darkMode ? "h-10 w-10 rounded-xl bg-slate-800 font-extrabold text-white ring-1 ring-white/10 hover:bg-slate-700" : "h-10 w-10 rounded-xl bg-white font-extrabold text-gray-900 ring-1 ring-black/10 hover:bg-gray-50"}
                        >
                          −
                        </button>
                        <div className="w-8 text-center text-[14px] font-extrabold">{qty}</div>
                        <button
                          type="button"
                          onClick={() => {
                            if (orderDisabled) return;
                            addOne(selectedDate, row);
                            setFlashKey(k);
                            window.setTimeout(() => setFlashKey((prev) => (prev === k ? null : prev)), 220);
                          }}
                          className={darkMode ? "h-10 w-10 rounded-xl bg-slate-800 font-extrabold text-white ring-1 ring-white/10 hover:bg-slate-700" : "h-10 w-10 rounded-xl bg-white font-extrabold text-gray-900 ring-1 ring-black/10 hover:bg-gray-50"}
                        >
                          +
                        </button>
                      </div>
                    )
                  ) : (
                    <div className={`rounded-2xl px-3 py-2 text-[12px] font-bold ring-1 ${darkMode ? "bg-slate-800 text-slate-200 ring-white/10" : "bg-green-50 text-green-700 ring-green-200"}`}>
                      {category?.trim() ? category : "Jídlo"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function JirkaSection() {
    const photoSources = ["/fotky/obchod-1.jpg", "/fotky/obchod-2.jpg", "/fotky/jidelna-1.jpg", "/fotky/jidelna-2.jpg"];

    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {photoSources.map((src) => (
            <div key={src} className={`overflow-hidden rounded-[28px] shadow-sm ring-1 ${darkMode ? "bg-slate-900 ring-white/10" : "bg-white ring-black/10"}`}>
              <img src={src} alt="Jiřka" className="h-56 w-full object-cover" />
            </div>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className={`rounded-[28px] border px-5 py-5 ${darkMode ? "border-white/10 bg-slate-900" : "border-[#dbeee2] bg-white"}`}>
            <div className={`text-[22px] font-extrabold ${darkMode ? "text-white" : "text-green-700"}`}>Jídelna</div>
            <div className="mt-3 space-y-2">
              {loadingSystemItems ? (
                <div className={`text-[14px] ${darkMode ? "text-slate-300" : "text-gray-500"}`}>{t("loading")}</div>
              ) : canteenHoursRows.length === 0 ? (
                <div className={`text-[14px] ${darkMode ? "text-slate-300" : "text-gray-500"}`}>Otevírací doba zatím není vyplněná.</div>
              ) : (
                canteenHoursRows.map((row) => (
                  <div
                    key={`canteen-${row.id}`}
                    className={`flex items-center justify-between rounded-2xl px-4 py-3 ring-1 ${darkMode ? "bg-slate-800 ring-white/10" : "bg-neutral-50 ring-black/5"}`}
                  >
                    <span className={`text-[14px] font-extrabold ${darkMode ? "text-white" : "text-[#1f2f56]"}`}>{row.label ?? "Den"}</span>
                    <span className={`text-[14px] font-semibold ${darkMode ? "text-slate-200" : "text-gray-700"}`}>{row.value_text ?? "—"}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={`rounded-[28px] border px-5 py-5 ${darkMode ? "border-white/10 bg-slate-900" : "border-[#dbeee2] bg-white"}`}>
            <div className={`text-[22px] font-extrabold ${darkMode ? "text-white" : "text-green-700"}`}>Obchod</div>
            <div className="mt-3 space-y-2">
              {loadingSystemItems ? (
                <div className={`text-[14px] ${darkMode ? "text-slate-300" : "text-gray-500"}`}>{t("loading")}</div>
              ) : shopHoursRows.length === 0 ? (
                <div className={`text-[14px] ${darkMode ? "text-slate-300" : "text-gray-500"}`}>Otevírací doba zatím není vyplněná.</div>
              ) : (
                shopHoursRows.map((row) => (
                  <div
                    key={`shop-${row.id}`}
                    className={`flex items-center justify-between rounded-2xl px-4 py-3 ring-1 ${darkMode ? "bg-slate-800 ring-white/10" : "bg-neutral-50 ring-black/5"}`}
                  >
                    <span className={`text-[14px] font-extrabold ${darkMode ? "text-white" : "text-[#1f2f56]"}`}>{row.label ?? "Den"}</span>
                    <span className={`text-[14px] font-semibold ${darkMode ? "text-slate-200" : "text-gray-700"}`}>{row.value_text ?? "—"}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function AboutSection() {
    return (
      <div className="space-y-4">
        <div className={`rounded-[28px] p-5 shadow-sm ring-1 ${darkMode ? "bg-slate-900 ring-white/10" : "bg-white ring-black/10"}`}>
          <div className={`text-[24px] font-extrabold ${darkMode ? "text-white" : "text-green-700"}`}>Jiřka</div>
          <div className={`mt-3 whitespace-pre-line text-[15px] leading-7 ${darkMode ? "text-slate-200" : "text-gray-700"}`}>
            {loadingSystemItems
              ? t("loading")
              : aboutTextRow?.value_text ||
                "Sem si potom doplníš článek o Jiřce, historii, nabídce a dalších informacích."}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-[28px] bg-green-50 p-5 ring-1 ring-green-100">
            <div className="text-[13px] font-extrabold uppercase tracking-wide text-green-700">{t("address")}</div>
            <div className="mt-2 text-[15px] font-semibold text-gray-700">Havlíčkova 72, 29001 Poděbrady</div>
          </div>

          <div className={`rounded-[28px] p-5 shadow-sm ring-1 ${darkMode ? "bg-slate-900 ring-white/10" : "bg-white ring-black/10"}`}>
            <div className={`text-[13px] font-extrabold uppercase tracking-wide ${darkMode ? "text-slate-300" : "text-green-700"}`}>IČO</div>
            <div className={`mt-2 text-[15px] font-semibold ${darkMode ? "text-slate-200" : "text-gray-700"}`}>Doplníme později</div>
          </div>

          <div className={`rounded-[28px] p-5 shadow-sm ring-1 ${darkMode ? "bg-slate-900 ring-white/10" : "bg-white ring-black/10"}`}>
            <div className={`text-[13px] font-extrabold uppercase tracking-wide ${darkMode ? "text-slate-300" : "text-green-700"}`}>Kontakt</div>
            <div className={`mt-2 text-[15px] font-semibold ${darkMode ? "text-slate-200" : "text-gray-700"}`}>325 612 154</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? "bg-slate-950 text-white" : "bg-[#f7faf8] text-gray-900"}`}>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} t={t} />

      <AllergensModal
        open={algOpen}
        onClose={() => setAlgOpen(false)}
        title={algTitle}
        allergens={algList}
        category={algCategory}
        darkMode={darkMode}
      />

      <DayPickerModal
        open={dayPickerOpen}
        onClose={() => setDayPickerOpen(false)}
        weekOffset={weekOffset}
        setWeekOffset={setWeekOffset}
        tabDays={tabDays}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        darkMode={darkMode}
        t={t}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        section={settingsSection}
        setSection={setSettingsSection}
        userName={userName}
        userEmail={userEmail}
        phone={userPhone}
        address={userAddress}
        onSaved={saveProfile}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        notifNews={notifNews}
        setNotifNews={setNotifNews}
        notifSurvey={notifSurvey}
        setNotifSurvey={setNotifSurvey}
        notifReview={notifReview}
        setNotifReview={setNotifReview}
        notifWeeklyMenu={notifWeeklyMenu}
        setNotifWeeklyMenu={setNotifWeeklyMenu}
        language={language}
        setLanguage={setLanguage}
        orders={orders}
        onRefreshOrders={refreshOrders}
        onTopup={topupCredit}
        onOpenPassword={() => setPasswordOpen(true)}
        t={t}
      />

      <ChangePasswordModal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        email={userEmail}
        darkMode={darkMode}
        t={t}
      />

      <div className={`sticky top-0 z-40 border-b backdrop-blur ${darkMode ? "border-white/10 bg-slate-950/90" : "border-black/5 bg-white/95"}`}>
        <div className="mx-auto w-full max-w-[1440px] px-6 pb-3 pt-3">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <Image
                src="/logo-na-mobil.png"
                alt="Jiřka"
                width={350}
                height={110}
                className="-ml-8 -mt-6 h-auto w-[330px] object-contain xl:w-[360px]"
                priority
              />
            </div>

            <div className="flex shrink-0 items-start gap-3">
              <StaffShortcut />
              <UserArea />
            </div>
          </div>

          <div className={`relative z-10 -mt-7 pl-7 text-[12px] font-semibold tracking-[0.01em] ${darkMode ? "text-slate-300" : "text-gray-500"}`}>
            {t("routeTagline")}
          </div>

          <div className="mt-2 h-[4px] w-full rounded-full bg-green-600" />
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1440px] px-6 py-6">
        <div className="grid grid-cols-[320px_minmax(0,1fr)] gap-6">
          <aside className="space-y-4">
            <div className="sticky top-[142px] space-y-4">
              <div className="space-y-3">
                <SidebarItem id="daily" label={t("menuShort")} icon="📋" />
                <SidebarItem id="order" label={t("orderShort")} icon="🍽️" />
                <SidebarItem id="jirka" label={t("jirka")} icon="🏪" />
                <SidebarItem id="about" label={t("about")} icon="ℹ️" />
              </div>

              <CartSidebarCard />
            </div>
          </aside>

          <main className={`rounded-[36px] border p-6 shadow-sm ring-1 ${darkMode ? "border-white/10 bg-slate-950 ring-white/10" : "border-[#dbeee2] bg-white ring-green-100/70"}`}>
            {activeSection === "daily" && <SectionHeaderDaily />}
            {activeSection === "order" && <SectionHeaderOrder />}

            <div className="mt-6">
              {(activeSection === "daily" || activeSection === "order") && zavreno ? (
                <div className="mb-4 rounded-2xl bg-red-50 p-4 font-semibold text-red-700 ring-2 ring-red-200/60">
                  {t("closedSunday")}
                </div>
              ) : null}

              {activeSection === "order" && orderDayHint(selectedDate, t) ? (
                <div className={`mb-4 rounded-2xl p-4 text-[14px] font-semibold ring-1 ${darkMode ? "bg-slate-900 text-slate-200 ring-white/10" : "bg-neutral-50 text-gray-600 ring-black/10"}`}>
                  {orderDayHint(selectedDate, t)}
                </div>
              ) : null}

              {activeSection === "daily" && <MenuList mode="daily" />}
              {activeSection === "order" && <MenuList mode="order" />}
              {activeSection === "jirka" && <JirkaSection />}
              {activeSection === "about" && <AboutSection />}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
