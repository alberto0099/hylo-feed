// Pantalla de Fabio: los DMs que le llegan a la cuenta de Instagram, ya
// pintados como hylos y listos para descargar.
//
// La tarjeta es LA MISMA que la del feed (<TarjetaHylo>), a propósito: lo que
// descarga Fabio se ve exactamente igual que lo que se publica en la app.
//
// El token de Instagram vive en el servidor, no aquí: esta pantalla solo llama
// a /api/ig/mensajes. Fabio inicia sesión una vez y no vuelve a verlo.

import { useCallback, useEffect, useState } from "react";
import { MAP, TarjetaHylo, type PanelPostRow } from "./tarjeta";

const CATEGORIAS = Object.entries(MAP).map(([valor, m]) => ({
  valor,
  etiqueta: `${m.emoji} ${m.label}`,
}));

type Mensaje = PanelPostRow & { remitente?: string | null };

type Respuesta = {
  conectado?: boolean;
  cuenta?: string | null;
  mensajes?: Mensaje[];
  error?: string;
  detalle?: unknown;
};

export default function Cotilleo() {
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">("cargando");
  const [conectado, setConectado] = useState(false);
  const [cuenta, setCuenta] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Categoría que Fabio le pone a cada mensaje (vacío = sin categoría).
  const [categorias, setCategorias] = useState<Record<string, string>>({});

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

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/ig/mensajes?ts=${Date.now()}`, { cache: "no-store" });
      const d: Respuesta = await r.json();
      if (d.error) {
        setError(d.error);
        setEstado("error");
        setConectado(!!d.conectado);
        return;
      }
      setConectado(!!d.conectado);
      setCuenta(d.cuenta ?? null);
      setMensajes(d.mensajes ?? []);
      setError(null);
      setEstado("listo");
    } catch (e) {
      setError(String(e));
      setEstado("error");
    }
  }, []);

  useEffect(() => {
    void cargar();
    // Cada minuto: los DMs no llegan tan rápido como para justificar más.
    const t = window.setInterval(() => void cargar(), 60000);
    return () => window.clearInterval(t);
  }, [cargar]);

  async function marcarHecho(id: string) {
    // Se quita de la lista al momento; si el servidor falla, vuelve al recargar.
    setMensajes((ms) => ms.filter((m) => m.id !== id));
    await fetch("/api/ig/hecho", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: id }),
    }).catch(() => {});
  }

  return (
    <div className="app-shell">
      <div className="cotilleo-barra">
        <span className="cotilleo-titulo">
          Cotilleo
          {cuenta && <span className="cotilleo-cuenta">@{cuenta}</span>}
        </span>
        <button type="button" className="cotilleo-limpiar" onClick={() => void cargar()}>
          Actualizar
        </button>
      </div>

      {estado === "cargando" && <p className="cotilleo-vacio">Cargando mensajes...</p>}

      {estado === "error" && (
        <div className="cotilleo-aviso">
          <p>No se han podido leer los mensajes.</p>
          <p className="cotilleo-detalle">{error}</p>
          <a className="cotilleo-boton" href="/api/ig/entrar">
            Volver a conectar Instagram
          </a>
        </div>
      )}

      {estado === "listo" && !conectado && (
        <div className="cotilleo-aviso">
          <p>Conecta la cuenta de Instagram para ver aquí los mensajes.</p>
          <a className="cotilleo-boton" href="/api/ig/entrar">
            Conectar Instagram
          </a>
        </div>
      )}

      {estado === "listo" && conectado && mensajes.length === 0 && (
        <p className="cotilleo-vacio">No hay mensajes nuevos.</p>
      )}

      {estado === "listo" && conectado && mensajes.length > 0 && (
        <div className="hylo-wrap cotilleo-vista">
          <div className="hylo-grid">
            {mensajes.map((m) => (
              <TarjetaHylo
                key={m.id}
                r={{ ...m, category: categorias[String(m.id)] ?? "" }}
                rowKey={String(m.id)}
                acciones={
                  <>
                    <select
                      className="cotilleo-select cotilleo-select--fila"
                      value={categorias[String(m.id)] ?? ""}
                      onChange={(e) =>
                        setCategorias((c) => ({ ...c, [String(m.id)]: e.target.value }))
                      }
                    >
                      <option value="">Sin categoría</option>
                      {CATEGORIAS.map((c) => (
                        <option key={c.valor} value={c.valor}>
                          {c.etiqueta}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className="cotilleo-hecho"
                      onClick={() => void marcarHecho(String(m.id))}
                    >
                      Hecho
                    </button>
                  </>
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
