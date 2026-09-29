export function inr(n: number | undefined | null): string {
  const v = Math.round(Number(n ?? 0));
  return "₹" + v.toLocaleString("en-IN");
}

// Returns remaining seconds between now and an ISO end time (can be negative).
export function secondsUntil(iso: string): number {
  return Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
}

export function fmtCountdown(totalSec: number): string {
  const neg = totalSec < 0;
  let s = Math.abs(totalSec);
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  const core = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  return neg ? `-${core}` : core;
}

export function fmtTime(iso?: string | null): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
