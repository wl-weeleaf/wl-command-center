const TZ = "Europe/Copenhagen";

const weekdayDa = [
  "søndag",
  "mandag",
  "tirsdag",
  "onsdag",
  "torsdag",
  "fredag",
  "lørdag",
];

function parts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") bag[p.type] = p.value;
  }
  const isoDate = `${bag.year}-${bag.month}-${bag.day}`;
  const jsDate = new Date(`${isoDate}T12:00:00`);
  const weekdayIndex = jsDate.getUTCDay();
  return {
    year: bag.year,
    month: bag.month,
    day: bag.day,
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    isoDate,
    weekdayIndex,
    weekday: weekdayDa[weekdayIndex] ?? "",
  };
}

export function copenhagenNow() {
  return parts();
}

export function todayLabelDa(date = new Date()) {
  const p = parts(date);
  const long = new Intl.DateTimeFormat("da-DK", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  return { label: long, isoDate: p.isoDate, weekday: p.weekday, hour: p.hour };
}

export function greetingWord(hour: number) {
  if (hour < 5) return "Godnat";
  if (hour < 10) return "Godmorgen";
  if (hour < 17) return "Goddag";
  return "Godaften";
}

export function isoWeekKey(date = new Date()) {
  const p = parts(date);
  const d = new Date(`${p.isoDate}T12:00:00Z`);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function addDaysIso(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function toIso(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const s = String(value);
  return s || null;
}

export function toDateOnly(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  if (!s) return null;
  return s.slice(0, 10);
}
