export function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDateTime(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function unique<T>(items: T[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

export function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, "").toLowerCase();
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
