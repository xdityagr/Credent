"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usd } from "@/lib/format";

/** The borrower's private daily revenue (owner-only, rendered inside an open envelope). */
export function RevenueChart({ daily, start }: { daily: number[]; start: number }) {
  const data = daily.map((v, i) => ({ day: start + i, v }));
  return (
    <div className="h-[180px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap={1}>
          <XAxis dataKey="day" hide />
          <YAxis
            width={56}
            tick={{ fill: "#7d889b", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => usd(v, "compact")}
          />
          <Tooltip
            cursor={{ fill: "#dde4f1" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="rounded-[4px] border border-rule bg-sheet px-3 py-1.5 text-[13px] tabular-nums shadow-sm">
                  Day {(payload[0].payload as { day: number }).day}: {usd(payload[0].value as number)}
                </div>
              ) : null
            }
          />
          <Bar dataKey="v" fill="#3e5c9a" radius={[2, 2, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
