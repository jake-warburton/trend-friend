export function summarizeSourceYield(source: {
  rawItemCount: number;
  keptItemCount: number;
  yieldRatePercent: number;
}): string {
  if (source.rawItemCount <= 0) {
    return "No raw fetch volume yet";
  }
  return `${source.keptItemCount}/${source.rawItemCount} kept (${formatYieldPercent(source.yieldRatePercent)})`;
}

export function describeSourceYield(source: {
  rawItemCount: number;
  keptItemCount: number;
  yieldRatePercent: number;
}): string {
  if (source.rawItemCount <= 0) {
    return "No raw item volume recorded yet.";
  }
  return `${source.keptItemCount} kept from ${source.rawItemCount} fetched after dedupe and caps.`;
}

function formatYieldPercent(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0%";
  }
  if (Math.abs(value - Math.round(value)) < 0.05) {
    return `${Math.round(value)}%`;
  }
  return `${value.toFixed(1)}%`;
}
