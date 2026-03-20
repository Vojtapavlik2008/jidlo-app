"use client";

import Link from "next/link";
import { useState } from "react";
import {
  type FoodEditRow,
  type ViewProps,
  czDateTime,
  pillBase,
  prettyDelivery,
  prettyPackaging,
  prettyPayment,
  statusPill,
} from "../page";

/* ===================== Inline icons ===================== */
function IconPencil({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPrinter({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9V3h12v6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M6 18h12v3H6v-3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path
        d="M6 14H5a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3h-1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M8 13h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconRefresh({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M21 3v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconX({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconTrash({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 6V4h8v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 6l1 16h10l1-16" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconChevronDown({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
  fieldClassName,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  fieldClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? "";

  return (
    <div className="relative">
      <div className="text-xs font-extrabold text-gray-600 tracking-wide">{label}</div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          fieldClassName,
          "mt-2 flex items-center justify-between gap-3 text-left",
          "hover:bg-green-50 hover:ring-green-300 transition",
        ].join(" ")}
      >
        <span className="truncate">{current}</span>
        <IconChevronDown className={["h-5 w-5 text-green-700 transition", open ? "rotate-180" : ""].join(" ")} />
      </button>

      {open ? (
        <>
          <button type="button" className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-label="close" />
          <div className="absolute z-50 bottom-full mb-2 w-full overflow-hidden rounded-2xl bg-white ring-1 ring-black/10 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
            <div className="p-2">
              {options.map((o) => {
                const active = o.value === value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={[
                      "w-full text-left rounded-xl px-4 py-2.5 text-sm font-extrabold transition",
                      active ? "bg-green-600 text-white" : "bg-white text-gray-900 hover:bg-green-50",
                    ].join(" ")}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function MobileView({
  loading,
  err,
  filteredOrders,
  filter,
  setFilter,
  newCount,
  deliveryCount,
  pickupCount,
  allCount,

  open,
  active,
  activeLoading,

  savingEdit,
  confirmDelOpen,
  deleting,

  foodsOpen,
  foodRows,
  foodsSaving,
  addFoodName,
  setAddFoodName,
  confirmFoodDelete,

  eName,
  setEName,
  ePhone,
  setEPhone,
  eAddress,
  setEAddress,
  eNote,
  setENote,
  eDelivery,
  setEDelivery,
  ePackaging,
  setEPackaging,
  ePayment,
  setEPayment,

  load,
  openModal,
  closeModal,
  onPrint,
  saveEdit,
  deleteOrderConfirmed,

  getFoodsFromOrder,
  getQtyFromOrder,

  openFoodsModal,
  closeFoodsModal,

  setFoodRows,
  setConfirmDelOpen,
  setConfirmFoodDelete,

  persistFoodRename,
  addFoodToOrder,
  deleteFoodFromOrder,
}: ViewProps) {
  const page = "max-w-md mx-auto px-3 py-4";
  const headerBtn =
    "rounded-full border px-3 py-2 text-[13px] font-extrabold hover:bg-green-50 inline-flex items-center gap-2";

  const card =
    "rounded-3xl border border-green-200/90 bg-white p-4 shadow-[0_12px_30px_rgba(0,0,0,0.05)]";

  const modalBox =
    "fixed inset-x-3 top-3 bottom-3 z-50 rounded-3xl bg-white ring-1 ring-black/10 shadow-[0_34px_110px_rgba(0,0,0,0.26)] overflow-hidden";
  const modalInner = "p-4 overflow-auto h-full";

  const field =
    "w-full rounded-2xl bg-white ring-1 ring-black/10 px-4 py-3 text-[15px] font-semibold text-gray-900 outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-green-600/25";

  const miniBtn = "rounded-full border px-4 py-2 text-sm font-extrabold hover:bg-gray-50";
  const primaryBtn =
    "rounded-full bg-green-600 px-5 py-2 text-sm font-extrabold text-white hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed";

  const sectionCard = "rounded-3xl bg-green-50/50 ring-1 ring-green-200/80 p-4 relative";

  const countBadge =
    "inline-flex items-center justify-center min-w-[24px] h-[24px] px-2 rounded-full bg-green-700 text-white text-[11px] font-extrabold";

  const filterBtn = (active: boolean) =>
    [
      "rounded-2xl px-3 py-3 text-[13px] font-extrabold transition w-full",
      "inline-flex items-center justify-center gap-2",
      active
        ? "bg-green-600 text-white shadow-[0_14px_30px_rgba(22,101,52,0.18)]"
        : "bg-green-50/60 text-green-900 ring-1 ring-green-200 hover:bg-green-50 hover:ring-green-300",
    ].join(" ");

  const confirmBox =
    "fixed left-1/2 top-1/2 z-[60] w-[calc(100vw-24px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white ring-1 ring-black/10 shadow-[0_34px_110px_rgba(0,0,0,0.28)] p-5";

  return (
    <div className={page}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-bold tracking-tight text-gray-900">Online objednávky</div>
          <div className="mt-1 text-sm text-gray-600 font-semibold">
            Nové: <span className="text-gray-900">{newCount}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={() => load(true)} className={headerBtn}>
            <IconRefresh className="h-4 w-4" />
          </button>
          <Link href="/staff" className={headerBtn}>
            Zpět
          </Link>
        </div>
      </div>

      <div className="mt-4 rounded-3xl bg-white ring-1 ring-black/10 p-3 shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-1 gap-2">
          <button type="button" className={filterBtn(filter === "delivery")} onClick={() => setFilter("delivery")}>
            <span>Doručení</span>
            <span className={countBadge}>{deliveryCount}</span>
          </button>
          <button type="button" className={filterBtn(filter === "pickup")} onClick={() => setFilter("pickup")}>
            <span>Osobní odběr</span>
            <span className={countBadge}>{pickupCount}</span>
          </button>
          <button type="button" className={filterBtn(filter === "all")} onClick={() => setFilter("all")}>
            <span>Všechny</span>
            <span className={countBadge}>{allCount}</span>
          </button>
        </div>
      </div>

      {err ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {String(err).toLowerCase().includes("jwt expired")
            ? "Přihlášení vypršelo. Obnov stránku nebo se přihlas znovu."
            : err}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 text-sm font-semibold text-gray-600">Načítám…</div>
      ) : filteredOrders.length === 0 ? (
        <div className="mt-6 text-sm font-semibold text-gray-600">Tady zatím nic není.</div>
      ) : (
        <div className="mt-5 grid gap-3">
          {filteredOrders.map((o) => {
            const foods = getFoodsFromOrder(o);
            const showFoods = foods.slice(0, 2);
            const hasMore = foods.length > 2;

            return (
              <div key={o.id} className={card} onClick={() => openModal(o)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[18px] font-extrabold text-gray-900">{o.full_name}</div>
                    <div className="mt-1 text-[14px] font-semibold text-gray-700">{o.address}</div>
                    <div className="mt-1 text-[13px] text-gray-600">
                      {o.phone} • {prettyDelivery(o.delivery_mode)}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-full bg-green-600 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPrint(o);
                    }}
                  >
                    <IconPrinter className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={pillBase("bg-green-50 text-green-800 ring-green-200/80")}>
                    {prettyPayment(o.payment_method)}
                  </span>
                  <span className={pillBase("bg-white text-gray-900 ring-black/10")}>
                    {o.total} Kč • {getQtyFromOrder(o)} ks
                  </span>
                </div>

                <div className="mt-3 space-y-1">
                  {showFoods.length === 0 ? (
                    <div className="text-sm font-semibold text-gray-500">(bez položek)</div>
                  ) : (
                    <>
                      {showFoods.map((n, idx) => (
                        <div key={idx} className="text-[15px] font-bold text-green-900">
                          • {n}
                        </div>
                      ))}
                      {hasMore ? <div className="text-[15px] font-bold text-green-800">…</div> : null}
                    </>
                  )}
                </div>

                {o.note ? (
                  <div className="mt-3">
                    <span className={pillBase("bg-green-50 text-green-800 ring-green-200/80")}>
                      Poznámka: <span className="ml-2 font-semibold">{o.note}</span>
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {open && active ? (
        <>
          <button type="button" className="fixed inset-0 z-40 bg-black/30" onClick={closeModal} aria-label="close" />

          <div className={modalBox}>
            <div className={modalInner}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="truncate text-[20px] font-extrabold tracking-tight text-gray-900">
                      {active.full_name}
                    </div>
                    <span className={statusPill((active.status ?? "").toLowerCase())}>
                      {(active.status ?? "new").toLowerCase() === "new"
                        ? "Nová"
                        : (active.status ?? "").toUpperCase()}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-gray-600">{czDateTime(active.created_at)}</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-green-600 text-white"
                    onClick={() => onPrint(active)}
                    title="Tisk"
                  >
                    <IconPrinter className="h-5 w-5" />
                  </button>

                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-black/10 hover:bg-black/5"
                    onClick={closeModal}
                    title="Zavřít"
                  >
                    <IconX className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 pb-6">
                <div className={sectionCard}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-extrabold text-green-800">Jídla</div>
                      <div className="mt-1 text-xs font-semibold text-gray-600">Rychlý přehled položek v objednávce.</div>
                    </div>

                    <button
                      type="button"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-green-700 ring-1 ring-green-200/90 hover:bg-green-50"
                      onClick={openFoodsModal}
                      title="Upravit jídla"
                    >
                      <IconPencil className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3">
                    <span className={pillBase("bg-white text-gray-900 ring-black/10")}>
                      Celkem: <span className="ml-2 font-extrabold text-green-700">{active.total} Kč</span>
                      <span className="ml-3 font-extrabold text-gray-600">{getQtyFromOrder(active)} ks</span>
                    </span>
                  </div>

                  {activeLoading ? (
                    <div className="mt-3 text-sm font-semibold text-gray-600">Načítám položky…</div>
                  ) : (() => {
                      const foods = getFoodsFromOrder(active);
                      if (!foods.length) {
                        return <div className="mt-3 text-sm font-semibold text-gray-600">(Položky nejsou uložené)</div>;
                      }
                      return (
                        <ul className="mt-3 grid gap-2">
                          {foods.slice(0, 20).map((n, idx) => (
                            <li key={idx} className="text-[15px] font-extrabold text-green-900">
                              • {n}
                            </li>
                          ))}
                        </ul>
                      );
                    })()}
                </div>

                <div className={sectionCard}>
                  <div className="text-sm font-extrabold text-green-800">Údaje</div>

                  <div className="mt-4 grid gap-3">
                    <div>
                      <div className="text-xs font-extrabold tracking-wide text-gray-600">Jméno</div>
                      <input className={field} value={eName} onChange={(e) => setEName(e.target.value)} />
                    </div>

                    <div>
                      <div className="text-xs font-extrabold tracking-wide text-gray-600">Telefon</div>
                      <input className={field} value={ePhone} onChange={(e) => setEPhone(e.target.value)} />
                    </div>

                    <div>
                      <div className="text-xs font-extrabold tracking-wide text-gray-600">Adresa</div>
                      <input className={field} value={eAddress} onChange={(e) => setEAddress(e.target.value)} />
                    </div>

                    <div>
                      <div className="text-xs font-extrabold tracking-wide text-gray-600">Poznámka</div>
                      <textarea
                        className={field + " min-h-[64px] resize-none"}
                        value={eNote}
                        onChange={(e) => setENote(e.target.value)}
                      />
                    </div>

                    <FieldSelect
                      label="Převzetí"
                      value={eDelivery}
                      onChange={setEDelivery}
                      fieldClassName={field}
                      options={[
                        { value: "delivery", label: "Doručení" },
                        { value: "pickup", label: "Osobní odběr" },
                      ]}
                    />

                    <FieldSelect
                      label="Balení"
                      value={ePackaging}
                      onChange={setEPackaging}
                      fieldClassName={field}
                      options={[
                        { value: "plastic", label: "Plast" },
                        { value: "rekrabicka", label: "REkrabička" },
                        { value: "own", label: "Jídlonosič" },
                      ]}
                    />

                    <FieldSelect
                      label="Platba"
                      value={ePayment}
                      onChange={setEPayment}
                      fieldClassName={field}
                      options={[
                        { value: "card_online", label: "Kartou online" },
                        { value: "card_delivery", label: "Kartou při převzetí" },
                        { value: "cash", label: "Hotově při převzetí" },
                        { value: "credit", label: "Kredit" },
                        { value: "online", label: "Online" },
                        { value: "invoice", label: "Fakturou" },
                        { value: "menu_order", label: "Objednávka z jídelníčku" },
                      ]}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="rounded-full bg-red-50 px-4 py-3 text-sm font-extrabold text-red-700 ring-1 ring-red-200"
                    disabled={savingEdit || deleting || foodsSaving}
                    onClick={() => setConfirmDelOpen(true)}
                  >
                    Smazat
                  </button>

                  <button
                    type="button"
                    className="rounded-full bg-green-600 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60"
                    disabled={savingEdit || deleting || foodsSaving}
                    onClick={saveEdit}
                  >
                    {savingEdit ? "Ukládám…" : "Uložit"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {foodsOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-[65] bg-black/35"
                onClick={closeFoodsModal}
                aria-label="close-foods"
              />
              <div className="fixed inset-x-3 top-8 bottom-8 z-[70] rounded-3xl bg-white ring-1 ring-black/10 shadow-[0_34px_110px_rgba(0,0,0,0.28)] overflow-hidden">
                <div className="p-4 overflow-auto h-full">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-extrabold text-gray-900">Úprava jídel</div>
                      <div className="mt-1 text-sm font-semibold text-gray-600">
                        Změny se projeví jen v této objednávce.
                      </div>
                    </div>

                    <button
                      type="button"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-black/10 hover:bg-black/5"
                      onClick={closeFoodsModal}
                      title="Zavřít"
                    >
                      <IconX className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="mt-4 rounded-3xl bg-green-50/50 p-4 ring-1 ring-green-200/80">
                    {foodRows.length === 0 ? (
                      <div className="text-sm font-semibold text-gray-600">(Tady zatím žádná jídla nejsou.)</div>
                    ) : (
                      <div className="grid gap-2">
                        {foodRows.map((r, idx) => (
                          <div key={r.kind === "items" ? r.id : `cart-${r.idx}`} className="flex items-center gap-2">
                            <input
                              className={field + " py-2.5"}
                              value={r.name}
                              onChange={(e) => {
                                const v = e.target.value;
                                setFoodRows((prev) =>
                                  prev.map((x) => {
                                    const same =
                                      (x.kind === "items" && r.kind === "items" && x.id === r.id) ||
                                      (x.kind === "cart" && r.kind === "cart" && x.idx === r.idx);
                                    return same ? ({ ...x, name: v } as any) : x;
                                  })
                                );
                              }}
                              onBlur={async () => {
                                try {
                                  const current = foodRows[idx];
                                  if (!current) return;
                                  await persistFoodRename(current, current.name.trim());
                                } catch (e: any) {
                                  alert(e?.message ?? "Uložení názvu se nepovedlo.");
                                }
                              }}
                            />

                            <button
                              type="button"
                              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-50"
                              title="Smazat jídlo"
                              onClick={() => setConfirmFoodDelete(r)}
                              disabled={foodsSaving}
                            >
                              <IconX className="h-5 w-5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 flex items-center gap-2">
                      <input
                        className={field + " py-2.5"}
                        placeholder="Přidat jídlo…"
                        value={addFoodName}
                        onChange={(e) => setAddFoodName(e.target.value)}
                      />
                      <button
                        type="button"
                        className={primaryBtn}
                        disabled={foodsSaving || !addFoodName.trim()}
                        onClick={async () => {
                          try {
                            await addFoodToOrder(addFoodName);
                            setAddFoodName("");
                          } catch (e: any) {
                            alert(e?.message ?? "Přidání jídla se nepovedlo.");
                          }
                        }}
                      >
                        Přidat
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end gap-2">
                    <button type="button" className={miniBtn} onClick={closeFoodsModal} disabled={foodsSaving}>
                      Zavřít
                    </button>
                  </div>
                </div>
              </div>

              {confirmFoodDelete ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-[75] bg-black/35"
                    onClick={() => (!foodsSaving ? setConfirmFoodDelete(null) : null)}
                    aria-label="close-confirm-food"
                  />
                  <div className={confirmBox + " z-[80]"}>
                    <div className="text-lg font-extrabold text-gray-900">Opravdu chcete smazat jídlo?</div>
                    <div className="mt-2 text-sm font-semibold text-gray-600">
                      Tato akce je nevratná (pro tuto objednávku).
                    </div>

                    <div className="mt-5 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className={miniBtn}
                        disabled={foodsSaving}
                        onClick={() => setConfirmFoodDelete(null)}
                      >
                        Zrušit
                      </button>
                      <button
                        type="button"
                        className="rounded-full bg-red-600 px-5 py-2 text-sm font-extrabold text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={foodsSaving}
                        onClick={async () => {
                          try {
                            const r = confirmFoodDelete as FoodEditRow;
                            setConfirmFoodDelete(null);
                            await deleteFoodFromOrder(r);
                          } catch (e: any) {
                            alert(e?.message ?? "Smazání jídla se nepovedlo.");
                          }
                        }}
                      >
                        Smazat
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </>
          ) : null}

          {confirmDelOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-[55] bg-black/35"
                onClick={() => (!deleting ? setConfirmDelOpen(false) : null)}
                aria-label="close-confirm"
              />
              <div className={confirmBox}>
                <div className="text-lg font-extrabold text-gray-900">Opravdu chcete smazat objednávku?</div>
                <div className="mt-2 text-sm font-semibold text-gray-600">
                  Tato akce je nevratná. Objednávka zmizí ze seznamu.
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className={miniBtn}
                    disabled={deleting}
                    onClick={() => setConfirmDelOpen(false)}
                  >
                    Zrušit
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-red-600 px-5 py-2 text-sm font-extrabold text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={deleting}
                    onClick={deleteOrderConfirmed}
                  >
                    {deleting ? "Mažu…" : "Smazat"}
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}