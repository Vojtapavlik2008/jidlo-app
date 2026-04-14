"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AddFoodModal from "../staff/jidla/_ui/AddFoodModal";

type FoodRow = {
  id: string;
  legacy_id: number;
  kategorie: string | null;
  nazev: string;
  cena: number | null;
  aktivni: boolean | null;
};

type SortKey = "legacy_id" | "nazev" | "cena";
type SortDir = "asc" | "desc";

function normStr(x: string | null | undefined) {
  return (x ?? "").toString().trim().toLowerCase();
}

function eqRow(a: FoodRow, b: FoodRow) {
  return (
    a.legacy_id === b.legacy_id &&
    (a.nazev ?? "") === (b.nazev ?? "") &&
    (a.kategorie ?? "") === (b.kategorie ?? "") &&
    (a.cena ?? null) === (b.cena ?? null) &&
    (a.aktivni ?? null) === (b.aktivni ?? null)
  );
}

function formatPrice(value: number | null) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value} Kč`;
}

async function apiGetFoods(): Promise<FoodRow[]> {
  const r = await fetch("/api/staff/jidla", { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || "Chyba: nejdou načíst jídla.");
  return (j?.data ?? []) as FoodRow[];
}

async function apiPatchFood(id: string, patch: Partial<FoodRow>) {
  const r = await fetch("/api/staff/jidla", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ id, ...patch }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || "Chyba při ukládání.");
}

async function apiDeleteFood(id: string) {
  const r = await fetch(`/api/staff/jidla?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || "Chyba při mazání.");
}

export default function StaffFoodEditor() {
  const [rows, setRows] = useState<FoodRow[]>([]);
  const [original, setOriginal] = useState<Record<string, FoodRow>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "legacy_id",
    dir: "asc",
  });

  const [catFilter, setCatFilter] = useState<string>("__ALL__");
  const [addOpen, setAddOpen] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailDraft, setDetailDraft] = useState<FoodRow | null>(null);

  async function load() {
    setLoading(true);
    setMsg(null);

    try {
      const list = await apiGetFoods();

      const orig: Record<string, FoodRow> = {};
      for (const r of list) orig[r.id] = { ...r };

      setOriginal(orig);
      setRows(list);
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "Chyba: nejdou načíst jídla.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const c = (r.kategorie ?? "").trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "cs"));
  }, [rows]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();

    return rows.filter((r) => {
      const matchesSearch =
        !s ||
        String(r.legacy_id ?? "").includes(s) ||
        normStr(r.nazev).includes(s) ||
        normStr(r.kategorie).includes(s);

      const matchesCat =
        catFilter === "__ALL__" ? true : (r.kategorie ?? "") === catFilter;

      return matchesSearch && matchesCat;
    });
  }, [q, rows, catFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sort.dir === "asc" ? 1 : -1;

    arr.sort((a, b) => {
      if (sort.key === "legacy_id") {
        return dir * (Number(a.legacy_id ?? 0) - Number(b.legacy_id ?? 0));
      }

      if (sort.key === "cena") {
        const av = a.cena == null ? -Infinity : Number(a.cena);
        const bv = b.cena == null ? -Infinity : Number(b.cena);
        return dir * (av - bv);
      }

      return dir * normStr(a.nazev).localeCompare(normStr(b.nazev), "cs");
    });

    return arr;
  }, [filtered, sort]);

  function toggleSort(key: SortKey) {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  }

  function indicatorFor(key: SortKey) {
    if (sort.key !== key) return "";
    if (key === "nazev") return sort.dir === "asc" ? "A–Z" : "Z–A";
    return sort.dir === "asc" ? "↑" : "↓";
  }

  function openDetail(row: FoodRow) {
    setDetailDraft({ ...row });
    setDetailOpen(true);
  }

  function closeDetail() {
    if (savingId) return;
    setDetailOpen(false);
    setDetailDraft(null);
  }

  function detailIsDirty() {
    if (!detailDraft) return false;
    const base = original[detailDraft.id];
    if (!base) return false;
    return !eqRow(base, detailDraft);
  }

  function resetDetailChanges() {
    if (!detailDraft) return;
    const base = original[detailDraft.id];
    if (!base) return;
    setDetailDraft({ ...base });
  }

  async function saveDetail() {
    if (!detailDraft) return;

    setSavingId(detailDraft.id);
    setMsg(null);

    try {
      await apiPatchFood(detailDraft.id, {
        nazev: detailDraft.nazev,
        cena: detailDraft.cena,
        kategorie: detailDraft.kategorie,
        aktivni: detailDraft.aktivni,
      });

      setRows((prev) =>
        prev.map((r) => (r.id === detailDraft.id ? { ...detailDraft } : r))
      );
      setOriginal((prev) => ({
        ...prev,
        [detailDraft.id]: { ...detailDraft },
      }));

      setMsg(`Uloženo: ${detailDraft.legacy_id} – ${detailDraft.nazev}`);
      setDetailOpen(false);
      setDetailDraft(null);
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "Chyba při ukládání.");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteDetail() {
    if (!detailDraft) return;

    const ok = window.confirm(
      `Opravdu smazat „${detailDraft.nazev}“ (č. ${detailDraft.legacy_id})?`
    );
    if (!ok) return;

    setSavingId(detailDraft.id);
    setMsg(null);

    try {
      await apiDeleteFood(detailDraft.id);

      setRows((prev) => prev.filter((r) => r.id !== detailDraft.id));
      setOriginal((prev) => {
        const copy = { ...prev };
        delete copy[detailDraft.id];
        return copy;
      });

      setMsg(`Smazáno: ${detailDraft.legacy_id} – ${detailDraft.nazev}`);
      setDetailOpen(false);
      setDetailDraft(null);
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "Chyba při mazání.");
    } finally {
      setSavingId(null);
    }
  }

  const saveDisabled = !detailDraft || !detailIsDirty() || savingId === detailDraft.id;

  const headBtn =
    "inline-flex items-center gap-2 rounded-xl px-2 py-1 text-left transition hover:bg-green-100/70";

  return (
    <main className="min-h-screen bg-[#f8faf8]">
      <div className="mx-auto max-w-[1180px] px-3 pb-6 pt-4 md:px-6 md:pt-8">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 text-[28px] font-extrabold tracking-tight text-[#0b2149] md:text-[38px]">
            Seznam jídel
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/staff/sprava-menu"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[24px] font-bold text-slate-700 ring-2 ring-slate-200 transition hover:bg-slate-50"
              title="Zpět na správu menu"
            >
              ←
            </Link>

            <Link
              href="/staff"
              className="inline-flex h-11 items-center justify-center rounded-full bg-green-50 px-4 text-[13px] font-extrabold text-green-900 ring-2 ring-green-200 transition hover:bg-green-100/70 md:px-5 md:text-[14px]"
            >
              Rozcestník
            </Link>
          </div>
        </div>

        <div className="mt-3 h-[4px] w-full rounded-full bg-green-600/90" />

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Hledat jídlo…"
              className="h-12 w-full rounded-full bg-white px-4 text-[14px] font-semibold text-gray-900 placeholder:text-gray-400 ring-2 ring-green-200/80 focus:outline-none focus:ring-2 focus:ring-green-500/30 sm:w-[280px] md:w-[340px]"
            />

            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="h-12 rounded-full bg-white px-4 text-[14px] font-semibold text-gray-900 ring-2 ring-green-200/80 focus:outline-none focus:ring-2 focus:ring-green-500/30"
            >
              <option value="__ALL__">Všechny kategorie</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex h-12 items-center justify-center rounded-full bg-green-600 px-6 text-[14px] font-extrabold text-white transition hover:brightness-95"
          >
            + Přidat jídlo
          </button>
        </div>

        {msg ? (
          <div className="mt-4 rounded-2xl bg-green-50 px-4 py-3 text-sm text-gray-800 ring-1 ring-green-200/70">
            {msg}
          </div>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-[28px] bg-white ring-2 ring-green-200/70 shadow-sm">
          <div className="grid grid-cols-[70px_minmax(0,1fr)_104px] items-center gap-3 bg-green-50/70 px-4 py-3 text-[15px] font-extrabold text-green-900 md:grid-cols-[90px_minmax(0,1.6fr)_140px_220px]">
            <div>
              <button
                type="button"
                onClick={() => toggleSort("legacy_id")}
                className={headBtn}
              >
                <span>ID</span>
                <span className="text-base opacity-80">{indicatorFor("legacy_id")}</span>
              </button>
            </div>

            <div>
              <button
                type="button"
                onClick={() => toggleSort("nazev")}
                className={headBtn}
              >
                <span>Název</span>
                <span className="text-base opacity-80">{indicatorFor("nazev")}</span>
              </button>
            </div>

            <div>
              <button
                type="button"
                onClick={() => toggleSort("cena")}
                className={headBtn}
              >
                <span>Cena</span>
                <span className="text-base opacity-80">{indicatorFor("cena")}</span>
              </button>
            </div>

            <div className="hidden md:block text-[15px]">Kategorie</div>
          </div>

          {loading ? (
            <div className="px-4 py-6 text-sm text-gray-600">Načítám…</div>
          ) : sorted.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-600">Nic nenalezeno.</div>
          ) : (
            <div className="divide-y divide-green-200/80">
              {sorted.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => openDetail(r)}
                  className="grid w-full grid-cols-[70px_minmax(0,1fr)_104px] items-center gap-3 bg-white px-4 py-4 text-left transition hover:bg-green-50/50 md:grid-cols-[90px_minmax(0,1.6fr)_140px_220px]"
                >
                  <div className="text-[18px] font-extrabold text-green-900">
                    {r.legacy_id}
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-extrabold text-gray-900 md:text-[16px]">
                      {r.nazev}
                    </div>
                    <div className="mt-1 truncate text-[12px] text-gray-500 md:hidden">
                      {r.kategorie || "Bez kategorie"}
                    </div>
                  </div>

                  <div className="whitespace-nowrap text-[15px] font-extrabold text-green-900">
                    {formatPrice(r.cena)}
                  </div>

                  <div className="hidden truncate text-[14px] font-semibold text-gray-600 md:block">
                    {r.kategorie || "Bez kategorie"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {detailOpen && detailDraft ? (
        <>
          <button
            type="button"
            onClick={closeDetail}
            className="fixed inset-0 z-[80] bg-black/40"
            aria-label="Zavřít detail"
          />

          <div className="fixed inset-x-0 bottom-0 z-[90] mx-auto w-full max-w-[560px] rounded-t-[30px] bg-white p-4 shadow-2xl md:left-1/2 md:top-1/2 md:bottom-auto md:inset-x-auto md:w-[560px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[30px]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[24px] font-extrabold text-gray-900">
                  Detail jídla
                </div>
                <div className="mt-1 text-[13px] font-semibold text-gray-500">
                  ID {detailDraft.legacy_id}
                </div>
              </div>

              <button
                type="button"
                onClick={closeDetail}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-[24px] font-bold text-slate-700 ring-2 ring-slate-200 transition hover:bg-slate-50"
                title="Zavřít"
              >
                ×
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-[13px] font-extrabold text-gray-700">
                  Název
                </label>
                <input
                  value={detailDraft.nazev}
                  onChange={(e) =>
                    setDetailDraft((prev) =>
                      prev ? { ...prev, nazev: e.target.value } : prev
                    )
                  }
                  className="h-12 w-full rounded-[18px] bg-white px-4 text-[15px] font-semibold text-gray-900 ring-2 ring-green-200/80 focus:outline-none focus:ring-2 focus:ring-green-500/30"
                />
              </div>

              <div>
                <label className="mb-1 block text-[13px] font-extrabold text-gray-700">
                  Cena
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={detailDraft.cena ?? ""}
                    onChange={(e) =>
                      setDetailDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              cena:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                            }
                          : prev
                      )
                    }
                    className="h-12 min-w-0 flex-1 rounded-[18px] bg-white px-4 text-[15px] font-semibold text-gray-900 ring-2 ring-green-200/80 focus:outline-none focus:ring-2 focus:ring-green-500/30"
                  />
                  <div className="shrink-0 text-[14px] font-extrabold text-green-900">
                    Kč
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[13px] font-extrabold text-gray-700">
                  Kategorie
                </label>
                <input
                  list="food-categories-list"
                  value={detailDraft.kategorie ?? ""}
                  onChange={(e) =>
                    setDetailDraft((prev) =>
                      prev ? { ...prev, kategorie: e.target.value } : prev
                    )
                  }
                  className="h-12 w-full rounded-[18px] bg-white px-4 text-[15px] font-semibold text-gray-900 ring-2 ring-green-200/80 focus:outline-none focus:ring-2 focus:ring-green-500/30"
                  placeholder="např. Polévka"
                />
                <datalist id="food-categories-list">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div className="rounded-[18px] bg-green-50/60 px-4 py-3 ring-1 ring-green-200/80">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[14px] font-extrabold text-gray-900">
                      Aktivní
                    </div>
                    <div className="text-[12px] text-gray-500">
                      Neaktivní jídlo se nebude běžně používat.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setDetailDraft((prev) =>
                        prev
                          ? { ...prev, aktivni: !(prev.aktivni ?? true) }
                          : prev
                      )
                    }
                    className={
                      "inline-flex h-10 min-w-[108px] items-center justify-center rounded-full px-4 text-[13px] font-extrabold transition " +
                      (detailDraft.aktivni ?? true
                        ? "bg-green-600 text-white"
                        : "bg-white text-slate-700 ring-2 ring-slate-200")
                    }
                  >
                    {(detailDraft.aktivni ?? true) ? "Ano" : "Ne"}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={resetDetailChanges}
                disabled={savingId === detailDraft.id || !detailIsDirty()}
                className="flex-1 rounded-full bg-white px-5 py-3 text-[14px] font-extrabold text-slate-700 ring-2 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Zrušit změny
              </button>

              <button
                type="button"
                onClick={saveDetail}
                disabled={saveDisabled}
                className="flex-1 rounded-full bg-green-600 px-5 py-3 text-[14px] font-extrabold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingId === detailDraft.id ? "Ukládám…" : "Uložit"}
              </button>
            </div>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={deleteDetail}
                disabled={savingId === detailDraft.id}
                className="text-[13px] font-bold text-red-600 underline underline-offset-2 transition hover:text-red-700 disabled:opacity-50"
              >
                Smazat jídlo
              </button>
            </div>
          </div>
        </>
      ) : null}

      <AddFoodModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        existingFoods={rows}
        categories={categories}
        onInserted={() => {
          load();
        }}
      />
    </main>
  );
}