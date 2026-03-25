"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import DesktopView from "./_ui/DesktopView";
import MobileView from "./_ui/MobileView";

type ProfileRow = {
  id: string;
  full_name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  kredit: number | null;
};

type OrderHistoryRow = {
  id: string;
  created_at: string;
  full_name: string | null;
  total: number | null;
  status: string | null;
  payment_method: string | null;
  delivery_mode?: string | null;
  cart?: any;
};

type Tab = "platici" | "zalohovani" | "vsichni";
type MainSheetMode = "create" | "edit" | "topup";

const cls = (...a: Array<string | false | undefined | null>) => a.filter(Boolean).join(" ");

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function XIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChevronLeftIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PencilIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalendarIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 3v4M16 3v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function prettyPayment(x: string | null) {
  const s = (x ?? "").toLowerCase();
  if (s === "cash") return "Hotově";
  if (s === "credit") return "Kredit";
  if (s === "card_delivery" || s === "card" || s === "card_online") return "Kartou";
  if (s === "invoice") return "Faktura";
  if (s === "menu_order") return "Objednávka z jídelníčku";
  if (s === "online") return "Online";
  return x || "—";
}

function prettyDeliveryMode(x: string | null | undefined) {
  const s = (x ?? "").toLowerCase();
  if (s === "delivery" || s === "ano" || s === "rozvoz") return "Doručení";
  if (s === "pickup" || s === "ne" || s === "osobni_odber" || s === "osobní odběr") return "Osobní odběr";
  return "Osobní odběr / doručení";
}

function czk(n: number) {
  return `${round2(Number(n || 0))} Kč`;
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";

  const wd = ["ne", "po", "út", "st", "čt", "pá", "so"][d.getDay()] ?? "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${wd} ${dd}.${mm}.`;
}

function getOrderItemsText(cart: any): string[] {
  if (!Array.isArray(cart)) return [];

  return cart
    .map((x: any) => {
      const qty = Number(x?.qty ?? 0);
      const name = String(x?.name ?? x?.nazev ?? "").trim();
      if (!name) return null;
      return `${qty > 0 ? `${qty}x ` : ""}${name}`;
    })
    .filter((x: string | null): x is string => Boolean(x));
}

function hasFutureCartDate(cart: any) {
  if (!Array.isArray(cart)) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return cart.some((x: any) => {
    const raw = String(x?.day ?? x?.datum ?? "").trim();
    if (!raw) return false;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return false;
    d.setHours(0, 0, 0, 0);
    return d >= today;
  });
}

function keepOrderInArchive(o: OrderHistoryRow) {
  const created = new Date(o.created_at);
  if (Number.isNaN(created.getTime())) return false;

  const limit = new Date();
  limit.setDate(limit.getDate() - 14);

  if (created >= limit) return true;
  if (hasFutureCartDate(o.cart)) return true;

  return false;
}

export default function StaffCustomersPage() {
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("vsichni");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [mainSheetMode, setMainSheetMode] = useState<MainSheetMode>("edit");
  const [busy, setBusy] = useState(false);

  const [edit, setEdit] = useState<ProfileRow | null>(null);

  const [ordersOpen, setOrdersOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmTopUpOpen, setConfirmTopUpOpen] = useState(false);

  const [fName, setFName] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fAddress, setFAddress] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fKredit, setFKredit] = useState<string>("0");

  const [search, setSearch] = useState("");
  const [creditSearch, setCreditSearch] = useState("");
  const [creditAmount, setCreditAmount] = useState<string>("");

  const [ordersLoading, setOrdersLoading] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<OrderHistoryRow[]>([]);

  async function load() {
    setMsg(null);
    setLoading(true);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Nejsi přihlášený.");

      const res = await fetch("/api/staff/profiles", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Chyba při načítání.");

      setRows((json.rows ?? []) as ProfileRow[]);
    } catch (e: any) {
      setMsg(e?.message ?? "Chyba při načítání.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadCustomerOrders(fullName: string) {
    if (!fullName.trim()) {
      setCustomerOrders([]);
      return;
    }

    setOrdersLoading(true);

    try {
      const { data, error } = await supabase
        .from("orders")
        .select("id, created_at, full_name, total, status, payment_method, delivery_mode, cart")
        .eq("full_name", fullName)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      const prepared = ((data ?? []) as OrderHistoryRow[]).filter(keepOrderInArchive);
      setCustomerOrders(prepared);
    } catch {
      setCustomerOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const platiciCount = useMemo(
    () => rows.filter((r) => Number(r.kredit ?? 0) === 0).length,
    [rows]
  );

  const zalohovaniCount = useMemo(
    () => rows.filter((r) => Number(r.kredit ?? 0) !== 0).length,
    [rows]
  );

  const vsichniCount = rows.length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((r) => {
      const k = Number(r.kredit ?? 0);

      const tabOk =
        tab === "vsichni" ? true : tab === "zalohovani" ? k !== 0 : k === 0;

      if (!tabOk) return false;
      if (!q) return true;

      const name = (r.full_name ?? "").toLowerCase();
      const email = (r.email ?? "").toLowerCase();

      return name.includes(q) || email.includes(q);
    });
  }, [rows, tab, search]);

  const creditCandidates = useMemo(() => {
    const q = creditSearch.trim().toLowerCase();
    if (!q) return rows.slice(0, 12);

    return rows
      .filter((r) => {
        const name = (r.full_name ?? "").toLowerCase();
        const email = (r.email ?? "").toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .slice(0, 12);
  }, [rows, creditSearch]);

  async function openEdit(r: ProfileRow) {
    setEdit(r);
    setMainSheetMode("edit");
    setConfirmDeleteOpen(false);
    setConfirmTopUpOpen(false);
    setOrdersOpen(false);

    setFName((r.full_name ?? "").toString());
    setFPhone((r.phone ?? "").toString());
    setFAddress((r.address ?? "").toString());
    setFEmail((r.email ?? "").toString());
    setFKredit(String(round2(Number(r.kredit ?? 0))));
    setCreditAmount("");
    setCreditSearch((r.full_name ?? r.email ?? "").toString());

    setOpen(true);
    await loadCustomerOrders((r.full_name ?? "").toString());
  }

  function openTopUpModal() {
    setEdit(null);
    setMainSheetMode("topup");
    setConfirmDeleteOpen(false);
    setConfirmTopUpOpen(false);
    setOrdersOpen(false);

    setCreditAmount("");
    setCreditSearch("");
    setFName("");
    setFPhone("");
    setFAddress("");
    setFEmail("");
    setFKredit("0");
    setCustomerOrders([]);

    setOpen(true);
  }

  function openCreateModal() {
    setEdit(null);
    setMainSheetMode("create");
    setConfirmDeleteOpen(false);
    setConfirmTopUpOpen(false);
    setOrdersOpen(false);

    setFName("");
    setFPhone("");
    setFAddress("");
    setFEmail("");
    setFKredit("0");
    setCreditAmount("");
    setCreditSearch("");
    setCustomerOrders([]);

    setOpen(true);
  }

  function closeAllSheets() {
    if (busy) return;
    setOpen(false);
    setEdit(null);
    setOrdersOpen(false);
    setConfirmDeleteOpen(false);
    setConfirmTopUpOpen(false);
    setCreditAmount("");
    setCreditSearch("");
    setCustomerOrders([]);
  }

  function goOneLayerBack() {
    if (busy) return;

    if (confirmDeleteOpen) {
      setConfirmDeleteOpen(false);
      return;
    }

    if (confirmTopUpOpen) {
      setConfirmTopUpOpen(false);
      return;
    }

    if (ordersOpen) {
      setOrdersOpen(false);
      return;
    }

    if (mainSheetMode === "topup") {
      closeAllSheets();
      return;
    }

    closeAllSheets();
  }

  async function saveEdit() {
    if (!edit || busy) return;

    setBusy(true);
    setMsg(null);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Nejsi přihlášený.");

      const kreditValue = round2(Number(fKredit || 0));
      if (!Number.isFinite(kreditValue)) {
        throw new Error("Neplatná hodnota kreditu.");
      }

      const res = await fetch("/api/staff/profiles", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: edit.id,
          full_name: fName.trim(),
          phone: fPhone.trim(),
          address: fAddress.trim(),
          email: fEmail.trim(),
          kredit: String(kreditValue),
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Chyba při ukládání.");

      await load();
      closeAllSheets();
    } catch (e: any) {
      setMsg(e?.message ?? "Chyba při ukládání.");
    } finally {
      setBusy(false);
    }
  }

  async function createCustomer() {
    if (busy) return;

    setBusy(true);
    setMsg(null);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Nejsi přihlášený.");

      const kreditValue = round2(Number(fKredit || 0));
      if (!Number.isFinite(kreditValue)) {
        throw new Error("Neplatná hodnota kreditu.");
      }

      const res = await fetch("/api/staff/profiles", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: fName.trim(),
          phone: fPhone.trim(),
          address: fAddress.trim(),
          email: fEmail.trim(),
          kredit: String(kreditValue),
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Chyba při vytváření zákazníka.");

      await load();
      closeAllSheets();
    } catch (e: any) {
      setMsg(e?.message ?? "Chyba při vytváření zákazníka.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteEdit() {
    if (!edit || busy) return;

    setBusy(true);
    setMsg(null);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Nejsi přihlášený.");

      const res = await fetch(`/api/staff/profiles?id=${encodeURIComponent(edit.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Chyba při mazání.");

      await load();
      closeAllSheets();
    } catch (e: any) {
      setMsg(e?.message ?? "Chyba při mazání.");
    } finally {
      setBusy(false);
    }
  }

  function chooseCreditCustomer(r: ProfileRow) {
    setEdit(r);
    setFName((r.full_name ?? "").toString());
    setFPhone((r.phone ?? "").toString());
    setFAddress((r.address ?? "").toString());
    setFEmail((r.email ?? "").toString());
    setFKredit(String(round2(Number(r.kredit ?? 0))));
    setCreditSearch((r.full_name ?? r.email ?? "").toString());
  }

  function openTopUpConfirm() {
    const add = round2(Number(creditAmount || 0));
    if (!edit) return;
    if (!Number.isFinite(add) || add <= 0) return;

    setConfirmTopUpOpen(true);
  }

  async function confirmTopUp() {
    if (!edit || busy) return;

    const add = round2(Number(creditAmount || 0));
    if (!Number.isFinite(add) || add <= 0) return;

    setBusy(true);
    setMsg(null);

    try {
      const res = await fetch("/api/staff/customer-credit-topup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: edit.id,
          amount: add,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Chyba při dobíjení kreditu.");

      const newCredit = round2(Number(json?.kredit ?? 0));

      setRows((prev) =>
        prev.map((p) => (p.id === edit.id ? { ...p, kredit: newCredit } : p))
      );

      setEdit((prev) => (prev ? { ...prev, kredit: newCredit } : prev));
      setFKredit(String(newCredit));
      setCreditAmount("");
      setConfirmTopUpOpen(false);

      if (mainSheetMode === "topup") {
        closeAllSheets();
      }
    } catch (e: any) {
      setMsg(e?.message ?? "Chyba při dobíjení kreditu.");
    } finally {
      setBusy(false);
    }
  }

  const ordersCount = customerOrders.length;

  const pageBg = "bg-[#f6f8f6]";
  const shell = "mx-auto max-w-[1260px] px-4 py-6";

  return (
    <div className={cls("min-h-screen", pageBg)}>
      <div className={shell}>
        <div className="hidden md:block">
          <DesktopView
            loading={loading}
            rowsCount={rows.length}
            tab={tab}
            setTab={setTab}
            search={search}
            setSearch={setSearch}
            filtered={filtered}
            platiciCount={platiciCount}
            zalohovaniCount={zalohovaniCount}
            vsichniCount={vsichniCount}
            msg={msg}
            onBack={() => router.push("/staff")}
            onOpenTopUp={openTopUpModal}
            onOpenEdit={openEdit}
          />
        </div>

        <div className="md:hidden">
          <MobileView
            loading={loading}
            rowsCount={rows.length}
            tab={tab}
            setTab={setTab}
            search={search}
            setSearch={setSearch}
            filtered={filtered}
            platiciCount={platiciCount}
            zalohovaniCount={zalohovaniCount}
            vsichniCount={vsichniCount}
            msg={msg}
            onOpenHub={() => router.push("/staff")}
            onOpenTopUp={openTopUpModal}
            onOpenEdit={openEdit}
            onOpenAddCustomer={openCreateModal}
          />
        </div>
      </div>

      {open ? (
        <>
          <button
            type="button"
            onClick={closeAllSheets}
            className="fixed inset-0 z-40 bg-black/35"
            aria-label="Zavřít"
          />

          <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center p-0 md:p-4">
            <div
              className={cls(
                "relative w-full bg-white shadow-[0_30px_80px_rgba(0,0,0,0.30)]",
                "max-h-[94vh] overflow-auto rounded-t-[28px] border border-gray-200 md:max-w-[760px] md:rounded-[30px]"
              )}
            >
              {!ordersOpen && !confirmDeleteOpen && !confirmTopUpOpen ? (
                <>
                  <SheetHeader
                    title={
                      mainSheetMode === "create"
                        ? "Přidat zákazníka"
                        : mainSheetMode === "topup"
                        ? "Dobít kredit"
                        : "Upravit zákazníka"
                    }
                    onBack={goOneLayerBack}
                    onClose={closeAllSheets}
                    backLabel={mainSheetMode === "topup" ? "Zpět" : "Zpět"}
                  />

                  <div className="px-4 pb-5 pt-1 md:px-5 md:pb-5">
                    {mainSheetMode === "topup" ? (
                      <div className="space-y-4">
                        <div className="relative">
                          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                          <input
                            value={creditSearch}
                            onChange={(e) => setCreditSearch(e.target.value)}
                            placeholder="Vyhledat jméno nebo e-mail"
                            className="h-12 w-full rounded-full border border-gray-200 bg-white pl-11 pr-4 text-[15px] font-medium text-gray-800 outline-none transition focus:border-emerald-300"
                          />
                        </div>

                        <div className="grid gap-2">
                          {creditCandidates.map((r) => {
                            const k = round2(Number(r.kredit ?? 0));
                            return (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => chooseCreditCustomer(r)}
                                className={cls(
                                  "w-full rounded-[20px] border px-4 py-3 text-left transition",
                                  edit?.id === r.id
                                    ? "border-emerald-300 bg-emerald-50"
                                    : "border-emerald-200 bg-white"
                                )}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate text-[15px] font-extrabold text-[#182033]">
                                      {r.full_name || "Bez jména"}
                                    </div>
                                    <div className="truncate text-[12px] text-gray-500">
                                      {r.email || r.phone || r.id}
                                    </div>
                                  </div>

                                  <div
                                    className={cls(
                                      "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold",
                                      k > 0
                                        ? "bg-emerald-100 text-emerald-800"
                                        : k < 0
                                        ? "bg-red-100 text-red-800"
                                        : "bg-gray-100 text-gray-600"
                                    )}
                                  >
                                    {k > 0 ? "+" : ""}
                                    {k} Kč
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {edit ? (
                          <div className="rounded-[22px] border border-emerald-200 bg-[#f5fbf7] px-4 py-4">
                            <div className="text-[16px] font-extrabold text-[#182033]">
                              {edit.full_name || "Bez jména"}
                            </div>
                            <div className="mt-1 text-[13px] text-gray-500">
                              Aktuální kredit: {round2(Number(edit.kredit ?? 0))} Kč
                            </div>
                          </div>
                        ) : null}

                        <div>
                          <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
                            Částka k dobití
                          </div>
                          <input
                            value={creditAmount}
                            onChange={(e) =>
                              setCreditAmount(e.target.value.replace(/[^\d]/g, "").slice(0, 6))
                            }
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="Zadej částku"
                            className="h-12 w-full rounded-full border border-gray-200 bg-gray-50 px-4 text-[15px] font-medium text-gray-900 outline-none transition focus:border-emerald-300 focus:bg-white"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <button
                            type="button"
                            onClick={goOneLayerBack}
                            className="h-12 rounded-full border border-gray-200 bg-white text-[15px] font-bold text-[#182033]"
                          >
                            Zpět
                          </button>
                          <button
                            type="button"
                            disabled={busy || !edit || Number(creditAmount || 0) <= 0}
                            onClick={openTopUpConfirm}
                            className={cls(
                              "h-12 rounded-full text-[15px] font-extrabold text-white",
                              busy || !edit || Number(creditAmount || 0) <= 0
                                ? "bg-emerald-300"
                                : "bg-emerald-600"
                            )}
                          >
                            Dobít kredit
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Field label="Jméno">
                          <input
                            value={fName}
                            onChange={(e) => setFName(e.target.value)}
                            className="w-full rounded-full border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-emerald-300 focus:bg-white focus:outline-none"
                          />
                        </Field>

                        <Field label="Telefon">
                          <input
                            value={fPhone}
                            onChange={(e) => setFPhone(e.target.value)}
                            inputMode="tel"
                            className="w-full rounded-full border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-emerald-300 focus:bg-white focus:outline-none"
                          />
                        </Field>

                        <Field label="Adresa">
                          <input
                            value={fAddress}
                            onChange={(e) => setFAddress(e.target.value)}
                            className="w-full rounded-full border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-emerald-300 focus:bg-white focus:outline-none"
                          />
                        </Field>

                        <Field label="E-mail">
                          <input
                            value={fEmail}
                            onChange={(e) => setFEmail(e.target.value)}
                            inputMode="email"
                            className="w-full rounded-full border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-emerald-300 focus:bg-white focus:outline-none"
                          />
                        </Field>

                        <Field label="Kredit (Kč)">
                          <div className="flex gap-2">
                            <input
                              value={fKredit}
                              onChange={(e) => setFKredit(e.target.value)}
                              inputMode="decimal"
                              className="w-full rounded-full border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-emerald-300 focus:bg-white focus:outline-none"
                            />

                            {mainSheetMode === "edit" ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setMainSheetMode("topup");
                                  setCreditAmount("");
                                  setCreditSearch(fName || fEmail || "");
                                }}
                                className="shrink-0 rounded-full border border-emerald-300 bg-white px-4 py-3 text-sm font-bold text-emerald-700"
                              >
                                Dobít kredit
                              </button>
                            ) : null}
                          </div>
                        </Field>

                        {mainSheetMode === "edit" ? (
                          <button
                            type="button"
                            disabled={ordersLoading || ordersCount === 0}
                            onClick={() => {
                              if (ordersCount > 0) setOrdersOpen(true);
                            }}
                            className={cls(
                              "mt-1 w-full rounded-[22px] border px-4 py-4 text-left transition",
                              ordersCount > 0
                                ? "border-emerald-200 bg-[#f5fbf7] active:scale-[0.995]"
                                : "border-gray-200 bg-gray-50 opacity-80"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex items-center gap-2">
                                <CalendarIcon className="h-5 w-5 text-[#0b7c4d]" />
                                <div className="min-w-0">
                                  <div className="text-[16px] font-extrabold text-[#182033]">
                                    Objednávky
                                  </div>
                                  <div className="mt-1 text-[12px] text-gray-500">
                                    {ordersCount > 0
                                      ? "Objednávky staré víc jak 2 týdny se mažou."
                                      : "Zatím žádné objednávky."}
                                  </div>
                                </div>
                              </div>

                              <div className="shrink-0 text-right">
                                <div className="rounded-full bg-white px-2.5 py-1 text-[12px] font-extrabold text-[#182033] border border-emerald-200">
                                  {ordersLoading ? "…" : ordersCount}
                                </div>
                                <div className="mt-1 text-[11px] text-gray-500">
                                  záloha 2 týdny
                                </div>
                              </div>
                            </div>
                          </button>
                        ) : null}

                        <div className="pt-2">
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={goOneLayerBack}
                              className="h-12 rounded-full border border-gray-200 bg-white text-[15px] font-bold text-[#182033]"
                            >
                              Zrušit
                            </button>

                            <button
                              type="button"
                              disabled={busy}
                              onClick={mainSheetMode === "create" ? createCustomer : saveEdit}
                              className={cls(
                                "h-12 rounded-full text-[15px] font-extrabold text-white",
                                busy ? "bg-emerald-300" : "bg-emerald-600"
                              )}
                            >
                              {busy
                                ? mainSheetMode === "create"
                                  ? "Přidávám…"
                                  : "Ukládám…"
                                : mainSheetMode === "create"
                                ? "Uložit"
                                : "Uložit"}
                            </button>
                          </div>

                          {mainSheetMode === "edit" ? (
                            <div className="pt-4 text-center">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setConfirmDeleteOpen(true)}
                                className="inline-flex items-center justify-center text-[14px] font-extrabold text-red-600"
                              >
                                Smazat zákazníka
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : null}

              {ordersOpen ? (
                <>
                  <SheetHeader
                    title="Objednávky"
                    onBack={goOneLayerBack}
                    onClose={closeAllSheets}
                    backLabel="Zpět"
                  />

                  <div className="px-4 pb-5 pt-1 md:px-5">
                    <div className="mb-3 text-[12px] text-gray-500">
                      Objednávky staré víc jak 2 týdny se mažou.
                    </div>

                    {ordersLoading ? (
                      <div className="rounded-[20px] border border-emerald-200 bg-white px-4 py-4 text-sm text-gray-600">
                        Načítám objednávky…
                      </div>
                    ) : customerOrders.length === 0 ? (
                      <div className="rounded-[20px] border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-600">
                        Zatím žádné objednávky.
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {customerOrders.map((o) => {
                          const items = getOrderItemsText(o.cart);

                          return (
                            <div
                              key={o.id}
                              className="rounded-[20px] border border-emerald-200 bg-white px-4 py-4"
                            >
                              <div className="text-[13px] font-bold text-gray-600">
                                {prettyPayment(o.payment_method)} • {prettyDeliveryMode(o.delivery_mode)} •{" "}
                                {formatShortDate(o.created_at)}
                              </div>

                              {items.length > 0 ? (
                                <div className="mt-2 grid gap-1">
                                  {items.map((txt, idx) => (
                                    <div
                                      key={`${o.id}-${idx}`}
                                      className="text-[14px] font-semibold text-[#182033]"
                                    >
                                      {txt}
                                    </div>
                                  ))}
                                </div>
                              ) : null}

                              <div className="mt-3 text-[13px] font-extrabold text-[#0b7c4d]">
                                {czk(Number(o.total ?? 0))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : null}

              {confirmTopUpOpen && edit ? (
                <>
                  <SheetHeader
                    title="Dobít kredit"
                    onBack={goOneLayerBack}
                    onClose={closeAllSheets}
                    backLabel="Zpět"
                  />

                  <div className="px-4 pb-5 pt-1 md:px-5">
                    <div className="rounded-[22px] border border-emerald-200 bg-[#f5fbf7] px-4 py-4">
                      <div className="text-[16px] font-extrabold text-[#182033]">
                        Dobít kredit zákazníkovi
                      </div>
                      <div className="mt-2 text-[15px] text-gray-700">
                        <span className="font-extrabold">{edit.full_name || "Bez jména"}</span>
                      </div>
                      <div className="mt-1 text-[15px] text-gray-700">
                        Částka: <span className="font-extrabold">{creditAmount} Kč</span>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setConfirmTopUpOpen(false)}
                        className="h-12 rounded-full border border-gray-200 bg-white text-[15px] font-bold text-[#182033]"
                      >
                        Ne
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={confirmTopUp}
                        className={cls(
                          "h-12 rounded-full text-[15px] font-extrabold text-white",
                          busy ? "bg-emerald-300" : "bg-emerald-600"
                        )}
                      >
                        Ano
                      </button>
                    </div>
                  </div>
                </>
              ) : null}

              {confirmDeleteOpen && edit ? (
                <>
                  <SheetHeader
                    title="Smazat zákazníka"
                    onBack={goOneLayerBack}
                    onClose={closeAllSheets}
                    backLabel="Zpět"
                  />

                  <div className="px-4 pb-5 pt-1 md:px-5">
                    <div className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-4">
                      <div className="text-[16px] font-extrabold text-[#182033]">
                        Opravdu smazat zákazníka?
                      </div>
                      <div className="mt-2 text-[15px] text-gray-700">
                        <span className="font-extrabold">
                          {edit.full_name || fName || "Bez jména"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteOpen(false)}
                        className="h-12 rounded-full border border-gray-200 bg-white text-[15px] font-bold text-[#182033]"
                      >
                        Ne
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={deleteEdit}
                        className={cls(
                          "h-12 rounded-full text-[15px] font-extrabold text-white",
                          busy ? "bg-red-300" : "bg-red-600"
                        )}
                      >
                        Ano
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function SheetHeader({
  title,
  onBack,
  onClose,
  backLabel = "Zpět",
}: {
  title: string;
  onBack: () => void;
  onClose: () => void;
  backLabel?: string;
}) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-100 bg-white px-4 py-4 md:px-5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-2 text-[13px] font-bold text-gray-700"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          {backLabel}
        </button>
      </div>

      <div className="min-w-0 flex-1 text-center text-[18px] font-extrabold text-[#182033]">
        {title}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700"
        title="Zavřít"
      >
        <XIcon className="h-5 w-5" />
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">{label}</div>
      {children}
    </div>
  );
}
