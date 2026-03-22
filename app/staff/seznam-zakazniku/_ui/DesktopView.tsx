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
  onOpenTopUp: () => void;
  onOpenEdit: (row: ProfileRow) => void;
};

export default function DesktopView({
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
  onOpenTopUp,
  onOpenEdit,
}: Props) {
  const pillBtn =
    "inline-flex items-center justify-center rounded-full border transition font-bold";
  const pillWhite =
    "border-gray-200 bg-white text-gray-800 hover:bg-gray-50";
  const pillGreen =
    "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700";

  return (
    <>
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
              {rowsCount} záznamů
            </span>
          )}

          <button
            type="button"
            onClick={onBack}
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
            onClick={onOpenTopUp}
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
                  onClick={() => onOpenEdit(r)}
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
                        onOpenEdit(r);
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
    </>
  );
}
