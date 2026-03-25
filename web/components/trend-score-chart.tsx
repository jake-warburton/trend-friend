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
import type { TrendHistoryGranularity } from "@/lib/trend-history";

const CHART_AXIS_COLOR = "var(--chart-axis)";
const CHART_GRID_COLOR = "var(--chart-grid)";

type TrendScoreChartProps = {
  history: TrendHistoryPoint[];
  currentScore: number;
  bucketGranularity?: TrendHistoryGranularity;
  forecast?: TrendForecast | null;
};

type TrendScoreChartDatum = {
  axisLabel: string;
  axisValue: string;
  date: string;
  score: number | null;
  forecast: number | null;
  rank: number | null;
  isProjected: boolean;
};

export function buildTrendScoreChartData(
  history: TrendHistoryPoint[],
  bucketGranularity: TrendHistoryGranularity = "day",
  forecast?: TrendForecast | null,
): TrendScoreChartDatum[] {
  const data: TrendScoreChartDatum[] = history.map((point) => ({
    axisLabel: buildAxisLabel(point.capturedAt, bucketGranularity),
    axisValue: point.capturedAt,
    date: formatTooltipDate(point.capturedAt, bucketGranularity),
    score: point.scoreTotal,
    forecast: point.scoreTotal,
    rank: point.rank,
    isProjected: false,
  }));

  if (!forecast || forecast.predictedScores.length === 0 || data.length === 0) {
    return data;
  }

  forecast.predictedScores.forEach((score, index) => {
    data.push({
      axisLabel: `Run +${index + 1}`,
      axisValue: `forecast-${index + 1}`,
      date: `Run +${index + 1}`,
      score: null,
      forecast: score,
      rank: null,
      isProjected: true,
    });
  });

  return data;
}

export function TrendScoreChart({
  history,
  currentScore,
  bucketGranularity = "day",
  forecast,
}: TrendScoreChartProps) {
  if (history.length === 0) {
    return <p className="chart-empty">No historical data yet. Scores will appear after multiple pipeline runs.</p>;
  }

  const data = buildTrendScoreChartData(history, bucketGranularity, forecast);
  const ticks = buildAxisTicks(data);
  const tickLabels = new Map(data.map((datum) => [datum.axisValue, datum.axisLabel]));
  const axisLayout = buildAxisLayout(ticks.length);
  const maxScore = Math.max(
    ...data.flatMap((datum) => [datum.score ?? 0, datum.forecast ?? 0]),
    currentScore,
  );

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={axisLayout.chartHeight}>
        <AreaChart
          data={data}
          margin={{ top: 8, right: 12, bottom: axisLayout.bottomMargin, left: 0 }}
        >
          <defs>
            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#5e6bff" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#5e6bff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
          <XAxis
            dataKey="axisValue"
            ticks={ticks}
            interval={0}
            tickFormatter={(value) => tickLabels.get(String(value)) ?? ""}
            tick={{
              fill: CHART_AXIS_COLOR,
              fontSize: 11,
              fontWeight: 500,
              angle: axisLayout.tickAngle,
              textAnchor: axisLayout.tickTextAnchor,
            }}
            axisLine={{ stroke: CHART_GRID_COLOR }}
            tickLine={false}
            minTickGap={axisLayout.minTickGap}
            tickMargin={axisLayout.tickMargin}
            height={axisLayout.axisHeight}
          />
          <YAxis
            domain={[0, Math.ceil(maxScore * 1.1)]}
            tick={{ fill: CHART_AXIS_COLOR, fontSize: 11, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            cursor={{ stroke: "var(--accent)", strokeWidth: 1, strokeOpacity: 0.3 }}
            contentStyle={{
              background: "var(--surface-tooltip)",
              border: "1px solid var(--border-strong)",
              borderRadius: 8,
              color: "var(--copy)",
              fontSize: 12,
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
              padding: "8px 12px",
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
            labelFormatter={(_label, payload) => payload?.[0]?.payload?.date ?? ""}
            formatter={(value, name, item) => {
              if (name === "score") return [Number(value).toFixed(1), "Score"];
              if (name === "forecast") {
                if (!item.payload.isProjected) {
                  return null;
                }
                return [Number(value).toFixed(1), "Forecast (projected)"];
              }
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

export function buildAxisLayout(tickCount: number) {
  const shouldRotate = tickCount >= 9;

  return {
    chartHeight: shouldRotate ? 290 : 260,
    bottomMargin: shouldRotate ? 22 : 0,
    axisHeight: shouldRotate ? 48 : 30,
    tickAngle: shouldRotate ? -35 : 0,
    tickTextAnchor: shouldRotate ? "end" : "middle",
    tickMargin: shouldRotate ? 10 : 6,
    minTickGap: shouldRotate ? 4 : 12,
  } as const;
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

function formatMonthLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatYearLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
  }).format(new Date(value));
}

function formatTooltipDate(
  value: string,
  granularity: TrendHistoryGranularity,
) {
  if (granularity === "day") {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  }

  if (granularity === "week") {
    const start = new Date(value);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    return `${new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(start)} to ${new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(end)}`;
  }

  if (granularity === "month") {
    return formatMonthLabel(value);
  }

  return formatYearLabel(value);
}

function buildAxisLabel(
  value: string,
  granularity: TrendHistoryGranularity,
) {
  if (granularity === "month") {
    return formatMonthLabel(value);
  }

  if (granularity === "year") {
    return formatYearLabel(value);
  }

  return formatShortDate(value);
}

function buildAxisTicks(data: TrendScoreChartDatum[]) {
  const dateTicks = data.filter((datum) => !datum.isProjected);

  if (dateTicks.length <= 14) {
    return dateTicks.map((datum) => datum.axisValue);
  }

  const maxTicks = 14;
  const sampledTicks: string[] = [];
  for (let index = 0; index < maxTicks; index += 1) {
    const sourceIndex = Math.round((index * (dateTicks.length - 1)) / (maxTicks - 1));
    const tick = dateTicks[sourceIndex]?.axisValue;
    if (tick && sampledTicks[sampledTicks.length - 1] !== tick) {
      sampledTicks.push(tick);
    }
  }

  return sampledTicks;
}
