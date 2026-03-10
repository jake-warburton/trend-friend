"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { TrendHistoryPoint } from "@/lib/types";

type TrendScoreChartProps = {
  history: TrendHistoryPoint[];
  currentScore: number;
};

export function TrendScoreChart({ history, currentScore }: TrendScoreChartProps) {
  if (history.length === 0) {
    return <p className="chart-empty">No historical data yet. Scores will appear after multiple pipeline runs.</p>;
  }

  const data = history.map((point) => ({
    date: formatShortDate(point.capturedAt),
    score: point.scoreTotal,
    rank: point.rank,
  }));

  const maxScore = Math.max(...data.map((d) => d.score), currentScore);

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
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4d" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#8892b0", fontSize: 11 }}
            axisLine={{ stroke: "#1e2d4d" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, Math.ceil(maxScore * 1.1)]}
            tick={{ fill: "#8892b0", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: "#0d1b2a",
              border: "1px solid #1e2d4d",
              borderRadius: 8,
              color: "#e0e6f0",
              fontSize: 12,
            }}
            formatter={(value, name) => {
              if (name === "score") return [Number(value).toFixed(1), "Score"];
              return [String(value), String(name)];
            }}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#5e6bff"
            strokeWidth={2}
            fill="url(#scoreGradient)"
            dot={{ fill: "#5e6bff", r: 3 }}
            activeDot={{ r: 5, fill: "#7e8aff" }}
          />
        </AreaChart>
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
