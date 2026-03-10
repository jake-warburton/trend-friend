"use client";

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

import type { TrendDetailRecord } from "@/lib/types";

type TrendTrajectoryChartProps = {
  trends: TrendDetailRecord[];
  limit?: number;
};

const PALETTE = ["#5e6bff", "#00c4ff", "#7fe0a7", "#ffca6e", "#9b8cff"];

export function TrendTrajectoryChart({ trends, limit = 5 }: TrendTrajectoryChartProps) {
  const topTrends = trends
    .filter((t) => t.history.length >= 2)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit);

  if (topTrends.length === 0) {
    return <p className="chart-empty">Not enough history to chart trajectories yet.</p>;
  }

  // Collect all unique dates across all trends
  const dateSet = new Set<string>();
  for (const trend of topTrends) {
    for (const point of trend.history) {
      dateSet.add(point.capturedAt.slice(0, 10));
    }
  }
  const dates = [...dateSet].sort();

  // Determine the maximum number of forecast points across all trends
  let maxForecastLen = 0;
  for (const trend of topTrends) {
    if (trend.forecast && trend.forecast.predictedScores.length > 0) {
      maxForecastLen = Math.max(maxForecastLen, trend.forecast.predictedScores.length);
    }
  }

  // Build chart data: one row per date, one key per trend
  const data: Record<string, string | number | undefined>[] = dates.map((date) => {
    const row: Record<string, string | number | undefined> = { date: formatShortDate(date) };
    for (const trend of topTrends) {
      const point = trend.history.find((p) => p.capturedAt.slice(0, 10) === date);
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
    ...topTrends.flatMap((t) => t.history.map((p) => p.scoreTotal)),
    ...topTrends.flatMap((t) =>
      t.forecast ? t.forecast.predictedScores : [],
    ),
    1,
  );

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
              background: "#0e1420",
              border: "1px solid #1e2838",
              borderRadius: 8,
              color: "#e0e4ea",
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
            wrapperStyle={{ fontSize: 11, color: "#7a8494" }}
            iconType="plainline"
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

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}
