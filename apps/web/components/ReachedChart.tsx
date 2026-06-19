"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DailyReached } from "@/lib/types";

export function ReachedChart({ data }: { data: DailyReached[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="reached" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B5BDB" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#3B5BDB" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => d.slice(5)}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={40} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #E3E8F0", fontSize: 12 }}
          labelStyle={{ color: "#141B28" }}
        />
        <Area type="monotone" dataKey="reached" stroke="#3B5BDB" strokeWidth={2} fill="url(#reached)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
