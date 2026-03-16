import { supabase } from "./supabase";

export type Profile = {
  id: string;
  role: "customer" | "staff";
  full_name: string | null;
  phone: string | null;
  address: string | null;
  email: string | null;
  kredit: number | null;
  terms_accepted: boolean | null;
};

export function isStaffLike(p: Profile | null | undefined) {
  return p?.role === "staff";
}

function toRole(x: any): "customer" | "staff" {
  return x === "staff" ? "staff" : "customer";
}

function digitsOnly(s: string) {
  return String(s ?? "").replace(/\D/g, "");
}

export async function getMyProfile(): Promise<Profile | null> {
  const { data: session } = await supabase.auth.getSession();
  const user = session.session?.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, phone, address, email, kredit, terms_accepted")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;

  const p = data as Profile;
  const authEmail = user.email ?? null;

  if (!p.email && authEmail) {
    p.email = authEmail;
    supabase.from("profiles").update({ email: authEmail }).eq("id", user.id);
  }

  return p;
}

export async function ensureMyProfile(): Promise<Profile | null> {
  const { data: session } = await supabase.auth.getSession();
  const user = session.session?.user;
  if (!user) return null;

  const existing = await getMyProfile();
  if (existing) return existing;

  const md = (user.user_metadata ?? {}) as any;

  const newProfile: Profile = {
    id: user.id,
    role: toRole(md.role),
    full_name: typeof md.full_name === "string" ? md.full_name.trim() : null,
    phone: md.phone ? digitsOnly(md.phone) : null,
    address: typeof md.address === "string" ? md.address.trim() : null,
    email: user.email ?? null,
    kredit: 0,
    terms_accepted: Boolean(md.terms_accepted ?? false),
  };

  const { error: upsertError } = await supabase
    .from("profiles")
    .upsert(newProfile, { onConflict: "id" });

  if (upsertError) {
    console.log("ensureMyProfile upsert error:", upsertError);
    return null;
  }

  return await getMyProfile();
}