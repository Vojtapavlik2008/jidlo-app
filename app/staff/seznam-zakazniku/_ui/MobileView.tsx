"use client";

type ProfileRow = {
  id: string;
  full_name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  kredit: number | null;
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

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

type Props = {
  loading: boolean;
  rowsCount: number;
  tab: Tab;
  setTab: (tab: Tab) => void;
  search: string;
  setSearch: (value: string) => void;
  filtered: ProfileRow[];
  platiciCount: number;
  zalohovaniCount: number;
  vsichniCount: number;
  msg: string | null;
  onBack: () => void;
  onOpenHub?: () => void;
  onOpenTopUp: () => void;
  onOpenEdit: (row: ProfileRow) => void;
  onOpenAddCustomer?: () => void;
};

function formatCustomerId(id: string, index: number) {
  const numeric = Number(String(id).replace(/\D/g, ""));
  if (Number.isFinite(numeric) && numeric > 0) return String(numeric).padStart(2, "0");
  return String(index + 1).padStart(2, "0");
}

function CreditBadge({ value }: { value: number }) {
  const isPositive = value > 0;
  const isNegative = value < 0;

  return (
    <div
      className={cls(
        "inline-flex min-w-[72px] items-center justify-center rounded-full border px-2.5 py-1 text-[11px] font-extrabold whitespace-nowrap",
        isPositive
          ? "border-emerald-200 bg-emerald-100 text-emerald-700"
          : isNegative
          ? "border-red-200 bg-red-100 text-red-700"
          : "border-gray-200 bg-gray-100 text-gray-500"
      )}
    >
      {isPositive ? "+" : ""}
      {value} Kč
    </div>
  );
}

function TabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cls(
        "flex h-[50px] items-center justify-center rounded-[999px] border px-3 text-[13px] font-extrabold shadow-sm transition active:scale-[0.99]",
        active
          ? "border-emerald-600 bg-emerald-600 text-white"
          : "border-emerald-200 bg-white text-emerald-800"
      )}
    >
      <span>{label}</span>
      <span
        className={cls(
          "ml-1.5 rounded-full px-2 py-[1px] text-[10px] font-extrabold",
          active ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-700"
        )}
      >
        {count}
      </span>
    </button>
  );
}

export default function MobileView({
  loading,
  rowsCount,
  tab,
  setTab,
  search,
  setSearch,
  filtered,
  platiciCount,
  zalohovaniCount,
  vsichniCount,
  msg,
  onBack,
  onOpenHub,
  onOpenTopUp,
  onOpenEdit,
  onOpenAddCustomer,
}: Props) {
  return (
    <div className="pb-6">
      {/* HLAVICKA */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[24px] font-extrabold leading-none tracking-tight text-[#0b2149]">
            Zákazníci
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenAddCustomer}
            className="inline-flex h-11 items-center justify-center rounded-full border border-emerald-600 bg-emerald-600 px-4 text-[12px] font-extrabold text-white shadow-sm transition active:scale-[0.99]"
          >
            Přidat zákazníka
          </button>

          <button
            type="button"
            onClick={onOpenHub}
            className="inline-flex h-11 items-center justify-center rounded-full border border-emerald-600 bg-emerald-600 px-4 text-[12px] font-extrabold text-white shadow-sm transition active:scale-[0.99]"
          >
            Rozcestník
          </button>
        </div>
      </div>

      {/* OBAL */}
      <div className="rounded-[32px] border-2 border-emerald-100 p-3 sm:p-4">
        <div className="rounded-[28px] border-2 border-emerald-100 p-3">
          {/* FILTRY */}
          <div className="mb-3 grid grid-cols-3 gap-2">
            <TabButton
              active={tab === "platici"}
              label="Plátící"
              count={platiciCount}
              onClick={() => setTab("platici")}
            />

            <TabButton
              active={tab === "zalohovani"}
              label="Zálohovaní"
              count={zalohovaniCount}
              onClick={() => setTab("zalohovani")}
            />

            <TabButton
              active={tab === "vsichni"}
              label="Všichni"
              count={vsichniCount}
              onClick={() => setTab("vsichni")}
            />
          </div>

          {/* SEARCH + TOPUP */}
          <div className="mb-4 flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Vyhledat jméno nebo e-mail"
                className="h-11 w-full rounded-full border-2 border-emerald-100 bg-[#f7fbf7] pl-10 pr-4 text-[13px] font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-emerald-300"
              />
            </div>

            <button
              type="button"
              onClick={onOpenTopUp}
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-full border-2 border-emerald-200 bg-white px-3 text-[11px] font-extrabold text-emerald-700 shadow-sm transition active:scale-[0.99]"
            >
              Dobít kredit
            </button>
          </div>

          {/* INFO / CHYBA */}
          {msg ? (
            <div className="mb-4 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-700">
              {msg}
            </div>
          ) : null}

          {/* STAV */}
          {loading ? (
            <div className="rounded-[24px] border-2 border-emerald-100 bg-white px-4 py-4 text-[14px] text-gray-600 shadow-sm">
              Načítám…
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-[24px] border-2 border-emerald-100 bg-white px-4 py-4 text-[14px] text-gray-600 shadow-sm">
              Nic tu není.
            </div>
          ) : (
            <div className="grid gap-2.5">
              {filtered.map((r, index) => {
                const kredit = round2(Number(r.kredit ?? 0));
                const customerId = formatCustomerId(r.id, index);

                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onOpenEdit(r)}
                    className="w-full rounded-[22px] border-2 border-emerald-100 bg-white px-3.5 py-3 text-left shadow-sm transition active:scale-[0.995]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {/* 1. řádek */}
                        <div className="flex min-w-0 items-start gap-2">
                          <div className="shrink-0 text-[12px] font-extrabold text-gray-400">
                            {customerId}
                          </div>

                          <div className="min-w-0 truncate text-[15px] font-extrabold leading-tight text-[#182033]">
                            {r.full_name || "Bez jména"}
                          </div>
                        </div>

                        {/* 2. řádek */}
                        <div className="mt-1 truncate text-[12px] font-medium text-gray-600">
                          {r.address || "—"}
                        </div>

                        {/* 3. řádek */}
                        <div className="mt-1 truncate text-[11px] text-gray-500">
                          {(r.phone || "—") + " • " + (r.email || "—")}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-start gap-2">
                        <CreditBadge value={kredit} />

                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-100 bg-white text-gray-700">
                          <PencilIcon className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* MALY FOOT INFO */}
          {!loading ? (
            <div className="mt-3 px-1 text-[11px] font-medium text-gray-400">
              {rowsCount} záznamů
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
