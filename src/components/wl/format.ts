import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/wl/access";

export function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function priorityLabel(p: string) {
  return PRIORITY_LABELS[p] ?? p;
}

export function statusLabel(s: string) {
  return STATUS_LABELS[s] ?? s;
}

export function priorityVariant(p: string) {
  if (p === "urgent" || p === "high") return "danger" as const;
  if (p === "normal") return "primary" as const;
  return "default" as const;
}

export function statusVariant(s: string) {
  if (s === "pending" || s === "open" || s === "upcoming") return "accent" as const;
  if (s === "executed" || s === "done" || s === "approved" || s === "received") return "success" as const;
  if (s === "rejected" || s === "failed" || s === "cancelled") return "danger" as const;
  return "default" as const;
}
