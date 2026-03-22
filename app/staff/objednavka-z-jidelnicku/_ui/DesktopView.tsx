"use client";

type CustomerType = "zakaznik" | "fakturovany";

type ProfileRow = {
  id: string;
  full_name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  kredit: number | null;
};

type InvoiceCustomerDbRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
};

type MenuDay = {
  key: string;
  label: string;
  short: string;
};

type MenuItem = {
  id: string;
  foodId: string;
  dayKey: string;
  name: string;
  subtitle: string;
  price: number;
};

function cls(...a: Array<string | false | undefined | null>) {
  return a.filter(Boolean).join(" ");
}

function czk(n: number) {
  return `${Number(n || 0).toFixed(2)} Kč`;
}

type Props = {
  customerType: CustomerType;
  setCustomerType: (value: CustomerType) => void;
  profileSearch: string;
  setProfileSearch: (value: string) => void;
  invoiceSearch: string;
  setInvoiceSearch: (value: string) => void;
  selectedProfile: ProfileRow | null;
  setSelectedProfile: (value: ProfileRow | null) => void;
  selectedInvoiceCustomer: InvoiceCustomerDbRow | null;
  setSelectedInvoiceCustomer: (value: InvoiceCustomerDbRow | null) => void;
  filteredProfiles: ProfileRow[];
  filteredInvoiceCustomers: InvoiceCustomerDbRow[];
  setCreateMode: (value: "profile" | "invoice") => void;
  setShowCreateCustomer: (value: boolean) => void;
  menuDays: MenuDay[];
  activeDay: string;
  setActiveDay: (value: string) => void;
  weekOffset: 0 | 1;
  setWeekOffset: React.Dispatch<React.SetStateAction<0 | 1>>;
  menuLoading: boolean;
  menuError: string | null;
  activeItems: MenuItem[];
  cartQty: (foodId: string, dayKey: string) => number;
  addToCart: (item: MenuItem) => void;
  subFromCart: (item: MenuItem) => void;
  cartCount: number;
  cartTotal: number;
  saveMsg: string | null;
  setShowSummary: (value: boolean) => void;
};

export default function DesktopView({
  customerType,
  setCustomerType,
  profileSearch,
  setProfileSearch,
  invoiceSearch,
  setInvoiceSearch,
  selectedProfile,
  setSelectedProfile,
  selectedInvoiceCustomer,
  setSelectedInvoiceCustomer,
  filteredProfiles,
  filteredInvoiceCustomers,
  setCreateMode,
  setShowCreateCustomer,
  menuDays,
  activeDay,
  setActiveDay,
  weekOffset,
  setWeekOffset,
  menuLoading,
  menuError,
  activeItems,
  cartQty,
  addToCart,
  subFromCart,
  cartCount,
  cartTotal,
  saveMsg,
  setShowSummary,
}: Props) {
  return (
    <>
      <div className="rounded-[26px] border border-[#bde7c8] bg-white p-4 shadow-[0_12px_32px_rgba(27,54,39,0.05)]">
        <div className="grid gap-2 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setCustomerType("zakaznik")}
            className={cls(
              "rounded-[16px] border px-5 py-2.5 text-left transition",
              customerType === "zakaznik"
                ? "border-[#08a35c] bg-[#08a35c] text-white"
                : "border-[#dff2e5] bg-white text-[#0b7c4d] hover:bg-[#f5fbf7]"
            )}
          >
            <div className="text-[16px] font-extrabold">Zákazník</div>
          </button>

          <button
            type="button"
            onClick={() => setCustomerType("fakturovany")}
            className={cls(
              "rounded-[16px] border px-5 py-2.5 text-left transition",
              customerType === "fakturovany"
                ? "border-[#08a35c] bg-[#08a35c] text-white"
                : "border-[#dff2e5] bg-white text-[#0b7c4d] hover:bg-[#f5fbf7]"
            )}
          >
            <div className="text-[16px] font-extrabold">Fakturovaný zákazník</div>
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          <div className="relative flex-1">
            {customerType === "zakaznik" ? (
              <>
                <input
                  value={
                    selectedProfile
                      ? `${selectedProfile.full_name ?? ""} • kredit ${czk(Number(selectedProfile.kredit ?? 0))}`
                      : profileSearch
                  }
                  onChange={(e) => {
                    setSelectedProfile(null);
                    setProfileSearch(e.target.value);
                  }}
                  placeholder="Vyhledej zákazníka"
                  className="w-full rounded-full border border-[#bde7c8] bg-white px-4 py-2.5 text-[15px] font-semibold text-[#182033] outline-none focus:border-[#08a35c]"
                />

                {filteredProfiles.length > 0 && profileSearch.trim() && !selectedProfile ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 rounded-[18px] border border-[#dff2e5] bg-white p-2 shadow-lg">
                    <div className="grid gap-2">
                      {filteredProfiles.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedProfile(c);
                            setProfileSearch("");
                          }}
                          className="rounded-[14px] border border-[#dff2e5] bg-[#f5fbf7] px-4 py-2.5 text-left hover:bg-[#ecf8f0]"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[15px] font-extrabold text-[#182033]">
                              {c.full_name || "Bez jména"}
                            </div>
                            <div className="text-[14px] font-extrabold text-[#0b7c4d]">
                              {czk(Number(c.kredit ?? 0))}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <input
                  value={selectedInvoiceCustomer ? selectedInvoiceCustomer.name : invoiceSearch}
                  onChange={(e) => {
                    setSelectedInvoiceCustomer(null);
                    setInvoiceSearch(e.target.value);
                  }}
                  placeholder="Vyhledej fakturovaného zákazníka"
                  className="w-full rounded-full border border-[#bde7c8] bg-white px-4 py-2.5 text-[15px] font-semibold text-[#182033] outline-none focus:border-[#08a35c]"
                />

                {filteredInvoiceCustomers.length > 0 && invoiceSearch.trim() && !selectedInvoiceCustomer ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 rounded-[18px] border border-[#dff2e5] bg-white p-2 shadow-lg">
                    <div className="grid gap-2">
                      {filteredInvoiceCustomers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedInvoiceCustomer(c);
                            setInvoiceSearch("");
                          }}
                          className="rounded-[14px] border border-[#dff2e5] bg-[#f5fbf7] px-4 py-2.5 text-left hover:bg-[#ecf8f0]"
                        >
                          <div className="text-[15px] font-extrabold text-[#182033]">{c.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setCreateMode(customerType === "zakaznik" ? "profile" : "invoice");
              setShowCreateCustomer(true);
            }}
            className="inline-flex h-[46px] w-[46px] items-center justify-center rounded-[16px] border border-[#78d3a0] bg-white text-[24px] font-extrabold text-[#0b7c4d] hover:bg-[#f5fbf7]"
          >
            +
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-[26px] border border-[#bde7c8] bg-white p-4 shadow-[0_12px_32px_rgba(27,54,39,0.05)]">
        <div className="flex flex-wrap items-center gap-2">
          {menuDays.map((day) => (
            <button
              key={day.key}
              type="button"
              onClick={() => setActiveDay(day.key)}
              className={cls(
                "rounded-[14px] border px-4 py-2 text-[14px] font-extrabold transition",
                activeDay === day.key
                  ? "border-[#08a35c] bg-[#08a35c] text-white"
                  : "border-[#dff2e5] bg-white text-[#0b7c4d] hover:bg-[#f5fbf7]"
              )}
            >
              {day.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setWeekOffset((prev) => (prev === 0 ? 1 : 0))}
            className="ml-auto rounded-[14px] border border-[#dff2e5] bg-white px-5 py-2 text-[16px] font-extrabold text-[#0b7c4d] hover:bg-[#f5fbf7]"
          >
            {weekOffset === 0 ? "Příští týden →" : "Aktuální týden ←"}
          </button>
        </div>

        <div className="mt-3">
          {menuLoading ? (
            <div className="text-sm font-semibold text-gray-600">Načítám menu…</div>
          ) : menuError ? (
            <div className="text-sm font-semibold text-red-600">{menuError}</div>
          ) : activeItems.length === 0 ? (
            <div className="text-sm font-semibold text-gray-500">Na tento den není v menu nic zadané.</div>
          ) : (
            <div className="mt-2 max-h-[430px] overflow-y-auto pr-1">
              <div className="grid gap-2.5">
                {activeItems.map((item) => {
                  const qty = cartQty(item.foodId, item.dayKey);

                  return (
                    <div
                      key={item.id}
                      className={cls(
                        "rounded-[20px] border px-4 py-3",
                        qty > 0 ? "border-[#95d6af] bg-[#eef8f1]" : "border-[#dff2e5] bg-white"
                      )}
                    >
                      <div className="grid items-center gap-3 md:grid-cols-[minmax(0,1.8fr)_220px_140px_150px]">
                        <div className="min-w-0">
                          <div className="truncate text-[15px] font-extrabold text-[#0b2149]">
                            {item.name}
                          </div>
                        </div>

                        <div className="truncate text-[13px] font-extrabold text-[#0b7c4d]">
                          {item.subtitle || "—"}
                        </div>

                        <div className="text-right text-[17px] font-extrabold text-[#0b7c4d]">
                          {czk(item.price)}
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          {qty <= 0 ? (
                            <button
                              type="button"
                              onClick={() => addToCart(item)}
                              className="rounded-full border border-[#78d3a0] bg-white px-5 py-2 text-[14px] font-extrabold text-[#0b7c4d] hover:bg-[#f5fbf7]"
                            >
                              Přidat
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => subFromCart(item)}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#78d3a0] bg-white text-[22px] font-extrabold text-[#0b7c4d]"
                              >
                                −
                              </button>
                              <div className="min-w-[24px] text-center text-[20px] font-extrabold text-[#0b2149]">
                                {qty}
                              </div>
                              <button
                                type="button"
                                onClick={() => addToCart(item)}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#78d3a0] bg-white text-[22px] font-extrabold text-[#0b7c4d]"
                              >
                                +
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {saveMsg ? <div className="mt-4 text-sm font-semibold text-[#0b7c4d]">{saveMsg}</div> : null}
    </>
  );
}
