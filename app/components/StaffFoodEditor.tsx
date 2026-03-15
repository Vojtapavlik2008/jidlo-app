"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AddFoodModal from "../staff/jidla/_ui/AddFoodModal";

type FoodRow = {
  id: string; // uuid
  legacy_id: number;
  kategorie: string | null;
  nazev: string;
  cena: number | null;
  aktivni: boolean | null;
};

type SortKey = "legacy_id" | "nazev" | "cena" | "kategorie";
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

  // ✅ SORT
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "legacy_id",
    dir: "asc",
  });

  // ✅ Kategorie = FILTER
  const [catOpen, setCatOpen] = useState(false);
  const [catFilter, setCatFilter] = useState<string>("__ALL__");

  // ✅ Modal (nový AddFoodModal)
  const [addOpen, setAddOpen] = useState(false);

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

  function updateLocal(id: string, patch: Partial<FoodRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function isDirty(r: FoodRow) {
    const o = original[r.id];
    if (!o) return false;
    return !eqRow(o, r);
  }

  async function saveRow(r: FoodRow) {
    setSavingId(r.id);
    setMsg(null);

    try {
      await apiPatchFood(r.id, {
        nazev: r.nazev,
        cena: r.cena,
        kategorie: r.kategorie,
        aktivni: r.aktivni,
      });

      setOriginal((prev) => ({ ...prev, [r.id]: { ...r } }));
      setMsg(`Uloženo: ${r.legacy_id} – ${r.nazev}`);
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "Chyba při ukládání.");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteRow(r: FoodRow) {
    const ok = window.confirm(`Opravdu si přejete smazat „${r.nazev}“ (č. ${r.legacy_id})?`);
    if (!ok) return;

    setSavingId(r.id);
    setMsg(null);

    try {
      await apiDeleteFood(r.id);

      setRows((prev) => prev.filter((x) => x.id !== r.id));
      setOriginal((prev) => {
        const copy = { ...prev };
        delete copy[r.id];
        return copy;
      });

      setMsg(`Smazáno: ${r.legacy_id} – ${r.nazev}`);
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "Chyba při mazání.");
    } finally {
      setSavingId(null);
    }
  }

  // ---------- categories ----------
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const c = (r.kategorie ?? "").trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "cs"));
  }, [rows]);

  // ✅ FILTER (search + kategorie)
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();

    return rows.filter((r) => {
      const matchesSearch =
        !s ||
        String(r.legacy_id ?? "").includes(s) ||
        normStr(r.nazev).includes(s) ||
        normStr(r.kategorie).includes(s);

      const matchesCat = catFilter === "__ALL__" ? true : (r.kategorie ?? "") === catFilter;

      return matchesSearch && matchesCat;
    });
  }, [q, rows, catFilter]);

  // ✅ SORT
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

      if (sort.key === "nazev") {
        return dir * normStr(a.nazev).localeCompare(normStr(b.nazev), "cs");
      }

      return dir * normStr(a.kategorie).localeCompare(normStr(b.kategorie), "cs");
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

  // ----- Styles -----
  const card =
    "rounded-[28px] bg-white ring-1 ring-green-200/70 shadow-[0_8px_30px_rgba(0,0,0,0.04)]";
  const input =
    "w-full rounded-2xl bg-white px-4 py-3 text-[15px] font-semibold text-gray-900 placeholder:text-gray-500 ring-1 ring-green-200/80 focus:outline-none focus:ring-2 focus:ring-green-500/30";
  const cellInput =
    "w-full rounded-xl px-3 py-2 ring-1 ring-green-200/90 font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/30";
  const thBtnBase =
    "select-none transition rounded-lg px-2 py-1 inline-flex items-center gap-2";
  const thBtnOn = "bg-green-100/70";
  const thBtnOff = "hover:bg-green-100/60";

  return (
    <div className={card + " p-6 md:p-7"}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-3xl font-extrabold text-gray-900">Seznam jídel</div>
          <div className="text-sm text-gray-600">
            Řazení = klik na Číslo / Název / Cena (přepíná ↑↓ / A–Z Z–A). Kategorie je filtr.
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Link
            href="/staff/sprava-menu"
            className="rounded-full bg-white px-5 py-3 text-sm font-extrabold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 transition whitespace-nowrap"
          >
            ← Zpět na správu menu
          </Link>

          <div className="w-full md:w-[360px]">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Hledat (číslo, název, kategorie)…"
              className={input}
            />
          </div>

          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="rounded-full bg-green-600 px-6 py-3 text-sm font-extrabold text-white hover:brightness-95 transition whitespace-nowrap"
          >
            + Přidat jídlo
          </button>
        </div>
      </div>

      {msg && (
        <div className="mt-4 rounded-2xl bg-green-50 ring-1 ring-green-200/70 px-4 py-3 text-sm text-gray-800">
          {msg}
        </div>
      )}

      <div className="mt-5 rounded-3xl ring-2 ring-green-300/80 overflow-hidden">
        <div className="grid grid-cols-[90px_1.6fr_160px_1fr_160px] bg-green-50/70 px-4 py-3 text-sm font-extrabold text-green-900">
          <div>
            <button
              type="button"
              className={thBtnBase + " " + (sort.key === "legacy_id" ? thBtnOn : thBtnOff)}
              onClick={() => toggleSort("legacy_id")}
            >
              <span className="text-[15px]">Číslo</span>
              <span className="text-base opacity-80">{indicatorFor("legacy_id")}</span>
            </button>
          </div>

          <div>
            <button
              type="button"
              className={thBtnBase + " " + (sort.key === "nazev" ? thBtnOn : thBtnOff)}
              onClick={() => toggleSort("nazev")}
            >
              <span className="text-[15px]">Název</span>
              <span className="text-base opacity-80">{indicatorFor("nazev")}</span>
            </button>
          </div>

          <div>
            <button
              type="button"
              className={thBtnBase + " " + (sort.key === "cena" ? thBtnOn : thBtnOff)}
              onClick={() => toggleSort("cena")}
            >
              <span className="text-[15px]">Cena</span>
              <span className="text-base opacity-80">{indicatorFor("cena")}</span>
            </button>
          </div>

          {/* Kategorie = filter */}
          <div className="relative">
            <button
              type="button"
              className={thBtnBase + " " + thBtnOff}
              onClick={() => setCatOpen((v) => !v)}
              title="Filtrovat kategorii"
            >
              <span className="text-[15px]">Kategorie</span>
              <span className="text-base opacity-80">▾</span>
              {catFilter !== "__ALL__" && (
                <span className="ml-2 rounded-full bg-green-600 text-white px-2 py-0.5 text-xs">
                  filtr
                </span>
              )}
            </button>

            {catOpen && (
              <div className="absolute z-50 mt-2 w-[260px] rounded-2xl bg-white ring-2 ring-green-300/80 shadow-xl p-2">
                <button
                  type="button"
                  className={
                    "w-full text-left rounded-xl px-3 py-2 text-sm font-semibold hover:bg-green-50 " +
                    (catFilter === "__ALL__" ? "bg-green-50" : "")
                  }
                  onClick={() => {
                    setCatFilter("__ALL__");
                    setCatOpen(false);
                  }}
                >
                  Všechny kategorie
                </button>

                <div className="my-2 h-px bg-green-200" />

                <div className="max-h-64 overflow-auto">
                  {categories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={
                        "w-full text-left rounded-xl px-3 py-2 text-sm font-semibold hover:bg-green-50 " +
                        (catFilter === c ? "bg-green-50" : "")
                      }
                      onClick={() => {
                        setCatFilter(c);
                        setCatOpen(false);
                      }}
                    >
                      {c}
                    </button>
                  ))}
                  {categories.length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-500">Žádné kategorie.</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="text-right text-[15px]">Akce</div>
        </div>

        {loading ? (
          <div className="px-4 py-6 text-sm text-gray-600">Načítám…</div>
        ) : sorted.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-600">Nic nenalezeno.</div>
        ) : (
          <div className="divide-y-2 divide-green-300/80">
            {sorted.map((r) => {
              const disabledSaving = savingId === r.id;
              const dirty = isDirty(r);
              const saveDisabled = !dirty || disabledSaving;

              return (
                <div
                  key={r.id}
                  className="grid grid-cols-[90px_1.6fr_160px_1fr_160px] items-center gap-3 px-4 py-3 bg-white"
                >
                  <div className="font-extrabold text-green-900 text-lg">{r.legacy_id}</div>

                  <input
                    value={r.nazev}
                    onChange={(e) => updateLocal(r.id, { nazev: e.target.value })}
                    className={cellInput}
                  />

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={r.cena ?? ""}
                      onChange={(e) =>
                        updateLocal(r.id, {
                          cena: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      className={cellInput}
                    />
                    <span className="text-sm font-extrabold text-green-900">Kč</span>
                  </div>

                  <input
                    value={r.kategorie ?? ""}
                    onChange={(e) => updateLocal(r.id, { kategorie: e.target.value })}
                    className={cellInput}
                    placeholder="např. Polévka"
                  />

                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      disabled={saveDisabled}
                      onClick={() => saveRow(r)}
                      className={
                        "rounded-full px-4 py-2 text-sm font-extrabold transition " +
                        (saveDisabled
                          ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                          : "bg-green-600 text-white hover:brightness-95 shadow-sm")
                      }
                    >
                      {disabledSaving ? "Ukládám…" : "Uložit"}
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteRow(r)}
                      disabled={disabledSaving}
                      className="text-xs font-bold text-gray-400 hover:text-red-600 transition disabled:opacity-50"
                      title="Smazat jídlo"
                    >
                      smazat
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ✅ MODAL */}
      <AddFoodModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        existingFoods={rows}
        categories={categories}
        onInserted={() => {
          load();
        }}
      />
    </div>
  );
}