import { useMemo, useState } from "react";
import {
  useMeasurements,
  useDeleteMeasurement,
  useCreateIndoorHistoryEvent,
  useDeleteIndoorHistoryEvent,
  useToast,
} from "../hooks";
import { ToastContainer } from "./Modals";
import { Chevron } from "./Collapsible";
import { IndoorHistory, Measurement } from "../api/types";

type Kind = "riego" | "medicion" | "evento";

type TimelineItem = {
  id: string;
  ts: string;
  kind: Kind;
  text: string;
  deleteKind: "event" | "measurement";
  deleteId: string;
};

const KIND_STYLES: Record<Kind, { badge: string; dot: string; label: string }> = {
  riego: { badge: "bg-blue-100 text-blue-800", dot: "bg-blue-500", label: "Riego" },
  medicion: { badge: "bg-green-100 text-green-800", dot: "bg-green-500", label: "Medición" },
  evento: { badge: "bg-gray-100 text-gray-600", dot: "bg-gray-400", label: "Evento" },
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function measurementText(m: Measurement): string {
  const parts: string[] = [];
  if (m.temp_c != null) parts.push(`temp ${m.temp_c}°C`);
  if (m.humidity != null) parts.push(`HR ${m.humidity}%`);
  if (m.ec != null) parts.push(`EC ${m.ec}`);
  if (m.ph != null) parts.push(`pH ${m.ph}`);
  if (m.runoff_ec != null) parts.push(`runoff EC ${m.runoff_ec}`);
  if (m.ppfd != null) parts.push(`PPFD ${m.ppfd}`);
  return parts.length ? parts.join(" · ") : "medición";
}

export function HistoryPanel({
  indoorId,
  events,
  onUpdated,
}: {
  indoorId: string;
  events: IndoorHistory[];
  onUpdated: () => void;
}) {
  const { data: measurements, refetch: refetchMeasurements } = useMeasurements(indoorId);
  const { createHistoryEvent, loading: creating } = useCreateIndoorHistoryEvent();
  const { deleteHistoryEvent } = useDeleteIndoorHistoryEvent();
  const { deleteMeasurement } = useDeleteMeasurement();
  const { toasts, showToast, removeToast } = useToast();

  const [open, setOpen] = useState(true);
  const [newEvent, setNewEvent] = useState("");

  const items = useMemo(() => {
    const list: TimelineItem[] = [];
    (events ?? []).forEach((e) => {
      const kind: Kind = /riego/i.test(e.message) ? "riego" : "evento";
      list.push({
        id: `h-${e.id}`,
        ts: e.event_ts,
        kind,
        text: e.message,
        deleteKind: "event",
        deleteId: e.id,
      });
    });
    (measurements ?? []).forEach((m) => {
      list.push({
        id: `m-${m.id}`,
        ts: m.event_ts,
        kind: "medicion",
        text: measurementText(m),
        deleteKind: "measurement",
        deleteId: m.id,
      });
    });
    return list.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  }, [events, measurements]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.trim()) return;
    try {
      await createHistoryEvent(indoorId, newEvent.trim());
      setNewEvent("");
      showToast("Evento agregado", "success");
      onUpdated();
    } catch {
      showToast("Error al agregar el evento", "error");
    }
  };

  const handleDelete = async (item: TimelineItem) => {
    try {
      if (item.deleteKind === "measurement") {
        await deleteMeasurement(item.deleteId);
        refetchMeasurements();
      } else {
        await deleteHistoryEvent(indoorId, item.deleteId);
        onUpdated();
      }
    } catch {
      showToast("Error al eliminar", "error");
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-left"
        >
          <Chevron open={open} />
          <h3 className="section-title text-lg font-semibold text-gray-800">Historial</h3>
        </button>
      </div>

      {open && (
        <>
          <form onSubmit={handleAdd} className="flex gap-2 mb-4">
            <input
              type="text"
              value={newEvent}
              onChange={(e) => setNewEvent(e.target.value)}
              placeholder="Agregar evento (ej: le subí la luz 40 cm)"
              className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={creating || !newEvent.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-sm hover:bg-blue-600 disabled:opacity-50 text-xs uppercase tracking-wider"
            >
              Agregar
            </button>
          </form>

          {items.length > 0 ? (
            <div className="space-y-1 max-h-[28rem] overflow-auto">
              {items.map((it) => {
                const ks = KIND_STYLES[it.kind];
                return (
                  <div
                    key={it.id}
                    className="flex items-start justify-between gap-3 bg-gray-50 rounded-sm px-3 py-2"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <span className={`led mt-1.5 ${ks.dot}`} />
                      <div className="min-w-0">
                        <p className="text-sm text-gray-800 break-words">{it.text}</p>
                        <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-0.5">
                          <span className={`px-1.5 py-0.5 rounded-sm ${ks.badge}`}>{ks.label}</span>
                          <span className="ml-2 normal-case tracking-normal">
                            {fmtDateTime(it.ts)}
                          </span>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(it)}
                      className="text-red-500 hover:text-red-700 text-xs shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500">Todavía no hay actividad registrada.</p>
          )}
        </>
      )}
    </div>
  );
}
