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

function formatIndex(index: number) {
  return String(index + 1).padStart(2, "0");
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
  onOpenHub?: () => void;
  onOpenTopUp: () => void;
  onOpenEdit: (row: ProfileRow) => void;
  onOpenAddCustomer?: () => void;
};

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
  onOpenHub,
  onOpenTopUp,
  onOpenEdit,
  onOpenAddCustomer,
}: Props) {
  const pillBase =
    "inline-flex items-center justify-center rounded-full border font-extrabold transition active:scale-[0.99]";
  const pillActive = "border-emerald-600 bg-emerald-600 text-white";
  const pillIdle = "border-emerald-200 bg-white text-emerald-900";

  return (
    <div className="pb-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[24px] font-extrabold leading-none tracking-tight text-[#0b2149]">
            Zákazníci
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenAddCustomer}
            className="rounded-full border border-emerald-600 bg-emerald-600 px-4 py-2 text-[12px] font-extrabold text-white shadow-sm"
          >
            Přidat zákazníka
          </button>

          <button
            type="button"
            onClick={onOpenHub}
            className="rounded-full border border-emerald-600 bg-emerald-600 px-4 py-2 text-[12px] font-extrabold text-white shadow-sm"
          >
            Rozcestník
          </button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setTab("platici")}
          className={cls(
            pillBase,
            "min-h-[46px] px-3 text-[12px]",
            tab === "platici" ? pillActive : pillIdle
          )}
        >
          <span className="truncate">Plátící</span>
          <span
            className={cls(
              "ml-1.5 text-[12px] font-extrabold",
              tab === "platici" ? "text-white" : "text-emerald-700"
            )}
          >
            {platiciCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab("zalohovani")}
          className={cls(
            pillBase,
            "min-h-[46px] px-3 text-[12px]",
            tab === "zalohovani" ? pillActive : pillIdle
          )}
        >
          <span className="truncate">Zálohovaní</span>
          <span
            className={cls(
              "ml-1.5 text-[12px] font-extrabold",
              tab === "zalohovani" ? "text-white" : "text-emerald-700"
            )}
          >
            {zalohovaniCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab("vsichni")}
          className={cls(
            pillBase,
            "min-h-[46px] px-3 text-[12px]",
            tab === "vsichni" ? pillActive : pillIdle
          )}
        >
          <span className="truncate">Všichni</span>
          <span
            className={cls(
              "ml-1.5 text-[12px] font-extrabold",
              tab === "vsichni" ? "text-white" : "text-emerald-700"
            )}
          >
            {vsichniCount}
          </span>
        </button>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Vyhledat jméno nebo e-mail"
            className="h-11 w-full rounded-full border border-emerald-200 bg-white pl-10 pr-3 text-[13px] font-medium text-gray-800 outline-none transition focus:border-emerald-300"
          />
        </div>

        <button
          type="button"
          onClick={onOpenTopUp}
          className="shrink-0 rounded-full border border-emerald-200 bg-white px-3 py-2.5 text-[11px] font-extrabold text-emerald-700"
        >
          Dobít kredit
        </button>
      </div>

      {msg ? (
        <div className="mb-4 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {msg}
        </div>
      ) : null}

      <div className="grid gap-2">
        {loading ? (
          <div className="rounded-[22px] border border-emerald-200 bg-white px-4 py-4 text-sm text-gray-600 shadow-sm">
            Načítám…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[22px] border border-emerald-200 bg-white px-4 py-4 text-sm text-gray-600 shadow-sm">
            Nic tu není.
          </div>
        ) : (
          filtered.map((r, index) => {
            const k = round2(Number(r.kredit ?? 0));

            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onOpenEdit(r)}
                className="w-full rounded-[22px] border border-emerald-200 bg-white px-3.5 py-3 text-left shadow-sm transition active:scale-[0.995]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <div className="shrink-0 pt-[1px] text-[12px] font-extrabold text-gray-400">
                        {formatIndex(index)}
                      </div>

                      <div className="min-w-0 flex-1 truncate text-[15px] font-extrabold text-[#182033]">
                        {r.full_name || "—"}
                      </div>
                    </div>

                    <div className="mt-1 truncate pl-[22px] text-[12px] font-medium text-gray-600">
                      {r.address || "—"}
                    </div>

                    <div className="mt-0.5 truncate pl-[22px] text-[11px] text-gray-500">
                      {[r.phone || "—", r.email || "—"].join(" • ")}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-start gap-2">
                    <span
                      className={cls(
                        "inline-flex min-w-[72px] items-center justify-center rounded-full border px-2.5 py-1.5 text-[11px] font-extrabold whitespace-nowrap",
                        k > 0
                          ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                          : k < 0
                          ? "border-red-200 bg-red-100 text-red-800"
                          : "border-gray-200 bg-gray-100 text-gray-600"
                      )}
                    >
                      {k > 0 ? "+" : ""}
                      {k} Kč
                    </span>

                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700">
                      <PencilIcon className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
