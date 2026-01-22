import { useNavigate } from "react-router-dom";
import { useIndoors } from "../hooks";
import { CardSkeleton, EmptyState } from "../components/Modals";

export default function Indoors() {
  const navigate = useNavigate();
  const { data, loading, error } = useIndoors();

  if (error) {
    return (
      <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
        Error al cargar indoors: {error.message}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Indoors</h1>
          <p className="text-gray-600 mt-2">Gestiona tus carpas y espacios de cultivo.</p>
        </div>
        <button className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium">
          + Nuevo Indoor
        </button>
      </div>

      {/* Indoors Grid */}
      {loading ? (
        <div className="grid grid-cols-3 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : data && data.length > 0 ? (
        <div className="grid grid-cols-3 gap-6">
          {data.map((indoor) => (
            <button
              key={indoor.id}
              onClick={() => navigate(`/indoors/${indoor.id}`)}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow text-left"
            >
              <h3 className="text-lg font-semibold text-gray-800">{indoor.name}</h3>
              <p className="text-gray-600 text-sm mt-2">
                {indoor.plants_count} {indoor.plants_count === 1 ? "planta" : "plantas"}
              </p>
              <div className="mt-4 text-blue-500 font-medium text-sm">Ver detalle →</div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="🌱"
          title="No hay indoors aún"
          description="Crea tu primer indoor para empezar a cultivar plantas."
          action={{ label: "Crear Indoor", onClick: () => {} }}
        />
      )}
    </div>
  );
}
