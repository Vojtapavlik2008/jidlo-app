"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
  cart?: any;
};

type Tab = "platici" | "zalohovani" | "vsichni";

const cls = (...a: Array<string | false | undefined | null>) => a.filter(Boolean).join(" ");

function round2(n: number) {
  return Math.round(n * 100) / 100;
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

function czk(n: number) {
  return `${round2(Number(n || 0))} Kč`;
}

function getOrderItemsText(cart: any): string[] {
  if (Array.isArray(cart)) {
    return cart
      .map((x: any) => {
        const qty = Number(x?.qty ?? 0);
        const name = String(x?.name ?? x?.nazev ?? "").trim();
        const day = String(x?.day ?? x?.datum ?? "").trim();
        if (!name) return null;
        return `${qty > 0 ? `${qty}× ` : ""}${name}${day ? ` • ${day}` : ""}`;
      })
      .filter(Boolean);
  }

  const items = Array.isArray(cart?.items) ? cart.items : [];
  return items
    .map((x: any) => {
      const qty = Number(x?.qty ?? 0);
      const name = String(x?.name ?? x?.nazev ?? "").trim();
      const day = String(x?.day ?? x?.datum ?? "").trim();
      if (!name) return null;
      return `${qty > 0 ? `${qty}× ` : ""}${name}${day ? ` • ${day}` : ""}`;
    })
    .filter(Boolean);
}

export default function StaffCustomersPage() {
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("vsichni");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<ProfileRow | null>(null);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [creditOpen, setCreditOpen] = useState(false);

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
        .select("id, created_at, full_name, total, status, payment_method, cart")
        .eq("full_name", fullName)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      setCustomerOrders((data ?? []) as OrderHistoryRow[]);
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
    if (!q) return rows.slice(0, 8);

    return rows
      .filter((r) => {
        const name = (r.full_name ?? "").toLowerCase();
        const email = (r.email ?? "").toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .slice(0, 8);
  }, [rows, creditSearch]);

  async function openEdit(r: ProfileRow) {
    setEdit(r);
    setConfirmDeleteOpen(false);
    setCreditOpen(false);
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
    setConfirmDeleteOpen(false);
    setCreditOpen(true);
    setCreditAmount("");
    setCreditSearch("");
    setFName("");
    setFPhone("");
    setFAddress("");
    setFEmail("");
    setFKredit("0");
    setOpen(true);
    setCustomerOrders([]);
  }

  function closeEdit() {
    if (busy) return;
    setOpen(false);
    setEdit(null);
    setConfirmDeleteOpen(false);
    setCreditOpen(false);
    setCreditAmount("");
    setCreditSearch("");
    setCustomerOrders([]);
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
      closeEdit();
    } catch (e: any) {
      setMsg(e?.message ?? "Chyba při ukládání.");
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
      closeEdit();
    } catch (e: any) {
      setMsg(e?.message ?? "Chyba při mazání.");
    } finally {
      setBusy(false);
    }
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
      setCreditOpen(false);
    } catch (e: any) {
      setMsg(e?.message ?? "Chyba při dobíjení kreditu.");
    } finally {
      setBusy(false);
    }
  }

  function keypadPress(value: string) {
    if (value === "clear") {
      setCreditAmount("");
      return;
    }
    if (value === "back") {
      setCreditAmount((prev) => prev.slice(0, -1));
      return;
    }
    setCreditAmount((prev) => {
      const next = `${prev}${value}`;
      if (next.length > 6) return prev;
      return next;
    });
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

  const pageBg = "bg-[#f6f8f6]";
  const shell = "mx-auto max-w-[1260px] px-4 py-6";
  const pillBtn =
    "inline-flex items-center justify-center rounded-full border transition font-bold";
  const pillWhite =
    "border-gray-200 bg-white text-gray-800 hover:bg-gray-50";
  const pillGreen =
    "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700";

  return (
    <div className={cls("min-h-screen", pageBg)}>
      <div className={shell}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[34px] font-extrabold leading-none tracking-tight text-[#0b2149]">
              Seznam zákazníků
            </div>
            <div className="mt-2 text-[14px] font-semibold text-emerald-700">
              Přepni mezi plátícími / zálohovanými / všemi
            </div>
          </div>

          <div className="flex items-center gap-2">
            {loading ? (
              <span className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-500">
                Načítám…
              </span>
            ) : (
              <span className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-500">
                {rows.length} záznamů
              </span>
            )}

            <button
              type="button"
              onClick={() => router.push("/staff")}
              className={cls(pillBtn, pillWhite, "h-11 px-5 text-[15px]")}
            >
              Rozcestník
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setTab("platici")}
            className={cls(
              pillBtn,
              "h-10 px-4 text-[14px]",
              tab === "platici" ? pillGreen : pillWhite
            )}
          >
            Plátící
            <span
              className={cls(
                "ml-2 rounded-full px-2 py-0.5 text-[11px] font-extrabold",
                tab === "platici" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
              )}
            >
              {platiciCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTab("zalohovani")}
            className={cls(
              pillBtn,
              "h-10 px-4 text-[14px]",
              tab === "zalohovani" ? pillGreen : pillWhite
            )}
          >
            Zálohovaní
            <span
              className={cls(
                "ml-2 rounded-full px-2 py-0.5 text-[11px] font-extrabold",
                tab === "zalohovani" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
              )}
            >
              {zalohovaniCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTab("vsichni")}
            className={cls(
              pillBtn,
              "h-10 px-4 text-[14px]",
              tab === "vsichni" ? pillGreen : pillWhite
            )}
          >
            Všichni
            <span
              className={cls(
                "ml-2 rounded-full px-2 py-0.5 text-[11px] font-extrabold",
                tab === "vsichni" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
              )}
            >
              {vsichniCount}
            </span>
          </button>

          <div className="min-w-[260px] max-w-[380px] flex-1">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Hledat jméno nebo e-mail"
                className="h-10 w-full rounded-full border border-gray-200 bg-white pl-11 pr-4 text-[14px] font-medium text-gray-800 outline-none transition focus:border-emerald-300"
              />
            </div>
          </div>

          <div className="ml-auto">
            <button
              type="button"
              onClick={openTopUpModal}
              className="inline-flex h-10 items-center justify-center rounded-full border border-emerald-300 bg-white px-4 text-[14px] font-bold text-emerald-700 transition hover:bg-emerald-50"
            >
              Dobít kredit
            </button>
          </div>
        </div>

        {msg ? (
          <div className="mb-4 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {msg}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-[28px] border border-emerald-200 bg-white shadow-sm">
          <div className="hidden gap-3 border-b border-emerald-100 bg-white px-6 py-3 text-xs font-extrabold uppercase tracking-wide text-gray-400 md:grid md:grid-cols-[80px_1.2fr_1.6fr_160px_1.2fr_140px_80px]">
            <div>ID</div>
            <div>Jméno</div>
            <div>Adresa</div>
            <div className="text-right">Telefon</div>
            <div>Email</div>
            <div className="text-right">Kredit</div>
            <div className="text-right">Upr.</div>
          </div>

          <div>
            {loading ? (
              <div className="px-6 py-6 text-sm text-gray-600">Načítám…</div>
            ) : filtered.length === 0 ? (
              <div className="px-6 py-6 text-sm text-gray-600">Nic tu není.</div>
            ) : (
              filtered.map((r, i) => {
                const k = round2(Number(r.kredit ?? 0));
                const zebra = i % 2 === 0 ? "bg-white" : "bg-emerald-50/50";

                return (
                  <div
                    key={r.id}
                    onClick={() => openEdit(r)}
                    className={cls(
                      "cursor-pointer px-6 py-4 md:grid md:grid-cols-[80px_1.2fr_1.6fr_160px_1.2fr_140px_80px] md:gap-3",
                      "border-b border-emerald-100 last:border-b-0",
                      zebra,
                      "hover:bg-emerald-50/80 transition"
                    )}
                  >
                    <div className="text-sm font-extrabold text-[#0b2149]">
                      {String(i + 1).padStart(2, "0")}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-bold text-gray-900">{r.full_name || "—"}</div>
                      <div className="mt-1 space-y-1 text-xs text-gray-600 md:hidden">
                        <div className="truncate">{r.address || "—"}</div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{r.email || "—"}</span>
                          <span className="font-semibold text-gray-900">{r.phone || "—"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="hidden min-w-0 md:block">
                      <div className="truncate text-[15px] text-gray-800">{r.address || "—"}</div>
                    </div>

                    <div className="hidden text-right md:block">
                      <div className="text-[15px] font-bold text-gray-900">{r.phone || "—"}</div>
                    </div>

                    <div className="hidden min-w-0 md:block">
                      <div className="truncate text-[15px] text-gray-700">{r.email || "—"}</div>
                    </div>

                    <div className="mt-3 text-right md:mt-0">
                      <span
                        className={cls(
                          "inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold border",
                          k > 0
                            ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                            : k < 0
                            ? "border-red-200 bg-red-100 text-red-800"
                            : "border-gray-200 bg-gray-100 text-gray-700"
                        )}
                      >
                        {k > 0 ? "+" : ""}
                        {k} Kč
                      </span>
                    </div>

                    <div className="mt-3 text-right md:mt-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(r);
                        }}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50"
                        title="Upravit"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {open ? (
        <>
          <button
            type="button"
            onClick={closeEdit}
            className="fixed inset-0 z-40 bg-black/35"
            aria-label="Zavřít"
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {!creditOpen ? (
              <div className="max-h-[92vh] w-full max-w-[760px] overflow-auto rounded-[30px] border border-gray-200 bg-white p-5 shadow-[0_30px_80px_rgba(0,0,0,0.30)]">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[18px] font-extrabold text-[#182033]">
                      Upravit zákazníka
                    </div>
                    <div className="text-[14px] text-gray-500">Uprav údaje a ulož.</div>
                  </div>

                  <button
                    type="button"
                    onClick={closeEdit}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50"
                    title="Zavřít"
                  >
                    <XIcon className="h-5 w-5" />
                  </button>
                </div>

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
                      <button
                        type="button"
                        onClick={() => {
                          setCreditOpen(true);
                          setCreditAmount("");
                          setCreditSearch(fName || fEmail || "");
                        }}
                        className="shrink-0 rounded-full border border-emerald-300 bg-white px-4 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
                      >
                        Dobít kredit
                      </button>
                    </div>
                  </Field>
                </div>

                <div className="mt-6 rounded-[24px] border border-emerald-200 bg-[#f5fbf7] p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5 text-[#0b7c4d]" />
                    <div className="text-[18px] font-extrabold text-[#182033]">Objednávky</div>
                  </div>

                  {ordersLoading ? (
                    <div className="text-sm font-semibold text-gray-600">Načítám objednávky…</div>
                  ) : customerOrders.length === 0 ? (
                    <div className="text-sm font-semibold text-gray-500">Zatím žádné objednávky.</div>
                  ) : (
                    <div className="grid gap-3">
                      {customerOrders.map((o) => {
                        const items = getOrderItemsText(o.cart);
                        return (
                          <div
                            key={o.id}
                            className="rounded-[18px] border border-[#dff2e5] bg-white px-4 py-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="text-[15px] font-extrabold text-[#182033]">
                                  {new Date(o.created_at).toLocaleDateString("cs-CZ")}
                                </div>
                                <div className="mt-1 text-[13px] text-gray-500">
                                  {prettyPayment(o.payment_method)} • {o.status || "—"}
                                </div>
                              </div>

                              <div className="text-[15px] font-extrabold text-[#0b7c4d]">
                                {czk(Number(o.total ?? 0))}
                              </div>
                            </div>

                            {items.length > 0 ? (
                              <div className="mt-3 grid gap-1">
                                {items.map((txt, idx) => (
                                  <div key={`${o.id}-${idx}`} className="text-[14px] font-semibold text-gray-700">
                                    {txt}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmDeleteOpen(true)}
                    className="text-sm font-bold text-red-600 transition hover:text-red-700 disabled:text-gray-400"
                  >
                    Smazat zákazníka
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={closeEdit}
                      className="rounded-full border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50"
                    >
                      Zrušit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={saveEdit}
                      className={cls(
                        "rounded-full px-5 py-3 text-sm font-extrabold text-white",
                        busy ? "bg-emerald-400" : "bg-emerald-600 hover:bg-emerald-700"
                      )}
                    >
                      {busy ? "Ukládám…" : "Uložit"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full max-w-[560px] rounded-[30px] border border-gray-200 bg-white p-5 shadow-[0_30px_80px_rgba(0,0,0,0.30)]">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[18px] font-extrabold text-[#182033]">Dobití kreditu</div>
                    <div className="text-[14px] text-gray-500">Připiš kredit vybranému zákazníkovi.</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCreditOpen(false)}
                    className="inline-flex h-11 items-center justify-center rounded-full border border-gray-200 bg-white px-5 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
                  >
                    Zavřít
                  </button>
                </div>

                <div className="mb-4 space-y-3">
                  <div>
                    <div className="relative">
                      <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        value={creditSearch}
                        onChange={(e) => setCreditSearch(e.target.value)}
                        placeholder="Napiš jméno nebo e-mail"
                        className="h-12 w-full rounded-full border border-gray-200 bg-white pl-11 pr-4 text-[15px] font-medium text-gray-800 outline-none transition focus:border-emerald-300"
                      />
                    </div>

                    {(creditSearch.trim() || !edit) && creditCandidates.length > 0 ? (
                      <div className="mt-2 max-h-[180px] overflow-y-auto rounded-[20px] border border-gray-200 bg-white">
                        {creditCandidates.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => chooseCreditCustomer(r)}
                            className="flex w-full items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 text-left last:border-b-0 hover:bg-emerald-50/60"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-[14px] font-bold text-[#182033]">
                                {r.full_name || "Bez jména"}
                              </div>
                              <div className="truncate text-[13px] text-gray-500">
                                {r.email || r.phone || r.id}
                              </div>
                            </div>
                            <div className="shrink-0 text-[13px] font-bold text-emerald-700">
                              {round2(Number(r.kredit ?? 0))} Kč
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {edit ? (
                    <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/70 px-4 py-3">
                      <div className="text-[16px] font-bold text-[#182033]">
                        {edit.full_name || "Bez jména"}
                      </div>
                      <div className="mt-1 text-[14px] font-semibold text-gray-500">
                        Aktuální kredit: {round2(Number(edit.kredit ?? 0))} Kč
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-[24px] border border-gray-200 bg-gray-50 px-4 py-4">
                    <div className="text-[13px] font-bold text-gray-500">Částka k dobití</div>
                    <div className="mt-3 text-[34px] font-extrabold leading-none text-[#182033]">
                      {creditAmount ? `${creditAmount} Kč` : "—"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"].map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => keypadPress(key)}
                      className="h-[56px] rounded-[18px] border border-gray-200 bg-white text-[18px] font-extrabold text-[#182033] transition hover:bg-gray-50"
                    >
                      {key === "clear" ? "C" : key === "back" ? "←" : key}
                    </button>
                  ))}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCreditOpen(false)}
                    className="h-12 rounded-full border border-gray-200 bg-white text-[15px] font-bold text-[#182033] hover:bg-gray-50"
                  >
                    Zpět
                  </button>
                  <button
                    type="button"
                    disabled={busy || !edit || Number(creditAmount || 0) <= 0}
                    onClick={confirmTopUp}
                    className={cls(
                      "h-12 rounded-full text-[15px] font-extrabold text-white",
                      busy || !edit || Number(creditAmount || 0) <= 0
                        ? "bg-emerald-300"
                        : "bg-emerald-600 hover:bg-emerald-700"
                    )}
                  >
                    Dobít kredit
                  </button>
                </div>
              </div>
            )}
          </div>

          {confirmDeleteOpen && edit ? (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                className="absolute inset-0 bg-black/20"
                aria-label="Zavřít potvrzení"
              />
              <div className="relative w-full max-w-[430px] rounded-[28px] border border-gray-200 bg-white p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
                <div className="text-[18px] font-extrabold text-[#182033]">
                  Opravdu chcete smazat zákazníka?
                </div>
                <div className="mt-2 text-[15px] text-gray-600">
                  <span className="font-bold text-gray-900">
                    {edit.full_name || fName || "Bez jména"}
                  </span>
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteOpen(false)}
                    className="rounded-full border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50"
                  >
                    Ne
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={deleteEdit}
                    className={cls(
                      "rounded-full px-5 py-3 text-sm font-extrabold text-white",
                      busy ? "bg-red-400" : "bg-red-600 hover:bg-red-700"
                    )}
                  >
                    Ano
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
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