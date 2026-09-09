// Pantalla de Fabio: pega el texto de un DM y sale la tarjeta lista para
// descargar, con el MISMO diseño que el feed (comparten <TarjetaHylo>).
//
// Primera fase, a propósito manual: se pega el mensaje a mano. Cuando la
// lectura de DMs de Instagram esté montada, lo único que cambia es de dónde
// sale el texto — la tarjeta y la descarga son ya las definitivas.

import { useEffect, useMemo, useState } from "react";
import { MAP, TarjetaHylo, type PanelPostRow } from "./tarjeta";

const CATEGORIAS = Object.entries(MAP).map(([valor, m]) => ({
  valor,
  etiqueta: `${m.emoji} ${m.label}`,
}));

export default function Cotilleo() {
  const [texto, setTexto] = useState("");
  const [categoria, setCategoria] = useState("");
  const [nombre, setNombre] = useState("");

  // El nombre que iOS pone bajo el icono al añadir a pantalla de inicio.
  useEffect(() => {
    document.title = "Cotilleo";
    const m = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (m) m.setAttribute("content", "Cotilleo");
  }, []);

  // La fecha se congela al montar: si fuese Date.now() en cada tecleo, la
  // tarjeta reharía el "hace 1 seg" mientras Fabio escribe.
  const creado = useMemo(() => new Date().toISOString(), []);

  const fila: PanelPostRow = {
    id: "pegado",
    name: nombre.trim() || null,
    body: texto,
    category: categoria,
    is_anonymous: !nombre.trim(),
    image_url: null,
    created_at: creado,
  };

  const hayTexto = texto.trim().length > 0;

  return (
    <div className="app-shell">
      <div className="cotilleo-barra">
        <span className="cotilleo-titulo">Cotilleo</span>
        {hayTexto && (
          <button
            type="button"
            className="cotilleo-limpiar"
            onClick={() => {
              setTexto("");
              setNombre("");
              setCategoria("");
            }}
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="cotilleo-form">
        <textarea
          className="cotilleo-texto"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Pega aquí el mensaje que te ha llegado por DM"
          rows={4}
          autoCapitalize="sentences"
        />

        <div className="cotilleo-campos">
          <select
            className="cotilleo-select"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            <option value="">Sin categoría</option>
            {CATEGORIAS.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.etiqueta}
              </option>
            ))}
          </select>

          <input
            className="cotilleo-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Anónimo"
            aria-label="Nombre (vacío = anónimo)"
          />
        </div>
      </div>

      {hayTexto ? (
        <div className="hylo-wrap cotilleo-vista">
          <div className="hylo-grid">
            <TarjetaHylo r={fila} rowKey="pegado" />
          </div>
        </div>
      ) : (
        <p className="cotilleo-vacio">
          Pega un mensaje arriba y aquí abajo verás cómo queda.
        </p>
      )}
    </div>
  );
}
