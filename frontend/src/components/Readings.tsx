import { useRef, useState } from "react";

export type Status = "ok" | "low" | "high" | "none";

export type CardSpec = {
  key: string;
  label: string;
  value: number | null;
  at?: string | null;
  source?: string | null;
  min?: number | null;
  max?: number | null;
  unit?: string;
  step: string;
  digits: number;
  save: (value: number | null) => void;
};

export const STATUS_STYLES: Record<Status, { card: string; value: string; badge: string; label: string }> = {
  ok: {
    card: "border-blue-500 bg-blue-50",
    value: "text-blue-500",
    badge: "bg-blue-100 text-blue-800",
    label: "OK",
  },
  low: {
    card: "border-yellow-500 bg-yellow-50",
    value: "text-yellow-800",
    badge: "bg-yellow-100 text-yellow-800",
    label: "BAJO",
  },
  high: {
    card: "border-red-400 bg-red-50",
    value: "text-red-700",
    badge: "bg-red-100 text-red-800",
    label: "ALTO",
  },
  none: {
    card: "border-gray-200 bg-gray-50",
    value: "text-gray-500",
    badge: "bg-gray-100 text-gray-600",
    label: "—",
  },
};

export function rangeStatus(
  value: number | null | undefined,
  min: number | null | undefined,
  max: number | null | undefined
): Status {
  if (value === null || value === undefined || min === null || min === undefined || max === null || max === undefined) {
    return "none";
  }
  if (value < min) return "low";
  if (value > max) return "high";
  return "ok";
}

export function fmtNum(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined) return "—";
  return Number(value).toFixed(digits).replace(/\.0+$/, "");
}

export function timeAgo(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "ahora";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

const SOURCE_LABELS: Record<string, string> = {
  measurement: "medición",
  watering: "riego",
  indoor: "manual",
};

export function ReadingCard({
  label,
  value,
  at,
  source,
  min,
  max,
  unit,
  step = "0.1",
  digits = 1,
  status,
  saving,
  onSave,
}: {
  label: string;
  value: number | null;
  at?: string | null;
  source?: string | null;
  min?: number | null;
  max?: number | null;
  unit?: string;
  step?: string;
  digits?: number;
  status: Status;
  saving?: boolean;
  onSave: (value: number | null) => void;
}) {
  const s = STATUS_STYLES[status];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const doneRef = useRef(false);

  const startEdit = () => {
    setDraft(value != null ? String(value) : "");
    doneRef.current = false;
    setEditing(true);
  };

  const finish = (save: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    setEditing(false);
    if (!save) return;
    const trimmed = draft.trim();
    if (trimmed === "") return;
    const num = Number(trimmed);
    if (Number.isNaN(num)) return;
    if (value != null && Number(value) === num) return;
    onSave(num);
  };

  const recency = timeAgo(at);
  const sourceLabel = source ? SOURCE_LABELS[source] ?? source : null;

  return (
    <div className={`border rounded-sm p-3 ${s.card}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-gray-500">{label}</p>
        <div className="flex items-center gap-1.5">
          <span className={`px-1.5 py-0.5 rounded-sm text-[10px] font-semibold ${s.badge}`}>
            {s.label}
          </span>
          {!editing && (
            <button
              onClick={startEdit}
              title="Editar"
              className="text-gray-400 hover:text-blue-500 text-xs leading-none"
            >
              ✎
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <input
          autoFocus
          type="number"
          step={step}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => finish(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              finish(true);
            }
            if (e.key === "Escape") {
              e.preventDefault();
              finish(false);
            }
          }}
          disabled={saving}
          className="w-full mt-2 px-2 py-1 bg-white border border-blue-400 rounded-sm text-xl font-bold text-gray-800 focus:outline-none"
        />
      ) : (
        <button onClick={startEdit} className="block w-full text-left" title="Click para editar">
          <p className={`text-2xl font-bold leading-none mt-2 ${s.value}`}>
            {fmtNum(value, digits)}
          </p>
        </button>
      )}

      <div className="flex items-center justify-between mt-1 min-h-[14px]">
        {min != null || max != null ? (
          <p className="text-[10px] uppercase tracking-widest text-gray-500">
            ideal {fmtNum(min)}–{fmtNum(max)}
            {unit ? ` ${unit}` : ""}
          </p>
        ) : (
          <span />
        )}
        {(sourceLabel || recency) && (
          <span className="text-[10px] text-gray-400">
            {sourceLabel}
            {sourceLabel && recency ? " · " : ""}
            {recency}
          </span>
        )}
      </div>
    </div>
  );
}
