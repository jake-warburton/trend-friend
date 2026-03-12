"use client";

import { useEffect, useState } from "react";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { TrendDetailRecord, TrendHistoryResponse } from "@/lib/types";

type TrendTrajectoryChartProps = {
  trends: TrendDetailRecord[];
  history: TrendHistoryResponse;
  limit?: number;
};

const PALETTE = ["#5e6bff", "#00c4ff", "#7fe0a7", "#ffca6e", "#9b8cff"];
const HISTORY_BUCKET_MINUTES = 5;
const CHART_AXIS_COLOR = "var(--chart-axis)";
const CHART_GRID_COLOR = "var(--chart-grid)";
const LEGEND_TEXT_COLOR = "#ffffff";
const LEGEND_HEIGHT = 52;
const MOBILE_BREAKPOINT_PX = 640;
const MAX_HISTORY_POINTS_DESKTOP = 17;
const MAX_HISTORY_POINTS_MOBILE = 8;

type TrajectoryLegendEntry = {
  value?: string;
  color?: string;
};

type ChartTrend = TrendDetailRecord & {
  chartHistory: Array<{ capturedAt: string; scoreTotal: number }>;
};

export function TrendTrajectoryChart({ trends, history, limit = 5 }: TrendTrajectoryChartProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);
    const handleChange = () => setIsMobile(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const historyByTrendId = new Map<string, Array<{ capturedAt: string; scoreTotal: number }>>();

  for (const snapshot of history.snapshots) {
    const bucketedCapturedAt = bucketSnapshotTimestamp(snapshot.capturedAt);
    for (const trend of snapshot.trends) {
      const points = historyByTrendId.get(trend.id) ?? [];
      const existingPoint = points.find((point) => point.capturedAt === bucketedCapturedAt);
      if (existingPoint) {
        existingPoint.scoreTotal = trend.score.total;
      } else {
        points.push({
          capturedAt: bucketedCapturedAt,
          scoreTotal: trend.score.total,
        });
      }
      historyByTrendId.set(trend.id, points);
    }
  }

  const topTrends: ChartTrend[] = trends
    .map((trend) => ({
      ...trend,
      chartHistory: historyByTrendId.get(trend.id) ?? [],
    }))
    .filter((t) => t.chartHistory.length >= 2)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit);

  if (topTrends.length === 0) {
    return <p className="chart-empty">Not enough history to chart trajectories yet.</p>;
  }

  // Collect all unique snapshot timestamps across all trends
  const timestampSet = new Set<string>();
  for (const trend of topTrends) {
    for (const point of trend.chartHistory) {
      timestampSet.add(point.capturedAt);
    }
  }
  const timestamps = [...timestampSet].sort();
  const maxHistoryPoints = isMobile ? MAX_HISTORY_POINTS_MOBILE : MAX_HISTORY_POINTS_DESKTOP;
  const visibleTimestamps = timestamps.slice(-maxHistoryPoints);
  const sameDayHistory = new Set(visibleTimestamps.map((timestamp) => timestamp.slice(0, 10))).size === 1;

  // Determine the maximum number of forecast points across all trends
  let maxForecastLen = 0;
  for (const trend of topTrends) {
    if (trend.forecast && trend.forecast.predictedScores.length > 0) {
      maxForecastLen = Math.max(maxForecastLen, trend.forecast.predictedScores.length);
    }
  }

  // Build chart data: one row per snapshot timestamp, one key per trend
  const data: Record<string, string | number | undefined>[] = visibleTimestamps.map((timestamp) => {
    const row: Record<string, string | number | undefined> = {
      date: formatSnapshotLabel(timestamp, sameDayHistory),
    };
    for (const trend of topTrends) {
      const point = trend.chartHistory.find((p) => p.capturedAt === timestamp);
      if (point) {
        row[trend.name] = point.scoreTotal;
      }
    }
    return row;
  });

  // For each trend with a forecast, set the last actual point on the forecast
  // series so the dashed line connects seamlessly to the solid line
  if (maxForecastLen > 0 && data.length > 0) {
    const lastRow = data[data.length - 1];
    for (const trend of topTrends) {
      if (trend.forecast && trend.forecast.predictedScores.length > 0) {
        const forecastKey = `${trend.name} forecast`;
        const lastScore = lastRow[trend.name];
        if (lastScore !== undefined) {
          lastRow[forecastKey] = lastScore;
        }
      }
    }

    // Append forecast rows
    for (let i = 0; i < maxForecastLen; i++) {
      const row: Record<string, string | number | undefined> = { date: `Run +${i + 1}` };
      for (const trend of topTrends) {
        if (
          trend.forecast &&
          trend.forecast.predictedScores.length > i
        ) {
          const forecastKey = `${trend.name} forecast`;
          row[forecastKey] = trend.forecast.predictedScores[i];
        }
      }
      data.push(row);
    }
  }

  // Determine which trends have forecasts for rendering
  const trendsWithForecast = topTrends.filter(
    (t) => t.forecast && t.forecast.predictedScores.length > 0,
  );

  const maxScore = Math.max(
    ...topTrends.flatMap((t) => t.chartHistory.map((p) => p.scoreTotal)),
    ...topTrends.flatMap((t) =>
      t.forecast ? t.forecast.predictedScores : [],
    ),
    1,
  );
  const tickInterval = isMobile ? Math.max(1, Math.floor(data.length / 4)) : "preserveStartEnd";

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 12, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
          <XAxis
            dataKey="date"
            interval={tickInterval}
            minTickGap={isMobile ? 28 : 12}
            tick={{ fill: CHART_AXIS_COLOR, fontSize: 11, fontWeight: 500 }}
            axisLine={{ stroke: CHART_GRID_COLOR }}
            tickLine={false}
          />
          <YAxis
            domain={[0, Math.ceil(maxScore * 1.1)]}
            tick={{ fill: CHART_AXIS_COLOR, fontSize: 11, fontWeight: 500 }}
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
              const label = String(name);
              if (label.endsWith(" forecast")) {
                return [Number(value).toFixed(1), `${label.replace(/ forecast$/, "")} (forecast)`];
              }
              return [Number(value).toFixed(1), label];
            }}
            labelFormatter={(label) => String(label)}
          />
          <Legend
            verticalAlign="bottom"
            height={LEGEND_HEIGHT}
            content={<TrajectoryLegend />}
          />
          {topTrends.map((trend, i) => (
            <Line
              key={trend.id}
              type="monotone"
              dataKey={trend.name}
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth={2}
              dot={{ fill: PALETTE[i % PALETTE.length], r: 2.5 }}
              activeDot={{ r: 4 }}
              connectNulls
            />
          ))}
          {trendsWithForecast.map((trend) => {
            const colorIndex = topTrends.indexOf(trend);
            const color = PALETTE[colorIndex % PALETTE.length];
            return (
              <Line
                key={`${trend.id}-forecast`}
                type="monotone"
                dataKey={`${trend.name} forecast`}
                stroke={color}
                strokeWidth={1.5}
                strokeDasharray="6 4"
                dot={false}
                activeDot={{ r: 3 }}
                connectNulls
                legendType="none"
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrajectoryLegend({ payload }: { payload?: TrajectoryLegendEntry[] }) {
  if (!payload || payload.length === 0) {
    return null;
  }

  const visibleEntries = payload.filter((entry) => {
    const label = entry.value;
    return typeof label === "string" && !label.endsWith(" forecast");
  });

  if (visibleEntries.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "6px",
        paddingTop: "8px",
      }}
    >
      {visibleEntries.map((entry) => {
        const label = entry.value;
        if (!label) {
          return null;
        }

        return (
          <span
            key={String(label)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "4px 8px",
              borderRadius: "999px",
              background: typeof entry.color === "string" ? entry.color : "var(--accent)",
              color: LEGEND_TEXT_COLOR,
              fontSize: "11px",
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}

function formatSnapshotLabel(value: string, sameDayHistory: boolean) {
  const date = new Date(value);
  if (sameDayHistory) {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function bucketSnapshotTimestamp(value: string) {
  const date = new Date(value);
  date.setSeconds(0, 0);
  const roundedMinutes = Math.floor(date.getMinutes() / HISTORY_BUCKET_MINUTES) * HISTORY_BUCKET_MINUTES;
  date.setMinutes(roundedMinutes);
  return date.toISOString();
}
