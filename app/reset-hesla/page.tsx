"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ResetHeslaPage() {
  const router = useRouter();

  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setMsg(null);

    if (p1.length < 6) {
      setMsg("Heslo musí mít alespoň 6 znaků.");
      return;
    }
    if (p1 !== p2) {
      setMsg("Hesla se neshodují.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: p1 });
    setLoading(false);

    if (error) {
      setMsg("Chyba: " + error.message);
      return;
    }

    setMsg("Hotovo ✅ Heslo bylo změněno. Můžeš se přihlásit.");
    setTimeout(() => router.push("/"), 800);
  }

  return (
    <div className="min-h-screen bg-[#f4fff7]">
      <div className="mx-auto max-w-md px-6 py-10">
        <div className="rounded-3xl bg-white p-6 ring-1 ring-black/10 shadow-sm">
          <div className="text-2xl font-extrabold text-green-700">Nastavit nové heslo</div>
          <div className="mt-2 text-sm text-gray-600">
            Zadej nové heslo. Po uložení tě to vrátí na web.
          </div>

          <div className="mt-5 grid gap-3">
            <input
              className="w-full rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-green-200"
              type="password"
              placeholder="Nové heslo"
              value={p1}
              onChange={(e) => setP1(e.target.value)}
              autoComplete="new-password"
            />
            <input
              className="w-full rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-green-200"
              type="password"
              placeholder="Znovu nové heslo"
              value={p2}
              onChange={(e) => setP2(e.target.value)}
              autoComplete="new-password"
            />

            {msg && <div className="text-sm text-gray-700">{msg}</div>}

            <button
              disabled={loading}
              onClick={save}
              className="mt-2 w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-extrabold text-white hover:brightness-95 disabled:opacity-60"
            >
              Uložit nové heslo
            </button>

            <button
              type="button"
              onClick={() => router.push("/")}
              className="w-full rounded-2xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              Zpět na web
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
