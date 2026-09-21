import { useEffect, useRef, useState } from "react";
import { useChat, useChatHistory, useClearChat, useToast } from "../hooks";
import { ToastContainer } from "../components/Modals";
import { ChatMessage } from "../api/types";

const TOOL_LABELS: Record<string, string> = {
  water_indoor: "Regar indoor",
  add_measurement: "Registrar medición",
  apply_fertilizer: "Aplicar fertilizante",
  complete_task: "Completar tarea",
  set_humidifier: "Humidificador",
};

function toolLabel(name: string) {
  return TOOL_LABELS[name] ?? name;
}

export default function Chat() {
  const { data: history, error: historyError } = useChatHistory();
  const { sendMessage, confirm, loading, error: chatError } = useChat();
  const { clearChat } = useClearChat();
  const { toasts, showToast, removeToast } = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (history) setMessages(history);
  }, [history]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const lastMessage = messages[messages.length - 1];
  const hasPending = !!lastMessage && lastMessage.role === "assistant" && !!lastMessage.pending_action;

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((prev) => [
      ...prev,
      {
        id: `tmp-u-${Date.now()}`,
        role: "user",
        content: text,
        pending_action: null,
        created_at: new Date().toISOString(),
      },
    ]);
    try {
      const res = await sendMessage(text);
      if (res) {
        setMessages((prev) => [
          ...prev,
          {
            id: `tmp-a-${Date.now()}`,
            role: "assistant",
            content: res.reply,
            pending_action: res.pending_action,
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al enviar el mensaje", "error");
    }
  };

  const handleConfirm = async (approve: boolean) => {
    setMessages((prev) => prev.map((m) => (m.pending_action ? { ...m, pending_action: null } : m)));
    try {
      const res = await confirm(approve);
      if (res) {
        setMessages((prev) => [
          ...prev,
          {
            id: `tmp-a-${Date.now()}`,
            role: "assistant",
            content: res.reply,
            pending_action: null,
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al confirmar la acción", "error");
    }
  };

  const handleClear = async () => {
    try {
      await clearChat();
      setMessages([]);
      showToast("Conversación borrada", "success");
    } catch {
      showToast("Error al borrar", "error");
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)]">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Asistente</h1>
          <p className="text-gray-600 mt-1">
            Preguntá por tu cultivo o pedile que riegue, mida o fertirriegue.
          </p>
        </div>
        <button
          onClick={handleClear}
          className="px-3 py-1 text-xs uppercase tracking-wider border border-gray-300 text-gray-700 rounded-sm hover:bg-gray-100"
        >
          Limpiar
        </button>
      </div>

      {/* Chat card */}
      <div className="bg-white rounded-lg shadow flex flex-col flex-1 min-h-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3 bg-gray-50 rounded-t-lg">
          {messages.length === 0 && !loading && (
            <div className="flex justify-center">
              <div className="bg-blue-50 text-blue-800 px-4 py-2 rounded-sm text-sm">
                Hola 👋 Soy tu asistente de cultivo. ¿Qué querés saber?
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] px-4 py-2 rounded-sm text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-blue-500 text-white"
                    : "bg-white border border-gray-200 text-gray-800"
                }`}
              >
                {m.content}
                {m.pending_action && m.pending_action.actions.length > 0 && (
                  <div className="mt-2 text-[10px] uppercase tracking-widest text-gray-500">
                    Acción propuesta:{" "}
                    {m.pending_action.actions.map((a) => toolLabel(a.tool)).join(", ")}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 text-gray-500 px-4 py-2 rounded-sm text-sm animate-pulse">
                pensando…
              </div>
            </div>
          )}
        </div>

        {/* Pending confirmation */}
        {hasPending && (
          <div className="border-t border-gray-200 p-3 flex gap-2 bg-yellow-50">
            <button
              onClick={() => handleConfirm(true)}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded-sm hover:bg-blue-600 disabled:opacity-50 text-xs uppercase tracking-wider"
            >
              Confirmar
            </button>
            <button
              onClick={() => handleConfirm(false)}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-sm hover:bg-gray-100 disabled:opacity-50 text-xs uppercase tracking-wider"
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Error */}
        {(chatError || historyError) && (
          <div className="border-t border-red-400 bg-red-50 text-red-700 text-xs px-4 py-2">
            Error: {chatError?.message || historyError?.message}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-gray-200 p-3">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Escribí tu mensaje…"
              rows={2}
              className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-800 focus:outline-none focus:border-blue-500 resize-none"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="px-5 py-2 bg-blue-500 text-white rounded-sm hover:bg-blue-600 disabled:opacity-50 text-xs uppercase tracking-wider"
            >
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
