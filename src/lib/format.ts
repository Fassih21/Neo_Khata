export function formatRs(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  const neg = n < 0;
  const abs = Math.abs(n);
  const s = Number.isInteger(abs)
    ? abs.toLocaleString("en-US")
    : abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${neg ? "-" : ""}Rs ${s}`;
}

/** 03xx..., +923xx..., 923xx..., 3xx... -> 923xxxxxxxxx. Returns null if not a valid PK mobile. */
export function normalizePkPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let d = input.replace(/\D/g, "");
  if (d.startsWith("0092")) d = d.slice(2);
  else if (d.startsWith("0")) d = "92" + d.slice(1);
  else if (d.startsWith("3") && d.length === 10) d = "92" + d;
  return /^923\d{9}$/.test(d) ? d : null;
}

export function waLink(phone: string, message: string): string | null {
  const n = normalizePkPhone(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(message)}` : null;
}

export function fillTemplate(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export const todayISO = () => {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

/** "2026-11" for a Date */
export const monthKey = (d = new Date()) =>
  `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}`;

/** "2026-11" -> "2026-11-01" */
export const monthStart = (key: string) => `${key}-01`;

export function monthLabel(key: string, short = false) {
  const [y = 0, m = 1] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", {
    month: short ? "short" : "long",
    year: short ? undefined : "numeric",
  });
}

export function monthOptions(count = 24): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = monthKey(d);
    out.push({ value: k, label: monthLabel(k) });
  }
  return out;
}

/** first day of the next month as ISO date, for range queries */
export function nextMonthStart(key: string) {
  const [y = 0, m = 1] = key.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${monthKey(d)}-01`;
}

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export const num = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v));
