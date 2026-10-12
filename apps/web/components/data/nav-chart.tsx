"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { date as fmtDate, price } from "@/lib/format";
import type { NavPoint } from "@/lib/types";

const SENIOR = "#4f7fff";
const JUNIOR = "#1fa97a";

/** Tranche share prices indexed to 1.0000. One axis; legend plus line-end labels. */
export function NavChart({ points, height = 260 }: { points: NavPoint[]; height?: number }) {
  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center rounded-[16px] border border-dashed border-line-strong text-[14px] text-ink-3" style={{ height }}>
        Price history appears after the first weekly settlement
      </div>
    );
  }
  const data = points.map((p) => ({ ...p, s: p.senior_price_e6 / 1e6, j: p.junior_price_e6 / 1e6 }));
  const last = data[data.length - 1];
  return (
    <figure>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-[12.5px] text-ink-2">
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4 rounded-full" style={{ background: SENIOR }} /> Senior <span className="num text-ink">{price(last.senior_price_e6)}</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4 rounded-full" style={{ background: JUNIOR }} /> Junior <span className="num text-ink">{price(last.junior_price_e6)}</span>
        </span>
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="rgb(255 255 255 / 0.06)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => fmtDate(d).replace(/, \d{4}$/, "")}
              tick={{ fill: "#6b6b70", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              domain={["auto", "auto"]}
              tickFormatter={(v: number) => v.toFixed(3)}
              tick={{ fill: "#6b6b70", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip
              cursor={{ stroke: "rgb(255 255 255 / 0.25)", strokeWidth: 1 }}
              contentStyle={{
                background: "rgb(16 16 18 / 0.95)",
                border: "1px solid rgb(255 255 255 / 0.12)",
                borderRadius: 14,
                fontSize: 12,
                color: "#ededed",
              }}
              labelFormatter={(d) => fmtDate(String(d))}
              formatter={(v, name) => [Number(v).toFixed(4), name === "s" ? "Senior" : "Junior"]}
            />
            <Line type="monotone" dataKey="s" stroke={SENIOR} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "#000", strokeWidth: 2 }} />
            <Line type="monotone" dataKey="j" stroke={JUNIOR} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "#000", strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        Senior share price {price(last.senior_price_e6)}, junior share price {price(last.junior_price_e6)}, indexed to 1.0000 at launch.
      </figcaption>
    </figure>
  );
}
