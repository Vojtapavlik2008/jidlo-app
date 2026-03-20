"use client";

import Link from "next/link";
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

import { useState } from "react";

export default function DesktopView({
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
  const page = "max-w-6xl mx-auto px-6 py-8";
  const headerBtn =
    "rounded-full border px-4 py-2 text-sm font-extrabold hover:bg-green-50 inline-flex items-center gap-2";

  const card =
    "rounded-3xl border border-green-200/90 bg-white p-4 shadow-[0_12px_30px_rgba(0,0,0,0.05)]";

  const row =
    "grid grid-cols-12 gap-4 items-center rounded-2xl bg-green-50/50 ring-1 ring-green-200/80 px-5 py-4 transition hover:bg-green-50/80 hover:ring-green-300/90 cursor-pointer";

  const colFoods = "col-span-12 md:col-span-4 min-w-0";
  const colDetails = "col-span-12 md:col-span-4 min-w-0";
  const colPrice = "col-span-12 md:col-span-2 justify-self-end text-right";
  const colPencil = "col-span-6 md:col-span-1 justify-self-end";
  const colPrint = "col-span-6 md:col-span-1 justify-self-end";

  const foodLine = "text-[18px] font-bold tracking-tight text-green-900";
  const detailsName = "text-[18px] font-bold tracking-tight text-gray-900";
  const detailsSub = "mt-1 text-[16px] font-semibold text-gray-800";
  const detailsSub2 = "mt-1 text-[14px] font-medium text-gray-600";

  const pricePill =
    "inline-flex items-center rounded-full bg-white ring-2 ring-green-600/25 px-4 py-2 text-sm font-extrabold text-green-700";

  const pencilBtn =
    "h-11 w-11 rounded-full bg-white ring-1 ring-green-200/90 hover:bg-green-50 text-green-700 inline-flex items-center justify-center";
  const printBtn =
    "h-11 w-14 rounded-full bg-green-600 ring-1 ring-green-600 hover:bg-green-700 text-white inline-flex items-center justify-center";

  const modalBox =
    "fixed left-1/2 top-1/2 z-50 w-[860px] max-w-[calc(100vw-28px)] max-h-[calc(100vh-28px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white ring-1 ring-black/10 shadow-[0_34px_110px_rgba(0,0,0,0.26)] overflow-hidden";
  const modalInner = "p-6 md:p-7 overflow-auto max-h-[calc(100vh-28px)]";

  const field =
    "w-full rounded-2xl bg-white ring-1 ring-black/10 px-4 py-3 text-[15px] font-semibold text-gray-900 outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-green-600/25";

  const miniBtn = "rounded-full border px-4 py-2 text-sm font-extrabold hover:bg-gray-50";
  const primaryBtn =
    "rounded-full bg-green-600 px-5 py-2 text-sm font-extrabold text-white hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed";

  const sectionCard = "rounded-3xl bg-green-50/50 ring-1 ring-green-200/80 p-4 relative";
  const sectionTitle = "text-sm font-extrabold text-green-800";
  const sectionHint = "text-xs font-semibold text-gray-600";

  const dangerAction =
    "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-extrabold text-red-700 hover:bg-red-50 ring-1 ring-transparent hover:ring-red-200 transition";

  const confirmBox =
    "fixed left-1/2 top-1/2 z-[60] w-[520px] max-w-[calc(100vw-28px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white ring-1 ring-black/10 shadow-[0_34px_110px_rgba(0,0,0,0.28)] p-5";

  const filterWrap =
    "mt-5 rounded-3xl bg-white ring-1 ring-black/10 p-3 shadow-[0_10px_28px_rgba(0,0,0,0.04)]";

  const countBadge =
    "inline-flex items-center justify-center min-w-[26px] h-[26px] px-2 rounded-full bg-green-700 text-white text-xs font-extrabold";

  const filterBtn = (active: boolean) =>
    [
      "rounded-2xl px-4 py-3 text-sm font-extrabold transition w-full",
      "inline-flex items-center justify-center gap-3",
      active
        ? "bg-green-600 text-white shadow-[0_14px_30px_rgba(22,101,52,0.18)]"
        : "bg-green-50/60 text-green-900 ring-1 ring-green-200 hover:bg-green-50 hover:ring-green-300",
    ].join(" ");

  const foodsBox =
    "fixed left-1/2 top-1/2 z-[70] w-[720px] max-w-[calc(100vw-28px)] max-h-[calc(100vh-28px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white ring-1 ring-black/10 shadow-[0_34px_110px_rgba(0,0,0,0.28)] overflow-hidden";
  const foodsInner = "p-5 md:p-6 overflow-auto max-h-[calc(100vh-28px)]";

  return (
    <div className={page}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-3xl font-bold tracking-tight text-gray-900">Online objednávky</div>
          <div className="mt-1 text-sm text-gray-600 font-semibold">
            Nové: <span className="text-gray-900">{newCount}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={() => load(true)} className={headerBtn}>
            <IconRefresh className="h-4 w-4" />
            Obnovit
          </button>
          <Link href="/staff" className={headerBtn}>
            Zpět →
          </Link>
        </div>
      </div>

      <div className={filterWrap}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button type="button" className={filterBtn(filter === "delivery")} onClick={() => setFilter("delivery")}>
            <span>Doručení</span>
            <span className={countBadge}>{deliveryCount}</span>
          </button>
          <button type="button" className={filterBtn(filter === "pickup")} onClick={() => setFilter("pickup")}>
            <span>Osobní odběr</span>
            <span className={countBadge}>{pickupCount}</span>
          </button>
          <button type="button" className={filterBtn(filter === "all")} onClick={() => setFilter("all")}>
            <span>Všechny objednávky</span>
            <span className={countBadge}>{allCount}</span>
          </button>
        </div>
      </div>

      {err ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {String(err).toLowerCase().includes("jwt expired")
            ? "Přihlášení vypršelo. Obnov stránku nebo se přihlas znovu."
            : err}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-8 text-sm font-semibold text-gray-600">Načítám…</div>
      ) : filteredOrders.length === 0 ? (
        <div className="mt-8 text-sm font-semibold text-gray-600">Tady zatím nic není.</div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4">
          {filteredOrders.map((o) => {
            const foods = getFoodsFromOrder(o);
            const showFoods = foods.slice(0, 2);
            const hasMore = foods.length > 2;

            return (
              <div key={o.id} className={card}>
                <div
                  role="button"
                  tabIndex={0}
                  className={row}
                  onClick={() => openModal(o)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") openModal(o);
                  }}
                  title="Upravit objednávku"
                >
                  <div className={colFoods}>
                    {showFoods.length === 0 ? (
                      <div className={foodLine}>(bez položek)</div>
                    ) : (
                      <ul className="mt-2 space-y-1">
                        {showFoods.map((n, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="mt-[8px] h-2.5 w-2.5 rounded-full bg-green-600 shrink-0" />
                            <span className={foodLine}>{n}</span>
                          </li>
                        ))}
                        {hasMore ? (
                          <li className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-green-600 shrink-0" />
                            <span className="text-base font-bold text-green-800">…</span>
                          </li>
                        ) : null}
                      </ul>
                    )}
                  </div>

                  <div className={colDetails}>
                    <div className={detailsName}>{o.full_name}</div>
                    <div className={detailsSub}>{o.address}</div>
                    <div className={detailsSub2}>
                      {o.phone} • {prettyDelivery(o.delivery_mode)} • {prettyPackaging(o.packaging_mode)}
                    </div>
                  </div>

                  <div className={colPrice}>
                    <div className={pricePill}>
                      {o.total} Kč <span className="ml-2 text-gray-600 font-extrabold">{getQtyFromOrder(o)} ks</span>
                    </div>
                    <div className="mt-2">
                      <span className={pillBase("bg-green-50 text-green-800 ring-green-200/80")}>
                        {prettyPayment(o.payment_method)}
                      </span>
                    </div>
                  </div>

                  <div className={colPencil}>
                    <button
                      type="button"
                      className={pencilBtn}
                      title="Upravit"
                      aria-label="Upravit"
                      onClick={(e) => {
                        e.stopPropagation();
                        openModal(o);
                      }}
                    >
                      <IconPencil className="h-4 w-4" />
                    </button>
                  </div>

                  <div className={colPrint}>
                    <button
                      type="button"
                      className={printBtn}
                      title="Tisk"
                      aria-label="Tisk"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPrint(o);
                      }}
                    >
                      <IconPrinter className="h-6 w-6" />
                    </button>
                  </div>
                </div>

                {o.note ? (
                  <div className="mt-3 flex flex-wrap gap-2">
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
                  <div className="flex items-center gap-3">
                    <div className="truncate text-[22px] font-extrabold tracking-tight text-gray-900">
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
                    className="inline-flex h-10 w-12 items-center justify-center rounded-full bg-green-600 text-white ring-1 ring-green-600 hover:bg-green-700"
                    onClick={() => onPrint(active)}
                    title="Tisk"
                  >
                    <IconPrinter className="h-6 w-6" />
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

              <div className="mt-5 grid gap-4">
                <div className={sectionCard}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className={sectionTitle}>Jídla</div>
                      <div className={"mt-1 " + sectionHint}>Rychlý přehled položek v objednávce.</div>
                    </div>

                    <span className={pillBase("bg-white text-gray-900 ring-black/10")}>
                      Celkem: <span className="ml-2 font-extrabold text-green-700">{active.total} Kč</span>
                      <span className="ml-3 font-extrabold text-gray-600">{getQtyFromOrder(active)} ks</span>
                    </span>
                  </div>

                  {activeLoading ? (
                    <div className="mt-3 text-sm font-semibold text-gray-600">Načítám položky…</div>
                  ) : (() => {
                      const foods = getFoodsFromOrder(active);
                      const show = foods.slice(0, 20);
                      const more = foods.length > 20;
                      if (show.length === 0) {
                        return <div className="mt-3 text-sm font-semibold text-gray-600">(Položky nejsou uložené)</div>;
                      }
                      return (
                        <ul className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1 md:grid-cols-2">
                          {show.map((n, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="mt-[7px] h-2.5 w-2.5 shrink-0 rounded-full bg-green-600" />
                              <span className="leading-snug text-[16px] font-extrabold text-green-900">{n}</span>
                            </li>
                          ))}
                          {more ? (
                            <li className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-600" />
                              <span className="text-sm font-extrabold text-green-800">…</span>
                            </li>
                          ) : null}
                        </ul>
                      );
                    })()}

                  <button
                    type="button"
                    className="absolute bottom-3 right-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-green-700 ring-1 ring-green-200/90 hover:bg-green-50"
                    onClick={openFoodsModal}
                    title="Upravit jídla"
                  >
                    <IconPencil className="h-4 w-4" />
                  </button>
                </div>

                <div className={sectionCard}>
                  <div className="mt-1 text-sm font-extrabold text-green-800">Údaje</div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
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

                    <div className="md:col-span-3">
                      <div className="text-xs font-extrabold tracking-wide text-gray-600">Poznámka</div>
                      <textarea
                        className={field + " min-h-[64px] resize-none"}
                        value={eNote}
                        onChange={(e) => setENote(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
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

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    className={dangerAction}
                    disabled={savingEdit || deleting || foodsSaving}
                    onClick={() => setConfirmDelOpen(true)}
                    title="Smazat objednávku"
                  >
                    <IconTrash className="h-5 w-5" />
                    <span>Smazat</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={miniBtn}
                      disabled={savingEdit || deleting || foodsSaving}
                      onClick={closeModal}
                    >
                      Zpět
                    </button>
                    <button
                      type="button"
                      className={primaryBtn}
                      disabled={savingEdit || deleting || foodsSaving}
                      onClick={saveEdit}
                    >
                      {savingEdit ? "Ukládám…" : "Uložit"}
                    </button>
                  </div>
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
              <div className={foodsBox}>
                <div className={foodsInner}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-extrabold text-gray-900">Úprava jídel v objednávce</div>
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
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-extrabold text-green-800">Jídla</div>
                      <span className={pillBase("bg-white text-gray-900 ring-black/10")}>
                        Celkem: <span className="ml-2 font-extrabold text-green-700">{active.total} Kč</span>
                        <span className="ml-3 font-extrabold text-gray-600">{getQtyFromOrder(active)} ks</span>
                      </span>
                    </div>

                    {foodRows.length === 0 ? (
                      <div className="mt-3 text-sm font-semibold text-gray-600">(Tady zatím žádná jídla nejsou.)</div>
                    ) : (
                      <div className="mt-3 grid gap-2">
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