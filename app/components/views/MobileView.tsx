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
  zip_code: string;
  city: string;
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

  const fullAddress = [params.address.trim(), `${params.zip_code.trim()} ${params.city.trim()}`.trim()]
    .filter(Boolean)
    .join(", ");

  const { data: order, error: e1 } = await supabase
    .from("orders")
    .insert({
      user_id: uid,
      full_name: params.full_name.trim() || null,
      phone: params.phone.replace(/\D/g, "") || null,
      address: fullAddress || null,
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

/** ===================== i18n ===================== */
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
    zipCode: "PSČ",
    city: "Město",
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
    laterGateway: "Později přidáme platební bránu.",
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
    pickupMethod: "Způsob převzetí",
    delivery: "Doručení",
    pickup: "Osobní odběr",
    packaging: "Balení",
    preferredTime: "Preferuji čas doručení",
    optional: "(volitelné)",
    payment: "Platba",
    note: "Poznámka",
    recap: "Rekapitulace",
    total: "Celkem",
    foods: "Jídla",
    deliveryFee: "Doprava",
    orderSummary: "Souhrn objednávky",
    billingData: "Fakturační údaje",
    map: "Mapa",
    items: "Položky",
    goHome: "Přejít na hlavní stránku",
    contactOrderChange: "Pro změnu údajů v objednávce nás kontaktujte na tel. 325 612 154",
    noOrders: "Zatím tu nejsou žádné objednávky.",
    upcomingOrder: "Následující objednávka",
    pastOrder: "Vydaná objednávka",
    amount: "Zadat částku",
    min500: "Minimálně 500 Kč",
    choosePayment: "Vybrat platbu",
    cardEntry: "Zadat kartu",
    saveProfileOk: "Profil byl uložen.",
    chooseCountryCode: "Předvolba",
    selectTime: "Vybrat čas",
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
    address: "Street",
    zipCode: "ZIP",
    city: "City",
    agreeTerms: "I agree to the terms and personal data processing.",
    doneEmail: "Done. If email confirmation is needed, check your email and sign in.",
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
    laterGateway: "We will add the payment gateway later.",
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
    pickupMethod: "Pickup method",
    delivery: "Delivery",
    pickup: "Pickup",
    packaging: "Packaging",
    preferredTime: "Preferred delivery time",
    optional: "(optional)",
    payment: "Payment",
    note: "Note",
    recap: "Summary",
    total: "Total",
    foods: "Meals",
    deliveryFee: "Delivery",
    orderSummary: "Order summary",
    billingData: "Billing details",
    map: "Map",
    items: "Items",
    goHome: "Go to homepage",
    contactOrderChange: "To change order details, contact us at 325 612 154",
    noOrders: "No orders yet.",
    upcomingOrder: "Upcoming order",
    pastOrder: "Completed order",
    amount: "Enter amount",
    min500: "Minimum 500 CZK",
    choosePayment: "Choose payment",
    cardEntry: "Enter card",
    saveProfileOk: "Profile saved.",
    chooseCountryCode: "Country code",
    selectTime: "Choose time",
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
    address: "Вулиця",
    zipCode: "Індекс",
    city: "Місто",
    agreeTerms: "Я погоджуюся з умовами та обробкою персональних даних.",
    doneEmail: "Готово. Якщо потрібне підтвердження електронною поштою, перевірте її та увійдіть.",
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
    weeklyMenuEmailSub: "Я хочу отримувати тижневе меню на електронну пошту.",
    darkMode: "Темний режим",
    language: "Мова",
    topUpCredit: "Поповнити кредит",
    orders: "Замовлення",
    settings: "Налаштування",
    personalData: "Особисті дані",
    done: "Готово",
    pay: "Оплатити",
    close: "Закрити",
    laterGateway: "Платіжний шлюз буде додано пізніше.",
    today: "Сьогодні",
    tomorrow: "Завтра",
    closedSunday: "У неділю зачинено.",
    orderOnlyTodayFuture: "Можна замовляти лише на сьогодні до 13:00 або на майбутні дні.",
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
    pickupMethod: "Спосіб отримання",
    delivery: "Доставка",
    pickup: "Самовивіз",
    packaging: "Упаковка",
    preferredTime: "Бажаний час доставки",
    optional: "(необов'язково)",
    payment: "Оплата",
    note: "Примітка",
    recap: "Підсумок",
    total: "Разом",
    foods: "Страви",
    deliveryFee: "Доставка",
    orderSummary: "Підсумок замовлення",
    billingData: "Платіжні дані",
    map: "Мапа",
    items: "Позиції",
    goHome: "Перейти на головну сторінку",
    contactOrderChange: "Щоб змінити дані замовлення, зв'яжіться з нами за тел. 325 612 154",
    noOrders: "Замовлень поки немає.",
    upcomingOrder: "Майбутнє замовлення",
    pastOrder: "Видане замовлення",
    amount: "Введіть суму",
    min500: "Мінімум 500 CZK",
    choosePayment: "Оберіть оплату",
    cardEntry: "Ввести картку",
    saveProfileOk: "Профіль збережено.",
    chooseCountryCode: "Код країни",
    selectTime: "Вибрати час",
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
    address: "Straße",
    zipCode: "PLZ",
    city: "Stadt",
    agreeTerms: "Ich stimme den Bedingungen und der Verarbeitung personenbezogener Daten zu.",
    doneEmail: "Fertig. Wenn eine E-Mail-Bestätigung nötig ist, prüfe deine E-Mails und melde dich an.",
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
    laterGateway: "Das Zahlungsportal wird später hinzugefügt.",
    today: "Heute",
    tomorrow: "Morgen",
    closedSunday: "Sonntags geschlossen.",
    orderOnlyTodayFuture: "Bestellungen sind nur für heute bis 13:00 Uhr oder für zukünftige Tage möglich.",
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
    pickupMethod: "Abholmethode",
    delivery: "Lieferung",
    pickup: "Abholung",
    packaging: "Verpackung",
    preferredTime: "Bevorzugte Lieferzeit",
    optional: "(optional)",
    payment: "Zahlung",
    note: "Notiz",
    recap: "Zusammenfassung",
    total: "Gesamt",
    foods: "Gerichte",
    deliveryFee: "Lieferung",
    orderSummary: "Bestellübersicht",
    billingData: "Rechnungsdaten",
    map: "Karte",
    items: "Positionen",
    goHome: "Zur Startseite",
    contactOrderChange: "Um Bestelldaten zu ändern, kontaktiere uns unter 325 612 154",
    noOrders: "Noch keine Bestellungen.",
    upcomingOrder: "Kommende Bestellung",
    pastOrder: "Abgeschlossene Bestellung",
    amount: "Betrag eingeben",
    min500: "Mindestens 500 CZK",
    choosePayment: "Zahlung wählen",
    cardEntry: "Karte eingeben",
    saveProfileOk: "Profil gespeichert.",
    chooseCountryCode: "Ländervorwahl",
    selectTime: "Zeit wählen",
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
    address: "Calle",
    zipCode: "Código postal",
    city: "Ciudad",
    agreeTerms: "Acepto los términos y el tratamiento de datos personales.",
    doneEmail: "Hecho. Si hace falta confirmación por correo, revisa tu email e inicia sesión.",
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
    laterGateway: "La pasarela de pago se añadirá más tarde.",
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
    pickupMethod: "Método de recogida",
    delivery: "Entrega",
    pickup: "Recogida",
    packaging: "Embalaje",
    preferredTime: "Hora preferida de entrega",
    optional: "(opcional)",
    payment: "Pago",
    note: "Nota",
    recap: "Resumen",
    total: "Total",
    foods: "Comidas",
    deliveryFee: "Entrega",
    orderSummary: "Resumen del pedido",
    billingData: "Datos de facturación",
    map: "Mapa",
    items: "Artículos",
    goHome: "Ir a la página principal",
    contactOrderChange: "Para cambiar los datos del pedido, contáctanos al 325 612 154",
    noOrders: "Todavía no hay pedidos.",
    upcomingOrder: "Pedido próximo",
    pastOrder: "Pedido completado",
    amount: "Introducir cantidad",
    min500: "Mínimo 500 CZK",
    choosePayment: "Elegir pago",
    cardEntry: "Introducir tarjeta",
    saveProfileOk: "Perfil guardado.",
    chooseCountryCode: "Prefijo del país",
    selectTime: "Elegir hora",
  },
} as const;

type LanguageCode = keyof typeof translations;

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

/** ===================== Allergens ===================== */
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

type OrderRowLite = {
  id: string;
  created_at: string | null;
  datum: string | null;
  total: number | null;
  status: string | null;
  delivery_mode: string | null;
  name?: string | null;
};

type MobileViewProps = {
  onOpenCart?: () => void;
};

type SettingsSection =
  | "menu"
  | "personal"
  | "notifications"
  | "language"
  | "topup"
  | "orders";

type CountryCodeOption = {
  code: string;
  flag: string;
  dial: string;
};

const COUNTRY_CODES: CountryCodeOption[] = [
  { code: "CZ", flag: "🇨🇿", dial: "+420" },
  { code: "SK", flag: "🇸🇰", dial: "+421" },
  { code: "DE", flag: "🇩🇪", dial: "+49" },
  { code: "AT", flag: "🇦🇹", dial: "+43" },
  { code: "PL", flag: "🇵🇱", dial: "+48" },
  { code: "UA", flag: "🇺🇦", dial: "+380" },
  { code: "ES", flag: "🇪🇸", dial: "+34" },
  { code: "GB", flag: "🇬🇧", dial: "+44" },
];

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
  darkMode = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
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
        <div className={`flex items-center justify-between px-4 pb-2 pt-3 ${darkMode ? "border-b border-white/10" : "border-b border-gray-100"}`}>
          <div className={`text-[15px] font-extrabold ${darkMode ? "text-white" : "text-gray-900"}`}>{title}</div>
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

/** ===================== Auth Modal ===================== */
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
    <BaseModal
      open={open}
      onClose={onClose}
      title={title || "Informace"}
      darkMode={darkMode}
      maxWidth="max-w-md"
    >
      <div className="space-y-4 p-4">
        <div>
          <div
            className={`text-[11px] font-extrabold uppercase tracking-wide ${
              darkMode ? "text-slate-300" : "text-gray-500"
            }`}
          >
            Alergeny
          </div>

          {allergens.length > 0 ? (
            <div className="mt-2 space-y-2">
              {allergens.map((item, idx) => (
                <div
                  key={`${item}-${idx}`}
                  className={`rounded-2xl px-3 py-2 text-[13px] font-semibold ring-1 ${
                    darkMode
                      ? "bg-slate-800 text-slate-100 ring-white/10"
                      : "bg-neutral-50 text-gray-700 ring-black/10"
                  }`}
                >
                  {item}
                </div>
              ))}
            </div>
          ) : (
            <div
              className={`mt-2 rounded-2xl px-3 py-2 text-[13px] font-semibold ring-1 ${
                darkMode
                  ? "bg-slate-800 text-slate-300 ring-white/10"
                  : "bg-neutral-50 text-gray-500 ring-black/10"
              }`}
            >
              Bez uvedených alergenů.
            </div>
          )}
        </div>

        <div>
          <div
            className={`text-[11px] font-extrabold uppercase tracking-wide ${
              darkMode ? "text-slate-300" : "text-gray-500"
            }`}
          >
            Kategorie
          </div>

          <div
            className={`mt-2 rounded-2xl px-3 py-2 text-[13px] font-semibold ring-1 ${
              darkMode
                ? "bg-slate-800 text-slate-100 ring-white/10"
                : "bg-neutral-50 text-gray-700 ring-black/10"
            }`}
          >
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/40" aria-label="Zavřít" />
      <div className="relative w-full max-w-md rounded-3xl bg-white p-4 shadow-2xl ring-1 ring-black/10">
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

        <div className="mt-3 space-y-2.5">
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

/** ===================== Settings / sections ===================== */
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

  return (
    <BaseModal open={open} onClose={onClose} title={t("changePassword")} darkMode={darkMode}>
      <div className="space-y-3 p-4">
        <label className="block">
          <div className={`mb-1 text-[11px] font-extrabold ${darkMode ? "text-slate-300" : "text-gray-600"}`}>{t("oldPassword")}</div>
          <input
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            type="password"
            className={`w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none ring-1 ${darkMode ? "bg-slate-800 text-white ring-white/10 focus:ring-green-500" : "bg-white ring-black/10 focus:ring-2 focus:ring-green-600"}`}
          />
        </label>

        <label className="block">
          <div className={`mb-1 text-[11px] font-extrabold ${darkMode ? "text-slate-300" : "text-gray-600"}`}>{t("newPassword")}</div>
          <input
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            type="password"
            className={`w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none ring-1 ${darkMode ? "bg-slate-800 text-white ring-white/10 focus:ring-green-500" : "bg-white ring-black/10 focus:ring-2 focus:ring-green-600"}`}
          />
        </label>

        <label className="block">
          <div className={`mb-1 text-[11px] font-extrabold ${darkMode ? "text-slate-300" : "text-gray-600"}`}>{t("newPasswordAgain")}</div>
          <input
            value={newPassword2}
            onChange={(e) => setNewPassword2(e.target.value)}
            type="password"
            className={`w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none ring-1 ${darkMode ? "bg-slate-800 text-white ring-white/10 focus:ring-green-500" : "bg-white ring-black/10 focus:ring-2 focus:ring-green-600"}`}
          />
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

  const darkCard = darkMode
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
      maxWidth="max-w-lg"
    >
      <div className="max-h-[78dvh] overflow-auto p-4">
        {section === "menu" ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setSection("personal")}
              className={`w-full rounded-2xl px-4 py-4 text-left text-[13px] font-extrabold ring-1 ${darkCard}`}
            >
              {t("personalData")}
            </button>

            <button
              type="button"
              onClick={() => setSection("notifications")}
              className={`w-full rounded-2xl px-4 py-4 text-left text-[13px] font-extrabold ring-1 ${darkCard}`}
            >
              {t("notifications")}
            </button>

            <div className={`flex items-center justify-between rounded-2xl px-4 py-4 text-left text-[13px] font-extrabold ring-1 ${darkCard}`}>
              <span>{t("darkMode")}</span>
              <Toggle checked={darkMode} onChange={setDarkMode} />
            </div>

            <button
              type="button"
              onClick={() => setSection("language")}
              className={`flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left text-[13px] font-extrabold ring-1 ${darkCard}`}
            >
              <span>{t("language")}</span>
              <span className="text-xl">{languageFlag}</span>
            </button>

            <button
              type="button"
              onClick={() => setSection("topup")}
              className={`w-full rounded-2xl px-4 py-4 text-left text-[13px] font-extrabold ring-1 ${darkCard}`}
            >
              {t("topUpCredit")}
            </button>

            <button
              type="button"
              onClick={() => setSection("orders")}
              className={`w-full rounded-2xl px-4 py-4 text-left text-[13px] font-extrabold ring-1 ${darkCard}`}
            >
              {t("orders")}
            </button>
          </div>
        ) : null}

        {section === "personal" ? (
          <div className="space-y-3">
            <label className="block">
              <div className={`mb-1 text-[11px] font-extrabold ${darkMode ? "text-slate-300" : "text-gray-600"}`}>{t("fullName")}</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none ring-1 ${darkMode ? "bg-slate-800 text-white ring-white/10" : "bg-white ring-black/10"}`}
              />
            </label>

            <label className="block">
              <div className={`mb-1 text-[11px] font-extrabold ${darkMode ? "text-slate-300" : "text-gray-600"}`}>{t("email")}</div>
              <input
                value={userEmail}
                readOnly
                className={`w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none ring-1 ${darkMode ? "bg-slate-800 text-slate-300 ring-white/10" : "bg-gray-50 text-gray-500 ring-black/10"}`}
              />
            </label>

            <label className="block">
              <div className={`mb-1 text-[11px] font-extrabold ${darkMode ? "text-slate-300" : "text-gray-600"}`}>{t("phone")}</div>
              <input
                value={phoneLocal}
                onChange={(e) => setPhoneLocal(formatPhoneCz(e.target.value))}
                inputMode="numeric"
                className={`w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none ring-1 ${darkMode ? "bg-slate-800 text-white ring-white/10" : "bg-white ring-black/10"}`}
              />
            </label>

            <label className="block">
              <div className={`mb-1 text-[11px] font-extrabold ${darkMode ? "text-slate-300" : "text-gray-600"}`}>{t("address")}</div>
              <input
                value={addressLocal}
                onChange={(e) => setAddressLocal(e.target.value)}
                className={`w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none ring-1 ${darkMode ? "bg-slate-800 text-white ring-white/10" : "bg-white ring-black/10"}`}
              />
            </label>

            {msg ? (
              <div className={`rounded-2xl px-3 py-2 text-[12px] font-bold ring-1 ${darkMode ? "bg-slate-800 text-slate-100 ring-white/10" : "bg-neutral-50 text-neutral-700 ring-black/10"}`}>
                {msg}
              </div>
            ) : null}

            <button
              type="button"
              onClick={onOpenPassword}
              className={`text-[12px] font-bold underline underline-offset-4 ${darkMode ? "text-slate-300" : "text-gray-600"}`}
            >
              {t("changePassword")}
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSection("menu")}
                className={`flex-1 rounded-2xl px-4 py-3 text-[13px] font-extrabold ring-1 ${darkCard}`}
              >
                {t("back")}
              </button>
              <button
                type="button"
                onClick={savePersonal}
                disabled={busy}
                className="flex-1 rounded-2xl bg-green-600 px-4 py-3 text-[13px] font-extrabold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {t("save")}
              </button>
            </div>
          </div>
        ) : null}

        {section === "notifications" ? (
          <div className="space-y-3">
            {[
              {
                label: t("newsOffers"),
                sub: "E-mail",
                checked: notifNews,
                setChecked: setNotifNews,
              },
              {
                label: t("satisfactionSurvey"),
                sub: "Ohodnoťte, jak se vám líbí Jiřka.",
                checked: notifSurvey,
                setChecked: setNotifSurvey,
              },
              {
                label: t("productReview"),
                sub: "Krátké hodnocení po nákupu jídla.",
                checked: notifReview,
                setChecked: setNotifReview,
              },
              {
                label: t("weeklyMenuEmail"),
                sub: t("weeklyMenuEmailSub"),
                checked: notifWeeklyMenu,
                setChecked: setNotifWeeklyMenu,
              },
            ].map((item, idx) => (
              <div key={idx} className={`rounded-2xl p-3 ring-1 ${darkCard}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-extrabold">{item.label}</div>
                    <div className={`mt-1 text-[12px] ${darkMode ? "text-slate-300" : "text-gray-500"}`}>{item.sub}</div>
                  </div>
                  <Toggle checked={item.checked} onChange={item.setChecked} />
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setSection("menu")}
              className={`w-full rounded-2xl px-4 py-3 text-[13px] font-extrabold ring-1 ${darkCard}`}
            >
              {t("back")}
            </button>
          </div>
        ) : null}

        {section === "language" ? (
          <div className="space-y-2">
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
                    "flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left ring-1",
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

            <button
              type="button"
              onClick={() => setSection("menu")}
              className={`mt-2 w-full rounded-2xl px-4 py-3 text-[13px] font-extrabold ring-1 ${darkCard}`}
            >
              {t("back")}
            </button>
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

            <div className={`rounded-2xl p-3 ring-1 ${darkCard}`}>
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
              <button
                type="button"
                onClick={() => setSection("menu")}
                className={`flex-1 rounded-2xl px-4 py-3 text-[13px] font-extrabold ring-1 ${darkCard}`}
              >
                {t("back")}
              </button>
              <button
                type="button"
                onClick={doTopup}
                disabled={busy}
                className="flex-1 rounded-2xl bg-green-600 px-4 py-3 text-[13px] font-extrabold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {t("pay")}
              </button>
            </div>
          </div>
        ) : null}

        {section === "orders" ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={onRefreshOrders}
              className={`w-full rounded-2xl px-4 py-3 text-[13px] font-extrabold ring-1 ${darkCard}`}
            >
              Obnovit
            </button>

            {orders.length === 0 ? (
              <div className={`rounded-2xl p-3 text-[13px] ring-1 ${darkCard}`}>{t("noOrders")}</div>
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

            <button
              type="button"
              onClick={() => setSection("menu")}
              className={`w-full rounded-2xl px-4 py-3 text-[13px] font-extrabold ring-1 ${darkCard}`}
            >
              {t("back")}
            </button>
          </div>
        ) : null}
      </div>
    </BaseModal>
  );
}

/** ===================== Cart Sheet ===================== */
function PackagingInfoModal({
  open,
  onClose,
  title,
  imgSrc,
  lines,
  darkMode,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  imgSrc: string;
  lines: string[];
  darkMode: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[270] flex items-center justify-center p-4">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/40" aria-label="Zavřít" />
      <div
        className={`relative w-full max-w-md overflow-hidden rounded-3xl shadow-2xl ring-1 ${
          darkMode ? "bg-slate-900 text-white ring-white/10" : "bg-white ring-black/10"
        }`}
      >
        <div
          className={`flex items-center justify-between px-4 pb-2 pt-3 ${
            darkMode ? "border-b border-white/10" : "border-b border-gray-100"
          }`}
        >
          <div className={`text-[14px] font-extrabold ${darkMode ? "text-white" : "text-gray-900"}`}>
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`h-10 w-10 rounded-2xl font-extrabold ring-1 ${
              darkMode
                ? "bg-slate-800 text-white ring-white/10 hover:bg-slate-700"
                : "bg-white ring-black/10 hover:bg-gray-50"
            }`}
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl ring-1 ${
                darkMode ? "bg-slate-800 ring-white/10" : "bg-white ring-black/10"
              }`}
            >
              <Image src={imgSrc} alt={title} width={56} height={56} />
            </div>

            <div className="min-w-0">
              <div className={`text-[13px] font-extrabold ${darkMode ? "text-white" : "text-gray-900"}`}>
                {title}
              </div>
              <div className="mt-1 space-y-1">
                {lines.map((line, i) => (
                  <div key={i} className={`text-[13px] ${darkMode ? "text-slate-200" : "text-gray-700"}`}>
                    {line}
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

function CartSheet({
  open,
  onClose,
  authed,
  onNeedLogin,
  credit,
  darkMode,
  t,
}: {
  open: boolean;
  onClose: () => void;
  authed: boolean;
  onNeedLogin: () => void;
  credit: number;
  darkMode: boolean;
  t: (key: keyof typeof translations["cs"]) => string;
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

  const [zipCode, setZipCode] = useState("");
  const [city, setCity] = useState("");
  const [countryCode, setCountryCode] = useState<CountryCodeOption>(COUNTRY_CODES[0]);
  const [countryOpen, setCountryOpen] = useState(false);
  const [timeEnabled, setTimeEnabled] = useState(false);

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
    setCountryOpen(false);
    setTimeEnabled(false);
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

        const rawAddress = String((p as any)?.address ?? "");
        if (!address.trim() && rawAddress) {
          const parts = rawAddress.split(",");
          const street = parts[0]?.trim() ?? "";
          const second = parts[1]?.trim() ?? "";
          const zip = second.split(" ")[0] ?? "";
          const cityName = second.split(" ").slice(1).join(" ");
          setAddress(street);
          setZipCode(zip);
          setCity(cityName);
        }
      } catch {}
    })();

    return () => {
      alive = false;
    };
  }, [open, authed, step, setName, setPhone, setAddress, address]);

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

  const pill = darkMode ? "rounded-2xl ring-1 ring-white/10 bg-slate-800 text-white" : "rounded-2xl ring-1 ring-black/10 bg-white";
  const pillSoft = darkMode ? "rounded-2xl ring-1 ring-green-500/20 bg-slate-800 text-white" : "rounded-2xl ring-1 ring-green-200/70 bg-green-50/40";
  const btnPrimary =
    "rounded-2xl px-4 py-3 text-[13px] font-extrabold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50";
  const btnGhost =
    darkMode
      ? "rounded-2xl px-4 py-3 text-[13px] font-extrabold bg-slate-800 text-white ring-1 ring-white/10 hover:bg-slate-700"
      : "rounded-2xl px-4 py-3 text-[13px] font-extrabold bg-white ring-1 ring-black/10 hover:bg-gray-50";
  const qtyBtn =
    darkMode
      ? "h-8 w-8 rounded-xl bg-slate-700 ring-1 ring-white/10 text-white font-extrabold hover:bg-slate-600 active:scale-[0.98] disabled:opacity-40"
      : "h-8 w-8 rounded-xl bg-white ring-1 ring-black/10 text-gray-900 font-extrabold hover:bg-gray-50 active:scale-[0.98] disabled:opacity-40";

  const cartDays = useMemo(() => Array.from(new Set(cart.map((it) => it.datum))).sort(), [cart]);

  const timeSlots = useMemo(() => {
    const toMin = (time: string) => {
      const [h, m] = time.split(":").map(Number);
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
    for (let n = start; n + step <= end; n += step) {
      const from = toStr(n);
      const to = toStr(n + step);
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
    if (cartDays.length === 0) return t("selectTime");
    const pickedDays = cartDays.filter((d) => (timesByDay as any)?.[d]);
    if (pickedDays.length === 0) return t("selectTime");

    if (cartDays.length === 1) {
      const d = cartDays[0];
      const picked = (timesByDay as any)?.[d] as DayTime;
      if (!picked) return t("selectTime");
      return `${formatCartDay(d)} ${picked.from}–${picked.to}`;
    }

    if (sameTimeForAll) {
      const d = pickedDays[0];
      const picked = (timesByDay as any)?.[d] as DayTime;
      if (!picked) return t("selectTime");
      return `Všechny dny ${picked.from}–${picked.to}`;
    }

    const d0 = pickedDays[0];
    const t0 = (timesByDay as any)?.[d0] as DayTime;
    if (!t0) return t("selectTime");
    return `${formatCartDay(d0)} ${t0.from}–${t0.to}${pickedDays.length > 1 ? ` +${pickedDays.length - 1}` : ""}`;
  }, [cartDays, timesByDay, sameTimeForAll, t]);

  const evalScrollHint = () => {
    const el = scrollRef.current;
    if (!el) return;
    const moreDown = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
    setCanScrollDown(moreDown);
  };

  useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(evalScrollHint, 50);
    return () => clearTimeout(timeout);
  }, [open, cartCount, step]);

  async function finalizeOrder() {
    setBusy(true);
    setMsg(null);
    try {
      const id = await createOrder({
        full_name: name,
        phone: `${countryCode.dial} ${digitsOnly(phone)}`,
        address,
        zip_code: zipCode,
        city,
        note,
        delivery_mode: deliveryMode,
        packaging_mode: packagingMode,
        payment_method: payment,
        times_by_day: timeEnabled ? timesByDay : {},
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

      if (!name.trim() || digitsOnly(phone).length < 6) {
        setMsg("Vyplň jméno a telefon.");
        return;
      }

      if (deliveryMode === "delivery") {
        if (!address.trim()) {
          setMsg("Vyplň ulici a číslo popisné.");
          return;
        }
        if (!zipCode.trim() || !city.trim()) {
          setMsg("Vyplň PSČ a město.");
          return;
        }
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
        <div className={`relative max-h-[80dvh] w-full max-w-md overflow-hidden rounded-3xl shadow-2xl ring-1 ${darkMode ? "bg-slate-900 text-white ring-white/10" : "bg-white ring-black/10"}`}>
          <div className={`flex items-center justify-between px-4 pb-2 pt-3 ${darkMode ? "border-b border-white/10" : "border-b border-gray-100"}`}>
            <div className={`text-[14px] font-extrabold ${darkMode ? "text-white" : "text-gray-900"}`}>{title}</div>
            <button
              type="button"
              onClick={onClose}
              className={`h-10 w-10 rounded-2xl font-extrabold ring-1 ${darkMode ? "bg-slate-800 text-white ring-white/10 hover:bg-slate-700" : "bg-white ring-black/10 hover:bg-gray-50"}`}
            >
              ✕
            </button>
          </div>

          <div className="max-h-[70dvh] space-y-2 overflow-auto p-3">
            {options.map((option) => {
              const active = option.id === value;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onPick(option.id);
                    onClose();
                  }}
                  className={[
                    "w-full rounded-2xl px-4 py-3 text-left ring-1 transition",
                    active
                      ? "bg-green-50 text-gray-900 ring-green-300/70"
                      : darkMode
                      ? "bg-slate-800 text-white ring-white/10 hover:bg-slate-700"
                      : "bg-white text-gray-900 ring-black/10 hover:bg-gray-50",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[13px] font-extrabold">{option.label}</div>
                      {option.sub ? (
                        <div className={`text-[12px] ${darkMode ? "text-slate-300" : "text-gray-500"}`}>{option.sub}</div>
                      ) : null}
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

  function CountryCodeSheet() {
    if (!countryOpen) return null;

    return (
      <div className="fixed inset-0 z-[265] flex items-center justify-center p-4">
        <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setCountryOpen(false)} />
        <div className={`relative max-h-[80dvh] w-full max-w-md overflow-hidden rounded-3xl shadow-2xl ring-1 ${darkMode ? "bg-slate-900 text-white ring-white/10" : "bg-white ring-black/10"}`}>
          <div className={`flex items-center justify-between px-4 pb-2 pt-3 ${darkMode ? "border-b border-white/10" : "border-b border-gray-100"}`}>
            <div className={`text-[14px] font-extrabold ${darkMode ? "text-white" : "text-gray-900"}`}>{t("chooseCountryCode")}</div>
            <button
              type="button"
              onClick={() => setCountryOpen(false)}
              className={`h-10 w-10 rounded-2xl font-extrabold ring-1 ${darkMode ? "bg-slate-800 text-white ring-white/10 hover:bg-slate-700" : "bg-white ring-black/10 hover:bg-gray-50"}`}
            >
              ✕
            </button>
          </div>

          <div className="max-h-[70dvh] space-y-2 overflow-auto p-3">
            {COUNTRY_CODES.map((item) => {
              const active = item.dial === countryCode.dial;
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    setCountryCode(item);
                    setCountryOpen(false);
                  }}
                  className={[
                    "flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left ring-1",
                    active
                      ? "bg-green-50 text-gray-900 ring-green-300/70"
                      : darkMode
                      ? "bg-slate-800 text-white ring-white/10 hover:bg-slate-700"
                      : "bg-white text-gray-900 ring-black/10 hover:bg-gray-50",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{item.flag}</span>
                    <span className="text-[13px] font-extrabold">{item.dial}</span>
                  </div>
                  <span className="font-extrabold text-green-700">{active ? "✓" : ""}</span>
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
          <div className={`text-[12px] font-extrabold ${darkMode ? "text-slate-200" : "text-gray-700"}`}>{label}</div>
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
    [pill, darkMode]
  );

  const RowInput = useCallback(
    ({
      label,
      value,
      onChange,
      placeholder,
      inputMode,
      autoComplete,
      maxWidth = "w-[210px] max-w-[210px]",
    }: {
      label: string;
      value: string;
      onChange: (v: string) => void;
      placeholder?: string;
      inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
      autoComplete?: string;
      maxWidth?: string;
    }) => (
      <div className={pill + " p-3"}>
        <div className="flex items-center justify-between gap-3">
          <div className={`shrink-0 text-[12px] font-extrabold ${darkMode ? "text-slate-200" : "text-gray-700"}`}>{label}</div>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            inputMode={inputMode}
            autoComplete={autoComplete}
            className={`${maxWidth} rounded-2xl px-3 py-2.5 text-[13px] font-semibold outline-none ring-1 ${darkMode ? "bg-slate-700 text-white ring-white/10" : "bg-white ring-black/10"}`}
          />
        </div>
      </div>
    ),
    [pill, darkMode]
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
        <div className={`text-[12px] font-extrabold ${darkMode ? "text-slate-200" : "text-gray-700"}`}>{label}</div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`mt-2 min-h-[70px] w-full rounded-2xl px-3 py-3 text-[13px] font-semibold outline-none ring-1 ${darkMode ? "bg-slate-700 text-white ring-white/10" : "bg-white ring-black/10"}`}
        />
      </div>
    ),
    [pill, darkMode]
  );

  if (!open) return null;

  const packagingLabel =
    packagingMode === "plastic"
      ? "Plastová krabička"
      : packagingMode === "rekrabicka"
      ? "REkrabička"
      : "Jídlonosič";

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
        active
          ? "bg-green-50 text-gray-900 ring-green-300/70"
          : darkMode
          ? "bg-slate-800 text-white ring-white/10 hover:bg-slate-700"
          : "bg-white ring-black/10 hover:bg-gray-50",
      ].join(" ");

    const infoBtn =
      darkMode
        ? "h-9 w-9 rounded-2xl bg-slate-700 ring-1 ring-white/10 hover:bg-slate-600 font-extrabold flex items-center justify-center"
        : "h-9 w-9 rounded-2xl bg-white ring-1 ring-black/10 hover:bg-gray-50 font-extrabold flex items-center justify-center";

    const pricePill =
      "rounded-full bg-green-50 text-green-700 ring-1 ring-green-200 px-2 py-1 text-[11px] font-extrabold leading-none whitespace-nowrap";

    const PriceLines = ({ lines }: { lines: string[] }) => (
      <div className="flex flex-col items-end gap-1">
        {lines.map((text, idx) => (
          <div key={idx} className={pricePill}>
            {text}
          </div>
        ))}
      </div>
    );

    return (
      <div className="fixed inset-0 z-[260] flex items-center justify-center p-4">
        <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setPickOpen(null)} />
        <div className={`relative max-h-[80dvh] w-full max-w-md overflow-hidden rounded-3xl shadow-2xl ring-1 ${darkMode ? "bg-slate-900 text-white ring-white/10" : "bg-white ring-black/10"}`}>
          <div className={`flex items-center justify-between px-4 pb-2 pt-3 ${darkMode ? "border-b border-white/10" : "border-b border-gray-100"}`}>
            <div className={`text-[14px] font-extrabold ${darkMode ? "text-white" : "text-gray-900"}`}>Balení</div>
            <button
              type="button"
              onClick={() => setPickOpen(null)}
              className={`h-10 w-10 rounded-2xl font-extrabold ring-1 ${darkMode ? "bg-slate-800 text-white ring-white/10 hover:bg-slate-700" : "bg-white ring-black/10 hover:bg-gray-50"}`}
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
                <div className="text-[13px] font-extrabold">Plastová krabička</div>
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
                <div className="text-[13px] font-extrabold">REkrabička</div>
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
                <div className="text-[13px] font-extrabold">Jídlonosič</div>
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
              className={btnGhost + " w-full"}
            >
              {t("close")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const fullAddressForMap = encodeURIComponent(
    [address.trim(), zipCode.trim(), city.trim()].filter(Boolean).join(", ") || "Havlíčkova 72, Poděbrady"
  );

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/40" aria-label="Zavřít" />

      <div
        className={[
          "relative w-full max-w-[680px] overflow-hidden rounded-3xl shadow-2xl ring-1",
          darkMode ? "bg-slate-900 text-white ring-white/10" : "bg-white ring-black/10",
        ].join(" ")}
      >
        <div className={`flex items-center justify-between px-4 pb-2 pt-3 ${darkMode ? "border-b border-white/10" : "border-b border-gray-100"}`}>
          <div className={`text-[14px] font-extrabold ${darkMode ? "text-white" : "text-gray-900"}`}>
            {step === "cart" && t("cart")}
            {step === "checkout" && "Dokončení"}
            {step === "done" && t("orderSummary")}
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`h-10 w-10 rounded-2xl font-extrabold ring-1 ${darkMode ? "bg-slate-800 text-white ring-white/10 hover:bg-slate-700" : "bg-white ring-black/10 hover:bg-gray-50"}`}
          >
            ✕
          </button>
        </div>

        {step === "cart" ? (
          <div className="relative">
            <div ref={scrollRef} onScroll={evalScrollHint} className="max-h-[70dvh] overflow-auto px-4 pb-28 pt-3">
              {cartCount === 0 ? (
                <div className={`rounded-2xl p-3 text-[13px] ring-1 ${darkMode ? "bg-slate-800 text-slate-300 ring-white/10" : "bg-neutral-50 text-gray-600 ring-black/10"}`}>
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
                          <div className={`rounded-xl px-2.5 py-1.5 text-[12px] font-extrabold ring-1 ${darkMode ? "bg-slate-700 text-white ring-white/10" : "bg-white text-[#1f2f56] ring-black/10"}`}>
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
                                className={`flex items-center gap-2 py-2 last:border-b-0 ${darkMode ? "border-b border-white/10" : "border-b border-green-200/50"}`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className={`break-words text-[14px] font-extrabold leading-snug ${darkMode ? "text-white" : "text-gray-900"}`}>
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
                <div className={`h-10 bg-gradient-to-t ${darkMode ? "from-slate-900 to-transparent" : "from-white to-transparent"}`} />
                <div className="-mt-6 flex justify-center">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full shadow ring-1 ${darkMode ? "bg-slate-800/90 text-white ring-white/10" : "bg-white/90 text-gray-700 ring-black/10"}`}>
                    ↓
                  </div>
                </div>
              </div>
            ) : null}

            <div className={`absolute bottom-0 left-0 right-0 ${darkMode ? "border-t border-white/10 bg-slate-900" : "border-t border-gray-100 bg-white"}`}>
              <div className="px-4 py-3">
                <div className={pill + " p-3"}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className={`text-[11px] font-bold ${darkMode ? "text-slate-300" : "text-gray-500"}`}>{t("total")}</div>
                      <div className={`text-[18px] font-extrabold ${darkMode ? "text-white" : "text-gray-900"}`}>{total} Kč</div>
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

                  {authed && credit >= 0 ? (
                    <div className={`mt-2 text-[12px] ${darkMode ? "text-slate-300" : "text-gray-500"}`}>
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
                  label={t("pickupMethod")}
                  value={deliveryMode === "delivery" ? `${t("delivery")} (Doprava 10 Kč)` : t("pickup")}
                  onClick={() => setPickOpen("delivery")}
                />

                <RowInput
                  label={t("fullName")}
                  value={name}
                  onChange={setName}
                  placeholder="Vojtěch Pavlík"
                  autoComplete="name"
                />

                <div className={pill + " p-3"}>
                  <div className="flex items-center justify-between gap-3">
                    <div className={`shrink-0 text-[12px] font-extrabold ${darkMode ? "text-slate-200" : "text-gray-700"}`}>{t("phone")}</div>
                    <div className="flex w-[210px] max-w-[210px] items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCountryOpen(true)}
                        className={`flex shrink-0 items-center gap-1 rounded-2xl px-2.5 py-2.5 text-[12px] font-extrabold ring-1 ${darkMode ? "bg-slate-700 text-white ring-white/10" : "bg-white text-gray-900 ring-black/10"}`}
                      >
                        <span>{countryCode.flag}</span>
                        <span>{countryCode.dial}</span>
                      </button>

                      <input
                        value={phone}
                        onChange={(e) => setPhone(formatPhoneCz(e.target.value))}
                        placeholder="777 777 777"
                        inputMode="tel"
                        autoComplete="tel"
                        className={`min-w-0 flex-1 rounded-2xl px-3 py-2.5 text-[13px] font-semibold outline-none ring-1 ${darkMode ? "bg-slate-700 text-white ring-white/10" : "bg-white ring-black/10"}`}
                      />
                    </div>
                  </div>
                </div>

                {deliveryMode === "delivery" ? (
                  <>
                    <RowInput
                      label={t("address")}
                      value={address}
                      onChange={setAddress}
                      placeholder="Ulice a č.p."
                      autoComplete="street-address"
                    />

                    <div className={pill + " p-3"}>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className={`mb-1 text-[11px] font-extrabold ${darkMode ? "text-slate-300" : "text-gray-600"}`}>{t("zipCode")}</div>
                          <input
                            value={zipCode}
                            onChange={(e) => setZipCode(digitsOnly(e.target.value).slice(0, 5))}
                            inputMode="numeric"
                            className={`w-full rounded-2xl px-3 py-2.5 text-[13px] font-semibold outline-none ring-1 ${darkMode ? "bg-slate-700 text-white ring-white/10" : "bg-white ring-black/10"}`}
                          />
                        </div>

                        <div>
                          <div className={`mb-1 text-[11px] font-extrabold ${darkMode ? "text-slate-300" : "text-gray-600"}`}>{t("city")}</div>
                          <input
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            className={`w-full rounded-2xl px-3 py-2.5 text-[13px] font-semibold outline-none ring-1 ${darkMode ? "bg-slate-700 text-white ring-white/10" : "bg-white ring-black/10"}`}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}

                <RowPick label={t("packaging")} value={packagingLabel} onClick={() => setPickOpen("packaging")} />

                <RowPick label={t("payment")} value={paymentLabel} onClick={() => setPickOpen("payment")} />

                {cartCount > 0 ? (
                  <div className={pillSoft + " p-3"}>
                    <div className={`mb-2 text-[12px] font-extrabold ${darkMode ? "text-slate-200" : "text-gray-700"}`}>{t("recap")}</div>
                    <div className={`flex items-center justify-between text-[13px] ${darkMode ? "text-slate-200" : "text-gray-700"}`}>
                      <span>{t("foods")}</span>
                      <span className="font-extrabold">{itemsTotal} Kč</span>
                    </div>

                    {deliveryMode === "delivery" && cartCount > 0 ? (
                      <div className={`flex items-center justify-between text-[13px] ${darkMode ? "text-slate-200" : "text-gray-700"}`}>
                        <span>{t("deliveryFee")}</span>
                        <span className="font-extrabold">10 Kč</span>
                      </div>
                    ) : null}

                    {packagingFee > 0 ? (
                      <div className={`flex items-center justify-between text-[13px] ${darkMode ? "text-slate-200" : "text-gray-700"}`}>
                        <span>{t("packaging")}</span>
                        <span className="font-extrabold">{packagingFee} Kč</span>
                      </div>
                    ) : null}

                    <div className={`mt-2 flex items-center justify-between pt-2 ${darkMode ? "border-t border-white/10" : "border-t border-green-200/60"}`}>
                      <span className={`text-[12px] font-bold ${darkMode ? "text-slate-300" : "text-gray-600"}`}>{t("total")}</span>
                      <span className="text-[16px] font-extrabold text-green-700">{payTotal} Kč</span>
                    </div>
                  </div>
                ) : null}

                <div className={pill + " p-3"}>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={timeEnabled}
                      onChange={(e) => setTimeEnabled(e.target.checked)}
                    />
                    <span className={`text-[13px] font-extrabold ${darkMode ? "text-slate-100" : "text-gray-800"}`}>
                      {t("preferredTime")}
                    </span>
                  </label>

                  {timeEnabled ? (
                    <button
                      type="button"
                      onClick={() => setTimeOpen(true)}
                      className="mt-3 w-full rounded-2xl bg-green-50 px-3 py-3 text-left text-[12px] font-extrabold text-green-800 ring-1 ring-green-200 hover:bg-green-100"
                      title={timeSummary}
                      disabled={cartCount === 0}
                    >
                      {t("preferredTime")} · {timeSummary}
                    </button>
                  ) : null}
                </div>

                <RowTextarea label={t("note")} value={note} onChange={setNote} placeholder="Např. bez cibule, zazvonit…" />

                {msg ? (
                  <div className={`rounded-2xl px-3 py-2 text-[12px] font-bold ring-1 ${darkMode ? "bg-slate-800 text-slate-100 ring-white/10" : "bg-neutral-50 text-neutral-700 ring-black/10"}`}>
                    {msg}
                  </div>
                ) : null}
              </div>
            </div>

            <div className={`absolute bottom-0 left-0 right-0 ${darkMode ? "border-t border-white/10 bg-slate-900" : "border-t border-gray-100 bg-white"}`}>
              <div className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setStep("cart")} className={btnGhost}>
                    ← {t("back")}
                  </button>

                  <button
                    type="button"
                    onClick={submitOrder}
                    disabled={busy || cartCount === 0 || (payment === "credit" && !canPayCredit)}
                    className={"flex-1 " + btnPrimary}
                  >
                    {busy ? "Odesílám…" : `${payment === "card_online" ? t("pay") : "Odeslat"} (${payTotal} Kč)`}
                  </button>
                </div>

                {!authed ? (
                  <button type="button" onClick={onNeedLogin} className={btnGhost + " mt-2 w-full"}>
                    {t("signIn")}
                  </button>
                ) : null}
              </div>
            </div>

            <PickerSheet
              open={pickOpen === "delivery"}
              title={t("pickupMethod")}
              value={deliveryMode}
              onClose={() => setPickOpen(null)}
              onPick={(id) => setDeliveryMode(id as DeliveryMode)}
              options={[
                { id: "delivery", label: t("delivery"), sub: "Doprava 10 Kč" },
                { id: "pickup", label: t("pickup"), sub: "Bez dopravy" },
              ]}
            />

            <PackagingPicker />

            <PickerSheet
              open={pickOpen === "payment"}
              title={t("payment")}
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

            <CountryCodeSheet />

            <PackagingInfoModal
              open={packInfoOpen}
              onClose={() => setPackInfoOpen(false)}
              title={packInfoTitle}
              imgSrc={packInfoImg}
              lines={packInfoLines}
              darkMode={darkMode}
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

            <div className={`relative w-full max-w-md overflow-hidden rounded-3xl shadow-2xl ring-1 ${darkMode ? "bg-slate-900 text-white ring-white/10" : "bg-white ring-black/10"}`}>
              <div className={`flex items-start justify-between px-4 pb-2 pt-3 ${darkMode ? "border-b border-white/10" : "border-b border-gray-100"}`}>
                <div>
                  <div className={`text-[18px] font-extrabold ${darkMode ? "text-white" : "text-gray-900"}`}>{t("preferredTime")}</div>
                  <div className={`text-[12px] font-semibold ${darkMode ? "text-slate-300" : "text-gray-600"}`}>10:00 – 13:30 (po 30 min) • {t("optional")}</div>
                </div>

                <button
                  type="button"
                  onClick={() => setTimeOpen(false)}
                  className={`h-10 w-10 rounded-2xl font-extrabold ring-1 ${darkMode ? "bg-slate-800 text-white ring-white/10 hover:bg-slate-700" : "bg-white ring-black/10 hover:bg-gray-50"}`}
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
                            : darkMode
                            ? "bg-slate-800 text-white ring-white/10 hover:bg-slate-700"
                            : "bg-white text-gray-900 ring-black/10 hover:bg-gray-50",
                        ].join(" ")}
                      >
                        {formatCartDay(d)}
                      </button>
                    );
                  })}
                </div>

                {cartDays.length > 1 ? (
                  <label className={`flex select-none items-center gap-2 text-[13px] font-semibold ${darkMode ? "text-slate-200" : "text-gray-700"}`}>
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
                            : darkMode
                            ? "bg-slate-800 text-white ring-white/10 hover:bg-slate-700"
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
                    {t("done")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {step === "done" ? (
          <div className="max-h-[78dvh] overflow-auto px-4 pb-4 pt-3">
            <div className="rounded-2xl bg-green-50 p-4 ring-1 ring-green-200">
              <div className="text-[16px] font-extrabold text-green-800">{t("orderSummary")}</div>
              {orderId ? (
                <div className="mt-1 text-[12px] font-bold text-green-900/80">Objednávka #{orderId}</div>
              ) : null}
            </div>

            <div className={pill + " mt-3 p-4"}>
              <div className={`text-[12px] font-extrabold uppercase tracking-wide ${darkMode ? "text-slate-300" : "text-gray-500"}`}>{t("billingData")}</div>
              <div className={`mt-2 space-y-1 text-[14px] ${darkMode ? "text-slate-100" : "text-gray-800"}`}>
                <div><span className="font-extrabold">{t("fullName")}:</span> {name || "—"}</div>
                <div><span className="font-extrabold">{t("phone")}:</span> {countryCode.dial} {phone || "—"}</div>
                <div><span className="font-extrabold">{t("address")}:</span> {address || "—"}</div>
                <div className="flex gap-6">
                  <div><span className="font-extrabold">{t("zipCode")}:</span> {zipCode || "—"}</div>
                  <div><span className="font-extrabold">{t("city")}:</span> {city || "—"}</div>
                </div>
                <div><span className="font-extrabold">{t("payment")}:</span> {paymentLabel}</div>
                <div><span className="font-extrabold">{t("packaging")}:</span> {packagingLabel}</div>
              </div>
            </div>

            <div className={pill + " mt-3 p-4"}>
              <div className={`text-[12px] font-extrabold uppercase tracking-wide ${darkMode ? "text-slate-300" : "text-gray-500"}`}>{t("map")}</div>
              <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-black/10">
                <iframe
                  title="Mapa doručení"
                  src={`https://www.google.com/maps?q=${fullAddressForMap}&z=15&output=embed`}
                  className="h-[220px] w-full border-0"
                  loading="lazy"
                />
              </div>
            </div>

            <div className={pill + " mt-3 p-4"}>
              <div className={`mb-2 text-[12px] font-extrabold uppercase tracking-wide ${darkMode ? "text-slate-300" : "text-gray-500"}`}>{t("items")}</div>
              <div className="space-y-2">
                {grouped.map((g) => (
                  <div key={g.datum} className={`rounded-2xl p-3 ring-1 ${darkMode ? "bg-slate-800 ring-white/10" : "bg-neutral-50 ring-black/5"}`}>
                    <div className={`mb-2 text-[12px] font-extrabold ${darkMode ? "text-white" : "text-[#1f2f56]"}`}>{formatCartDay(g.datum)}</div>
                    {g.items.map((it) => (
                      <div key={it.key} className={`flex items-center justify-between gap-3 py-1 text-[13px] ${darkMode ? "text-slate-100" : "text-gray-800"}`}>
                        <div className="min-w-0 flex-1">
                          {it.nazev} <span className={darkMode ? "text-slate-400" : "text-gray-500"}>× {it.qty}</span>
                        </div>
                        <div className="shrink-0 font-extrabold text-green-700">{it.cena * it.qty} Kč</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className={`mt-3 pt-3 text-[14px] ${darkMode ? "border-t border-white/10" : "border-t border-gray-100"}`}>
                <div className="flex items-center justify-between">
                  <span>{t("foods")}</span>
                  <span className="font-extrabold">{itemsTotal} Kč</span>
                </div>
                {deliveryFee > 0 ? (
                  <div className="mt-1 flex items-center justify-between">
                    <span>{t("deliveryFee")}</span>
                    <span className="font-extrabold">{deliveryFee} Kč</span>
                  </div>
                ) : null}
                {packagingFee > 0 ? (
                  <div className="mt-1 flex items-center justify-between">
                    <span>{t("packaging")}</span>
                    <span className="font-extrabold">{packagingFee} Kč</span>
                  </div>
                ) : null}
                <div className={`mt-2 flex items-center justify-between pt-2 ${darkMode ? "border-t border-white/10" : "border-t border-gray-100"}`}>
                  <span className="font-bold">{t("total")}</span>
                  <span className="text-[16px] font-extrabold text-green-700">{payTotal} Kč</span>
                </div>
              </div>
            </div>

            <div className={`mt-3 text-center text-[11px] font-semibold ${darkMode ? "text-slate-400" : "text-gray-500"}`}>
              {t("contactOrderChange")}
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                router.push("/");
              }}
              className={btnGhost + " mt-3 w-full"}
            >
              {t("goHome")}
            </button>
          </div>
        ) : null}

        <BaseModal
          open={gatewayOpen}
          onClose={() => setGatewayOpen(false)}
          title={t("payment")}
          darkMode={darkMode}
        >
          <div className="space-y-4 p-4">
            <div className="rounded-2xl bg-yellow-50 p-4 text-[13px] font-semibold text-yellow-800 ring-1 ring-yellow-200">
              {t("laterGateway")}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setGatewayOpen(false)}
                className={btnGhost + " flex-1"}
              >
                {t("back")}
              </button>
              <button
                type="button"
                onClick={finalizeOrder}
                className="flex-1 rounded-2xl bg-green-600 px-4 py-3 text-[13px] font-extrabold text-white hover:bg-green-700"
              >
                {t("pay")}
              </button>
            </div>
          </div>
        </BaseModal>
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
      <div className={`relative w-full max-w-sm overflow-hidden rounded-3xl shadow-2xl ring-1 ${darkMode ? "bg-slate-900 text-white ring-white/10" : "bg-white ring-black/10"}`}>
        <div className={`flex items-center justify-between px-4 pb-2 pt-3 ${darkMode ? "border-b border-white/10" : "border-b border-gray-100"}`}>
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

        <div className="p-4">
          <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              disabled={weekOffset === 0}
              className={`h-11 rounded-2xl font-extrabold ring-1 disabled:opacity-40 ${darkMode ? "bg-slate-800 text-white ring-white/10" : "bg-white ring-black/10"}`}
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
              className={`h-11 rounded-2xl font-extrabold ring-1 disabled:opacity-40 ${darkMode ? "bg-slate-800 text-white ring-white/10" : "bg-white ring-black/10"}`}
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

/** ===================== Main MobileView ===================== */
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
    <BaseModal
      open={open}
      onClose={onClose}
      title={title || "Informace"}
      darkMode={darkMode}
      maxWidth="max-w-md"
    >
      <div className="space-y-4 p-4">
        <div>
          <div
            className={`text-[11px] font-extrabold uppercase tracking-wide ${
              darkMode ? "text-slate-300" : "text-gray-500"
            }`}
          >
            Alergeny
          </div>

          {allergens.length > 0 ? (
            <div className="mt-2 space-y-2">
              {allergens.map((item, idx) => (
                <div
                  key={`${item}-${idx}`}
                  className={`rounded-2xl px-3 py-2 text-[13px] font-semibold ring-1 ${
                    darkMode
                      ? "bg-slate-800 text-slate-100 ring-white/10"
                      : "bg-neutral-50 text-gray-700 ring-black/10"
                  }`}
                >
                  {item}
                </div>
              ))}
            </div>
          ) : (
            <div
              className={`mt-2 rounded-2xl px-3 py-2 text-[13px] font-semibold ring-1 ${
                darkMode
                  ? "bg-slate-800 text-slate-300 ring-white/10"
                  : "bg-neutral-50 text-gray-500 ring-black/10"
              }`}
            >
              Bez uvedených alergenů.
            </div>
          )}
        </div>

        <div>
          <div
            className={`text-[11px] font-extrabold uppercase tracking-wide ${
              darkMode ? "text-slate-300" : "text-gray-500"
            }`}
          >
            Kategorie
          </div>

          <div
            className={`mt-2 rounded-2xl px-3 py-2 text-[13px] font-semibold ring-1 ${
              darkMode
                ? "bg-slate-800 text-slate-100 ring-white/10"
                : "bg-neutral-50 text-gray-700 ring-black/10"
            }`}
          >
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

export default function MobileView({ onOpenCart }: MobileViewProps) {
  const router = useRouter();
  const topAnchorRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const el = topAnchorRef.current;
    if (el) el.scrollIntoView({ block: "start" });
  }, [activeSection]);

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
        className="inline-flex h-[36px] min-w-[96px] max-w-[40vw] items-center justify-center rounded-2xl bg-white px-3 text-[12px] font-extrabold text-[#2f406b] ring-1 ring-black/10 hover:bg-gray-50"
      >
        <span className="truncate">{t("signIn")}</span>
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
        className="inline-flex h-[36px] min-w-[96px] max-w-[40vw] items-center gap-1.5 rounded-2xl bg-white px-3 text-[12px] font-extrabold text-[#2f406b] ring-1 ring-black/10 hover:bg-gray-50"
        title={showCredit ? `${name} · ${credit} Kč` : name}
      >
        <span className="min-w-0 flex-1 truncate text-left">
          {name}
        </span>

        {showCredit ? (
          <span className="shrink-0 rounded-full bg-green-50 px-1.5 py-[2px] text-[9px] leading-none text-green-700 ring-1 ring-green-200">
            {credit} Kč
          </span>
        ) : null}

        <span className="shrink-0 text-[10px] opacity-70">▾</span>
      </button>

      {menuOpen ? (
        <div className="absolute right-0 top-[46px] z-[120] w-64 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/10">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setSettingsSection("menu");
              setSettingsOpen(true);
            }}
            className="w-full px-4 py-3 text-left text-sm font-extrabold hover:bg-gray-50"
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
            className="w-full px-4 py-3 text-left text-sm font-extrabold hover:bg-gray-50"
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
            className="w-full px-4 py-3 text-left text-sm font-extrabold hover:bg-gray-50"
          >
            {t("topUpCredit")}
          </button>

          <div className="h-px bg-gray-100" />

          <button
            type="button"
            onClick={signOut}
            className="w-full px-4 py-3 text-left text-sm font-extrabold text-red-600 hover:bg-red-50"
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
      className="inline-flex h-[36px] min-w-[96px] items-center justify-center rounded-2xl bg-green-50 px-3 text-[12px] font-extrabold text-green-800 ring-1 ring-green-200 hover:bg-green-100"
    >
      Rozcestník
    </button>
  );
}

  function SectionHeaderDaily() {
  const canEditMenu = authed && role === "staff";

  return (
    <div className="px-0.5 pt-0.5">
      <div className="flex items-start justify-between gap-3">
        <div
          className={`text-[23px] font-extrabold leading-none ${
            darkMode ? "text-white" : "text-green-700"
          }`}
        >
          {t("dailyMenu")}
        </div>

        <div className="flex items-center gap-3 pt-1">
          {canEditMenu ? (
            <button
              type="button"
              onClick={() => router.push("/staff/sprava-menu")}
              className={`text-[13px] font-bold underline decoration-1 underline-offset-4 ${
                darkMode ? "text-slate-400" : "text-gray-500"
              }`}
            >
              Upravit menu
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setDayPickerOpen(true)}
            className={`text-right text-[13px] font-bold underline decoration-1 underline-offset-4 ${
              darkMode ? "text-slate-200" : "text-gray-700"
            }`}
          >
            {formatSelectedDaySmart(selectedDate, t)}
          </button>
        </div>
      </div>
    </div>
  );
}

  function SectionHeaderOrder() {
    return (
      <div className="space-y-2.5 px-0.5 pt-0.5">
        <div className={`text-[23px] font-extrabold leading-none ${darkMode ? "text-white" : "text-green-700"}`}>{t("orderMeals")}</div>

        <div className={`rounded-[24px] border px-3 py-3 shadow-sm ring-1 ${darkMode ? "border-white/10 bg-slate-800 ring-white/10" : "border-[#dbeee2] bg-white ring-green-100/70"}`}>
          <div className="grid grid-cols-[38px_1fr_38px] items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              disabled={weekOffset === 0}
              className={`h-10 rounded-2xl font-extrabold disabled:opacity-35 ${darkMode ? "bg-slate-700 text-white ring-1 ring-white/10" : "bg-white text-gray-700 ring-1 ring-black/10"}`}
            >
              ‹
            </button>

            <button
              type="button"
              onClick={() => setDayPickerOpen(true)}
              className={`rounded-2xl px-3 py-2 text-center ring-1 transition ${darkMode ? "bg-slate-700 ring-white/10 hover:bg-slate-600" : "bg-[#f7fbf8] ring-green-200/80 hover:bg-[#eef8f1]"}`}
            >
              <div className="text-[9px] font-bold uppercase tracking-wide text-green-700">{weekText}</div>
              <div className={`mt-0.5 text-[13px] font-extrabold ${darkMode ? "text-white" : "text-[#1f2f56]"}`}>{rangeLabel}</div>
            </button>

            <button
              type="button"
              onClick={() => setWeekOffset(1)}
              disabled={weekOffset === 1}
              className={`h-10 rounded-2xl font-extrabold disabled:opacity-35 ${darkMode ? "bg-slate-700 text-white ring-1 ring-white/10" : "bg-white text-gray-700 ring-1 ring-black/10"}`}
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
                      ? darkMode
                        ? "bg-slate-700 text-white ring-2 ring-green-500 hover:bg-slate-600"
                        : "bg-white text-gray-800 ring-2 ring-green-500 hover:bg-gray-50"
                      : darkMode
                      ? "bg-slate-700 text-white ring-white/10 hover:bg-slate-600"
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
    if (loadingMenu) return <div className={`text-[13px] ${darkMode ? "text-slate-300" : "text-gray-500"}`}>{t("loading")}</div>;
    if (err) return <div className="text-[13px] font-bold text-red-600">{err}</div>;
    if (items.length === 0) return <div className={`text-[13px] ${darkMode ? "text-slate-300" : "text-gray-500"}`}>{t("noMenuYet")}</div>;

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
                qty > 0 && mode === "order"
                  ? "border-green-300/80 bg-green-50"
                  : darkMode
                  ? "border-white/10 bg-slate-800"
                  : "border-black/10 bg-white",
                isFlashing ? "scale-[1.01]" : "scale-100",
              ].join(" ")}
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className={`truncate text-[15px] font-extrabold ${darkMode ? "text-white" : "text-[#1f2f56]"}`}>{title}</div>

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
                        {t("add")}
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => removeOne(selectedDate, row)}
                          className={darkMode ? "h-8 w-8 rounded-xl bg-slate-700 font-extrabold text-white ring-1 ring-white/10 hover:bg-slate-600" : "h-8 w-8 rounded-xl bg-white font-extrabold text-gray-900 ring-1 ring-black/10 hover:bg-gray-50"}
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
                          className={darkMode ? "h-8 w-8 rounded-xl bg-slate-700 font-extrabold text-white ring-1 ring-white/10 hover:bg-slate-600" : "h-8 w-8 rounded-xl bg-white font-extrabold text-gray-900 ring-1 ring-black/10 hover:bg-gray-50"}
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
            <div key={src} className={`overflow-hidden rounded-[24px] shadow-sm ring-1 ${darkMode ? "bg-slate-800 ring-white/10" : "bg-white ring-black/10"}`}>
              <img src={src} alt="Jiřka" className="h-44 w-full object-cover min-[560px]:h-36" />
            </div>
          ))}
        </div>

        <div className={`rounded-[24px] border px-4 py-3 ${darkMode ? "border-white/10 bg-slate-800" : "border-[#dbeee2] bg-white"}`}>
          <div className={`text-[16px] font-extrabold ${darkMode ? "text-white" : "text-green-700"}`}>Jídelna</div>
          <div className="mt-2 space-y-1.5">
            {loadingSystemItems ? (
              <div className={`text-[13px] ${darkMode ? "text-slate-300" : "text-gray-500"}`}>{t("loading")}</div>
            ) : canteenHoursRows.length === 0 ? (
              <div className={`text-[13px] ${darkMode ? "text-slate-300" : "text-gray-500"}`}>Otevírací doba zatím není vyplněná.</div>
            ) : (
              canteenHoursRows.map((row) => (
                <div key={`canteen-${row.id}`} className={`text-[13px] ${darkMode ? "text-slate-200" : "text-gray-700"}`}>
                  <span className={`font-extrabold ${darkMode ? "text-white" : "text-[#1f2f56]"}`}>{row.label ?? "Den"}:</span>{" "}
                  <span className="font-semibold">{row.value_text ?? "—"}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={`rounded-[24px] border px-4 py-3 ${darkMode ? "border-white/10 bg-slate-800" : "border-[#dbeee2] bg-white"}`}>
          <div className={`text-[16px] font-extrabold ${darkMode ? "text-white" : "text-green-700"}`}>Obchod</div>
          <div className="mt-2 space-y-1.5">
            {loadingSystemItems ? (
              <div className={`text-[13px] ${darkMode ? "text-slate-300" : "text-gray-500"}`}>{t("loading")}</div>
            ) : shopHoursRows.length === 0 ? (
              <div className={`text-[13px] ${darkMode ? "text-slate-300" : "text-gray-500"}`}>Otevírací doba zatím není vyplněná.</div>
            ) : (
              shopHoursRows.map((row) => (
                <div key={`shop-${row.id}`} className={`text-[13px] ${darkMode ? "text-slate-200" : "text-gray-700"}`}>
                  <span className={`font-extrabold ${darkMode ? "text-white" : "text-[#1f2f56]"}`}>{row.label ?? "Den"}:</span>{" "}
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
        <div className={`rounded-[24px] p-4 shadow-sm ring-1 ${darkMode ? "bg-slate-800 ring-white/10" : "bg-white ring-black/10"}`}>
          <div className={`text-[15px] font-extrabold ${darkMode ? "text-white" : "text-green-700"}`}>Jiřka</div>
          <div className={`mt-2 whitespace-pre-line text-[14px] leading-6 ${darkMode ? "text-slate-200" : "text-gray-700"}`}>
            {loadingSystemItems
              ? t("loading")
              : aboutTextRow?.value_text ||
                "Sem si potom doplníš článek o Jiřce, historii, nabídce a dalších informacích."}
          </div>
        </div>

        <div className="rounded-[24px] bg-green-50 p-4 ring-1 ring-green-100">
          <div className="text-[13px] font-extrabold uppercase tracking-wide text-green-700">{t("address")}</div>
          <div className="mt-1 text-[14px] font-semibold text-gray-700">Havlíčkova 72, 29001 Poděbrady</div>
        </div>

        <div className={`rounded-[24px] p-4 shadow-sm ring-1 ${darkMode ? "bg-slate-800 ring-white/10" : "bg-white ring-black/10"}`}>
          <div className={`text-[13px] font-extrabold uppercase tracking-wide ${darkMode ? "text-slate-300" : "text-green-700"}`}>IČO</div>
          <div className={`mt-1 text-[14px] font-semibold ${darkMode ? "text-slate-200" : "text-gray-700"}`}>Doplníme později</div>
        </div>

        <div className={`rounded-[24px] p-4 shadow-sm ring-1 ${darkMode ? "bg-slate-800 ring-white/10" : "bg-white ring-black/10"}`}>
          <div className={`text-[13px] font-extrabold uppercase tracking-wide ${darkMode ? "text-slate-300" : "text-green-700"}`}>Kontakt</div>
          <div className={`mt-1 text-[14px] font-semibold ${darkMode ? "text-slate-200" : "text-gray-700"}`}>325 612 154</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={topAnchorRef} className={`min-h-[100dvh] pb-40 ${darkMode ? "bg-slate-950 text-white" : "bg-white text-gray-900"}`}>
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

      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        authed={authed}
        onNeedLogin={() => setAuthOpen(true)}
        credit={credit}
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

<div className="sticky top-0 z-40 border-b border-black/5 bg-white/95 backdrop-blur">
  <div className="mx-auto w-full max-w-[680px] px-3 pb-2 pt-2">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <Image
          src="/logo-na-mobil.png"
          alt="Jiřka"
          width={230}
          height={95}
          className="-ml-10 -mt-12 h-auto w-[300px] object-contain min-[560px]:w-[310px]"
          priority
        />
      </div>

      <div className="flex w-[200px] shrink-0 items-start justify-end gap-2 -mt-[16px]">
  {authed && role === "staff" ? (
    <StaffShortcut />
  ) : (
    <div
      aria-hidden="true"
      className="h-[36px] w-[96px] rounded-2xl opacity-0 pointer-events-none"
    />
  )}

  <UserArea />
</div>
    </div>

    <div className="relative z-10 -mt-10 pl-9 text-[11px] font-semibold tracking-[0.01em] text-gray-500">
      {t("routeTagline")}
    </div>

    <div className="mt-1 h-[3px] w-full rounded-full bg-green-600" />
  </div>
</div>
      
      <div className="mx-auto w-full max-w-[680px] space-y-3 px-3 pb-3 pt-5">
        {activeSection === "daily" && <SectionHeaderDaily />}
        {activeSection === "order" && <SectionHeaderOrder />}

        {(activeSection === "daily" || activeSection === "order") && zavreno ? (
          <div className="rounded-2xl bg-red-50 p-3 font-semibold text-red-700 ring-2 ring-red-200/60">
            {t("closedSunday")}
          </div>
        ) : null}

        {activeSection === "order" && orderDayHint(selectedDate, t) ? (
          <div className={`rounded-2xl p-3 text-[13px] font-semibold ring-1 ${darkMode ? "bg-slate-800 text-slate-200 ring-white/10" : "bg-neutral-50 text-gray-600 ring-black/10"}`}>
            {orderDayHint(selectedDate, t)}
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
                  : darkMode
                  ? "border-white/10 bg-slate-800 text-white hover:bg-slate-700"
                  : "border-[#dbeee2] bg-white text-gray-900 hover:bg-gray-50",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-3">
                <div className={`text-[16px] font-extrabold ${cartCount > 0 ? "text-white" : darkMode ? "text-white" : "text-[#1f2f56]"}`}>
                  {t("orderShort")}
                </div>

                <div className={`shrink-0 text-[18px] font-extrabold ${cartCount > 0 ? "text-white" : "text-green-700"}`}>
                  {total} Kč
                </div>
              </div>
            </button>
          </div>
        </div>
      ) : null}

      <div className={`fixed bottom-0 left-0 right-0 z-50 ${darkMode ? "border-t border-white/10 bg-slate-950" : "border-t border-gray-200 bg-white"}`}>
        <div className={`mx-auto grid w-full max-w-[680px] grid-cols-5 text-[11px] font-semibold ${darkMode ? "text-slate-300" : "text-gray-600"}`}>
          {[
            { id: "daily", label: t("menuShort"), icon: "📋" },
            { id: "order", label: t("orderShort"), icon: "🍽️" },
            { id: "cart", label: t("cart"), icon: "🛒" },
            { id: "jirka", label: t("jirka"), icon: "🏪" },
            { id: "about", label: t("about"), icon: "ℹ️" },
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
                className={`flex flex-col items-center py-2 ${isActive ? "text-green-700" : darkMode ? "text-slate-300" : "text-gray-500"}`}
              >
                <span className="relative text-lg leading-none">
                  {x.icon}
                  {x.id === "cart" && cartCount > 0 ? (
                    <span className="absolute -right-3 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-green-600 px-1 text-[11px] font-extrabold text-white">
                      {cartCount}
                    </span>
                  ) : null}
                </span>
                <span className="truncate px-1 text-center">{x.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
