"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ensureMyProfile, isStaffLike, type Profile } from "@/lib/auth";

type Mode = "login" | "register" | "forgot";

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

function isValidPhoneCz(v: string) {
  return digitsOnly(v).length === 9;
}

function ProfileEditor({
  profile,
  emailFromAuth,
  onClose,
  onSaved,
}: {
  profile: Profile | null;
  emailFromAuth: string | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [email, setEmail] = useState(emailFromAuth ?? "");
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ? formatPhoneCz(profile.phone) : "");
  const [address, setAddress] = useState(profile?.address ?? "");
  const [agree, setAgree] = useState(profile?.terms_accepted ?? false);

  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setEmail(emailFromAuth ?? "");
    setFullName(profile?.full_name ?? "");
    setPhone(profile?.phone ? formatPhoneCz(profile.phone) : "");
    setAddress(profile?.address ?? "");
    setAgree(profile?.terms_accepted ?? false);
    setErr(null);
    setMsg(null);
  }, [
    emailFromAuth,
    profile?.full_name,
    profile?.phone,
    profile?.address,
    profile?.terms_accepted,
  ]);

  const original = useMemo(
    () => ({
      email: (emailFromAuth ?? "").trim(),
      fullName: (profile?.full_name ?? "").trim(),
      phone: formatPhoneCz(profile?.phone ?? ""),
      address: (profile?.address ?? "").trim(),
      agree: profile?.terms_accepted ?? false,
    }),
    [
      emailFromAuth,
      profile?.full_name,
      profile?.phone,
      profile?.address,
      profile?.terms_accepted,
    ]
  );

  const current = useMemo(
    () => ({
      email: email.trim(),
      fullName: fullName.trim(),
      phone: formatPhoneCz(phone),
      address: address.trim(),
      agree,
    }),
    [email, fullName, phone, address, agree]
  );

  const dirty =
    current.email !== original.email ||
    current.fullName !== original.fullName ||
    current.phone !== original.phone ||
    current.address !== original.address ||
    current.agree !== original.agree;

  const validName = isValidFullName(fullName);
  const validPhone = isValidPhoneCz(phone);
  const validEmail = isValidEmail(email);

  const canSave = dirty && agree && validEmail && validName && validPhone && !saving;

  async function saveChanges() {
    if (!profile) return;

    if (!validEmail) {
      setErr("Zadej platný email.");
      return;
    }
    if (!validName) {
      setErr("Zadej jméno i příjmení.");
      return;
    }
    if (!validPhone) {
      setErr("Telefon musí mít 9 číslic.");
      return;
    }
    if (!agree) {
      setErr("Zaškrtni souhlas.");
      return;
    }

    setSaving(true);
    setErr(null);
    setMsg(null);

    try {
      const nextEmail = email.trim();
      const nextName = fullName.trim();
      const nextPhone = digitsOnly(phone);
      const nextAddress = address.trim();

      const emailChanged = nextEmail !== (emailFromAuth ?? "").trim();

      if (emailChanged) {
        const { error: authErr } = await supabase.auth.updateUser({
          email: nextEmail,
        });
        if (authErr) throw authErr;
      }

      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          full_name: nextName,
          phone: nextPhone,
          address: nextAddress || null,
          email: nextEmail,
          terms_accepted: agree,
          terms_accepted_at: agree ? new Date().toISOString() : null,
        })
        .eq("id", profile.id);

      if (profileErr) throw profileErr;

      setMsg(
        emailChanged
          ? "Uloženo ✅ Pokud jsi změnil email, potvrď ho v doručené zprávě."
          : "Uloženo ✅"
      );

      await onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Chyba při ukládání.");
    } finally {
      setSaving(false);
    }
  }

  async function sendPasswordReset() {
    const em = email.trim() || emailFromAuth?.trim() || "";
    if (!isValidEmail(em)) {
      setErr("Nejdřív zadej platný email.");
      return;
    }

    setSendingReset(true);
    setErr(null);
    setMsg(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(em, {
        redirectTo: `${location.origin}/reset-hesla`,
      });

      if (error) throw error;

      setMsg("Na email jsme poslali odkaz pro změnu hesla.");
    } catch (e: any) {
      setErr(e?.message ?? "Nepodařilo se odeslat email pro změnu hesla.");
    } finally {
      setSendingReset(false);
    }
  }

  const field =
    "mt-1 w-full rounded-2xl bg-green-50 px-4 py-3 ring-1 ring-green-600/20 " +
    "text-gray-900 outline-none focus:ring-2 focus:ring-green-400";

  return (
    <div className="mt-4 grid gap-4 text-sm text-gray-800">
      <div>
        <div className="font-semibold text-gray-900">Email</div>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={field}
          autoComplete="email"
          placeholder="napr. jan@email.cz"
        />
      </div>

      <div>
        <div className="font-semibold text-gray-900">Jméno</div>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className={field}
          autoComplete="name"
          placeholder="Jméno a příjmení"
        />
      </div>

      <div>
        <div className="font-semibold text-gray-900">Telefon</div>
        <input
          value={formatPhoneCz(phone)}
          onChange={(e) => setPhone(formatPhoneCz(e.target.value))}
          className={field}
          inputMode="tel"
          autoComplete="tel"
          placeholder="777 777 777"
        />
      </div>

      <div>
        <div className="font-semibold text-gray-900">Adresa</div>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className={field}
          autoComplete="street-address"
          placeholder="Ulice a č.p., město"
        />
      </div>

      <div className="rounded-2xl bg-gray-50 px-4 py-3 ring-1 ring-black/5">
        <button
          type="button"
          onClick={sendPasswordReset}
          disabled={sendingReset}
          className="text-sm font-extrabold text-green-700 hover:underline disabled:opacity-60"
        >
          {sendingReset ? "Posílám email…" : "Změnit heslo"}
        </button>
        <div className="mt-1 text-xs text-gray-500">
          Po kliknutí pošleme email s odkazem, kde si heslo nastavíš.
        </div>
      </div>

      <label className="flex items-start gap-3 rounded-2xl bg-gray-50 px-4 py-3 ring-1 ring-black/5">
        <input
          type="checkbox"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300"
        />
        <span className="text-xs leading-5 text-gray-600">
          Souhlasím s obchodními podmínkami a se zpracováním osobních údajů v rozsahu
          nutném pro používání účtu a objednávek.
        </span>
      </label>

      {err && <div className="text-sm font-semibold text-red-600">{err}</div>}
      {msg && <div className="text-sm font-semibold text-green-700">{msg}</div>}

      <div className="mt-2 flex justify-between gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl px-5 py-2 text-sm font-semibold ring-1 ring-gray-300 hover:bg-gray-50 transition"
        >
          Zpět
        </button>

        <button
          type="button"
          disabled={!canSave}
          onClick={saveChanges}
          className="rounded-xl bg-green-600 px-5 py-2 text-sm font-extrabold text-white hover:brightness-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Ukládám…" : "Uložit změny"}
        </button>
      </div>
    </div>
  );
}

export default function AuthButton() {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("login");

  const [profileModal, setProfileModal] = useState<"profile" | "credit" | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [registerAgree, setRegisterAgree] = useState(false);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 " +
    "placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-green-200";

  async function refresh() {
    const p = await ensureMyProfile();
    setProfile(p);

    const { data } = await supabase.auth.getUser();
    setAuthEmail(data.user?.email ?? null);
  }

  useEffect(() => {
    void refresh();
    const { data: sub } = supabase.auth.onAuthStateChange(() => void refresh());
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setProfileModal(null);
        setMenuOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const displayName = useMemo(() => {
    if (!profile) return "";
    const n = profile.full_name?.trim();
    return n && n.length > 0 ? n : isStaffLike(profile) ? "Personál" : "Zákazník";
  }, [profile]);

  const creditValue = profile?.kredit ?? 0;
  const showCredit = creditValue > 0;

  function resetAuthForm() {
    setEmail("");
    setPass("");
    setFullName("");
    setPhone("");
    setAddress("");
    setRegisterAgree(false);
    setMsg(null);
    setLoading(false);
  }

  function closeAuthModal() {
    setOpen(false);
    setMsg(null);
    setLoading(false);
    setMode("login");
  }

  async function signIn() {
    setLoading(true);
    setMsg(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: pass,
    });

    if (error) {
      setMsg("Chyba přihlášení: " + error.message);
      setLoading(false);
      return;
    }
    if (!data.session) {
      setMsg("Nepodařilo se vytvořit session.");
      setLoading(false);
      return;
    }

    const p = await ensureMyProfile();
    setProfile(p);

    const { data: u } = await supabase.auth.getUser();
    setAuthEmail(u.user?.email ?? null);

    setLoading(false);
    closeAuthModal();
    resetAuthForm();

    if (isStaffLike(p)) router.push("/staff");
  }

  async function signUpCustomer() {
    setLoading(true);
    setMsg(null);

    if (!isValidEmail(email)) {
      setMsg("Vyplň platný email.");
      setLoading(false);
      return;
    }
    if (pass.length < 6) {
      setMsg("Heslo musí mít alespoň 6 znaků.");
      setLoading(false);
      return;
    }
    if (!isValidFullName(fullName)) {
      setMsg("Vyplň jméno i příjmení.");
      setLoading(false);
      return;
    }
    if (!isValidPhoneCz(phone)) {
      setMsg("Telefon musí mít 9 číslic.");
      setLoading(false);
      return;
    }
    if (!registerAgree) {
      setMsg("Zaškrtni souhlas s podmínkami.");
      setLoading(false);
      return;
    }

    const cleanEmail = email.trim();
    const cleanPhone = digitsOnly(phone);
    const cleanName = fullName.trim();
    const cleanAddress = address.trim();

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: pass,
      options: {
        data: {
          full_name: cleanName,
          phone: cleanPhone,
          address: cleanAddress || null,
          role: "customer",
          terms_accepted: registerAgree,
        },
      },
    });

    if (error) {
      setMsg(error.message);
      setLoading(false);
      return;
    }

    if (data.user?.id) {
      await supabase.from("profiles").upsert(
        {
          id: data.user.id,
          role: "customer",
          full_name: cleanName,
          phone: cleanPhone,
          address: cleanAddress || null,
          email: cleanEmail,
          kredit: 0,
          terms_accepted: registerAgree,
          terms_accepted_at: registerAgree ? new Date().toISOString() : null,
        },
        { onConflict: "id" }
      );
    }

    setMsg("Registrováno ✅ Teď se přihlas, případně nejdřív potvrď email.");
    setMode("login");
    setPass("");
    setLoading(false);
  }

  async function sendResetEmail() {
    setLoading(true);
    setMsg(null);

    const em = email.trim();
    if (!em) {
      setMsg("Vyplň email.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(em, {
      redirectTo: `${location.origin}/reset-hesla`,
    });

    if (error) {
      setMsg("Nepodařilo se odeslat email: " + error.message);
      setLoading(false);
      return;
    }

    setMsg("Hotovo ✅ Poslali jsme odkaz na email.");
    setLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setAuthEmail(null);
    setMenuOpen(false);
    setProfileModal(null);
    router.push("/");
  }

  const pill =
    "rounded-xl border-2 border-green-600 px-4 py-2 text-sm font-extrabold text-green-700 " +
    "hover:bg-green-600 hover:text-white transition";

  const solid =
    "rounded-xl bg-green-600 px-4 py-2 text-sm font-extrabold text-white hover:brightness-95 transition";

  return (
    <>
      {profile ? (
        <div className="flex items-center gap-3">
          {isStaffLike(profile) && (
            <button onClick={() => router.push("/staff")} className={solid}>
              Rozcestník
            </button>
          )}

          <div className="relative" ref={menuRef}>
            <button type="button" onClick={() => setMenuOpen((v) => !v)} className={pill} title="Profil">
              {displayName}
              {showCredit ? (
                <>
                  {" "}
                  • Kredit <span className="font-extrabold">{creditValue} Kč</span>
                </>
              ) : null}
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white p-2 shadow-2xl ring-1 ring-black/10 z-50">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setProfileModal("profile");
                  }}
                  className="w-full rounded-xl px-4 py-2 text-left text-sm font-semibold text-gray-900 hover:bg-green-50 transition whitespace-nowrap"
                >
                  ⚙ Nastavení profilu
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setProfileModal("credit");
                  }}
                  className="w-full rounded-xl px-4 py-2 text-left text-sm font-semibold text-gray-900 hover:bg-green-50 transition whitespace-nowrap"
                >
                  💳 Dobít kredit
                </button>

                <div className="my-2 h-px bg-gray-200" />

                <button
                  type="button"
                  onClick={signOut}
                  className="w-full rounded-xl px-4 py-2 text-left text-sm font-extrabold text-red-600 hover:bg-red-50 transition"
                >
                  Odhlásit
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => {
            setOpen(true);
            setMode("login");
            setMsg(null);
          }}
          className={pill}
        >
          Přihlásit se
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 p-4">
          <button type="button" className="absolute inset-0" onClick={closeAuthModal} aria-label="Zavřít" />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-xl ring-1 ring-black/10">
            <div className="flex items-start justify-between gap-3">
              <div className="text-xl font-extrabold text-green-700">
                {mode === "login" ? "Přihlášení" : mode === "register" ? "Registrace" : "Zapomenuté heslo"}
              </div>
              <button
                type="button"
                onClick={closeAuthModal}
                className="rounded-xl px-3 py-1.5 text-sm font-extrabold text-gray-700 hover:bg-gray-50 ring-1 ring-black/10"
              >
                ✕
              </button>
            </div>

            {mode !== "forgot" && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className={
                    "rounded-xl px-3 py-2 text-sm font-extrabold transition border " +
                    (mode === "login"
                      ? "bg-green-50 text-green-800 border-green-300 ring-2 ring-green-200"
                      : "bg-white text-green-700 border-green-200 hover:bg-green-50")
                  }
                >
                  Přihlášení
                </button>
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className={
                    "rounded-xl px-3 py-2 text-sm font-extrabold transition border " +
                    (mode === "register"
                      ? "bg-green-50 text-green-800 border-green-300 ring-2 ring-green-200"
                      : "bg-white text-green-700 border-green-200 hover:bg-green-50")
                  }
                >
                  Registrace
                </button>
              </div>
            )}

            <div className="mt-3 grid gap-2">
              {mode === "register" && (
                <>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    className={inputClass}
                    autoComplete="email"
                  />

                  <input
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    placeholder="Heslo"
                    type="password"
                    className={inputClass}
                    autoComplete="new-password"
                  />

                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jméno a příjmení"
                    className={inputClass}
                    autoComplete="name"
                  />

                  <input
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneCz(e.target.value))}
                    placeholder="Telefon"
                    className={inputClass}
                    inputMode="tel"
                    autoComplete="tel"
                  />

                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Adresa (nepovinná)"
                    className={inputClass}
                    autoComplete="street-address"
                  />

                  <label className="mt-1 flex items-start gap-3 rounded-xl bg-gray-50 px-3 py-3 text-xs text-gray-600 ring-1 ring-black/5">
                    <input
                      type="checkbox"
                      checked={registerAgree}
                      onChange={(e) => setRegisterAgree(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300"
                    />
                    <span>
                      Souhlasím s obchodními podmínkami a se zpracováním osobních údajů.
                    </span>
                  </label>
                </>
              )}

              {mode === "login" && (
                <>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    className={inputClass}
                    autoComplete="email"
                  />

                  <input
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    placeholder="Heslo"
                    type="password"
                    className={inputClass}
                    autoComplete="current-password"
                  />
                </>
              )}

              {mode === "forgot" && (
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className={inputClass}
                  autoComplete="email"
                />
              )}

              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    setMsg(null);
                    setPass("");
                  }}
                  className="text-left text-sm font-semibold text-green-700 hover:underline"
                >
                  Zapomenuté heslo?
                </button>
              )}

              {mode === "forgot" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setMsg(null);
                  }}
                  className="text-left text-sm font-semibold text-gray-600 hover:underline"
                >
                  ← Zpět na přihlášení
                </button>
              )}

              {msg && <div className="text-sm text-gray-700">{msg}</div>}

              <button
                disabled={loading}
                onClick={mode === "login" ? signIn : mode === "register" ? signUpCustomer : sendResetEmail}
                className="mt-2 w-full rounded-xl bg-green-600 px-4 py-2 text-sm font-extrabold text-white hover:brightness-95 disabled:opacity-60"
              >
                {mode === "login" ? "Přihlásit" : mode === "register" ? "Registrovat" : "Poslat odkaz na email"}
              </button>
            </div>
          </div>
        </div>
      )}

      {profileModal && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/30 p-4">
          <button type="button" className="absolute inset-0" onClick={() => setProfileModal(null)} aria-label="Zavřít" />

          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-black/10">
            <div className="flex items-start justify-between gap-3">
              <div className="text-xl font-extrabold text-green-700">
                {profileModal === "profile" ? "Nastavení profilu" : "Dobít kredit"}
              </div>
              <button
                type="button"
                onClick={() => setProfileModal(null)}
                className="rounded-xl px-3 py-1.5 text-sm font-extrabold text-gray-700 hover:bg-gray-50 ring-1 ring-black/10"
              >
                ✕
              </button>
            </div>

            {profileModal === "profile" ? (
              <ProfileEditor
                profile={profile}
                emailFromAuth={authEmail}
                onClose={() => setProfileModal(null)}
                onSaved={refresh}
              />
            ) : (
              <div className="mt-4 rounded-2xl bg-green-50 p-4 ring-1 ring-green-600/20 text-sm text-gray-700">
                Dobití kreditu zatím připravíme později 🙂
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}