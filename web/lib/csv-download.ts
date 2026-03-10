/**
 * Client-side CSV download helpers.
 * Separated from lib/trends.ts which uses node:fs and cannot be imported in client components.
 */

export function downloadTrendsCsv(): void {
  const link = document.createElement("a");
  link.href = "/api/export";
  link.download = "";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function downloadWatchlistCsv(watchlistId: number): void {
  const link = document.createElement("a");
  link.href = `/api/export/watchlist?id=${watchlistId}`;
  link.download = "";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
