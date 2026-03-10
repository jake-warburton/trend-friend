"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";

type SparklineProps = {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
};

export function Sparkline({ data, color = "#5e6bff", width = 80, height = 24 }: SparklineProps) {
  if (data.length < 2) {
    return <span className="sparkline-empty">--</span>;
  }

  const chartData = data.map((value, index) => ({ v: value, i: index }));

  return (
    <div className="sparkline-wrap" style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
