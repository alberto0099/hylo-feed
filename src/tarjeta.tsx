// La TARJETA de un hylo: lo que se ve y lo que se exporta.
//
// Vive aparte porque la usan dos sitios —el feed público y la pantalla de
// Fabio— y el diseño tiene que ser EL MISMO en los dos. Si esto se duplica,
// acaban divergiendo.
//
// Cada tarjeta lleva dentro un lienzo OCULTO de 1080x1350 (la medida de un
// post de Instagram) que es lo que html2canvas pinta al descargar. Lo que se
// ve en pantalla es una vista previa, no la imagen final.

import { useRef, useState, type ReactNode } from "react";
import { exportarNodoAPng } from "./exportar";

import { IconoComentario, IconoEnviar } from "./iconos";

export const MAP = {
  crushes: { emoji: "😍", label: "Crushes" },
  apuntes: { emoji: "📚", label: "Apuntes" },
  fiestas: { emoji: "🎉", label: "Fiestas" },
  pisos: { emoji: "🏠", label: "Pisos" },
  actividades: { emoji: "📆", label: "Actividades" },
  market: { emoji: "🛍️", label: "Mercado" },
  eventos: { emoji: "🏟️", label: "Eventos" },
  oportunidades: { emoji: "✨", label: "Oportunidades" },
  objetos_perdidos: { emoji: "🔍", label: "Objetos perdidos" },
  general: { emoji: "💬", label: "General" },
} as const;

export type CategoryKey = keyof typeof MAP;

export type PanelPostRow = {
  id: number | string;
  name: string | null;
  body: string;
  category: string;
  is_anonymous: boolean;
  image_url: string | null;
  created_at: string;
  source_key?: string;
};

export function safeCategory(category: string): CategoryKey | null {
  const normalizedCategory = category.trim();

  if (!normalizedCategory || normalizedCategory === "general") return null;
  if (normalizedCategory in MAP) return normalizedCategory as CategoryKey;
  return "crushes";
}

// Mismo sistema date/time que la app RN (relativeTimeShort de lib/format.ts):
//   1seg … 59seg → 1min … 59min → 1h … 23h → 1d … 6d → dd/mm/aa (año 2 dígitos)
export function formatFeedDate(iso: string) {
  const ts = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${Math.max(1, s)}seg`;
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

/** Grosor del trazo del corazón. Lo usan la tarjeta y, escalado, la foto. */
const GROSOR_CORAZON = 1.65;

function Heart({ filled }: { filled: boolean }) {
  return (
    <span
      style={{
        position: "relative",
        width: 24,
        height: 24,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "visible",
      }}
    >
      <span
        style={{
          position: "relative",
          zIndex: 2,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* El filo de los otros dos iconos mide 1,52 px a este tamaño (medido
            sobre el dibujo), pero poner aquí lo mismo dejaba el corazón
            visiblemente más fino: se dibuja 22,3 px de ancho y ellos 19,8, o
            sea que el mismo grosor pesa menos repartido en una figura mayor.
            Por eso va un punto por encima. */}
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill={filled ? "white" : "none"}
          stroke="white"
          strokeWidth={GROSOR_CORAZON}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 21s-6.7-4.35-9.33-8.09C.8 10.26 1.36 6.5 4.28 4.77c2.2-1.3 4.74-.65 6.22 1.03L12 7.47l1.5-1.67c1.48-1.68 4.02-2.33 6.22-1.03 2.92 1.73 3.48 5.49 1.61 8.14C18.7 16.65 12 21 12 21z" />
        </svg>
      </span>
    </span>
  );
}


export function renderHyloContent(
  r: PanelPostRow,
  category: CategoryKey | null,
  authorName: string,
  opts?: {
    capture?: boolean;
    onAbrirImagen?: (url: string) => void;
  },
): ReactNode {
  const capture = !!opts?.capture;
  const hasImage = !!r.image_url && !capture;
  const meta = category ? MAP[category] : null;

  return (
    <>
      {meta && category ? (
        <div
          className={`hylo-badge hylo-badge--${category}`}
          style={{
            fontSize: capture ? 34 : hasImage ? 14 : 15,
            padding: capture ? "12px 30px" : hasImage ? "4px 13px" : "5px 14px",
            borderRadius: 999,
            fontWeight: 600,
            ...(capture
              ? {
                  gap: 14,
                  display: "flex",
                  width: "fit-content",
                  alignSelf: "flex-start",
                  backdropFilter: "none",
                  WebkitBackdropFilter: "none",
                }
              : null),
          }}
        >
          {meta.emoji ? (
            <span
              className="hylo-badge-emoji"
              aria-hidden="true"
              style={{
                width: capture ? 52 : hasImage ? 20 : 22,
                height: capture ? 52 : hasImage ? 20 : 22,
                fontSize: capture ? 44 : hasImage ? 17 : 18,
              }}
            >
              {meta.emoji}
            </span>
          ) : null}
          <span>{meta.label}</span>
        </div>
      ) : null}

      <div
        className="hylo-meta"
        style={{
          display: "flex",
          justifyContent: "flex-start",
          alignItems: "center",
          gap: capture ? 10 : 4,
          marginTop: meta ? (capture ? 24 : hasImage ? 8 : 10) : 0,
          ...(capture
            ? { width: "fit-content", alignSelf: "flex-start" }
            : null),
        }}
      >
        {/* MISMO patrón que la app (components/HyloCard.tsx): nombre, un
            círculo de 2px como separador, y la hora JUNTO al nombre — no
            empujada al extremo derecho. Mismo tamaño de letra que el nombre;
            lo que cambia es el peso y el gris. */}
        <div className="hylo-authorline">
          <div
            className="hylo-author"
            style={{
              fontSize: capture ? 36 : hasImage ? 14 : 16,
              fontWeight: 600,
            }}
          >
            {authorName}
          </div>
        </div>

        {/* El separador va como CARÁCTER y no como un círculo de 2px.
            html2canvas no calcula el centrado flex de una caja tan pequeña y
            en el PNG el punto salía disparado hacia arriba; como texto se
            apoya en la misma línea que el nombre y la hora, siempre. */}
        <span
          aria-hidden="true"
          style={{
            fontSize: capture ? 36 : hasImage ? 14 : 16,
            lineHeight: 1,
            color: "rgba(255,255,255,0.5)",
            margin: "0 1px",
            flexShrink: 0,
          }}
        >
          ·
        </span>

        <div
          className="hylo-time"
          style={{
            fontSize: capture ? 36 : hasImage ? 14 : 16,
            fontWeight: 400,
            color: "rgba(255,255,255,0.5)",
            opacity: 1,
            flexShrink: 0,
            whiteSpace: "pre",
          }}
        >
          {formatFeedDate(r.created_at)}
        </div>
      </div>

      <p
        className="hylo-body"
        style={{
          fontSize: capture ? 38 : hasImage ? 14 : 16,
          lineHeight: hasImage ? 1.28 : 1.32,
          marginTop: capture ? 14 : hasImage ? 4 : 5,
          marginBottom: hasImage ? 6 : 0,
          fontWeight: 500,
        }}
      >
        {r.body}
      </p>

      {r.image_url ? (
        <div
          style={{
            width: "100%",
            marginTop: capture ? 26 : hasImage ? 14 : 18,
            paddingLeft: 0,
            paddingRight: 0,
            display: "flex",
            justifyContent: "flex-start",
          }}
        >
          <FotoDelHylo
            url={r.image_url}
            onAbrir={() => {
              if (r.image_url) opts?.onAbrirImagen?.(r.image_url);
            }}
          />
        </div>
      ) : null}

      {!capture ? (
        <div className="hylo-actions" aria-label="Acciones del hylo">
          <button className="hylo-action hylo-like" type="button" aria-label="Like">
            <Heart filled={false} />
          </button>

          <button className="hylo-action hylo-comments" type="button" aria-label="Comentarios">
            <IconoComentario />
          </button>

          <button className="hylo-action hylo-action--send" type="button" aria-label="Enviar mensaje">
            <IconoEnviar />
          </button>
        </div>
      ) : null}
    </>
  );
}


// Cuánto baja html2canvas el contenido de la etiqueta respecto a donde lo pone
// el navegador. MEDIDO con las métricas de la tipografía contra los píxeles del
// PNG: el texto cae 1,62px y el emoji 2,80.
//
// Los DOS caen, y por eso el contenido quedaba hundido dentro del óvalo. El
// desplazamiento común se corrige moviendo el relleno de la píldora (así suben
// emoji y texto a la vez, sin tocar el alto del óvalo) y al emoji se le sube
// aparte lo que cae de más.
//
// Se pueden probar otros valores sin tocar el código, con la URL:
//   /?subir=1.62&subirEmoji=1.18
// Es para afinarlo a ojo cuando la medida ya no da más de sí.
function delaUrl(clave: string, pordefecto: number) {
  if (typeof location === "undefined") return pordefecto;
  const v = parseFloat(new URLSearchParams(location.search).get(clave) ?? "");
  return Number.isFinite(v) ? Math.max(-8, Math.min(8, v)) : pordefecto;
}

// (Los ajustes de caída del emoji y del texto de la etiqueta eran parches para
// html2canvas. Ya no hacen falta: la foto la dibuja el navegador.)

// Alto máximo de la foto de un hylo. Manda sobre la maquetación entera: con
// más, la tarjeta se sale del recuadro 4:5 y pisa la banda del CTA.
const ALTO_MAX_IMAGEN = delaUrl("altoFoto", 190);

// Cuánto se le recorta al logo del CTA de su transparencia izquierda, en
// fracción de su alto. 0,101 sería quitársela entera; con eso la "h" quedaba
// pegada a la "a" de "Descarga".
if (typeof document !== "undefined") {
  document.documentElement.style.setProperty(
    "--recorte-logo",
    String(delaUrl("hueco", 0.05)),
  );
}

/**
 * Mete en la copia que va a fotografiar html2canvas: (a) el CSS de la página,
 * y (b) los parches de las cosas que no sabe interpretar.
 *
 * El CSS se copia a mano porque html2canvas monta la copia en un iframe y allí
 * la hoja de estilos se vuelve a pedir por su cuenta; si no llegaba a tiempo
 * salía un PNG sin estilos, con serifas y sin tarjeta.
 */
// Los hylos que ya se han descargado, para no repetirlos al publicar.
//
// Van en el navegador (localStorage), no en el servidor: la marca es de QUIEN
// descarga, y así no hace falta ni cuenta ni endpoint. El precio es que no se
// comparte entre dispositivos.
const CLAVE_DESCARGADOS = "hylo_feed_descargados_v1";

function leerDescargados(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(CLAVE_DESCARGADOS) ?? "[]"));
  } catch {
    return new Set();
  }
}

function guardarDescargado(id: string, si: boolean) {
  try {
    const ya = leerDescargados();
    if (si) ya.add(id);
    else ya.delete(id);
    localStorage.setItem(CLAVE_DESCARGADOS, JSON.stringify([...ya]));
  } catch {
    // Navegación privada o almacenamiento lleno: no marcamos y ya está.
  }
}

/**
 * La foto de un hylo.
 *
 * El tamaño se decide al cargar, según la forma de la foto:
 *   - ancha o normal -> ocupa el ancho de la tarjeta
 *   - alta (capturas de móvil) -> se limita por el alto y queda más estrecha
 *
 * En los dos casos la caja ES la foto, así que el redondeo la abraza y no
 * quedan esquinas cuadradas. Poner solo width:auto no valía: una foto pequeña
 * se pintaba a su tamaño real y salía diminuta.
 *
 * Sin carga diferida a propósito: con `loading=lazy` las fotos no llegaban a
 * salir. Son 62 en todo el feed y esto lo usan dos personas.
 */
function FotoDelHylo({ url, onAbrir }: { url: string; onAbrir: () => void }) {
  const ref = useRef<HTMLImageElement | null>(null);
  const [medida, setMedida] = useState<{ w: string; h: string } | null>(null);

  function alCargar() {
    const img = ref.current;
    const hueco = img?.parentElement?.clientWidth ?? 0;
    if (!img || !img.naturalWidth || !hueco) return;
    const altoSiLlenaElAncho = (img.naturalHeight * hueco) / img.naturalWidth;
    setMedida(
      altoSiLlenaElAncho <= ALTO_MAX_IMAGEN
        ? { w: "100%", h: "auto" }
        : { w: "auto", h: `${ALTO_MAX_IMAGEN}px` },
    );
  }

  return (
    <img
      ref={ref}
      src={url}
      alt=""
      decoding="async"
      crossOrigin="anonymous"
      onLoad={alCargar}
      onClick={onAbrir}
      style={{
        width: medida?.w ?? "100%",
        height: medida?.h ?? "auto",
        maxWidth: "100%",
        maxHeight: ALTO_MAX_IMAGEN,
        display: "block",
        borderRadius: 20,
        cursor: "zoom-in",
      }}
    />
  );
}

type PropsTarjeta = {
  r: PanelPostRow;
  /** Clave única; da nombre al PNG y marca el lienzo oculto. */
  rowKey: string;
  onAbrirImagen?: (url: string) => void;
  /** Controles extra en la fila de debajo del marco, junto a Descargar. */
  acciones?: ReactNode;
};

export function TarjetaHylo({
  r,
  rowKey,
  onAbrirImagen,
  acciones,
}: PropsTarjeta) {
  const refMarco = useRef<HTMLDivElement | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [descargado, setDescargado] = useState(() =>
    leerDescargados().has(rowKey),
  );

  const category = safeCategory(r.category);
  const categoryClass = category ?? "uncategorized";
  const authorName = r.is_anonymous ? "Anónimo" : r.name?.trim() || "Usuario";

  // Pinta el lienzo oculto de 1080x1350 y lo entrega.
  //
  // En el iPhone `<a download>` no guarda nada: Safari abre la imagen y ya. Por
  // eso, si el navegador sabe compartir ficheros, se usa la hoja de compartir
  // (desde ahí sí se guarda en Fotos). En escritorio, descarga normal.
  // Fotografía EL RECUADRO QUE SE VE, escalado a 1080x1350.
  //
  // Antes había una plantilla oscura aparte de 1080x1350, y la imagen no se
  // parecía a la página: fondo negro en vez del rosa, y la tipografía de la
  // tarjeta copiada de la pantalla, o sea diminuta sobre un lienzo 2,4 veces
  // más ancho. Capturando el marco real, lo que ves es lo que te llevas y no
  // hay dos diseños que mantener.
  // Solo para la foto: el fondo de la página (que vive en .app-shell, fuera
  // del recuadro) y sin las líneas que separan un hylo del siguiente.
  //
  // Y una compensación: dentro de una perspectiva 3D (la que inclina la
  // tarjeta) Chrome dibuja el TRAZO de un SVG a resolución de pantalla y luego
  // lo estira, así que en la foto, que sale al doble, el corazón salía a la
  // mitad de grosor mientras los otros dos iconos —que son siluetas rellenas,
  // no trazos— salían bien. Medido: el grosor del trazo se queda fijo pase lo
  // que pase, o sea que basta multiplicarlo por la escala de la foto.
  const CSS_FOTO_BASE = `
    .hylo-item { background-color: #140c13 !important; overflow: hidden !important; }
    .hylo-item::before, .hylo-item::after { display: none !important; }
  `;

  function marcar(si: boolean) {
    setDescargado(si);
    guardarDescargado(rowKey, si);
  }

  async function descargar() {
    const marco = refMarco.current;
    if (!marco || ocupado) return;
    setOcupado(true);
    try {
      // Sin esto la foto puede salir con la tipografía de reserva.
      try {
        await document.fonts?.ready;
      } catch {
        // Navegador sin la API: se sigue igual.
      }

      const caja = marco.getBoundingClientRect();
      const ancho = caja.width;
      const alto = ancho * 1.25; // 4:5, el del post de Instagram

      // La foto la dibuja el propio navegador (ver exportar.ts), así que sale
      // EXACTAMENTE el recuadro que se ve en la página: la misma tarjeta, la
      // misma luz y la misma sombra. Lo único que se añade es el fondo, que en
      // la página lo pone .app-shell y queda fuera del recuadro.
      const escala = 1080 / ancho;
      const blob = await exportarNodoAPng(marco, {
        ancho,
        alto,
        anchoFinal: 1080,
        cssExtra:
          CSS_FOTO_BASE +
          `.hylo-like svg { stroke-width: ${(GROSOR_CORAZON * escala).toFixed(3)}px !important; }`,
      });

      if (!blob) return;

      const nombre = `hylo-${rowKey}.png`;
      const fichero = new File([blob], nombre, { type: "image/png" });

      if (navigator.canShare?.({ files: [fichero] })) {
        try {
          await navigator.share({ files: [fichero] });
          marcar(true);
        } catch {
          // Canceló la hoja de compartir: no se marca nada.
        }
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      marcar(true);
    } finally {
      setOcupado(false);
    }
  }

  return (
    // El envoltorio existe para que los botones queden FUERA de la caja de
    // la tarjeta: el recorte de content-visibility (ver .hylo-slot) se los
    // comía cuando colgaban de ella.
    <div className="hylo-slot">
      <div
        ref={refMarco}
        className={`hylo-item ${r.image_url ? "hylo-item--image" : ""} ${
          descargado ? "hylo-item--hecho" : ""
        }`}
      >
        <article
          className={`hylo-card hylo-card--${categoryClass} ${
            r.image_url ? "hylo-card--image" : ""
          }`}
        >
          <div className={`hylo-card-overlay hylo-card-overlay--${categoryClass}`} />

          <div className="hylo-card-content">
            {renderHyloContent(r, category, authorName, { onAbrirImagen })}
          </div>
        </article>


        <div className="hylo-cta-slot" aria-hidden="true">
          <span className="hylo-cta">
            Descarga{" "}
            {/* La versión de 500px y no el original de 3307x1800: el logo se
                pinta 523 veces (una por tarjeta) y reescalar ese PNG de 608KB
                otras tantas era buena parte de lo que atascaba el scroll. Se
                dibuja a 66px, y en la foto exportada a 183. */}
            <img src="/hylo_logo_500.png" alt="Hylo" className="hylo-cta-logo" />.
            Tu campus ya está dentro.
          </span>
        </div>

      </div>

        {/* Fila de debajo del marco: vive FUERA del recuadro (top: 100%) para
            que no salga en la imagen exportada. */}
        <div className="hylo-bajo">
          <button
            type="button"
            className={`hylo-descarga ${descargado ? "hylo-descarga--hecho" : ""}`}
            onClick={() => void descargar()}
            disabled={ocupado}
          >
            {ocupado ? (
              "Preparando..."
            ) : descargado ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M20 6 9 17l-5-5"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Descargado
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Descargar
              </>
            )}
          </button>

          {descargado && (
            <button
              type="button"
              className="hylo-desmarcar"
              onClick={() => marcar(false)}
            >
              Desmarcar
            </button>
          )}

          {acciones}
        </div>
    </div>
  );
}
