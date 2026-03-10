import type { TrendForecast } from "@/lib/types";

export function getExplorerForecastBadge(
  forecastDirection: string | null | undefined,
): { label: string; tone: "high" | "medium" } | null {
  if (forecastDirection === "accelerating") {
    return {
      label: "Predicted breakout",
      tone: "high",
    };
  }
  if (forecastDirection === "decelerating") {
    return {
      label: "Cooling ahead",
      tone: "medium",
    };
  }
  return null;
}

export function formatForecastConfidence(confidence: string | null | undefined): string {
  if (confidence === "high") {
    return "High";
  }
  if (confidence === "medium") {
    return "Medium";
  }
  return "Low";
}

export function formatForecastMethod(method: string | null | undefined): string {
  if (method === "holt") {
    return "Holt trend";
  }
  if (method === "ses") {
    return "SES smoothing";
  }
  return "Forecast model";
}

export function summarizeForecastWindow(forecast: TrendForecast | null | undefined): string {
  if (!forecast || forecast.predictedScores.length === 0) {
    return "No forecast available";
  }
  return `Next ${forecast.predictedScores.length} runs · ${formatForecastConfidence(forecast.confidence)} confidence · ${formatForecastMethod(forecast.method)}`;
}
