"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { price, usd } from "@/lib/format";
import type { NavPoint } from "@/lib/types";

const SENIOR = "#2f55a4";
const JUNIOR = "#2e8a5f";

/** Share price of each tranche, indexed to 1.0000 at launch (one shared axis, same unit). */
export function NavChart({ points }: { points: NavPoint[] }) {
  const [table, setTable] = useState(false);
  const data = points.map((p) => ({
    day: p.day,
    senior: p.senior_price_e6 / 1_000_000,
    junior: p.junior_price_e6 / 1_000_000,
    raw: p,
  }));
  const last = points.at(-1);

  if (points.length === 0) {
    return <p className="text-[15px] text-ink-faint">Tranche prices appear after the first weekly settlement.</p>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[14px]">
        <Legend color={SENIOR} label="Senior" value={last ? price(last.senior_price_e6) : ""} />
        <Legend color={JUNIOR} label="Junior" value={last ? price(last.junior_price_e6) : ""} />
        <button onClick={() => setTable(!table)} className="ml-auto font-semibold text-ink-soft hover:text-ink">
          {table ? "Show chart" : "Show table"}
        </button>
      </div>
      {table ? (
        <div className="max-h-[260px] overflow-auto rounded-[4px] border border-rule">
          <table className="w-full text-[14px] tabular-nums">
            <thead className="sticky top-0 bg-paper-deep text-left text-ink-soft">
              <tr>
                <th className="px-3 py-2 font-semibold">Day</th>
                <th className="px-3 py-2 font-semibold">Senior price</th>
                <th className="px-3 py-2 font-semibold">Junior price</th>
                <th className="px-3 py-2 font-semibold">Senior NAV</th>
                <th className="px-3 py-2 font-semibold">Junior NAV</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.day} className="border-t border-rule">
                  <td className="px-3 py-1.5">{p.day}</td>
                  <td className="px-3 py-1.5">{price(p.senior_price_e6)}</td>
                  <td className="px-3 py-1.5">{price(p.junior_price_e6)}</td>
                  <td className="px-3 py-1.5">{usd(p.senior_nav)}</td>
                  <td className="px-3 py-1.5">{usd(p.junior_nav)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="#c9d3c6" strokeOpacity={0.6} vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fill: "#7d889b", fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "#9fae9c" }}
                tickFormatter={(d) => `d${d}`}
              />
              <YAxis
                tick={{ fill: "#7d889b", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={52}
                domain={["auto", "auto"]}
                tickFormatter={(v: number) => v.toFixed(3)}
              />
              <Tooltip
                cursor={{ stroke: "#7d889b", strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = (payload[0].payload as { raw: NavPoint }).raw;
                  return (
                    <div className="rounded-[4px] border border-rule bg-sheet px-3 py-2 text-[13px] shadow-sm tabular-nums">
                      <div className="mb-1 font-semibold text-ink">Day {p.day}</div>
                      <div className="flex items-center gap-2 text-ink">
                        <Swatch color={SENIOR} /> Senior {price(p.senior_price_e6)}
                        <span className="text-ink-faint">NAV {usd(p.senior_nav, "compact")}</span>
                      </div>
                      <div className="flex items-center gap-2 text-ink">
                        <Swatch color={JUNIOR} /> Junior {price(p.junior_price_e6)}
                        <span className="text-ink-faint">NAV {usd(p.junior_nav, "compact")}</span>
                      </div>
                    </div>
                  );
                }}
              />
              <Line type="linear" dataKey="senior" stroke={SENIOR} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "#f8faf5", strokeWidth: 2 }} isAnimationActive={false} />
              <Line type="linear" dataKey="junior" stroke={JUNIOR} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "#f8faf5", strokeWidth: 2 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function Swatch({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: color }} />;
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <span className="flex items-center gap-2 text-ink">
      <span className="inline-block h-[3px] w-4 rounded-full" style={{ background: color }} />
      <span className="font-semibold">{label}</span>
      <span className="tabular-nums text-ink-soft">{value}</span>
    </span>
  );
}
