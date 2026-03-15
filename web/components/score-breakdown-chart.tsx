"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { TrendScore } from "@/lib/types";

type ScoreBreakdownChartProps = {
  score: TrendScore;
};

const COMPONENT_COLORS: Record<string, string> = {
  Social: "#5e6bff",
  Developer: "#00c4ff",
  Knowledge: "#7fe0a7",
  Search: "#ffca6e",
  Diversity: "#9b8cff",
};
const CHART_AXIS_COLOR = "var(--chart-axis)";

export function ScoreBreakdownChart({ score }: ScoreBreakdownChartProps) {
  const data = [
    { label: "Social", value: score.social },
    { label: "Developer", value: score.developer },
    { label: "Knowledge", value: score.knowledge },
    { label: "Search", value: score.search },
    { label: "Advertising", value: score.advertising ?? 0 },
    { label: "Diversity", value: score.diversity },
  ].filter((item) => item.value > 0);

  if (data.length === 0) {
    return <p className="chart-empty">No component scores available.</p>;
  }

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 60 }}>
          <XAxis
            type="number"
            tick={{ fill: CHART_AXIS_COLOR, fontSize: 11, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fill: CHART_AXIS_COLOR, fontSize: 12, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            width={70}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-panel-soft)", opacity: 0.6 }}
            contentStyle={{
              background: "var(--surface-tooltip)",
              border: "1px solid var(--border-strong)",
              borderRadius: 8,
              color: "var(--copy)",
              fontSize: 12,
              padding: "8px 12px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            }}
            labelStyle={{
              color: "var(--copy)",
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 2,
            }}
            itemStyle={{
              color: "var(--copy)",
              fontSize: 12,
            }}
            formatter={(value) => [Number(value).toFixed(1), "Score"]}
          />
          <Bar
            dataKey="value"
            radius={[0, 6, 6, 0]}
            barSize={22}
            activeBar={{ opacity: 0.85, filter: "brightness(1.15)" }}
          >
            {data.map((entry) => (
              <Cell key={entry.label} fill={COMPONENT_COLORS[entry.label] ?? "#5e6bff"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
