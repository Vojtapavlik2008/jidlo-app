"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type View = "home" | "routes" | "allergens" | "items" | "counts";

type RouteRow = {
  id: number;
  okruh: string;
  driverName: string;
  phone: string;
};

type ItemRow = {
  id: number;
  name: string;
  price: number;
};

type FoodCountRow = {
  id: number;
  name: string;
  description?: string;
  category: string;
  countToday: number;
  countYesterday: number;
  history: {
    date: string;
    count: number;
  }[];
};

type AllergenRow = {
  id: number;
  code: number;
  name: string;
};

type FoodAllergenSourceRow = {
  alergeny: string | null;
};

const cls = (...a: Array<string | false | undefined | null>) => a.filter(Boolean).join(" ");

function extractAllergenNumbers(value: string | null | undefined): number[] {
  if (!value) return [];
  const matches = value.match(/\d+/g);
  if (!matches) return [];
  return matches
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 100);
}

function PencilIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.06 4.94 17.81 8.69"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M4 7h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function PlusIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M12 5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function AdminTile({
  title,
  onClick,
}: {
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cls(
        "flex min-h-[104px] w-full items-center justify-center rounded-[22px] border border-emerald-300",
        "bg-emerald-500 px-6 py-6 text-center text-white shadow-sm transition",
        "hover:-translate-y-0.5 hover:bg-emerald-600"
      )}
    >
      <span className="text-[22px] font-extrabold tracking-tight">{title}</span>
    </button>
  );
}

function TopLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center rounded-full border border-emerald-400 bg-white px-5 text-[15px] font-bold text-emerald-700 transition hover:bg-emerald-50"
    >
      {children}
    </Link>
  );
}

function TopButton({
  onClick,
  children,
  tone = "white",
}: {
  onClick?: () => void;
  children: React.ReactNode;
  tone?: "white" | "green" | "red";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cls(
        "inline-flex h-10 items-center rounded-full px-5 text-[15px] font-bold transition",
        tone === "white" && "border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50",
        tone === "green" && "bg-emerald-500 text-white hover:bg-emerald-600",
        tone === "red" && "bg-red-500 text-white hover:bg-red-600"
      )}
    >
      {children}
    </button>
  );
}

function PillButton({
  onClick,
  children,
  tone = "green",
  type = "button",
}: {
  onClick?: () => void;
  children: React.ReactNode;
  tone?: "green" | "white" | "red";
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={cls(
        "inline-flex h-9 items-center justify-center rounded-full px-4 text-[14px] font-bold transition",
        tone === "green" && "bg-emerald-500 text-white hover:bg-emerald-600",
        tone === "white" && "border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50",
        tone === "red" && "bg-red-500 text-white hover:bg-red-600"
      )}
    >
      {children}
    </button>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  className = "",
}: {
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cls(
        "h-9 w-full rounded-full border border-emerald-200 bg-white px-4 text-[14px] outline-none transition",
        "placeholder:text-slate-400 focus:border-emerald-500",
        className
      )}
    />
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cls("rounded-[24px] border border-emerald-200 bg-white shadow-sm", className)}>
      {children}
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-100 px-6 py-5">
      <div>
        <h2 className="text-[26px] font-extrabold tracking-tight text-[#0b2149]">{title}</h2>
        {subtitle ? <p className="mt-1 text-[14px] text-slate-500">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
}

export default function StaffAdminPage() {
  const [view, setView] = useState<View>("home");

  const [routes, setRoutes] = useState<RouteRow[]>([
    { id: 1, okruh: "1. okruh", driverName: "Jan Novák", phone: "777 123 456" },
    { id: 2, okruh: "2. okruh", driverName: "", phone: "" },
  ]);

  const [items, setItems] = useState<ItemRow[]>([
    { id: 1, name: "Rozvoz", price: 10 },
    { id: 2, name: "Rekrabička", price: 80 },
    { id: 3, name: "Krabička na jídlo", price: 8 },
    { id: 4, name: "Krabička na polévku", price: 7 },
    { id: 5, name: "Bez krabičky", price: 0 },
  ]);

  const [foods] = useState<FoodCountRow[]>([
    {
      id: 25,
      name: "Kapustová polévka",
      category: "Polévky",
      countToday: 12,
      countYesterday: 10,
      history: [
        { date: "2026-03-01", count: 9 },
        { date: "2026-03-02", count: 14 },
        { date: "2026-03-03", count: 12 },
        { date: "2026-03-04", count: 11 },
        { date: "2026-03-05", count: 10 },
        { date: "2026-03-06", count: 12 },
      ],
    },
    {
      id: 53,
      name: "Sojové kostky po myslivecku rýže",
      category: "Hlavní jídla",
      countToday: 4,
      countYesterday: 6,
      history: [
        { date: "2026-03-01", count: 7 },
        { date: "2026-03-02", count: 8 },
        { date: "2026-03-03", count: 5 },
        { date: "2026-03-04", count: 4 },
        { date: "2026-03-05", count: 6 },
        { date: "2026-03-06", count: 4 },
      ],
    },
    {
      id: 94,
      name: "Smaž. sýr bram. tatar. om. obl.",
      category: "Hlavní jídla",
      countToday: 5,
      countYesterday: 8,
      history: [
        { date: "2026-03-01", count: 6 },
        { date: "2026-03-02", count: 8 },
        { date: "2026-03-03", count: 9 },
        { date: "2026-03-04", count: 7 },
        { date: "2026-03-05", count: 8 },
        { date: "2026-03-06", count: 5 },
      ],
    },
    {
      id: 215,
      name: "Vepřové ražniči bram. tat.om.",
      category: "Hlavní jídla",
      countToday: 29,
      countYesterday: 25,
      history: [
        { date: "2026-03-01", count: 18 },
        { date: "2026-03-02", count: 20 },
        { date: "2026-03-03", count: 24 },
        { date: "2026-03-04", count: 21 },
        { date: "2026-03-05", count: 25 },
        { date: "2026-03-06", count: 29 },
      ],
    },
  ]);

  const [allergens, setAllergens] = useState<AllergenRow[]>([]);
  const [allergensLoading, setAllergensLoading] = useState(false);
  const [allergensError, setAllergensError] = useState<string | null>(null);

  const [routeEditId, setRouteEditId] = useState<number | null>(null);
  const [routeDrafts, setRouteDrafts] = useState<Record<number, RouteRow>>({});

  const [itemEditId, setItemEditId] = useState<number | null>(null);
  const [itemDrafts, setItemDrafts] = useState<Record<number, ItemRow>>({});

  const [allergenEditId, setAllergenEditId] = useState<number | null>(null);
  const [allergenDrafts, setAllergenDrafts] = useState<Record<number, AllergenRow>>({});

  const [countMode, setCountMode] = useState<"today" | "yesterday" | "day" | "week" | "month">("today");
  const [customDay, setCustomDay] = useState("2026-03-06");

  useEffect(() => {
    if (view !== "allergens") return;

    let cancelled = false;

    async function loadAllergens() {
      setAllergensLoading(true);
      setAllergensError(null);

      const { data, error } = await supabase.from("jidla").select("alergeny").order("id", { ascending: true });

      if (cancelled) return;

      if (error) {
        setAllergensError(error.message || "Nepodařilo se načíst alergeny.");
        setAllergensLoading(false);
        return;
      }

      const source = (data ?? []) as FoodAllergenSourceRow[];
      const unique = Array.from(new Set(source.flatMap((row) => extractAllergenNumbers(row.alergeny)))).sort(
        (a, b) => a - b
      );

      const rows: AllergenRow[] = unique.map((num) => ({
        id: num,
        code: num,
        name: `Alergen ${num}`,
      }));

      setAllergens(rows);
      setAllergensLoading(false);
    }

    loadAllergens();

    return () => {
      cancelled = true;
    };
  }, [view]);

  const foodRows = useMemo(() => {
    return foods.map((food) => {
      let count = food.countToday;
      if (countMode === "yesterday") count = food.countYesterday;
      if (countMode === "day") count = food.history.find((x) => x.date === customDay)?.count ?? 0;
      if (countMode === "week") count = food.history.reduce((sum, x) => sum + x.count, 0);
      if (countMode === "month") count = food.history.reduce((sum, x) => sum + x.count, 0) + 18;
      return { ...food, shownCount: count };
    });
  }, [foods, countMode, customDay]);

  function startRouteEdit(row: RouteRow) {
    setRouteEditId(row.id);
    setRouteDrafts((prev) => ({ ...prev, [row.id]: { ...row } }));
  }

  function saveRouteEdit(id: number) {
    const draft = routeDrafts[id];
    if (!draft) return;
    setRoutes((prev) => prev.map((r) => (r.id === id ? draft : r)));
    setRouteEditId(null);
  }

  function deleteRoute(id: number) {
    if (!confirm("Opravdu smazat tento okruh?")) return;
    setRoutes((prev) => prev.filter((r) => r.id !== id));
    if (routeEditId === id) setRouteEditId(null);
  }

  function addRoute() {
    const newId = Math.max(0, ...routes.map((r) => r.id)) + 1;
    const row: RouteRow = { id: newId, okruh: `${routes.length + 1}. okruh`, driverName: "", phone: "" };
    setRoutes((prev) => [...prev, row]);
    setRouteEditId(newId);
    setRouteDrafts((prev) => ({ ...prev, [newId]: row }));
  }

  function startItemEdit(row: ItemRow) {
    setItemEditId(row.id);
    setItemDrafts((prev) => ({ ...prev, [row.id]: { ...row } }));
  }

  function saveItemEdit(id: number) {
    const draft = itemDrafts[id];
    if (!draft) return;
    setItems((prev) => prev.map((r) => (r.id === id ? draft : r)));
    setItemEditId(null);
  }

  function deleteItem(id: number) {
    if (!confirm("Opravdu smazat tuto položku?")) return;
    setItems((prev) => prev.filter((r) => r.id !== id));
    if (itemEditId === id) setItemEditId(null);
  }

  function addItem() {
    const newId = Math.max(0, ...items.map((r) => r.id)) + 1;
    const row: ItemRow = { id: newId, name: "", price: 0 };
    setItems((prev) => [...prev, row]);
    setItemEditId(newId);
    setItemDrafts((prev) => ({ ...prev, [newId]: row }));
  }

  function startAllergenEdit(row: AllergenRow) {
    setAllergenEditId(row.id);
    setAllergenDrafts((prev) => ({ ...prev, [row.id]: { ...row } }));
  }

  function saveAllergenEdit(id: number) {
    const draft = allergenDrafts[id];
    if (!draft) return;
    setAllergens((prev) => prev.map((r) => (r.id === id ? { ...draft, id: draft.code } : r)));
    setAllergenEditId(null);
  }

  function deleteAllergen(id: number) {
    if (!confirm("Opravdu smazat tento alergen ze seznamu na stránce?")) return;
    setAllergens((prev) => prev.filter((r) => r.id !== id));
    if (allergenEditId === id) setAllergenEditId(null);
  }

  function addAllergen() {
    const newCode = Math.max(0, ...allergens.map((r) => r.code)) + 1;
    const row: AllergenRow = {
      id: Date.now(),
      code: newCode,
      name: `Alergen ${newCode}`,
    };
    setAllergens((prev) => [...prev, row]);
    setAllergenEditId(row.id);
    setAllergenDrafts((prev) => ({ ...prev, [row.id]: row }));
  }

  function renderTop(title: string, subtitle?: string, showBack = false) {
    return (
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[34px] font-extrabold leading-none tracking-tight text-[#0b2149]">{title}</h1>
          {subtitle ? <p className="mt-2 text-[14px] font-bold text-emerald-700">{subtitle}</p> : null}
        </div>

        <div className="flex items-center gap-2">
          {showBack ? <TopButton onClick={() => setView("home")}>Zpět</TopButton> : null}
          <TopLink href="/staff">Rozcestník</TopLink>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8faf8]">
      <div className="mx-auto max-w-[1220px] px-7 py-9">
        {view === "home" ? (
          <>
            {renderTop("Administrace", "Správa systémových údajů")}

            <div className="grid gap-5 md:grid-cols-2">
              <AdminTile title="Rozvoz – okruhy" onClick={() => setView("routes")} />
              <AdminTile title="Alergeny" onClick={() => setView("allergens")} />
              <AdminTile title="Položky" onClick={() => setView("items")} />
              <AdminTile title="Počty jídel" onClick={() => setView("counts")} />
            </div>
          </>
        ) : null}

        {view === "routes" ? (
          <>
            {renderTop("Rozvoz – okruhy", "Správa okruhů, řidičů a telefonů", true)}

            <Card>
              <SectionHeader
                title="Okruhy"
                subtitle="Tužkou upravíš řádek. Když není nic vyplněné, zobrazí se „-“."
                right={
                  <PillButton onClick={addRoute}>
                    <span className="mr-2">
                      <PlusIcon className="h-4 w-4" />
                    </span>
                    Přidat okruh
                  </PillButton>
                }
              />

              <div className="p-5">
                <div className="overflow-hidden rounded-[20px] border border-emerald-100">
                  <table className="min-w-full bg-white">
                    <thead className="bg-emerald-50">
                      <tr className="text-left text-[14px] font-extrabold text-[#0b2149]">
                        <th className="px-5 py-4">Okruh</th>
                        <th className="px-5 py-4">Jméno</th>
                        <th className="px-5 py-4">Telefon</th>
                        <th className="px-5 py-4 text-right">Akce</th>
                      </tr>
                    </thead>
                    <tbody>
                      {routes.map((row) => {
                        const editing = routeEditId === row.id;
                        const draft = routeDrafts[row.id];

                        return (
                          <tr key={row.id} className="border-t border-emerald-100">
                            <td className="px-5 py-4">
                              {editing ? (
                                <TextInput
                                  value={draft?.okruh ?? ""}
                                  onChange={(value) =>
                                    setRouteDrafts((prev) => ({
                                      ...prev,
                                      [row.id]: { ...(prev[row.id] ?? row), okruh: value },
                                    }))
                                  }
                                />
                              ) : (
                                <span className="text-[16px] font-semibold text-slate-900">{row.okruh || "-"}</span>
                              )}
                            </td>

                            <td className="px-5 py-4">
                              {editing ? (
                                <TextInput
                                  value={draft?.driverName ?? ""}
                                  onChange={(value) =>
                                    setRouteDrafts((prev) => ({
                                      ...prev,
                                      [row.id]: { ...(prev[row.id] ?? row), driverName: value },
                                    }))
                                  }
                                />
                              ) : (
                                <span className="text-[16px] text-slate-700">{row.driverName || "-"}</span>
                              )}
                            </td>

                            <td className="px-5 py-4">
                              {editing ? (
                                <TextInput
                                  value={draft?.phone ?? ""}
                                  onChange={(value) =>
                                    setRouteDrafts((prev) => ({
                                      ...prev,
                                      [row.id]: { ...(prev[row.id] ?? row), phone: value },
                                    }))
                                  }
                                />
                              ) : (
                                <span className="text-[16px] text-slate-700">{row.phone || "-"}</span>
                              )}
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex justify-end gap-2">
                                {editing ? (
                                  <>
                                    <PillButton onClick={() => saveRouteEdit(row.id)}>Uložit</PillButton>
                                    <PillButton tone="white" onClick={() => setRouteEditId(null)}>
                                      Zrušit
                                    </PillButton>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => startRouteEdit(row)}
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100"
                                  >
                                    <PencilIcon className="h-4 w-4" />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => deleteRoute(row.id)}
                                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600 transition hover:bg-red-100"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          </>
        ) : null}

        {view === "items" ? (
          <>
            {renderTop("Položky", "Rozvoz, rekrabička, krabičky a další položky", true)}

            <Card>
              <SectionHeader
                title="Položky systému"
                subtitle="Přidání, úprava a mazání položek"
                right={
                  <PillButton onClick={addItem}>
                    <span className="mr-2">
                      <PlusIcon className="h-4 w-4" />
                    </span>
                    Přidat položku
                  </PillButton>
                }
              />

              <div className="p-5">
                <div className="overflow-hidden rounded-[20px] border border-emerald-100">
                  <table className="min-w-full bg-white">
                    <thead className="bg-emerald-50">
                      <tr className="text-left text-[14px] font-extrabold text-[#0b2149]">
                        <th className="px-5 py-4">ID</th>
                        <th className="px-5 py-4">Název</th>
                        <th className="px-5 py-4">Cena</th>
                        <th className="px-5 py-4 text-right">Akce</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((row) => {
                        const editing = itemEditId === row.id;
                        const draft = itemDrafts[row.id];

                        return (
                          <tr key={row.id} className="border-t border-emerald-100">
                            <td className="px-5 py-4 text-[16px] font-semibold text-slate-900">{row.id}</td>

                            <td className="px-5 py-4">
                              {editing ? (
                                <TextInput
                                  value={draft?.name ?? ""}
                                  onChange={(value) =>
                                    setItemDrafts((prev) => ({
                                      ...prev,
                                      [row.id]: { ...(prev[row.id] ?? row), name: value },
                                    }))
                                  }
                                />
                              ) : (
                                <span className="text-[16px] text-slate-700">{row.name || "-"}</span>
                              )}
                            </td>

                            <td className="px-5 py-4">
                              {editing ? (
                                <TextInput
                                  type="number"
                                  value={draft?.price ?? 0}
                                  onChange={(value) =>
                                    setItemDrafts((prev) => ({
                                      ...prev,
                                      [row.id]: { ...(prev[row.id] ?? row), price: Number(value || 0) },
                                    }))
                                  }
                                  className="max-w-[140px]"
                                />
                              ) : (
                                <span className="text-[16px] font-bold text-emerald-700">{row.price.toFixed(2)} Kč</span>
                              )}
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex justify-end gap-2">
                                {editing ? (
                                  <>
                                    <PillButton onClick={() => saveItemEdit(row.id)}>Uložit</PillButton>
                                    <PillButton tone="white" onClick={() => setItemEditId(null)}>
                                      Zrušit
                                    </PillButton>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => startItemEdit(row)}
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100"
                                  >
                                    <PencilIcon className="h-4 w-4" />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => deleteItem(row.id)}
                                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600 transition hover:bg-red-100"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          </>
        ) : null}

        {view === "allergens" ? (
          <>
            {renderTop("Alergeny", "Načtené reálně ze tabulky jidla", true)}

            <Card>
              <SectionHeader
                title="Seznam alergenů"
                subtitle="Čísla jsou načtená z databáze. Názvy doplníme později."
                right={
                  <div className="flex gap-2">
                    <PillButton tone="white" onClick={() => setView("allergens")}>
                      Obnovit
                    </PillButton>
                    <PillButton onClick={addAllergen}>
                      <span className="mr-2">
                        <PlusIcon className="h-4 w-4" />
                      </span>
                      Přidat
                    </PillButton>
                  </div>
                }
              />

              <div className="p-5">
                {allergensLoading ? (
                  <div className="rounded-[20px] border border-emerald-100 bg-emerald-50 px-5 py-5 text-[15px] font-bold text-emerald-700">
                    Načítám alergeny…
                  </div>
                ) : allergensError ? (
                  <div className="rounded-[20px] border border-red-200 bg-red-50 px-5 py-5 text-[15px] font-bold text-red-700">
                    Chyba: {allergensError}
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-[20px] border border-emerald-100">
                    <table className="min-w-full bg-white">
                      <thead className="bg-emerald-50">
                        <tr className="text-left text-[14px] font-extrabold text-[#0b2149]">
                          <th className="px-5 py-4">Číslo</th>
                          <th className="px-5 py-4">Název</th>
                          <th className="px-5 py-4 text-right">Akce</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allergens
                          .slice()
                          .sort((a, b) => a.code - b.code)
                          .map((row) => {
                            const editing = allergenEditId === row.id;
                            const draft = allergenDrafts[row.id];

                            return (
                              <tr key={row.id} className="border-t border-emerald-100">
                                <td className="px-5 py-4">
                                  {editing ? (
                                    <TextInput
                                      type="number"
                                      value={draft?.code ?? 0}
                                      onChange={(value) =>
                                        setAllergenDrafts((prev) => ({
                                          ...prev,
                                          [row.id]: { ...(prev[row.id] ?? row), code: Number(value || 0) },
                                        }))
                                      }
                                      className="max-w-[120px]"
                                    />
                                  ) : (
                                    <span className="text-[16px] font-bold text-emerald-700">{row.code}</span>
                                  )}
                                </td>

                                <td className="px-5 py-4">
                                  {editing ? (
                                    <TextInput
                                      value={draft?.name ?? ""}
                                      onChange={(value) =>
                                        setAllergenDrafts((prev) => ({
                                          ...prev,
                                          [row.id]: { ...(prev[row.id] ?? row), name: value },
                                        }))
                                      }
                                    />
                                  ) : (
                                    <span className="text-[16px] text-slate-700">{row.name}</span>
                                  )}
                                </td>

                                <td className="px-5 py-4">
                                  <div className="flex justify-end gap-2">
                                    {editing ? (
                                      <>
                                        <PillButton onClick={() => saveAllergenEdit(row.id)}>Uložit</PillButton>
                                        <PillButton tone="white" onClick={() => setAllergenEditId(null)}>
                                          Zrušit
                                        </PillButton>
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => startAllergenEdit(row)}
                                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100"
                                      >
                                        <PencilIcon className="h-4 w-4" />
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => deleteAllergen(row.id)}
                                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600 transition hover:bg-red-100"
                                    >
                                      <TrashIcon className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}

                        {!allergensLoading && !allergensError && allergens.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-5 py-6 text-center text-[15px] text-slate-500">
                              Ve sloupci <span className="font-bold">alergeny</span> jsem zatím nenašel žádná čísla.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Card>
          </>
        ) : null}

        {view === "counts" ? (
          <>
            {renderTop("Počty jídel", "Přehled prodaných jídel", true)}

            <Card>
              <SectionHeader title="Filtr období" subtitle="Zvol období, které chceš zobrazit" />

              <div className="border-b border-emerald-100 px-6 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <PillButton onClick={() => setCountMode("today")} tone={countMode === "today" ? "green" : "white"}>
                    Dnes
                  </PillButton>
                  <PillButton
                    onClick={() => setCountMode("yesterday")}
                    tone={countMode === "yesterday" ? "green" : "white"}
                  >
                    Včera
                  </PillButton>
                  <PillButton onClick={() => setCountMode("week")} tone={countMode === "week" ? "green" : "white"}>
                    Týden
                  </PillButton>
                  <PillButton onClick={() => setCountMode("month")} tone={countMode === "month" ? "green" : "white"}>
                    Měsíc
                  </PillButton>
                  <PillButton onClick={() => setCountMode("day")} tone={countMode === "day" ? "green" : "white"}>
                    Vyber den
                  </PillButton>

                  {countMode === "day" ? (
                    <input
                      type="date"
                      value={customDay}
                      onChange={(e) => setCustomDay(e.target.value)}
                      className="h-9 rounded-full border border-emerald-200 bg-white px-4 text-[14px] outline-none focus:border-emerald-500"
                    />
                  ) : null}
                </div>
              </div>

              <div className="p-5">
                <div className="overflow-hidden rounded-[20px] border border-emerald-100">
                  <table className="min-w-full bg-white">
                    <thead className="bg-emerald-50">
                      <tr className="text-left text-[14px] font-extrabold text-[#0b2149]">
                        <th className="px-5 py-4">ID</th>
                        <th className="px-5 py-4">Název</th>
                        <th className="px-5 py-4">Popis</th>
                        <th className="px-5 py-4">Kategorie</th>
                        <th className="px-5 py-4">Počet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {foodRows.map((row) => (
                        <tr key={row.id} className="border-t border-emerald-100">
                          <td className="px-5 py-4 text-[16px] text-slate-900">{row.id}</td>
                          <td className="px-5 py-4 text-[16px] font-semibold text-slate-900">{row.name}</td>
                          <td className="px-5 py-4 text-[14px] text-slate-400">{row.description || ""}</td>
                          <td className="px-5 py-4 text-[16px] text-slate-700">{row.category}</td>
                          <td className="px-5 py-4 text-[16px] font-bold text-emerald-700">{row.shownCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          </>
        ) : null}
      </div>
    </main>
  );
}