const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

export const formatDate = (iso: string) => dateFmt.format(new Date(iso));
export const formatTime = (iso: string) => timeFmt.format(new Date(iso));
export const formatDateTime = (iso: string) => `${formatDate(iso)}, ${formatTime(iso)}`;
export const formatDay = (iso: string) => dayFmt.format(new Date(iso));

/** "YYYY-MM-DD" due dates are calendar dates, not instants — format without timezone shifts. */
export const formatDueDate = (ymd: string) => dateFmt.format(new Date(`${ymd}T12:00:00`));

/** Local calendar day key for grouping, e.g. "2026-10-17". */
export function localDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** ISO instant -> value for <input type="datetime-local"> (local time, minute precision). */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value (local time) -> ISO instant. */
export const fromLocalInput = (value: string) => new Date(value).toISOString();

export function isOverdue(ymd: string | null, done: boolean): boolean {
  if (!ymd || done) return false;
  return ymd < localDayKey(new Date().toISOString());
}

export function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDate(iso);
}
