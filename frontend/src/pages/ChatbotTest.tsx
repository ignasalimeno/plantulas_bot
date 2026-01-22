import { useState } from "react";

export default function ChatbotTest() {
  const [message, setMessage] = useState("");

  const handleSendMessage = () => {
    if (!message.trim()) return;
    // Placeholder: en ETAPA 5 integraremos el chatbot real
    console.log("Message sent:", message);
    setMessage("");
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Chatbot Test</h1>
        <p className="text-gray-600 mt-2">Pruebas del bot conversacional.</p>
      </div>

      {/* Chat Container */}
      <div className="bg-white rounded-lg shadow flex flex-col h-96">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
          <div className="flex justify-center">
            <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg text-sm">
              🤖 Chatbot listo para ETAPA 5
            </div>
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Escribe tu mensaje aquí..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={2}
            />
            <button
              onClick={handleSendMessage}
              disabled={!message.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 font-medium"
            >
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
