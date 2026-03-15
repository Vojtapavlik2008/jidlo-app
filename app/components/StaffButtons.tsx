"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getMyProfile } from "@/lib/auth";

type ProfileLike = {
  full_name?: string | null;
  phone?: string | null;
  address?: string | null;
  kredit?: number | null;
  credit_unlocked?: boolean | null;
  role?: string | null;
  is_staff?: boolean | null;
};

function TileButton({
  title,
  subtitle,
  colorClass,
  onClick,
  badge,
}: {
  title: string;
  subtitle?: string;
  colorClass: string;
  onClick: () => void;
  badge?: number | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative w-full rounded-2xl px-6 py-7 text-white shadow-md transition",
        "hover:shadow-lg active:scale-[0.99]",
        colorClass,
      ].join(" ")}
    >
      {badge && badge > 0 ? (
        <div className="absolute -top-3 -right-3 min-w-[40px] h-10 px-3 rounded-full bg-white text-gray-900 flex items-center justify-center text-sm font-extrabold shadow">
          {badge}
        </div>
      ) : null}

      <div className="text-xl md:text-2xl font-extrabold">{title}</div>
      {subtitle ? <div className="mt-1 text-sm font-semibold text-white/90">{subtitle}</div> : null}
    </button>
  );
}

export default function StaffButtons() {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [ready, setReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [profile, setProfile] = useState<ProfileLike | null>(null);

  const [newOrdersCount, setNewOrdersCount] = useState<number | null>(null);

  // auth + profile
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      setIsAuthed(!!data.session);

      const p = await getMyProfile();
      if (!alive) return;
      setProfile(p ?? null);

      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const isStaff = useMemo(() => {
    if (!profile) return false;
    if (profile.is_staff) return true;
    if (profile.role && String(profile.role).toLowerCase().includes("staff")) return true;
    if (profile.role && String(profile.role).toLowerCase().includes("admin")) return true;
    return false;
  }, [profile]);

  async function loadNewOrdersCount() {
    try {
      // count only (head:true)
      const { count, error } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "new");

      if (error) throw error;
      setNewOrdersCount(count ?? 0);
    } catch {
      // když nemáš policy nebo tabulku, necháme null a nic nerušíme
      setNewOrdersCount(null);
    }
  }

  // poll + refresh on focus
  useEffect(() => {
    if (!ready) return;
    if (!isAuthed) return;
    if (!isStaff) return;

    loadNewOrdersCount();

    const id = setInterval(() => loadNewOrdersCount(), 20_000);

    const onVis = () => {
      if (document.visibilityState === "visible") loadNewOrdersCount();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ready, isAuthed, isStaff]);

  if (!ready) return null;

  if (!isAuthed) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="text-lg font-semibold">Přihlas se, prosím.</div>
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="text-lg font-semibold">Nemáš oprávnění pro staff.</div>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-4xl font-extrabold tracking-tight">Personální rozcestník</div>
          <div className="mt-1 text-sm text-gray-600 font-semibold">Administrace jídelny</div>
        </div>

        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded-full border px-4 py-2 text-sm font-bold hover:bg-gray-50"
        >
          Web →
        </button>
      </div>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
        <TileButton
          title="Objednávka (pokladna)"
          colorClass="bg-green-600"
          onClick={() => router.push("/staff/objednavka")}
        />

        <TileButton
          title="Online objednávky"
          colorClass="bg-emerald-800"
          badge={newOrdersCount}
          onClick={() => router.push("/staff/online-objednavka")}
        />

        <TileButton
          title="Seznam zákazníků"
          colorClass="bg-red-600"
          onClick={() => router.push("/staff/seznam-zakazniku")}
        />

        <TileButton
          title="Správa menu"
          colorClass="bg-purple-600"
          onClick={() => router.push("/staff/sprava-menu")}
        />

        <TileButton
          title="Reporty"
          colorClass="bg-slate-600"
          onClick={() => router.push("/staff/reporty")}
        />

        <TileButton
          title="Administrace"
          colorClass="bg-blue-600"
          onClick={() => router.push("/staff/administrace")}
        />
      </div>
    </div>
  );
}