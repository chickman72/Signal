"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type GapDatum = {
  topic: string;
  count: number;
};

type GapChartProps = {
  data: GapDatum[];
};

export default function GapChart({ data }: GapChartProps) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barSize={28} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
          <XAxis dataKey="topic" tick={{ fill: "#94a3b8", fontSize: 12 }} />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
          <Tooltip
            cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
            contentStyle={{
              background: "rgba(15, 23, 42, 0.9)",
              border: "1px solid rgba(148, 163, 184, 0.2)",
              borderRadius: "12px",
            }}
            labelStyle={{ color: "#e2e8f0" }}
            itemStyle={{ color: "#f8fafc" }}
          />
          <Bar dataKey="count" fill="#fb7185" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
