"use client";

import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { tString } from "@/lib/i18n/translate";

export type PieSlice = {
  label: string;
  value: number;
  color: string;
};

type SummaryPieChartProps = {
  slices: PieSlice[];
  size?: number;
  interactive?: boolean;
};

export function SummaryPieChart({
  slices,
  size = 100,
  interactive = false,
}: SummaryPieChartProps) {
  const { t } = useLanguage();
  const [hovered, setHovered] = useState<number | null>(null);

  if (!slices || slices.length === 0) return null;
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total <= 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;
  const holeR = size * 0.26;
  const active = hovered != null ? slices[hovered] : null;

  if (slices.length === 1) {
    return (
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill={slices[0]!.color} />
        <circle cx={cx} cy={cy} r={holeR} fill="#1c2433" />
        {interactive && (
          <text
            x={cx}
            y={cy + 4}
            textAnchor="middle"
            fontSize={size * 0.1}
            fill="#e2e8f0"
            fontWeight="700"
          >
            {slices[0]!.value.toFixed(0)} {tString(t, "currency")}
          </text>
        )}
      </svg>
    );
  }

  let angle = -Math.PI / 2;
  const paths = slices.map((sl) => {
    const sweep = (sl.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const hx1 = cx + holeR * Math.cos(angle - sweep);
    const hy1 = cy + holeR * Math.sin(angle - sweep);
    const hx2 = cx + holeR * Math.cos(angle);
    const hy2 = cy + holeR * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    return {
      ...sl,
      d: `M${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} L${hx2},${hy2} A${holeR},${holeR} 0 ${large},0 ${hx1},${hy1} Z`,
    };
  });

  const labelSize = size * 0.085;
  const valSize = size * 0.1;

  return (
    <svg width={size} height={size} style={interactive ? { cursor: "default" } : {}}>
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill={p.color}
          stroke="#1c2433"
          strokeWidth={hovered === i ? 2.5 : 1.5}
          style={interactive ? { cursor: "pointer", transition: "all 0.15s" } : {}}
          onMouseEnter={interactive ? () => setHovered(i) : undefined}
          onMouseLeave={interactive ? () => setHovered(null) : undefined}
        />
      ))}
      <circle cx={cx} cy={cy} r={holeR} fill="#1c2433" />
      {interactive && (
        <>
          <text
            x={cx}
            y={active ? cy - valSize * 0.6 : cy - valSize * 0.3}
            textAnchor="middle"
            fontSize={labelSize}
            fill={active ? active.color : "#6b7280"}
            fontWeight="700"
          >
            {active
              ? active.label.length > 14
                ? `${active.label.slice(0, 13)}…`
                : active.label
              : tString(t, "total_label")}
          </text>
          <text
            x={cx}
            y={active ? cy + valSize * 0.9 : cy + valSize * 0.7}
            textAnchor="middle"
            fontSize={valSize}
            fill="#e2e8f0"
            fontWeight="800"
          >
            {(active ? active.value : total).toFixed(2)} {tString(t, "currency")}
          </text>
        </>
      )}
    </svg>
  );
}
