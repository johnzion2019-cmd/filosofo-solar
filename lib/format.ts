export function formatPowerParts(
  watts: number,
  preferKw = false,
): { value: string; unit: "W" | "kW" } {
  const magnitude = Math.abs(watts);
  if (magnitude >= 1000 || (preferKw && magnitude === 0)) {
    const kw = watts / 1000;
    return { value: magnitude >= 1000 ? kw.toFixed(2) : "0", unit: "kW" };
  }
  return { value: String(Math.round(watts)), unit: "W" };
}

export function formatPower(watts: number, preferKw = false): string {
  const parts = formatPowerParts(watts, preferKw);
  return `${parts.value} ${parts.unit}`;
}

export function formatKwh(value: number): string {
  if (!Number.isFinite(value)) return "0.00";
  return value.toFixed(2);
}

export function formatKwh1(value: number): string {
  if (!Number.isFinite(value)) return "0.0";
  return value.toFixed(1);
}

export function formatPeso(value: number): string {
  const amount = Number.isFinite(value) ? value : 0;
  return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatKw(watts: number): string {
  return `${(watts / 1000).toFixed(2)} kW`;
}

export function formatAgo(from: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - from) / 1000));
  if (seconds < 20) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes === 1 ? "1 min ago" : `${minutes} mins ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

export function formatNumber(value: number, digits: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

export function sourceLabel(source: "demo" | "deye" | "bridge"): string {
  if (source === "deye") return "Deye Cloud Live";
  if (source === "bridge") return "Local Bridge";
  return "Demo";
}
