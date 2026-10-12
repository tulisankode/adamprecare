"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { caseTypeColor } from "@/lib/status";
import { formatDateLabel } from "@/lib/format";
import type { CaseTypeCount, DailySeries } from "@/lib/types";

const DONUT_SIZE = 250;
const CHART_HEIGHT = 300;

/** Measures an element's content width and keeps it updated with a ResizeObserver. */
function useElementWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.floor(el.getBoundingClientRect().width));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/* Secondary encoding: the mandated case-type palette is not CVD-safe, so each series also gets its own marker shape. */
type ShapeKind = "circle" | "square" | "triangle" | "diamond" | "cross";
const SHAPES: ShapeKind[] = ["circle", "square", "triangle", "diamond", "cross"];
const SHAPE_BY_CODE: Record<string, ShapeKind> = {
  KECELAKAAN: "circle",
  NYERI_DADA: "square",
  SESAK_NAFAS: "triangle",
  BENCANA_ALAM: "diamond",
  LAINNYA: "cross",
};
function shapeFor(code: string, index: number): ShapeKind {
  return SHAPE_BY_CODE[code] ?? SHAPES[index % SHAPES.length];
}

function Marker({ kind, x, y, r, color, fill = "#fff" }: { kind: ShapeKind; x: number; y: number; r: number; color: string; fill?: string }) {
  const common = { stroke: color, strokeWidth: 2.5, fill };
  switch (kind) {
    case "square":
      return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} rx={1.5} {...common} />;
    case "triangle":
      return <polygon points={`${x},${y - r - 1} ${x + r + 1},${y + r} ${x - r - 1},${y + r}`} {...common} />;
    case "diamond":
      return <polygon points={`${x},${y - r - 1} ${x + r + 1},${y} ${x},${y + r + 1} ${x - r - 1},${y}`} {...common} />;
    case "cross":
      return (
        <g stroke={color} strokeWidth={3} strokeLinecap="round">
          <line x1={x - r} y1={y - r} x2={x + r} y2={y + r} />
          <line x1={x - r} y1={y + r} x2={x + r} y2={y - r} />
        </g>
      );
    default:
      return <circle cx={x} cy={y} r={r} {...common} />;
  }
}

function LegendSwatch({ kind, color, muted }: { kind: ShapeKind; color: string; muted?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0">
      <Marker kind={kind} x={8} y={8} r={5} color={muted ? "#D4D8DC" : color} fill={muted ? "#D4D8DC" : color} />
    </svg>
  );
}

/* ------------------------------------------------------------------------ */

export function TopCasesDonut({ data }: { data: CaseTypeCount[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const rows = data.map((d, i) => ({ ...d, fill: caseTypeColor(d.code, d.color), shape: shapeFor(d.code, i) }));

  return (
    <div className="flex h-full flex-col">
      {/* Fixed-size chart: the center label overlay shares exactly the same box as the pie, so it is always centered. */}
      <div className="relative mx-auto" style={{ width: DONUT_SIZE, height: DONUT_SIZE }}>
          <PieChart width={DONUT_SIZE} height={DONUT_SIZE} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Pie
              data={rows}
              dataKey="count"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={DONUT_SIZE / 2 - 48}
              outerRadius={DONUT_SIZE / 2 - 2}
              startAngle={90}
              endAngle={-270}
              stroke={rows.length > 1 ? "#fff" : "none"}
              strokeWidth={2}
              isAnimationActive={false}
            >
              {rows.map((r) => (
                <Cell key={r.code} fill={r.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [`${value} panggilan`, name]}
              contentStyle={{ borderRadius: 8, border: "1px solid #E6E8EC", fontSize: 12 }}
            />
          </PieChart>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center">
          <div>
            <p className="text-2xl font-semibold text-ink">{total}</p>
            <p className="text-[11px] text-muted-strong">Panggilan</p>
          </div>
        </div>
      </div>
      <ul className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-ink" aria-label="Legenda Top 5 Kasus">
        {rows.map((r) => (
          <li key={r.code} className="flex items-center gap-2">
            <LegendSwatch kind={r.shape} color={r.fill} />
            {r.name} <span className="text-muted-strong">({r.count})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

export function DailyCallsChart({ data }: { data: DailySeries }) {
  const series = useMemo(
    () =>
      data.series.map((s, i) => ({
        ...s,
        stroke: caseTypeColor(s.code, s.color),
        shape: shapeFor(s.code, i),
        total: s.data.reduce((a, b) => a + b, 0),
      })),
    [data.series],
  );

  const rows = useMemo(
    () =>
      data.dates.map((date, idx) => {
        const row: Record<string, string | number> = { date, tick: formatDateLabel(date).slice(0, 5), full: formatDateLabel(date) };
        for (const s of data.series) row[s.code] = s.data[idx] ?? 0;
        return row;
      }),
    [data],
  );

  const showDots = rows.length <= 16;
  const [boxRef, width] = useElementWidth<HTMLDivElement>();

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="w-full min-w-0 lg:flex-1">
        {/* Explicit width/height (measured) instead of ResponsiveContainer, which measured 0 inside this flex layout. */}
        <div ref={boxRef} className="h-[300px] w-full">
          {width > 0 && (
            <LineChart width={width} height={CHART_HEIGHT} data={rows} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="#EEF0F2" />
              <XAxis
                dataKey="tick"
                tick={{ fontSize: 11, fill: "#6B7280" }}
                tickLine={false}
                axisLine={{ stroke: "#B2B9C6" }}
                minTickGap={24}
                tickMargin={10}
              />
              <YAxis allowDecimals={false} width={32} tick={{ fontSize: 11, fill: "#6B7280" }} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ stroke: "#B2B9C6", strokeDasharray: "3 3" }}
                labelFormatter={(_label, payload) => String(payload?.[0]?.payload?.full ?? _label)}
                contentStyle={{ borderRadius: 8, border: "1px solid #E6E8EC", fontSize: 12 }}
                labelStyle={{ fontWeight: 600, color: "#1E1E1E" }}
                itemStyle={{ color: "#3F3F3F" }}
              />
              {series.map((s) => (
                <Line
                  key={s.code}
                  type="monotone"
                  dataKey={s.code}
                  name={s.name}
                  stroke={s.stroke}
                  strokeWidth={2.5}
                  isAnimationActive={false}
                  dot={
                    showDots
                      ? (p: { cx?: number; cy?: number; index?: number }) => (
                          <Marker key={`${s.code}-${p.index}`} kind={s.shape} x={p.cx ?? 0} y={p.cy ?? 0} r={5} color={s.stroke} />
                        )
                      : false
                  }
                  activeDot={(p: { cx?: number; cy?: number }) => (
                    <Marker kind={s.shape} x={p.cx ?? 0} y={p.cy ?? 0} r={6} color={s.stroke} fill={s.stroke} />
                  )}
                />
              ))}
            </LineChart>
          )}
        </div>
        <p className="mt-2 text-center text-sm font-medium text-ink">Tanggal Panggilan</p>
      </div>
      <ul className="flex flex-row flex-wrap gap-x-5 gap-y-3 text-xs lg:w-44 lg:flex-col lg:pt-4" aria-label="Legenda Grafik Total Panggilan">
        {series.map((s) => (
          <li key={s.code} className={s.total === 0 ? "flex items-center gap-2 text-muted" : "flex items-center gap-2 text-ink"}>
            <LegendSwatch kind={s.shape} color={s.stroke} muted={s.total === 0} />
            {s.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
