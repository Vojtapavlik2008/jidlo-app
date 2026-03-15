"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getMyProfile } from "@/lib/auth";

function digitsOnly(s: string) {
  return (s ?? "").replace(/\D/g, "");
}

function formatPhoneCz(raw: string) {
  const d = digitsOnly(raw).slice(0, 9);
  const a = d.slice(0, 3);
  const b = d.slice(3, 6);
  const c = d.slice(6, 9);
  return [a, b, c].filter(Boolean).join(" ").trim();
}

function isValidEmail(v: string) {
  return /\S+@\S+\.\S+/.test(v.trim());
}

function isValidFullName(v: string) {
  return v.trim().split(/\s+/).filter(Boolean).length >= 2;
}

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [agree, setAgree] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.back();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setMsg(null);

        const { data: userData } = await supabase.auth.getUser();
        if (!alive) return;

        if (!userData?.user?.id) {
          router.back();
          return;
        }

        setUserId(userData.user.id);
        setEmail(userData.user.email ?? "");

        const p: any = await getMyProfile();
        if (!alive) return;

        setFullName(p?.full_name ?? "");
        setPhone(p?.phone ? formatPhoneCz(p.phone) : "");
        setAddress(p?.address ?? "");
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setMsg(e?.message ?? "Chyba při načítání profilu.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  const original = useMemo(
    () => ({
      email: email.trim(),
      fullName: fullName.trim(),
      phone: formatPhoneCz(phone),
      address: address.trim(),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loading]
  );

  const current = useMemo(
    () => ({
      email: email.trim(),
      fullName: fullName.trim(),
      phone: formatPhoneCz(phone),
      address: address.trim(),
    }),
    [email, fullName, phone, address]
  );

  const dirty =
    !loading &&
    (current.email !== original.email ||
      current.fullName !== original.fullName ||
      current.phone !== original.phone ||
      current.address !== original.address);

  async function save() {
    if (!userId) return;

    const cleanEmail = email.trim();
    const cleanName = fullName.trim();
    const cleanPhone = digitsOnly(phone).slice(0, 9);
    const cleanAddress = address.trim();

    if (!isValidEmail(cleanEmail)) {
      setMsg("Zadej platný email.");
      return;
    }
    if (!isValidFullName(cleanName)) {
      setMsg("Vyplň prosím jméno i příjmení.");
      return;
    }
    if (cleanPhone.length !== 9) {
      setMsg("Telefon musí mít 9 číslic.");
      return;
    }
    if (!agree) {
      setMsg("Zaškrtni souhlas.");
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const oldEmail = userData.user?.email ?? "";

      if (cleanEmail !== oldEmail) {
        const { error: authErr } = await supabase.auth.updateUser({
          email: cleanEmail,
        });
        if (authErr) throw authErr;
      }

const { error } = await supabase
  .from("profiles")
  .update({
    full_name: cleanName,
    phone: cleanPhone,
    address: cleanAddress || null,
    email: cleanEmail,
  })
  .eq("id", userId);

      if (error) throw error;

      window.dispatchEvent(new Event("profile-updated"));
      setMsg(
        cleanEmail !== oldEmail
          ? "Uloženo ✅ Pokud jsi změnil email, potvrď ho v doručené zprávě."
          : "Uloženo ✅"
      );
      setAgree(false);
    } catch (e: any) {
      setMsg(e?.message ?? "Chyba při ukládání.");
    } finally {
      setSaving(false);
    }
  }

  async function sendReset() {
    if (!isValidEmail(email)) {
      setMsg("Nejdřív zadej platný email.");
      return;
    }

    setSendingReset(true);
    setMsg(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${location.origin}/reset-hesla`,
      });

      if (error) throw error;
      setMsg("Na email jsme poslali odkaz pro změnu hesla.");
    } catch (e: any) {
      setMsg(e?.message ?? "Nepodařilo se odeslat email.");
    } finally {
      setSendingReset(false);
    }
  }

  const input =
    "w-full rounded-2xl bg-white px-3 py-2.5 text-[14px] font-semibold text-gray-900 " +
    "placeholder:text-gray-400 ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-green-600";

  const canSave =
    dirty &&
    agree &&
    isValidEmail(email) &&
    isValidFullName(fullName) &&
    digitsOnly(phone).length === 9 &&
    !saving;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
      <button
        type="button"
        onClick={() => router.back()}
        className="absolute inset-0 bg-black/40"
        aria-label="Zavřít"
      />

      <div className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl ring-1 ring-black/10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-extrabold text-green-700">Nastavení profilu</div>
            <div className="mt-0.5 text-[12px] font-semibold text-gray-500">
              Údaje se použijí u objednávek.
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.back()}
            className="h-10 w-10 rounded-2xl bg-white ring-1 ring-black/10 hover:bg-gray-50 font-extrabold"
            aria-label="Zavřít"
            title="Zavřít"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-2.5">
          {loading ? (
            <div className="rounded-2xl bg-gray-50 ring-1 ring-black/10 px-3 py-3 text-sm font-semibold text-gray-600">
              Načítám…
            </div>
          ) : (
            <>
              {msg ? (
                <div className="rounded-2xl bg-green-50 px-3 py-2 ring-1 ring-green-600/20 text-[12px] font-bold text-gray-800">
                  {msg}
                </div>
              ) : null}

              <label className="block">
                <div className="mb-1 text-[11px] font-extrabold text-gray-600">Email *</div>
                <input
                  className={input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>

              <label className="block">
                <div className="mb-1 text-[11px] font-extrabold text-gray-600">Jméno a příjmení *</div>
                <input
                  className={input}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Např. Jan Novák"
                  autoComplete="name"
                />
              </label>

              <label className="block">
                <div className="mb-1 text-[11px] font-extrabold text-gray-600">Telefon *</div>
                <input
                  className={input}
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneCz(e.target.value))}
                  placeholder="111 111 111"
                  inputMode="numeric"
                  autoComplete="tel"
                />
              </label>

              <label className="block">
                <div className="mb-1 text-[11px] font-extrabold text-gray-600">Adresa</div>
                <input
                  className={input}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ulice a č.p., město"
                  autoComplete="street-address"
                />
              </label>

              <div className="rounded-2xl bg-gray-50 px-3 py-3 ring-1 ring-black/5">
                <button
                  type="button"
                  onClick={sendReset}
                  disabled={sendingReset}
                  className="text-sm font-extrabold text-green-700 hover:underline disabled:opacity-60"
                >
                  {sendingReset ? "Posílám email…" : "Změnit heslo"}
                </button>
                <div className="mt-1 text-[11px] font-semibold text-gray-500">
                  Na email pošleme odkaz, kde si heslo nastavíš znovu.
                </div>
              </div>

              <label className="flex items-start gap-3 rounded-2xl bg-gray-50 px-3 py-3 ring-1 ring-black/5">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300"
                />
                <span className="text-[11px] leading-5 text-gray-600">
                  Souhlasím s obchodními podmínkami a se zpracováním osobních údajů.
                </span>
              </label>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="w-full rounded-2xl px-4 py-3 text-sm font-extrabold bg-white ring-1 ring-black/10 hover:bg-gray-50"
                >
                  Zpět
                </button>

                <button
                  type="button"
                  onClick={save}
                  disabled={!canSave}
                  className="w-full rounded-2xl px-4 py-3 text-sm font-extrabold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Ukládám…" : "Uložit změny"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}