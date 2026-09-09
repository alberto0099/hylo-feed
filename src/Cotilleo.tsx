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

  // "Instalable como app" se enciende AQUÍ, no en el index.html, porque ese
  // HTML sirve también el feed público: si el manifiesto fuese del sitio
  // entero, quien añadiese el feed a su pantalla de inicio acabaría con un
  // icono llamado "Cotilleo" que abre esta herramienta.
  //
  // Safari lee estas etiquetas del DOM en el momento de "Añadir a pantalla de
  // inicio", así que ponerlas al montar la pantalla llega a tiempo.
  useEffect(() => {
    document.title = "Cotilleo";

    const puestas: Element[] = [];
    function meta(name: string, content: string) {
      const el = document.createElement("meta");
      el.setAttribute("name", name);
      el.setAttribute("content", content);
      document.head.appendChild(el);
      puestas.push(el);
    }

    const manifiesto = document.createElement("link");
    manifiesto.rel = "manifest";
    manifiesto.href = "/manifest.webmanifest";
    document.head.appendChild(manifiesto);
    puestas.push(manifiesto);

    meta("apple-mobile-web-app-capable", "yes");
    meta("mobile-web-app-capable", "yes");
    meta("apple-mobile-web-app-status-bar-style", "black-translucent");
    meta("apple-mobile-web-app-title", "Cotilleo");

    return () => puestas.forEach((el) => el.remove());
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
