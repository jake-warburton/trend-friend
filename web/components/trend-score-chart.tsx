"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { TrendForecast, TrendHistoryPoint } from "@/lib/types";
import { formatForecastConfidence } from "@/lib/forecast-ui";

type TrendScoreChartProps = {
  history: TrendHistoryPoint[];
  currentScore: number;
  forecast?: TrendForecast | null;
};

type TrendScoreChartDatum = {
  date: string;
  score: number | null;
  forecast: number | null;
  rank: number | null;
};

export function buildTrendScoreChartData(
  history: TrendHistoryPoint[],
  forecast?: TrendForecast | null,
): TrendScoreChartDatum[] {
  const data: TrendScoreChartDatum[] = history.map((point) => ({
    date: formatShortDate(point.capturedAt),
    score: point.scoreTotal,
    forecast: null,
    rank: point.rank,
  }));

  if (!forecast || forecast.predictedScores.length === 0 || data.length === 0) {
    return data;
  }

  // Include the last two actual points in the forecast series so the
  // monotone spline has enough slope context to smoothly continue
  // the trajectory of the real line into the forecast.
  const tailCount = Math.min(3, data.length);
  for (let i = data.length - tailCount; i < data.length; i++) {
    data[i].forecast = data[i].score;
  }

  forecast.predictedScores.forEach((score, index) => {
    data.push({
      date: `Run +${index + 1}`,
      score: null,
      forecast: score,
      rank: null,
    });
  });

  return data;
}

export function TrendScoreChart({ history, currentScore, forecast }: TrendScoreChartProps) {
  if (history.length === 0) {
    return <p className="chart-empty">No historical data yet. Scores will appear after multiple pipeline runs.</p>;
  }

  const data = buildTrendScoreChartData(history, forecast);
  const maxScore = Math.max(
    ...data.flatMap((datum) => [datum.score ?? 0, datum.forecast ?? 0]),
    currentScore,
  );

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#5e6bff" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#5e6bff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2838" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#7a8494", fontSize: 11 }}
            axisLine={{ stroke: "#1e2838" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, Math.ceil(maxScore * 1.1)]}
            tick={{ fill: "#7a8494", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface-tooltip)",
              border: "1px solid var(--border-strong)",
              borderRadius: 8,
              color: "var(--copy)",
              fontSize: 12,
            }}
            formatter={(value, name) => {
              if (name === "score") return [Number(value).toFixed(1), "Score"];
              if (name === "forecast") return [Number(value).toFixed(1), "Forecast (projected)"];
              return [String(value), String(name)];
            }}
          />
          {forecast && forecast.predictedScores.length > 0 ? (
            <Line
              type="monotone"
              dataKey="forecast"
              stroke={forecastLineColor(forecast.confidence)}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
            />
          ) : null}
          <Area
            type="monotone"
            dataKey="score"
            stroke="#5e6bff"
            strokeWidth={2}
            fill="url(#scoreGradient)"
            dot={{ fill: "#5e6bff", r: 3 }}
            activeDot={{ r: 5, fill: "#7e8aff" }}
          />
          {forecast && forecast.predictedScores.length > 0 ? (
            <Line
              type="monotone"
              dataKey="score"
              stroke="#5e6bff"
              strokeWidth={3}
              dot={false}
              activeDot={false}
              connectNulls={false}
              legendType="none"
              tooltipType="none"
            />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
      {forecast && forecast.predictedScores.length > 0 ? (
        <p className={`forecast-note forecast-note-${forecast.confidence}`}>
          Dashed line shows a {formatForecastConfidence(forecast.confidence).toLowerCase()}-confidence{" "}
          projection using {forecast.method === "holt" ? "Holt trend" : "SES smoothing"}.
        </p>
      ) : null}
    </div>
  );
}

function forecastLineColor(confidence: string) {
  if (confidence === "high") {
    return "#3ddc97";
  }
  if (confidence === "medium") {
    return "#ffbf69";
  }
  return "#7c8aa5";
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}
