"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import DesktopView from "./_ui/DesktopView";
import MobileView from "./_ui/MobileView";

type CustomerType = "zakaznik" | "fakturovany";

type ProfileRow = {
  id: string;
  full_name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  kredit: number | null;
};

type InvoiceCustomerDbRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
};

type MenuDenRow = {
  datum: string;
  poradi: number | null;
  jidlo_id: string;
};

type JidloRow = {
  id: string;
  nazev: string | null;
  cena: number | null;
  kategorie: string | null;
};

type MenuDay = {
  key: string;
  label: string;
  short: string;
};

type MenuItem = {
  id: string;
  foodId: string;
  dayKey: string;
  name: string;
  subtitle: string;
  price: number;
};

type CartItem = {
  id: string;
  foodId: string;
  dayKey: string;
  name: string;
  subtitle: string;
  price: number;
  qty: number;
};

function cls(...a: Array<string | false | undefined | null>) {
  return a.filter(Boolean).join(" ");
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function toISODateLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, diff: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + diff);
  return x;
}

function startOfWeekMonday(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function czk(n: number) {
  return `${Number(n || 0).toFixed(2)} Kč`;
}

function dayLabelShort(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  const names = ["ne", "po", "út", "st", "čt", "pá", "so"];
  return `${names[dt.getDay()]} ${dt.getDate()}.${dt.getMonth() + 1}.`;
}

export default function ObjednavkaZJidelnickuPage() {
  const [customerType, setCustomerType] = useState<CustomerType>("zakaznik");

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [invoiceCustomers, setInvoiceCustomers] = useState<InvoiceCustomerDbRow[]>([]);

  const [profileSearch, setProfileSearch] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");

  const [selectedProfile, setSelectedProfile] = useState<ProfileRow | null>(null);
  const [selectedInvoiceCustomer, setSelectedInvoiceCustomer] = useState<InvoiceCustomerDbRow | null>(null);

  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [createMode, setCreateMode] = useState<"profile" | "invoice">("invoice");

  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [createCustomerMsg, setCreateCustomerMsg] = useState<string | null>(null);

  const [menuDays, setMenuDays] = useState<MenuDay[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);

  const [weekOffset, setWeekOffset] = useState<0 | 1>(0);
  const [activeDay, setActiveDay] = useState<string>(toISODateLocal(startOfWeekMonday(new Date())));
  const [cart, setCart] = useState<CartItem[]>([]);

  const [showSummary, setShowSummary] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [creditOpen, setCreditOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditSaving, setCreditSaving] = useState(false);

  async function loadProfiles() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, address, phone, email, kredit")
      .order("full_name", { ascending: true });

    if (error) throw new Error(error.message);
    setProfiles((data ?? []) as ProfileRow[]);
  }

  async function loadInvoiceCustomers() {
    const { data, error } = await supabase
      .from("invoice_customers")
      .select("id, name, phone, email, address")
      .order("name", { ascending: true });

    if (error) throw new Error(error.message);
    setInvoiceCustomers((data ?? []) as InvoiceCustomerDbRow[]);
  }

  useEffect(() => {
    loadProfiles().catch(() => {});
    loadInvoiceCustomers().catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      setMenuLoading(true);
      setMenuError(null);

      try {
        const baseWeek = startOfWeekMonday(new Date());
        const currentWeek = addDays(baseWeek, weekOffset * 7);

        const days: MenuDay[] = Array.from({ length: 6 }, (_, i) => {
          const d = addDays(currentWeek, i);
          const short = ["ne", "po", "út", "st", "čt", "pá", "so"][d.getDay()];
          const label = `${short} ${String(d.getDate()).padStart(2, "0")}.${String(
            d.getMonth() + 1
          ).padStart(2, "0")}.`;
          return { key: toISODateLocal(d), label, short };
        });

        if (!alive) return;
        setMenuDays(days);

        if (!days.find((d) => d.key === activeDay)) {
          setActiveDay(days[0]?.key ?? toISODateLocal(currentWeek));
        }

        const from = days[0]?.key;
        const to = days[days.length - 1]?.key;

        const { data: menuData, error: menuErr } = await supabase
          .from("menu_den")
          .select("datum, poradi, jidlo_id")
          .gte("datum", from)
          .lte("datum", to)
          .order("datum", { ascending: true })
          .order("poradi", { ascending: true });

        if (menuErr) throw new Error(menuErr.message);

        const menuRows = (menuData ?? []) as MenuDenRow[];
        const ids = Array.from(new Set(menuRows.map((x) => x.jidlo_id).filter(Boolean)));

        let foodsById = new Map<string, JidloRow>();

        if (ids.length) {
          const { data: jidlaData, error: jidlaErr } = await supabase
            .from("jidla")
            .select("id, nazev, cena, kategorie")
            .in("id", ids);

          if (jidlaErr) throw new Error(jidlaErr.message);

          foodsById = new Map(((jidlaData ?? []) as JidloRow[]).map((j) => [j.id, j]));
        }

        const items: MenuItem[] = menuRows
          .map((m) => {
            const food = foodsById.get(m.jidlo_id);
            if (!food) return null;

            return {
              id: `${m.datum}-${m.jidlo_id}`,
              foodId: m.jidlo_id,
              dayKey: m.datum,
              name: food.nazev || "Bez názvu",
              subtitle: food.kategorie || "",
              price: Number(food.cena ?? 0),
            };
          })
          .filter(Boolean) as MenuItem[];

        if (!alive) return;
        setMenuItems(items);
      } catch (e: any) {
        if (!alive) return;
        setMenuItems([]);
        setMenuError(e?.message ?? "Nepodařilo se načíst menu.");
      } finally {
        if (alive) setMenuLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [weekOffset, activeDay]);

  const filteredProfiles = useMemo(() => {
    const q = profileSearch.trim().toLowerCase();
    if (!q) return profiles.slice(0, 8);

    return profiles
      .filter((c) => {
        const name = (c.full_name ?? "").toLowerCase();
        return name.includes(q);
      })
      .slice(0, 8);
  }, [profiles, profileSearch]);

  const filteredInvoiceCustomers = useMemo(() => {
    const q = invoiceSearch.trim().toLowerCase();
    if (!q) return invoiceCustomers.slice(0, 8);

    return invoiceCustomers.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [invoiceCustomers, invoiceSearch]);

  const activeItems = useMemo(
    () => menuItems.filter((x) => x.dayKey === activeDay),
    [menuItems, activeDay]
  );

  const cartTotal = useMemo(
    () => round2(cart.reduce((sum, item) => sum + item.qty * item.price, 0)),
    [cart]
  );

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty, 0),
    [cart]
  );

  const currentCredit = Number(selectedProfile?.kredit ?? 0);
  const remainingCredit = round2(currentCredit - cartTotal);

  function cartQty(foodId: string, dayKey: string) {
    return cart.find((x) => x.foodId === foodId && x.dayKey === dayKey)?.qty ?? 0;
  }

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const idx = prev.findIndex((x) => x.foodId === item.foodId && x.dayKey === item.dayKey);
      if (idx === -1) {
        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            foodId: item.foodId,
            dayKey: item.dayKey,
            name: item.name,
            subtitle: item.subtitle,
            price: round2(item.price),
            qty: 1,
          },
        ];
      }
      const copy = [...prev];
      copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
      return copy;
    });
  }

  function subFromCart(item: MenuItem) {
    setCart((prev) => {
      const idx = prev.findIndex((x) => x.foodId === item.foodId && x.dayKey === item.dayKey);
      if (idx === -1) return prev;

      const copy = [...prev];
      const nextQty = copy[idx].qty - 1;
      if (nextQty <= 0) return copy.filter((_, i) => i !== idx);

      copy[idx] = { ...copy[idx], qty: nextQty };
      return copy;
    });
  }

  async function createCustomer() {
    setCreateCustomerMsg(null);

    if (!newCustomerName.trim()) {
      setCreateCustomerMsg("Vyplň jméno zákazníka.");
      return;
    }

    setCreatingCustomer(true);
    try {
      if (createMode === "invoice") {
        const { data, error } = await supabase
          .from("invoice_customers")
          .insert({
            name: newCustomerName.trim(),
            phone: newCustomerPhone.trim() || null,
            email: newCustomerEmail.trim() || null,
            address: newCustomerAddress.trim() || null,
          })
          .select("id, name, phone, email, address")
          .single();

        if (error) throw new Error(error.message);

        const created = data as InvoiceCustomerDbRow;
        await loadInvoiceCustomers();
        setSelectedInvoiceCustomer(created);
        setInvoiceSearch(created.name);
      } else {
        const { data, error } = await supabase
          .from("profiles")
          .insert({
            full_name: newCustomerName.trim(),
            phone: newCustomerPhone.trim() || null,
            email: newCustomerEmail.trim() || null,
            address: newCustomerAddress.trim() || null,
            kredit: 0,
          })
          .select("id, full_name, phone, email, address, kredit")
          .single();

        if (error) throw new Error(error.message);

        const created = data as ProfileRow;
        await loadProfiles();
        setSelectedProfile(created);
        setProfileSearch(`${created.full_name ?? ""} • kredit ${czk(Number(created.kredit ?? 0))}`);
      }

      setShowCreateCustomer(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      setNewCustomerEmail("");
      setNewCustomerAddress("");
    } catch (e: any) {
      setCreateCustomerMsg(e?.message ?? "Nepodařilo se vytvořit zákazníka.");
    } finally {
      setCreatingCustomer(false);
    }
  }

  async function topUpCredit() {
    if (!selectedProfile || creditSaving) return;

    const amount = Number(creditAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    setCreditSaving(true);
    try {
      const nextCredit = Number(selectedProfile.kredit ?? 0) + amount;

      const { error } = await supabase
        .from("profiles")
        .update({ kredit: nextCredit })
        .eq("id", selectedProfile.id);

      if (error) throw new Error(error.message);

      const updatedProfile = { ...selectedProfile, kredit: nextCredit };
      setSelectedProfile(updatedProfile);
      setProfiles((prev) =>
        prev.map((p) => (p.id === selectedProfile.id ? { ...p, kredit: nextCredit } : p))
      );
      setCreditAmount("");
      setCreditOpen(false);
    } catch (e: any) {
      alert(e?.message ?? "Nepodařilo se dobít kredit.");
    } finally {
      setCreditSaving(false);
    }
  }

  function resetOrderStateAfterSave() {
    setShowSummary(false);
    setCart([]);
    setSaveMsg("Objednávka byla uložena.");
  }

  async function saveOrder() {
    setSaveMsg(null);

    if (savingOrder) return;

    if (customerType === "zakaznik" && !selectedProfile) {
      setSaveMsg("Vyber zákazníka.");
      return;
    }

    if (customerType === "fakturovany" && !selectedInvoiceCustomer) {
      setSaveMsg("Vyber fakturovaného zákazníka.");
      return;
    }

    if (!cart.length) {
      setSaveMsg("Přidej aspoň jedno jídlo.");
      return;
    }

    setSavingOrder(true);

    try {
      const payloadCart = cart.map((x) => ({
        day: x.dayKey,
        name: x.name,
        subtitle: x.subtitle,
        price: round2(x.price),
        qty: x.qty,
        line_total: round2(x.qty * x.price),
      }));

      const selectedName =
        customerType === "zakaznik"
          ? selectedProfile?.full_name ?? null
          : selectedInvoiceCustomer?.name ?? null;

      const selectedPhone =
        customerType === "zakaznik"
          ? selectedProfile?.phone ?? null
          : selectedInvoiceCustomer?.phone ?? null;

      const selectedAddress =
        customerType === "zakaznik"
          ? selectedProfile?.address ?? null
          : selectedInvoiceCustomer?.address ?? null;

      const selectedEmail =
        customerType === "zakaznik"
          ? selectedProfile?.email ?? null
          : selectedInvoiceCustomer?.email ?? null;

      const paymentMethod = customerType === "fakturovany" ? "invoice" : "menu_order";
      const status = customerType === "fakturovany" ? "invoice" : "menu_order";
      const source = "objednavka_z_jidelnicku";

      const { error } = await supabase.from("orders").insert({
        full_name: selectedName,
        phone: selectedPhone,
        address: selectedAddress,
        note: null,
        delivery_mode: null,
        packaging_mode: null,
        payment_method: paymentMethod,
        total: cartTotal,
        status,
        source,
        times_by_day: {},
        cart: {
          type: customerType === "fakturovany" ? "invoice_menu_order" : "profile_menu_order",
          profile_id: customerType === "zakaznik" ? selectedProfile?.id ?? null : null,
          invoice_customer_id: customerType === "fakturovany" ? selectedInvoiceCustomer?.id ?? null : null,
          customer_kind: customerType,
          customer:
            customerType === "zakaznik"
              ? {
                  id: selectedProfile?.id ?? null,
                  name: selectedProfile?.full_name ?? null,
                  phone: selectedProfile?.phone ?? null,
                  email: selectedProfile?.email ?? null,
                  address: selectedProfile?.address ?? null,
                  kredit: selectedProfile?.kredit ?? 0,
                }
              : {
                  id: selectedInvoiceCustomer?.id ?? null,
                  name: selectedInvoiceCustomer?.name ?? null,
                  phone: selectedInvoiceCustomer?.phone ?? null,
                  email: selectedInvoiceCustomer?.email ?? null,
                  address: selectedInvoiceCustomer?.address ?? null,
                },
          items: payloadCart,
          summary: {
            item_count: cartCount,
            total: cartTotal,
            created_from: "staff_menu_order",
            email: selectedEmail,
          },
        },
      });

      if (error) throw new Error(error.message);

      resetOrderStateAfterSave();
    } catch (e: any) {
      setSaveMsg(e?.message ?? "Objednávku se nepodařilo uložit.");
    } finally {
      setSavingOrder(false);
    }
  }

  const selectedCustomerSummary =
    customerType === "zakaznik"
      ? selectedProfile
        ? {
            title: selectedProfile.full_name || "Bez jména",
            phone: selectedProfile.phone || "—",
            email: selectedProfile.email || "—",
            address: selectedProfile.address || "—",
            kredit: Number(selectedProfile.kredit ?? 0),
          }
        : null
      : selectedInvoiceCustomer
      ? {
          title: selectedInvoiceCustomer.name || "Bez jména",
          phone: selectedInvoiceCustomer.phone || "—",
          email: selectedInvoiceCustomer.email || "—",
          address: selectedInvoiceCustomer.address || "—",
        }
      : null;

  const sharedProps = {
    customerType,
    setCustomerType,
    profileSearch,
    setProfileSearch,
    invoiceSearch,
    setInvoiceSearch,
    selectedProfile,
    setSelectedProfile,
    selectedInvoiceCustomer,
    setSelectedInvoiceCustomer,
    filteredProfiles,
    filteredInvoiceCustomers,
    setCreateMode,
    setShowCreateCustomer,
    menuDays,
    activeDay,
    setActiveDay,
    weekOffset,
    setWeekOffset,
    menuLoading,
    menuError,
    activeItems,
    cartQty,
    addToCart,
    subFromCart,
    cartCount,
    cartTotal,
    saveMsg,
    setShowSummary,
  };

  return (
    <div className="min-h-screen bg-[#f7f8f6] pb-[92px] md:pb-[96px]">
      <div className="mx-auto w-full max-w-[1320px] px-4 py-4 md:px-6 md:py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[28px] md:text-[34px] font-extrabold tracking-tight text-[#0b2149]">
              Objednávka z jídelníčku
            </h1>
            <div className="mt-1 text-[13px] font-semibold text-gray-500">
              {menuDays.length > 0
                ? `${menuDays[0].label} – ${menuDays[menuDays.length - 1].label}`
                : "Objednávka z menu"}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/staff"
              className="rounded-[18px] bg-[#08a35c] px-5 py-3 text-[15px] font-extrabold text-white hover:brightness-95"
            >
              Rozcestník
            </Link>
          </div>
        </div>

        <div className="mt-5 hidden md:block">
          <DesktopView {...sharedProps} />
        </div>

        <div className="mt-5 md:hidden">
          <MobileView {...sharedProps} />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#dff2e5] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1320px] items-center gap-3 px-4 py-4 md:px-6">
          <Link
            href="/staff"
            className="rounded-full border border-[#dff2e5] bg-white px-5 py-3 text-[15px] md:px-6 md:text-[16px] font-extrabold text-[#182033]"
          >
            Zpět
          </Link>

          <button
            type="button"
            onClick={() => setShowSummary(true)}
            className={cls(
              "ml-auto rounded-full px-5 py-3 text-[15px] md:px-6 md:text-[16px] font-extrabold transition",
              cartCount > 0
                ? "bg-[#08a35c] text-white"
                : "border border-[#dff2e5] bg-white text-[#182033]"
            )}
          >
            Objednávka • {cartCount} ks • {czk(cartTotal)}
          </button>
        </div>
      </div>

      {showCreateCustomer ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-[560px] rounded-[28px] border border-[#dff2e5] bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[22px] md:text-[24px] font-extrabold text-[#0b2149]">
                  {createMode === "invoice" ? "Nový fakturovaný zákazník" : "Nový zákazník"}
                </div>
                <div className="mt-1 text-[14px] font-semibold text-gray-500">
                  Vyplň základní údaje zákazníka
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateCustomer(false)}
                className="rounded-full border border-[#dff2e5] bg-white px-4 py-2 text-[14px] font-extrabold text-[#0b7c4d]"
              >
                Zavřít
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              <input
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Jméno"
                className="w-full rounded-full border border-[#bde7c8] bg-white px-4 py-3 text-[15px] font-semibold text-[#182033] outline-none focus:border-[#08a35c]"
              />
              <input
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                placeholder="Telefon"
                className="w-full rounded-full border border-[#bde7c8] bg-white px-4 py-3 text-[15px] font-semibold text-[#182033] outline-none focus:border-[#08a35c]"
              />
              <input
                value={newCustomerEmail}
                onChange={(e) => setNewCustomerEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded-full border border-[#bde7c8] bg-white px-4 py-3 text-[15px] font-semibold text-[#182033] outline-none focus:border-[#08a35c]"
              />
              <input
                value={newCustomerAddress}
                onChange={(e) => setNewCustomerAddress(e.target.value)}
                placeholder="Adresa"
                className="w-full rounded-full border border-[#bde7c8] bg-white px-4 py-3 text-[15px] font-semibold text-[#182033] outline-none focus:border-[#08a35c]"
              />
            </div>

            {createCustomerMsg ? (
              <div className="mt-4 text-sm font-semibold text-red-600">{createCustomerMsg}</div>
            ) : null}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreateCustomer(false)}
                className="rounded-full border border-[#dff2e5] bg-white px-5 py-3 text-[15px] font-extrabold text-[#182033]"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={createCustomer}
                disabled={creatingCustomer}
                className={cls(
                  "rounded-full px-5 py-3 text-[15px] font-extrabold text-white",
                  creatingCustomer ? "bg-[#77caa1]" : "bg-[#08a35c]"
                )}
              >
                {creatingCustomer ? "Ukládám…" : "Vytvořit zákazníka"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {creditOpen && selectedProfile ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-[430px] rounded-[28px] border border-[#dff2e5] bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[22px] font-extrabold text-[#0b2149]">Dobít kredit</div>
                <div className="mt-1 text-[14px] font-semibold text-gray-500">
                  {selectedProfile.full_name || "Zákazník"}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!creditSaving) {
                    setCreditOpen(false);
                    setCreditAmount("");
                  }
                }}
                className="rounded-full border border-[#dff2e5] bg-white px-4 py-2 text-[14px] font-extrabold text-[#0b7c4d]"
              >
                Zavřít
              </button>
            </div>

            <div className="mt-5">
              <input
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="Částka v Kč"
                inputMode="numeric"
                className="w-full rounded-full border border-[#bde7c8] bg-white px-4 py-3 text-[16px] font-semibold text-[#182033] outline-none focus:border-[#08a35c]"
              />
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setCreditOpen(false);
                  setCreditAmount("");
                }}
                className="rounded-full border border-[#dff2e5] bg-white px-5 py-3 text-[15px] font-extrabold text-[#182033]"
                disabled={creditSaving}
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={topUpCredit}
                disabled={creditSaving || !creditAmount}
                className={cls(
                  "rounded-full px-5 py-3 text-[15px] font-extrabold text-white",
                  creditSaving || !creditAmount ? "bg-[#77caa1]" : "bg-[#08a35c]"
                )}
              >
                {creditSaving ? "Dobíjím…" : "Dobít kredit"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showSummary ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-[930px] rounded-[28px] border border-[#dff2e5] bg-white p-4 md:p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[22px] md:text-[24px] font-extrabold text-[#0b2149]">Objednávka</div>
                <div className="mt-1 text-[14px] font-semibold text-gray-500">
                  Jednoduchý souhrn objednávky
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowSummary(false)}
                className="rounded-full border border-[#dff2e5] bg-white px-4 py-2 text-[14px] font-extrabold text-[#0b7c4d]"
              >
                Zavřít
              </button>
            </div>

            <div className="mt-5 rounded-[18px] border border-[#dff2e5] bg-[#f5fbf7] px-4 py-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-5">
                <div className="min-w-0">
                  <div className="text-[14px] font-bold text-gray-500">Zákazník</div>
                  <div className="mt-1 text-[18px] font-extrabold text-[#182033]">
                    {selectedCustomerSummary?.title || "Nevybrán"}
                  </div>
                  <div className="mt-1 text-[14px] text-gray-500">
                    {selectedCustomerSummary?.phone || "—"} • {selectedCustomerSummary?.email || "—"} •{" "}
                    {selectedCustomerSummary?.address || "—"}
                  </div>

                  {customerType === "zakaznik" && selectedProfile ? (
                    <button
                      type="button"
                      onClick={() => setCreditOpen(true)}
                      className="mt-2 text-[13px] font-extrabold text-[#0b7c4d] underline underline-offset-4"
                    >
                      Dobít kredit
                    </button>
                  ) : null}
                </div>

                {customerType === "zakaznik" && selectedProfile ? (
                  <div className="shrink-0 rounded-[16px] border border-[#dff2e5] bg-white px-4 py-3">
                    <div className="text-[14px] font-extrabold text-gray-600">
                      Kredit: <span className="text-[#0b7c4d]">{czk(currentCredit)}</span>
                    </div>
                    <div className="mt-2 text-[14px] font-extrabold text-gray-600">
                      Objednávka: <span className="text-[#182033]">{czk(cartTotal)}</span>
                    </div>
                    <div className="mt-2 text-[14px] font-extrabold text-gray-600">
                      Zůstatek na účtu:{" "}
                      <span className={remainingCredit >= 0 ? "text-[#0b7c4d]" : "text-red-600"}>
                        {czk(remainingCredit)}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-4 max-h-[340px] overflow-y-auto pr-1">
              <div className="grid gap-2.5">
                {cart.length === 0 ? (
                  <div className="text-sm font-semibold text-gray-500">Objednávka je prázdná.</div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-1 gap-2 rounded-[18px] border border-[#dff2e5] bg-white px-4 py-3 md:grid-cols-[minmax(0,1.8fr)_110px_70px_120px_130px] md:items-center md:gap-3"
                    >
                      <div className="truncate text-[15px] font-extrabold text-[#182033]">{item.name}</div>
                      <div className="text-[14px] font-semibold text-gray-500">{dayLabelShort(item.dayKey)}</div>
                      <div className="text-[15px] font-semibold text-[#182033]">{item.qty} ks</div>
                      <div className="text-[14px] font-semibold text-gray-500">{czk(item.price)}</div>
                      <div className="text-left md:text-right text-[15px] font-extrabold text-[#0b7c4d]">
                        {czk(item.qty * item.price)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="rounded-[18px] border border-[#bde7c8] bg-[#f5fbf7] px-5 py-3 text-[16px] font-extrabold text-[#0b7c4d]">
                Celkem: {czk(cartTotal)} • {cartCount} ks
              </div>

              <button
                type="button"
                onClick={saveOrder}
                disabled={savingOrder}
                className={cls(
                  "rounded-full px-5 py-3 text-[15px] font-extrabold text-white",
                  savingOrder ? "bg-[#77caa1]" : "bg-[#08a35c]"
                )}
              >
                {savingOrder ? "Ukládám…" : "Potvrdit objednávku"}
              </button>
            </div>

            {saveMsg ? <div className="mt-4 text-sm font-semibold text-[#0b7c4d]">{saveMsg}</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
