"use client";

import { useEffect, useMemo, useState } from "react";

type FoodRow = {
  id: string;
  legacy_id: number;
  nazev: string;
  cena: number | null;
  kategorie?: string | null;
  aktivni?: boolean | null;
};

type NewFood = {
  legacy_id: number | null;
  nazev: string;
  cena: number | null;
  kategorie: string;
  aktivni: boolean;
};

function nextLegacyId(existing: number[], startFrom?: number) {
  const set = new Set(existing);
  let n = startFrom ?? (existing.length ? Math.max(...existing) + 1 : 1);
  while (set.has(n)) n++;
  return n;
}

function toIntOrNull(raw: string) {
  const v = raw.replace(/[^\d]/g, "");
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function toPriceOrNull(raw: string) {
  const v = raw.replace(/[^\d]/g, "");
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

async function apiInsertFoods(items: Array<{
  legacy_id: number;
  nazev: string;
  cena: number | null;
  kategorie: string;
  aktivni: boolean;
}>) {
  const r = await fetch("/api/staff/jidla", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ items }),
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || "Chyba při ukládání.");
}

export default function AddFoodModal({
  open,
  onClose,
  existingFoods,
  categories,
  onInserted,
}: {
  open: boolean;
  onClose: () => void;
  existingFoods: FoodRow[];
  categories: string[];
  onInserted: () => void;
}) {
  const existingLegacy = useMemo(
    () => existingFoods.map((x) => x.legacy_id).filter((n) => Number.isFinite(n)),
    [existingFoods]
  );

  const defaultCategory = categories[0] ?? "Polévka (k hlavnímu jídlu)";

  const [rows, setRows] = useState<NewFood[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const suggested = nextLegacyId(existingLegacy);
    setRows([
      {
        legacy_id: suggested,
        nazev: "",
        cena: null,
        kategorie: defaultCategory,
        aktivni: true,
      },
    ]);
    setErr(null);
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const addRow = () => {
    const last = rows[rows.length - 1]?.legacy_id ?? null;
    const suggested = nextLegacyId(
      existingLegacy.concat(rows.map((r) => r.legacy_id ?? -1)),
      last != null ? last + 1 : undefined
    );

    setRows((prev) => [
      ...prev,
      { legacy_id: suggested, nazev: "", cena: null, kategorie: defaultCategory, aktivni: true },
    ]);
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const setRow = (idx: number, patch: Partial<NewFood>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const validate = (list: NewFood[]) => {
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (!r.nazev.trim()) return `Řádek ${i + 1}: vyplň název.`;
      if (!r.kategorie.trim()) return `Řádek ${i + 1}: vyplň kategorii.`;
      if (r.legacy_id == null || !Number.isFinite(r.legacy_id) || r.legacy_id <= 0)
        return `Řádek ${i + 1}: vyplň číslo (kladné).`;
    }

    const ids = list.map((r) => r.legacy_id as number);
    const set = new Set(ids);
    if (set.size !== ids.length) return "V modalu máš duplicitní čísla.";

    for (const id of ids) {
      if (existingLegacy.includes(id)) return `Číslo ${id} už existuje. Změň ho.`;
    }

    return null;
  };

  const onSaveAll = async () => {
    setErr(null);

    // ✅ pokud někdo nechal prázdné řádky, vyhoď je
    const trimmed = rows
      .map((r) => ({
        ...r,
        nazev: r.nazev.trim(),
        kategorie: r.kategorie.trim(),
      }))
      .filter((r) => r.nazev.length > 0);

    if (trimmed.length === 0) {
      setErr("Vyplň alespoň 1 jídlo.");
      return;
    }

    const v = validate(trimmed);
    if (v) {
      setErr(v);
      return;
    }

    setSaving(true);
    try {
      const payload = trimmed.map((r) => ({
        legacy_id: r.legacy_id as number,
        nazev: r.nazev,
        cena: r.cena,
        kategorie: r.kategorie,
        aktivni: r.aktivni,
      }));

      await apiInsertFoods(payload);

      onInserted();
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Chyba při ukládání.");
    } finally {
      setSaving(false);
    }
  };

  const overlay = "fixed inset-0 z-[80] bg-black/40";
  const modal =
    "fixed left-1/2 top-1/2 z-[90] w-[min(980px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 " +
    "rounded-[28px] bg-white ring-2 ring-green-200/80 shadow-2xl p-6";

  const input =
    "h-11 w-full rounded-2xl bg-white px-4 text-[14px] font-semibold text-gray-900 " +
    "ring-1 ring-green-200/80 focus:outline-none focus:ring-2 focus:ring-green-500/30";

  const btnGhost =
    "h-11 rounded-full bg-white px-5 text-sm font-extrabold text-gray-900 ring-1 ring-green-200/80 hover:bg-green-50 transition";
  const btnGreen =
    "h-11 rounded-full bg-green-600 px-6 text-sm font-extrabold text-white hover:brightness-95 disabled:opacity-50 transition";
  const btnRed =
    "h-11 rounded-full bg-white px-5 text-sm font-extrabold text-red-600 ring-1 ring-red-200 hover:bg-red-50 transition";

  return (
    <>
      <button className={overlay} onClick={onClose} aria-label="Zavřít" type="button" />

      <div className={modal} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-extrabold text-gray-900">Přidat jídla</div>
            <div className="mt-1 text-sm text-gray-600">
              Přidej víc jídel najednou (tlačítko „+ Přidat další řádek“).
            </div>
          </div>

          <button className={btnGhost} onClick={onClose} type="button">
            Zavřít
          </button>
        </div>

        {err ? (
          <div className="mt-4 rounded-2xl bg-red-50 ring-1 ring-red-200 px-4 py-3 text-sm text-red-700 font-semibold">
            {err}
          </div>
        ) : null}

        <div className="mt-5 overflow-auto rounded-2xl ring-1 ring-green-200/70">
          <div className="min-w-[920px]">
            <div className="grid grid-cols-[90px_2fr_130px_260px_110px] gap-3 bg-green-50/60 px-4 py-3 text-xs font-extrabold text-gray-700">
              <div>Číslo</div>
              <div>Název</div>
              <div>Cena</div>
              <div>Kategorie</div>
              <div>Akce</div>
            </div>

            <div className="divide-y divide-green-200/60 bg-white">
              {rows.map((r, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[90px_2fr_130px_260px_110px] gap-3 px-4 py-3 items-center"
                >
                  <input
                    className={input}
                    inputMode="numeric"
                    value={r.legacy_id ?? ""}
                    onChange={(e) => setRow(idx, { legacy_id: toIntOrNull(e.target.value) })}
                    placeholder="např. 25"
                  />

                  <input
                    className={input}
                    value={r.nazev}
                    onChange={(e) => setRow(idx, { nazev: e.target.value })}
                    placeholder="Název jídla…"
                  />

                  <input
                    className={input}
                    inputMode="numeric"
                    value={r.cena ?? ""}
                    onChange={(e) => setRow(idx, { cena: toPriceOrNull(e.target.value) })}
                    placeholder="např. 149"
                  />

                  <select
                    className={input}
                    value={r.kategorie}
                    onChange={(e) => setRow(idx, { kategorie: e.target.value })}
                  >
                    {[...new Set([defaultCategory, ...categories])].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center justify-end">
                    <button className={btnRed} onClick={() => removeRow(idx)} type="button">
                      Smazat
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button className={btnGhost} onClick={addRow} type="button">
            + Přidat další řádek
          </button>

          <button className={btnGreen} onClick={onSaveAll} disabled={saving} type="button">
            {saving ? "Ukládám…" : "Uložit všechno"}
          </button>
        </div>
      </div>
    </>
  );
}