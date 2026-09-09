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
import html2canvas from "html2canvas";

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

function Heart({ filled }: { filled: boolean }) {
  return (
    <span
      style={{
        position: "relative",
        width: 18,
        height: 18,
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
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill={filled ? "white" : "none"}
          stroke="white"
          strokeWidth="1.9"
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
          <div
            style={{
              width: "100%",
              maxWidth: "100%",
              maxHeight: capture ? 560 : hasImage ? 340 : 360,
              borderRadius: hasImage ? 20 : 22,
              overflow: "hidden",
              background: "transparent",
              display: "flex",
              justifyContent: "flex-start",
              alignItems: "flex-start",
            }}
          >
            <img
              src={r.image_url}
              alt=""
              loading="lazy"
              crossOrigin="anonymous"
              onClick={
                capture
                  ? undefined
                  : () => {
                      if (r.image_url) opts?.onAbrirImagen?.(r.image_url);
                    }
              }
              style={{
                width: "100%",
                height: "auto",
                maxWidth: "100%",
                maxHeight: capture ? 560 : hasImage ? 340 : 360,
                objectFit: "contain",
                display: "block",
                borderRadius: hasImage ? 20 : 22,
                cursor: capture ? "default" : "zoom-in",
              }}
            />
          </div>
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

      const lienzo = await html2canvas(marco, {
        width: ancho,
        height: alto,
        scale: 1080 / ancho,
        backgroundColor: "#db92c9",
        useCORS: true,
        logging: false,
        // Poda doble: fuera los controles de debajo (no son parte de la
        // imagen) y fuera las otras 522 tarjetas, que si no html2canvas las
        // clona todas para pintar una sola.
        //
        // La poda se limita a lo que cuelga de <body>: si se aplicara al
        // documento entero se llevaría por delante los <style> del <head> y
        // la copia salía SIN CSS — fondo blanco y texto suelto.
        ignoreElements: (el) =>
          el.classList?.contains("hylo-bajo") ||
          (document.body.contains(el) &&
            !(el === marco || el.contains(marco) || marco.contains(el))),
        onclone: (doc) => {
          const est = doc.createElement("style");
          // El CSS de la página, COPIADO a mano dentro de la copia.
          //
          // html2canvas monta la copia en un iframe aparte, y allí la hoja de
          // estilos se vuelve a pedir por su cuenta: si no ha llegado cuando
          // pinta, sale un PNG sin estilos —texto negro con serifas y sin
          // tarjeta—. Pasaba de vez en cuando, y más en el móvil. Metiendo
          // las reglas aquí ya no depende de esa carrera.
          let css = "";
          for (const hoja of Array.from(document.styleSheets)) {
            try {
              for (const regla of Array.from(hoja.cssRules)) {
                css += regla.cssText + "\n";
              }
            } catch {
              // Hoja de otro origen (las tipografías de Google): no se puede
              // leer, y tampoco hace falta para la maquetación.
            }
          }

          // Parches SOLO para la foto. La página se queda como está: aquí
          // se corrigen las cosas que html2canvas no sabe interpretar.
          est.textContent = css + [
            // El marco de líneas finas separa unas tarjetas de otras EN LA
            // PÁGINA; dentro de la imagen sobra.
            ".hylo-item::before,.hylo-item::after{display:none!important}",
            // overflow:hidden es para cortar el nombre con puntos
            // suspensivos; al pintarlo le recorta la cola de la "p".
            ".hylo-author{overflow:visible!important}",
            // No entiende inline-flex: el emoji de la etiqueta se le cae por
            // debajo del texto. Dentro de un flex, `flex` se ve igual.
            //
            // SIN corrección vertical a mano: probé a subirlo y lo que hay es
            // que cada emoji tiene su propio reparto de tinta dentro de la
            // caja. Medido: el calendario cae 3,5px (de 1080) y la carita
            // 0,6px. Un empujón fijo arregla uno y estropea el otro, y la
            // caja ya está centrada.
            ".hylo-badge-emoji{display:flex!important}",
            // Ni vertical-align con medida: el logo del CTA se le queda
            // colgado arriba. Se le baja con una transformación, que sí
            // aplica al pintar.
            ".hylo-cta-logo{vertical-align:baseline!important;" +
              "transform:translateY(calc(var(--alto) * 0.273))!important}",
            // Y como con vertical-align:baseline el logo reserva su alto por
            // ENCIMA de la línea, la caja crece hacia arriba y el bloque
            // entero baja: medidos 100px de aire arriba contra 38 abajo.
            // Se compensa quitando arriba lo mismo que se añade abajo
            // (0.273 x 1.9em = el desplazamiento del logo).
            ".hylo-cta{padding-top:calc(14px - 0.594em)!important;" +
              "padding-bottom:calc(14px + 0.594em)!important}",
          ].join("");
          // head puede venir nulo en el documento clonado; documentElement no.
          (doc.head ?? doc.documentElement)?.appendChild(est);
        },
      });

      const blob = await new Promise<Blob | null>((res) =>
        lienzo.toBlob(res, "image/png"),
      );
      if (!blob) return;

      const nombre = `hylo-${rowKey}.png`;
      const fichero = new File([blob], nombre, { type: "image/png" });

      if (navigator.canShare?.({ files: [fichero] })) {
        try {
          await navigator.share({ files: [fichero] });
        } catch {
          // Canceló la hoja de compartir: no se hace nada más.
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
    } finally {
      setOcupado(false);
    }
  }

  return (
      <div
        ref={refMarco}
          className={`hylo-item ${r.image_url ? "hylo-item--image" : ""}`}
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

        {/* Fila de debajo del marco: vive FUERA del recuadro (top: 100%) para
            que no salga en la imagen exportada. */}
        <div className="hylo-bajo">
          <button
            type="button"
            className="hylo-descarga"
            onClick={() => void descargar()}
            disabled={ocupado}
          >
            {ocupado ? (
              "Preparando..."
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
          {acciones}
        </div>

        <div className="hylo-cta-slot" aria-hidden="true">
          <span className="hylo-cta">
            Descarga <img src="/hylo_logo.png" alt="Hylo" className="hylo-cta-logo" />.
            Tu campus ya está dentro.
          </span>
        </div>

      </div>
  );
}
