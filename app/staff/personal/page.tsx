"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getMyProfile } from "@/lib/auth";
import DesktopView from "./_ui/DesktopView";

type Tile = {
  title: string;
  href: string;
  color: string;
  icon: string;
  desc?: string;
};

export default function StaffPersonalHubPage() {
  const [ready, setReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    let alive = true;

    async function run() {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!alive) return;

      setIsAuthed(!!user);

      if (!user) {
        setIsStaff(false);
        return;
      }

      const profile = await getMyProfile();
      if (!alive) return;

      setIsStaff(profile?.role === "staff");
    }

    run();
    const { data: sub } = supabase.auth.onAuthStateChange(() => run());
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const tiles: Tile[] = useMemo(
    () => [
      {
        title: "Objednávka (pokladna)",
        href: "/staff/objednavka",
        color: "bg-[#16a34a]",
        icon: "🧾",
        desc: "Nová objednávka na pokladně",
      },
      {
        title: "Online objednávky",
        href: "/staff/online",
        color: "bg-[#047857]",
        icon: "🛒",
        desc: "Přehled online objednávek",
      },
      {
        title: "Seznam zákazníků",
        href: "/staff/seznam-zakazniku",
        color: "bg-[#dc2626]",
        icon: "👥",
        desc: "Kontakty a kredit",
      },
      {
        title: "Správa menu",
        href: "/staff/sprava-menu",
        color: "bg-[#9333ea]",
        icon: "📅",
        desc: "Dny, jídla a pořadí",
      },
      {
        title: "Reporty",
        href: "/staff/reporty",
        color: "bg-[#475569]",
        icon: "📊",
        desc: "Dnes, včera, měsíce",
      },
      {
        title: "Administrace",
        href: "/staff/admin",
        color: "bg-[#2563eb]",
        icon: "🛠️",
        desc: "Nastavení systému",
      },
    ],
    []
  );

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-[#f7f8f6]">
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">Personální rozcestník</h1>
          <div className="mt-1 text-sm font-semibold text-gray-500">Administrace jídelny</div>
        </div>

        {!isAuthed && (
          <div className="mt-6 rounded-[28px] bg-white ring-1 ring-black/10 p-6">
            <div className="text-base font-extrabold text-gray-900">Nejste přihlášený</div>
            <div className="mt-1 text-sm font-semibold text-gray-600">
              Přihlašte se, aby se zobrazily staff nástroje.
            </div>
          </div>
        )}

        {isAuthed && !isStaff && (
          <div className="mt-6 rounded-[28px] bg-white ring-1 ring-black/10 p-6">
            <div className="text-base font-extrabold text-gray-900">Nemáte oprávnění</div>
            <div className="mt-1 text-sm font-semibold text-gray-600">
              Tato část je jen pro personál.
            </div>
          </div>
        )}

        {isAuthed && isStaff && <DesktopView tiles={tiles} />}
      </div>
    </div>
  );
}