export type ChartPoint = { t: number; v: number };

export function Sparkline({
  points,
  step = false,
  color = "#7CE38B",
  height = 26,
}: {
  points: ChartPoint[];
  step?: boolean;
  color?: string;
  height?: number;
}) {
  if (points.length < 2) {
    return <div style={{ height }} />;
  }

  const W = 100;
  const H = height;
  const pad = 3;
  const ts = points.map((p) => p.t);
  const vs = points.map((p) => p.v);
  const tMin = Math.min(...ts);
  const tMax = Math.max(...ts);
  let vMin = Math.min(...vs);
  let vMax = Math.max(...vs);
  if (step) {
    vMin = 0;
    vMax = 1;
  } else if (vMin === vMax) {
    vMin -= 1;
    vMax += 1;
  }

  const x = (t: number) => pad + ((t - tMin) / (tMax - tMin || 1)) * (W - 2 * pad);
  const y = (v: number) => pad + (H - 2 * pad) - ((v - vMin) / (vMax - vMin || 1)) * (H - 2 * pad);

  let d = "";
  points.forEach((p, i) => {
    const px = x(p.t);
    const py = y(p.v);
    if (i === 0) d += `M ${px} ${py}`;
    else if (step) d += ` L ${px} ${y(points[i - 1].v)} L ${px} ${py}`;
    else d += ` L ${px} ${py}`;
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full block"
      style={{ height }}
    >
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function fmtTick(t: number, spanMs: number): string {
  const d = new Date(t);
  const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (spanMs > 36 * 3600 * 1000) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm} ${hhmm}`;
  }
  return hhmm;
}

function fmtValue(v: number, unit?: string): string {
  const rounded = Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
  return unit ? `${rounded}${unit}` : `${rounded}`;
}

export function MetricChart({
  title,
  unit,
  points,
  step = false,
  color = "#7CE38B",
  simulated = false,
  onClose,
}: {
  title: string;
  unit?: string;
  points: ChartPoint[];
  step?: boolean;
  color?: string;
  simulated?: boolean;
  onClose: () => void;
}) {
  const W = 760;
  const H = 320;
  const padL = 46;
  const padR = 18;
  const padT = 18;
  const padB = 36;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const ts = points.map((p) => p.t);
  const vs = points.map((p) => p.v);
  const tMin = Math.min(...ts);
  const tMax = Math.max(...ts);
  const spanMs = tMax - tMin || 1;

  let vMin = Math.min(...vs);
  let vMax = Math.max(...vs);
  if (step) {
    vMin = 0;
    vMax = 1;
  } else if (vMin === vMax) {
    vMin -= 1;
    vMax += 1;
  } else {
    const pad = (vMax - vMin) * 0.1;
    vMin -= pad;
    vMax += pad;
  }

  const xScale = (t: number) => padL + ((t - tMin) / spanMs) * plotW;
  const yScale = (v: number) => padT + plotH - ((v - vMin) / (vMax - vMin || 1)) * plotH;

  let path = "";
  points.forEach((p, i) => {
    const x = xScale(p.t);
    const y = yScale(p.v);
    if (i === 0) {
      path += `M ${x} ${y}`;
    } else if (step) {
      path += ` L ${x} ${yScale(points[i - 1].v)} L ${x} ${y}`;
    } else {
      path += ` L ${x} ${y}`;
    }
  });

  const yTicks = step ? [0, 1] : [vMin, (vMin + vMax) / 2, vMax];
  const xTickCount = 5;
  const xTicks = Array.from({ length: xTickCount }, (_, i) => tMin + (spanMs * i) / (xTickCount - 1));

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg p-5 w-[min(94vw,820px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
            <p className="text-[10px] uppercase tracking-widest text-gray-500">
              {points.length} punto(s)
              {simulated ? " · datos simulados" : " · datos reales"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-sm leading-none px-1"
          >
            ✕
          </button>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-64">
          {/* grid */}
          {yTicks.map((v) => (
            <line
              key={v}
              x1={padL}
              x2={W - padR}
              y1={yScale(v)}
              y2={yScale(v)}
              stroke="#2e4a38"
              strokeWidth="1"
            />
          ))}

          {/* y labels */}
          {yTicks.map((v) => (
            <text
              key={`y-${v}`}
              x={padL - 8}
              y={yScale(v) + 3}
              textAnchor="end"
              fontSize="10"
              fill="#93a88d"
              fontFamily="IBM Plex Mono, monospace"
            >
              {step ? (v >= 0.5 ? "ON" : "OFF") : fmtValue(v, unit)}
            </text>
          ))}

          {/* x labels */}
          {xTicks.map((t, i) => (
            <text
              key={`x-${i}`}
              x={xScale(t)}
              y={H - 12}
              textAnchor="middle"
              fontSize="9"
              fill="#93a88d"
              fontFamily="IBM Plex Mono, monospace"
            >
              {fmtTick(t, spanMs)}
            </text>
          ))}

          {/* line */}
          <path d={path} fill="none" stroke={color} strokeWidth="2" />

          {/* points */}
          {points.length <= 60 &&
            points.map((p, i) => (
              <circle key={i} cx={xScale(p.t)} cy={yScale(p.v)} r="2.5" fill={color} />
            ))}
        </svg>
      </div>
    </div>
  );
}
