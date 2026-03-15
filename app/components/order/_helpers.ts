export function toISODate(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const dd = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function isSunday(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.getDay() === 0;
}
export function isSaturday(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.getDay() === 6;
}

// Pondělí týdne, ale když je sobota nebo neděle, vrátí pondělí příštího týdne.
export function baseMondayAutoNextWeekend(now: Date) {
  const x = new Date(now);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=ne, 1=po, ..., 6=so

  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(x);
  monday.setDate(monday.getDate() - diffToMonday);

  if (day === 6 || day === 0) monday.setDate(monday.getDate() + 7);
  return monday;
}

export function formatDayLabel(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const wd = new Intl.DateTimeFormat("cs-CZ", { weekday: "short" })
    .format(d)
    .replace(".", "");
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${wd} ${dd}.${mm}.`;
}

export function formatRangeLabel(fromIso: string, toIso: string) {
  const f = new Date(fromIso + "T00:00:00");
  const t = new Date(toIso + "T00:00:00");
  const fWd = new Intl.DateTimeFormat("cs-CZ", { weekday: "short" }).format(f).replace(".", "");
  const tWd = new Intl.DateTimeFormat("cs-CZ", { weekday: "short" }).format(t).replace(".", "");
  const fDd = String(f.getDate()).padStart(2, "0");
  const fMm = String(f.getMonth() + 1).padStart(2, "0");
  const tDd = String(t.getDate()).padStart(2, "0");
  const tMm = String(t.getMonth() + 1).padStart(2, "0");
  return `${fWd} ${fDd}.${fMm}. – ${tWd} ${tDd}.${tMm}.`;
}

export function msUntilNextMidnightLocal() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}