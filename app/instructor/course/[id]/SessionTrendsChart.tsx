"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type SessionTrendData = {
  period: string;
  sessions: number;
  label: string;
};

type SessionTrendsChartProps = {
  data: {
    today: number;
    last7Days: number;
    last30Days: number;
    last60Days: number;
    last90Days: number;
    last365Days: number;
  };
};

export default function SessionTrendsChart({ data }: SessionTrendsChartProps) {
  const chartData: SessionTrendData[] = [
    { period: "365", sessions: data.last365Days, label: "365 Days" },
    { period: "90", sessions: data.last90Days, label: "90 Days" },
    { period: "60", sessions: data.last60Days, label: "60 Days" },
    { period: "30", sessions: data.last30Days, label: "30 Days" },
    { period: "7", sessions: data.last7Days, label: "7 Days" },
    { period: "0", sessions: data.today, label: "Today" },
  ];

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
          <XAxis
            dataKey="period"
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            tickFormatter={(value) => {
              switch (value) {
                case "0": return "Today";
                case "7": return "7";
                case "30": return "30";
                case "60": return "60";
                case "90": return "90";
                case "365": return "365";
                default: return value;
              }
            }}
            label={{ value: 'Days', position: 'insideBottom', offset: -5, style: { textAnchor: 'middle', fill: '#94a3b8', fontSize: 12 } }}
          />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
          <Tooltip
            cursor={{ stroke: "rgba(148, 163, 184, 0.4)", strokeWidth: 1 }}
            contentStyle={{
              background: "rgba(15, 23, 42, 0.9)",
              border: "1px solid rgba(148, 163, 184, 0.2)",
              borderRadius: "12px",
            }}
            labelStyle={{ color: "#e2e8f0" }}
            itemStyle={{ color: "#f8fafc" }}
            formatter={(value: number | undefined, name: string | undefined) => [
              value !== undefined ? `${value} sessions` : "0 sessions",
              "Sessions"
            ]}
            labelFormatter={(label: string) => {
              switch (label) {
                case "0": return "Today";
                case "7": return "Last 7 Days";
                case "30": return "Last 30 Days";
                case "60": return "Last 60 Days";
                case "90": return "Last 90 Days";
                case "365": return "Last 365 Days";
                default: return label;
              }
            }}
          />
          <Line
            type="monotone"
            dataKey="sessions"
            stroke="#06b6d4"
            strokeWidth={3}
            dot={{ fill: "#06b6d4", strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: "#06b6d4", strokeWidth: 2, fill: "#0f172a" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}