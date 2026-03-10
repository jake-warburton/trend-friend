import type { NotificationLogEntry } from "@/lib/types";

export function summarizeNotificationDelivery(log: NotificationLogEntry | undefined): string {
  if (!log) {
    return "No deliveries yet";
  }
  if (log.error) {
    return `Failed: ${log.error}`;
  }
  if (log.statusCode != null) {
    return `Delivered (${log.statusCode})`;
  }
  return "Attempted";
}

export function maskWebhookDestination(destination: string): string {
  try {
    const url = new URL(destination);
    const tail = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean).at(-1) ?? "";
    return `${url.host}/${tail || "hook"}`;
  } catch {
    return destination;
  }
}
