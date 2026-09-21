import { useState } from "react";
import {
  useDevices,
  useCreateDevice,
  useDeleteDevice,
  useRotateDeviceToken,
  useToast,
} from "../hooks";
import { ToastContainer } from "./Modals";
import { Chevron } from "./Collapsible";

function fmtDateTime(s: string | null) {
  if (!s) return "nunca";
  return new Date(s).toLocaleString("es-ES");
}

export function DevicesPanel({ indoorId }: { indoorId: string }) {
  const { data: devices, loading, refetch } = useDevices(indoorId);
  const { createDevice, loading: creating } = useCreateDevice();
  const { deleteDevice } = useDeleteDevice();
  const { rotateToken } = useRotateDeviceToken();
  const { toasts, showToast, removeToast } = useToast();

  const [open, setOpen] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    temp: "",
    humidity: "",
    humidifier: "",
    ac: "",
  });
  const [newToken, setNewToken] = useState<{ token: string; name: string } | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      const res = await createDevice(indoorId, {
        name: form.name.trim(),
        ha_entities: {
          temp: form.temp || null,
          humidity: form.humidity || null,
          humidifier: form.humidifier || null,
          ac: form.ac || null,
        },
      });
      if (res) {
        setNewToken({ token: res.token, name: res.device.name });
        setForm({ name: "", temp: "", humidity: "", humidifier: "", ac: "" });
        setShowForm(false);
        showToast("Dispositivo creado", "success");
        refetch();
      }
    } catch {
      showToast("Error al crear el dispositivo", "error");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDevice(id);
      showToast("Dispositivo eliminado", "success");
      refetch();
    } catch {
      showToast("Error al eliminar", "error");
    }
  };

  const handleRotate = async (id: string) => {
    try {
      const res = await rotateToken(id);
      if (res) setNewToken({ token: res.token, name: res.device.name });
    } catch {
      showToast("Error al regenerar token", "error");
    }
  };

  const copyToken = () => {
    if (newToken) {
      navigator.clipboard?.writeText(newToken.token);
      showToast("Token copiado", "success");
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
          <h3 className="section-title text-lg font-semibold text-gray-800">Dispositivos</h3>
        </button>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-3 py-1 text-xs uppercase tracking-wider bg-blue-500 text-white rounded-sm hover:bg-blue-600"
        >
          {showForm ? "Cancelar" : "+ Nuevo dispositivo"}
        </button>
      </div>

      {open && (
        <>
          {newToken && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-500 rounded-sm">
              <p className="text-xs uppercase tracking-widest text-yellow-800 mb-1">
                Token de "{newToken.name}" — copialo ahora (no se vuelve a mostrar)
              </p>
              <div className="flex gap-2 items-center">
                <code className="flex-1 text-xs bg-white border border-gray-300 rounded-sm px-2 py-1 break-all">
                  {newToken.token}
                </code>
                <button
                  onClick={copyToken}
                  className="px-3 py-1 text-xs uppercase tracking-wider border border-gray-300 rounded-sm hover:bg-gray-100"
                >
                  Copiar
                </button>
                <button
                  onClick={() => setNewToken(null)}
                  className="px-3 py-1 text-xs uppercase tracking-wider text-gray-500"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {showForm && (
            <form onSubmit={handleCreate} className="mb-4 p-4 bg-gray-50 rounded-sm">
              <div className="mb-3">
                <label className="field-label">Nombre</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Raspberry Pi"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              <p className="field-label">Entidades de Home Assistant (entity_id)</p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ["temp", "Sensor temperatura", "sensor.carpa_temp"],
                  ["humidity", "Sensor humedad", "sensor.carpa_hr"],
                  ["humidifier", "Switch humidificador", "switch.humidificador"],
                  ["ac", "Aire (climate/switch)", "climate.aire"],
                ] as const).map(([key, label, ph]) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 mb-1">{label}</label>
                    <input
                      type="text"
                      value={form[key]}
                      onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                      placeholder={ph}
                      className="w-full px-2 py-1 bg-white border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                ))}
              </div>
              <button
                type="submit"
                disabled={creating}
                className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-sm hover:bg-blue-600 disabled:opacity-50 text-xs uppercase tracking-wider"
              >
                {creating ? "Creando..." : "Crear dispositivo"}
              </button>
            </form>
          )}

          {loading ? (
            <p className="text-gray-500">Cargando...</p>
          ) : devices && devices.length > 0 ? (
            <div className="space-y-2">
              {devices.map((d) => (
                <div key={d.id} className="bg-gray-50 rounded-sm p-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="text-sm text-gray-800 font-medium">{d.name}</p>
                      <p className="text-xs text-gray-500">
                        último contacto: {fmtDateTime(d.last_seen)}
                        {d.reported_state && (
                          <>
                            {" · "}
                            humidificador: {d.reported_state.humidifier ? "ON" : "OFF"}
                            {" · "}
                            aire: {d.reported_state.ac ? "ON" : "OFF"}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleRotate(d.id)}
                        className="text-blue-500 hover:text-blue-700 text-xs"
                      >
                        Nuevo token
                      </button>
                      <button
                        onClick={() => handleDelete(d.id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">
              No hay dispositivos. Creá uno y copiá el token en el bridge del Pi.
            </p>
          )}
        </>
      )}
    </div>
  );
}
