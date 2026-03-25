"use client";

import type { PokladnaViewProps } from "../page";
import { useMemo, useState } from "react";

function cls(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ");
}

function InfoIcon() {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#bde7c8] bg-[#eef8f1] text-[11px] font-extrabold text-[#0b7c4d]">
      i
    </span>
  );
}

function formatShortTodayLabel(input: string) {
  if (!input) return "";
  return input;
}

export default function MobileView({
  todayLabel,
  mode,
  setMode,
  delivery,
  setDelivery,
  packaging,
  setPackaging,
  items,
  qty,
  specialPrice,
  loadingItems,
  loadErr,
  setToOne,
  inc,
  dec,
  openKeypadFor,
  total,
  totalCount,
  resetOrder,
  openPayment,
  editOpen,
  setEditOpen,
  localItems,
  renameLocalItem,
  changeLocalPrice,
  removeLocalItem,
  foodSearchQuery,
  setFoodSearchQuery,
  foodSearchOpen,
  setFoodSearchOpen,
  filteredFoods,
  addFoodFromDatabase,
  manualFoodName,
  setManualFoodName,
  manualFoodCategory,
  setManualFoodCategory,
  manualFoodPrice,
  setManualFoodPrice,
  addManualFood,
  paymentOpen,
  setPaymentOpen,
  paymentMethod,
  setPaymentMethod,
  savingOrder,
  canConfirmPayment,
  confirmPayment,
  selectedCustomer,
  selectedCustomerCredit,
  creditEnough,
  customerPickerOpen,
  setCustomerPickerOpen,
  customerQuery,
  setCustomerQuery,
  customers,
  customersLoading,
  setSelectedCustomer,
  creditTopupOpen,
  setCreditTopupValue,
  setCreditTopupOpen,
  creditTopupValue,
  creditTopupSaving,
  topupKeypadPress,
  confirmCreditTopup,
  keypadOpen,
  setKeypadOpen,
  keypad,
  keypadPress,
  keypadApply,
  router,
  czk,
  // @ts-ignore
  changeLocalCategory,
}: PokladnaViewProps & {
  changeLocalCategory?: (id: string, value: string) => void;
}) {
  const shell = "min-h-screen bg-[#f8faf8]";
  const wrap = "mx-auto w-full max-w-md px-3 pt-3 pb-36";

  const greenBtn =
    "rounded-full bg-[#4aa948] px-4 py-2.5 text-[13px] font-extrabold text-white shadow-[0_8px_20px_rgba(74,169,72,0.20)] transition hover:brightness-95";
  const whiteBtn =
    "rounded-full bg-white px-4 py-2.5 text-[13px] font-extrabold text-gray-800 ring-1 ring-[#d7e3db] transition hover:bg-gray-50";

  const topCard =
    "mt-3 rounded-[28px] border border-[#bde7c8] bg-white p-4 shadow-[0_10px_26px_rgba(27,54,39,0.04)]";

  const modeBtn = (active: boolean) =>
    cls(
      "rounded-full px-5 py-3 text-[15px] font-extrabold transition",
      active
        ? "bg-[#4aa948] text-white shadow-[0_8px_20px_rgba(74,169,72,0.18)]"
        : "bg-white text-[#266a37] ring-1 ring-[#bde7c8]"
    );

  const smallBtn = (active: boolean) =>
    cls(
      "rounded-full px-3 py-2 text-[12px] font-extrabold transition",
      active ? "bg-[#4aa948] text-white" : "bg-white text-gray-900 ring-1 ring-black/10 hover:bg-gray-50"
    );

  const rowCardBase =
    "rounded-[22px] border px-3 py-3 shadow-[0_8px_22px_rgba(27,54,39,0.03)] transition";
  const rowCard = "border-[#bde7c8] bg-white";
  const rowCardActive = "border-[#8ec8a1] bg-[#e8f6eb]";

  const addBtn =
    "rounded-full px-3 py-2 text-[12px] font-extrabold text-[#0b7c4d] ring-1 ring-[#78d3a0] bg-white hover:bg-[#f5fbf7] transition";

  const priceBtn =
    "rounded-[16px] border border-[#bde7c8] bg-[#f3faf5] px-3 py-2 text-[14px] font-extrabold text-[#0b7c4d] transition hover:bg-[#ebf7ef]";

  const qtyBtn =
    "h-9 w-9 rounded-[12px] bg-white text-[20px] font-extrabold text-[#0b7c4d] ring-1 ring-[#78d3a0] hover:bg-[#f5fbf7] transition";

  const bottomFixed =
    "fixed left-0 right-0 bottom-0 z-30 border-t border-black/5 bg-white/95 backdrop-blur";
  const bottomInner = "mx-auto w-full max-w-md px-3 pb-4 pt-3";

  const btnCancel =
    "rounded-full bg-white px-4 py-3 text-[15px] font-extrabold text-gray-900 ring-1 ring-black/10 hover:bg-gray-50 transition";
  const btnPay =
    "rounded-full bg-[#4aa948] px-4 py-3 text-[15px] font-extrabold text-white shadow-sm hover:brightness-95 transition disabled:opacity-40";

  const modalCard =
    "mx-auto w-full max-w-md rounded-[28px] bg-white p-4 shadow-[0_22px_70px_rgba(0,0,0,0.2)] ring-1 ring-black/10";
  const modalBtn =
    "rounded-full bg-white px-3 py-2 text-[13px] font-extrabold text-gray-800 ring-1 ring-black/10 hover:bg-gray-50";

  const payBig = (active: boolean) =>
    cls(
      "rounded-full px-4 py-3 text-[15px] font-extrabold transition",
      active ? "bg-[#4aa948] text-white" : "bg-[#eef8f1] text-[#0d6b44] ring-1 ring-[#bde7c8] hover:bg-[#e4f4e8]"
    );

  const [allergenOpenId, setAllergenOpenId] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  const categoryOptions = useMemo(() => {
    const arr = Array.from(
      new Set(
        localItems
          .map((x: any) => (x.category ?? x.kategorie ?? "").trim())
          .filter(Boolean)
      )
    );
    return arr.sort((a, b) => a.localeCompare(b, "cs"));
  }, [localItems]);

  const confirmRemove = (id: string, name?: string) => {
    const ok = window.confirm(`Opravdu chceš smazat "${name ?? "toto jídlo"}" z tohoto dne?`);
    if (!ok) return;
    removeLocalItem(id);
  };

  return (
    <div className={shell}>
      <div className={wrap}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[23px] font-extrabold tracking-tight text-[#0f172a]">
              Pokladna
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button type="button" className={greenBtn} onClick={() => setEditOpen(true)}>
              Upravit
            </button>
            <button type="button" className={greenBtn} onClick={() => router.push("/staff")}>
              Rozcestník
            </button>
          </div>
        </div>

        <div className={topCard}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-2">
              <button type="button" className={modeBtn(mode === "tady")} onClick={() => setMode("tady")}>
                Tady
              </button>
              <button type="button" className={modeBtn(mode === "sebou")} onClick={() => setMode("sebou")}>
                Sebou
              </button>
            </div>

            <div className="shrink-0 text-[14px] font-extrabold text-[#0b7c4d]">
              {formatShortTodayLabel(todayLabel)}
            </div>
          </div>

          {mode === "sebou" && (
            <div className="mt-4 grid gap-4">
              <div>
                <div className="text-[12px] font-extrabold text-gray-900">Doprava</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className={smallBtn(delivery === "ano")} onClick={() => setDelivery("ano")}>
                    Ano
                  </button>
                  <button type="button" className={smallBtn(delivery === "ne")} onClick={() => setDelivery("ne")}>
                    Ne
                  </button>
                </div>
              </div>

              <div>
                <div className="text-[12px] font-extrabold text-gray-900">Balení</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className={smallBtn(packaging === "plast")} onClick={() => setPackaging("plast")}>
                    Plast
                  </button>
                  <button
                    type="button"
                    className={smallBtn(packaging === "rekrabicka")}
                    onClick={() => setPackaging("rekrabicka")}
                  >
                    Rekrabička
                  </button>
                  <button
                    type="button"
                    className={smallBtn(packaging === "jidlonosic")}
                    onClick={() => setPackaging("jidlonosic")}
                  >
                    Jídlonosič
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 grid gap-2.5">
          {loadingItems ? (
            <div className="rounded-[22px] border border-[#bde7c8] bg-white px-4 py-4 text-sm font-semibold text-gray-600">
              Načítám dnešní menu…
            </div>
          ) : loadErr ? (
            <div className="rounded-[22px] border border-[#bde7c8] bg-white px-4 py-4 text-sm font-semibold text-red-600">
              {loadErr}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-[22px] border border-[#bde7c8] bg-white px-4 py-4 text-sm font-semibold text-gray-600">
              Pro dnešek zatím nejsou ve správě menu zadaná žádná jídla.
            </div>
          ) : (
            items.map((it: any) => {
              const q = qty[it.id] ?? 0;
              const unit = specialPrice[it.id] ?? it.price;
              const allergens = it.allergens ?? it.alergeny ?? "";

              return (
                <div
                  key={it.id}
                  className={cls(rowCardBase, q > 0 ? rowCardActive : rowCard)}
                >
                  <div className="grid grid-cols-[1fr_auto_auto] items-start gap-2">
                    <div className="min-w-0">
                      <div className="flex items-start gap-2">
                        <div className="line-clamp-2 min-w-0 flex-1 text-[15px] font-extrabold leading-[1.25] text-gray-900">
                          {it.name}
                        </div>

                        <button
                          type="button"
                          className="mt-[1px] shrink-0"
                          onClick={() => setAllergenOpenId(it.id)}
                          aria-label="Zobrazit alergeny"
                        >
                          <InfoIcon />
                        </button>
                      </div>

                      <div className="mt-1 text-[12px] font-extrabold text-[#1d8f52]">
                        {it.category || "Bez kategorie"}
                      </div>
                    </div>

                    <button
                      type="button"
                      className={priceBtn}
                      onClick={() => openKeypadFor(it.id)}
                    >
                      {czk(unit)}
                    </button>

                    {q === 0 ? (
                      <button
                        type="button"
                        className={addBtn}
                        onClick={() => setToOne(it.id)}
                      >
                        Přidat
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button type="button" className={qtyBtn} onClick={() => dec(it.id)}>
                          −
                        </button>
                        <div className="min-w-[18px] text-center text-[14px] font-extrabold text-gray-900">
                          {q}
                        </div>
                        <button type="button" className={qtyBtn} onClick={() => inc(it.id)}>
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className={bottomFixed}>
        <div className={bottomInner}>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" className={btnCancel} onClick={resetOrder}>
              Zrušit
            </button>
            <button type="button" className={btnPay} onClick={openPayment} disabled={total <= 0}>
              {czk(total)} • {totalCount} ks
            </button>
          </div>
        </div>
      </div>

      {allergenOpenId && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[70] bg-black/40"
            onClick={() => setAllergenOpenId(null)}
          />
          <div className="fixed inset-0 z-[80] overflow-auto px-3 py-6">
            <div className={modalCard}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[18px] font-extrabold text-gray-900">Alergeny</div>
                </div>

                <button type="button" className={modalBtn} onClick={() => setAllergenOpenId(null)}>
                  Zavřít
                </button>
              </div>

              {(() => {
                const row: any = items.find((x: any) => String(x.id) === String(allergenOpenId));
                const allergens = row?.allergens ?? row?.alergeny ?? "";

                return (
                  <div className="mt-4 rounded-[22px] border border-[#bde7c8] bg-[#f5fbf7] p-4">
                    <div className="text-[15px] font-extrabold text-gray-900">
                      {row?.name ?? "Jídlo"}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-gray-600">
                      {allergens ? `Alergeny: ${allergens}` : "Alergeny nejsou zadané."}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </>
      )}

      {editOpen && (
        <>
          <button type="button" className="fixed inset-0 z-40 bg-black/40" onClick={() => setEditOpen(false)} />
          <div className="fixed inset-0 z-50 overflow-auto px-3 py-4">
            <div className={modalCard}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[18px] font-extrabold text-gray-900">Upravit jídla</div>
                  <div className="mt-1 text-[12px] font-semibold text-gray-500">
                    Změny se mají propsat natrvalo. Smazání maž jen z tohoto dne.
                  </div>
                </div>

                <button type="button" className={modalBtn} onClick={() => setEditOpen(false)}>
                  Zavřít
                </button>
              </div>

              <div className="mt-4 max-h-[40vh] overflow-auto rounded-[22px] border border-[#bde7c8]">
                <div className="divide-y divide-[#dff2e5]">
                  {localItems.map((it: any) => (
                    <div key={it.id} className="grid gap-2 px-3 py-3">
                      <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-start">
                        <div className="min-w-0">
                          <input
                            value={it.name}
                            onChange={(e) => renameLocalItem(it.id, e.target.value)}
                            className="w-full rounded-2xl bg-white px-3 py-2 text-sm font-bold text-gray-900 ring-1 ring-black/10 outline-none"
                            placeholder="Název"
                          />

                          <div className="mt-2">
                            <input
                              list={`cat-${it.id}`}
                              value={it.category ?? ""}
                              onChange={(e) => changeLocalCategory?.(it.id, e.target.value)}
                              className="w-full rounded-2xl bg-[#f8faf8] px-3 py-2 text-xs font-semibold text-[#0b7c4d] ring-1 ring-[#d7e3db] outline-none"
                              placeholder="Kategorie"
                            />
                            <datalist id={`cat-${it.id}`}>
                              {categoryOptions.map((cat) => (
                                <option key={cat} value={cat} />
                              ))}
                            </datalist>
                          </div>
                        </div>

                        <input
                          value={String(it.price ?? 0)}
                          onChange={(e) => changeLocalPrice(it.id, e.target.value)}
                          inputMode="numeric"
                          className="w-[88px] rounded-2xl bg-white px-3 py-2 text-right text-sm font-bold text-gray-900 ring-1 ring-black/10 outline-none"
                        />

                        <button
                          type="button"
                          onClick={() => confirmRemove(it.id, it.name)}
                          className="rounded-full px-3 py-2 text-xs font-extrabold text-red-600 ring-1 ring-red-200 hover:bg-red-50"
                        >
                          Smazat
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-[20px] border border-[#bde7c8] bg-[#f7fbf8] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-extrabold text-[#0b7c4d]">Přidat jídlo</div>
                  <button
                    type="button"
                    className="text-[12px] font-extrabold text-gray-500 underline underline-offset-2"
                    onClick={() => setManualOpen(true)}
                  >
                    Přidat ručně
                  </button>
                </div>

                <div className="mt-3 relative">
                  <input
                    value={foodSearchQuery}
                    onChange={(e) => {
                      setFoodSearchQuery(e.target.value);
                      setFoodSearchOpen(true);
                    }}
                    onFocus={() => setFoodSearchOpen(true)}
                    placeholder="Název nebo číslo jídla"
                    className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold text-gray-900 ring-1 ring-black/10 outline-none"
                  />

                  {foodSearchOpen && foodSearchQuery.trim() !== "" && (
                    <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-[#bde7c8] bg-white shadow-lg">
                      {filteredFoods.length === 0 ? (
                        <div className="px-4 py-3 text-sm font-semibold text-gray-500">Nic nenalezeno.</div>
                      ) : (
                        filteredFoods.map((f: any) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => addFoodFromDatabase(f)}
                            className="grid w-full grid-cols-[1fr_auto] gap-3 px-4 py-3 text-left hover:bg-[#f5fbf7]"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-extrabold text-gray-900">{f.nazev}</div>
                              <div className="mt-0.5 text-xs font-semibold text-gray-500">
                                #{f.legacy_id} • {f.kategorie ?? "Bez kategorie"}
                              </div>
                            </div>
                            <div className="text-sm font-extrabold text-[#0b7c4d]">
                              {czk(Number(f.cena ?? 0))}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button type="button" className={btnCancel} onClick={() => setEditOpen(false)}>
                  Zpět
                </button>
                <button type="button" className={btnPay} onClick={() => setEditOpen(false)}>
                  Uložit
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {manualOpen && (
        <>
          <button type="button" className="fixed inset-0 z-[60] bg-black/40" onClick={() => setManualOpen(false)} />
          <div className="fixed inset-0 z-[70] overflow-auto px-3 py-4">
            <div className={modalCard}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[18px] font-extrabold text-gray-900">Přidat ručně</div>
                </div>
                <button type="button" className={modalBtn} onClick={() => setManualOpen(false)}>
                  Zavřít
                </button>
              </div>

              <div className="mt-4 grid gap-2">
                <input
                  value={manualFoodName}
                  onChange={(e) => setManualFoodName(e.target.value)}
                  placeholder="Název"
                  className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold text-gray-900 ring-1 ring-black/10 outline-none"
                />

                <input
                  list="manual-categories"
                  value={manualFoodCategory}
                  onChange={(e) => setManualFoodCategory(e.target.value)}
                  placeholder="Kategorie"
                  className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold text-gray-900 ring-1 ring-black/10 outline-none"
                />
                <datalist id="manual-categories">
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>

                <input
                  value={manualFoodPrice}
                  onChange={(e) => setManualFoodPrice(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="Cena"
                  inputMode="numeric"
                  className="w-full rounded-2xl bg-white px-4 py-3 text-right text-sm font-bold text-gray-900 ring-1 ring-black/10 outline-none"
                />

                <button
                  type="button"
                  onClick={() => {
                    addManualFood();
                    setManualOpen(false);
                  }}
                  className={greenBtn}
                >
                  Přidat
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {paymentOpen && (
        <>
          <button type="button" className="fixed inset-0 z-40 bg-black/40" onClick={() => setPaymentOpen(false)} />
          <div className="fixed inset-0 z-50 overflow-auto px-3 py-4">
            <div className={modalCard}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-[18px] font-extrabold text-gray-900">Platba</div>
                <button type="button" className={modalBtn} onClick={() => setPaymentOpen(false)}>
                  Zavřít
                </button>
              </div>

              <div className="mt-4 rounded-[22px] bg-[#eef8f1] p-5 ring-1 ring-[#bde7c8]">
                <div className="text-xs font-bold text-gray-500">Celkem k úhradě</div>
                <div className="mt-1 text-[28px] font-extrabold text-[#0b7c4d]">{czk(total)}</div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button type="button" className={payBig(paymentMethod === "cash")} onClick={() => setPaymentMethod("cash")}>
                  Hotově
                </button>
                <button type="button" className={payBig(paymentMethod === "card")} onClick={() => setPaymentMethod("card")}>
                  Kartou
                </button>
              </div>

              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  className="text-center text-[13px] font-extrabold text-[#0b7c4d] underline underline-offset-4 hover:opacity-80"
                  onClick={() => {
                    setPaymentMethod("credit");
                    setCustomerPickerOpen(true);
                  }}
                >
                  Kredit
                </button>
              </div>

              {paymentMethod === "credit" && (
                <div className="mt-3 rounded-[18px] border border-[#bde7c8] bg-white p-3">
                  {!selectedCustomer ? (
                    <div className="text-sm font-semibold text-gray-600">
                      Není vybraný zákazník. Klikni na „Kredit“ a vyber zákazníka.
                    </div>
                  ) : (
                    <>
                      <div className="text-sm font-extrabold text-gray-900">
                        {selectedCustomer.full_name ?? "Bez jména"} • kredit {czk(selectedCustomerCredit)}
                      </div>

                      <div className="mt-1 text-xs font-semibold text-gray-500">
                        {creditEnough
                          ? `Po zaplacení zbude ${czk(selectedCustomerCredit - total)}`
                          : `Nedostatečný kredit • chybí ${czk(total - selectedCustomerCredit)}`}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setCreditTopupValue("");
                          setCreditTopupOpen(true);
                        }}
                        className="mt-2 text-xs font-extrabold text-[#0b7c4d] underline underline-offset-4 hover:opacity-80"
                      >
                        Dobít kredit
                      </button>

                      {!creditEnough && (
                        <div className="mt-2 text-xs font-extrabold text-red-600">
                          Tímto kreditem nejde objednávku zaplatit.
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button type="button" className={btnCancel} onClick={() => setPaymentOpen(false)}>
                  Zpět
                </button>
                <button type="button" className={btnPay} disabled={!canConfirmPayment} onClick={confirmPayment}>
                  {savingOrder ? "Ukládám…" : "Potvrdit"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {customerPickerOpen && (
        <>
          <button type="button" className="fixed inset-0 z-[60] bg-black/40" onClick={() => setCustomerPickerOpen(false)} />
          <div className="fixed inset-0 z-[70] overflow-auto px-3 py-4">
            <div className={modalCard}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[18px] font-extrabold text-gray-900">Výběr zákazníka</div>
                  <div className="mt-1 text-[12px] font-semibold text-gray-500">
                    Vyhledej zákazníka pro platbu kreditem.
                  </div>
                </div>
                <button type="button" className={modalBtn} onClick={() => setCustomerPickerOpen(false)}>
                  Zavřít
                </button>
              </div>

              <input
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                placeholder="Hledat jméno zákazníka…"
                className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold text-gray-900 ring-1 ring-black/10 outline-none"
              />

              <div className="mt-4 max-h-[44vh] overflow-auto rounded-[22px] border border-[#bde7c8]">
                {customersLoading ? (
                  <div className="px-4 py-6 text-sm font-semibold text-gray-600">Načítám zákazníky…</div>
                ) : customers.length === 0 ? (
                  <div className="px-4 py-6 text-sm font-semibold text-gray-600">Nikdo nenalezen.</div>
                ) : (
                  <div className="divide-y divide-[#dff2e5]">
                    {customers.map((c: any) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(c);
                          setPaymentMethod("credit");
                          setCustomerPickerOpen(false);
                        }}
                        className="grid w-full grid-cols-[1fr_auto] gap-3 px-4 py-3 text-left hover:bg-[#f5fbf7]"
                      >
                        <div className="text-sm font-extrabold text-gray-900">{c.full_name ?? "Bez jména"}</div>
                        <div className="text-sm font-extrabold text-[#0b7c4d]">{czk(Number(c.kredit ?? 0))}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {creditTopupOpen && selectedCustomer && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[80] bg-black/40"
            onClick={() => {
              if (!creditTopupSaving) setCreditTopupOpen(false);
            }}
          />

          <div className="fixed inset-0 z-[90] overflow-auto px-3 py-4">
            <div className={modalCard}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[18px] font-extrabold text-gray-900">Dobití kreditu</div>
                  <div className="mt-1 text-[12px] font-semibold text-gray-500">
                    Připiš kredit vybranému zákazníkovi.
                  </div>
                </div>

                <button
                  type="button"
                  className={modalBtn}
                  onClick={() => {
                    if (!creditTopupSaving) setCreditTopupOpen(false);
                  }}
                >
                  Zavřít
                </button>
              </div>

              <div className="mt-4 rounded-[22px] border border-[#bde7c8] bg-[#eef8f1] p-4">
                <div className="text-sm font-extrabold text-gray-900">
                  {selectedCustomer.full_name ?? "Bez jména"}
                </div>
                <div className="mt-1 text-xs font-semibold text-gray-500">
                  Aktuální kredit: {czk(Number(selectedCustomer.kredit ?? 0))}
                </div>
              </div>

              <div className="mt-4 rounded-[22px] bg-[#f7f8f6] p-4 ring-1 ring-black/10">
                <div className="text-[12px] font-bold text-gray-500">Částka k dobití</div>
                <div className="mt-1 text-[28px] font-extrabold text-gray-900">
                  {creditTopupValue ? `${creditTopupValue} Kč` : "—"}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "←"].map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="h-14 rounded-[18px] bg-white text-[20px] font-extrabold text-gray-900 ring-1 ring-black/10 shadow-sm hover:bg-gray-50"
                    onClick={() => topupKeypadPress(k)}
                    disabled={creditTopupSaving}
                  >
                    {k}
                  </button>
                ))}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className={btnCancel}
                  onClick={() => setCreditTopupOpen(false)}
                  disabled={creditTopupSaving}
                >
                  Zpět
                </button>

                <button
                  type="button"
                  className={btnPay}
                  onClick={confirmCreditTopup}
                  disabled={creditTopupSaving || !creditTopupValue}
                >
                  {creditTopupSaving ? "Dobíjím…" : "Dobít"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {keypadOpen && (
        <>
          <button type="button" className="fixed inset-0 z-40 bg-black/40" onClick={() => setKeypadOpen(false)} />
          <div className="fixed inset-0 z-50 overflow-auto px-3 py-4">
            <div className={modalCard}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-[18px] font-extrabold text-gray-900">Speciální cena</div>
                <button type="button" className={modalBtn} onClick={() => setKeypadOpen(false)}>
                  Zavřít
                </button>
              </div>

              <div className="mt-4 rounded-[18px] bg-[#f7f8f6] p-4 ring-1 ring-black/10">
                <div className="text-[12px] font-bold text-gray-500">Zadaná cena</div>
                <div className="mt-1 text-[28px] font-extrabold text-gray-900">
                  {keypad.value ? `${keypad.value} Kč` : "—"}
                </div>
                <div className="mt-2 text-[12px] font-semibold text-gray-500">
                  Tato cena platí jen pro tuto jednu objednávku. Prázdné = zrušit.
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "←"].map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="h-14 rounded-[18px] bg-white text-[20px] font-extrabold text-gray-900 ring-1 ring-black/10 shadow-sm hover:bg-gray-50"
                    onClick={() => keypadPress(k)}
                  >
                    {k}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button type="button" className={btnPay} onClick={keypadApply}>
                  Uložit
                </button>
                <button type="button" className={btnCancel} onClick={() => setKeypadOpen(false)}>
                  Zpět
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
