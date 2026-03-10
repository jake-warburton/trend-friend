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

  // Build chart data: one row per date, one key per trend
  const data = dates.map((date) => {
    const row: Record<string, string | number> = { date: formatShortDate(date) };
    for (const trend of topTrends) {
      const point = trend.history.find((p) => p.capturedAt.slice(0, 10) === date);
      if (point) {
        row[trend.name] = point.scoreTotal;
      }
    }
    return row;
  });

  const maxScore = Math.max(
    ...topTrends.flatMap((t) => t.history.map((p) => p.scoreTotal)),
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
            formatter={(value) => [Number(value).toFixed(1), "Score"]}
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
