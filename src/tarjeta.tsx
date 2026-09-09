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

// El logotipo va DENTRO de la frase del CTA. MEDIDO sobre el propio PNG: su
// línea de base está al 72,7% de la altura, así que el 27,3% es cola de la
// "y". Para que se apoye donde se apoya el texto hay que bajarlo ese 27,3%.
// Cambia SOLO el alto: la bajada se recalcula.
const LOGO_CTA_ALTO = 100;
const LOGO_CTA_BAJADA = Math.round(LOGO_CTA_ALTO * 0.273);

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
            fontSize: capture ? 15 : hasImage ? 14 : 15,
            padding: capture ? "5px 14px" : hasImage ? "4px 13px" : "5px 14px",
            borderRadius: 999,
            fontWeight: 600,
            ...(capture
              ? {
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
                width: capture ? 24 : hasImage ? 20 : 22,
                height: capture ? 24 : hasImage ? 20 : 22,
                fontSize: capture ? 20 : hasImage ? 17 : 18,
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
          gap: 4,
          marginTop: meta ? (hasImage ? 8 : 10) : 0,
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
              fontSize: capture ? 16 : hasImage ? 14 : 16,
              fontWeight: 600,
            }}
          >
            {authorName}
          </div>
        </div>

        <span
          aria-hidden="true"
          style={{
            width: 2,
            height: 2,
            borderRadius: 999,
            background: "rgba(255,255,255,0.5)",
            margin: "0 1px",
            flexShrink: 0,
            transform: "translateY(1px)",
          }}
        />

        <div
          className="hylo-time"
          style={{
            fontSize: capture ? 16 : hasImage ? 14 : 16,
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
          fontSize: capture ? 16 : hasImage ? 14 : 16,
          lineHeight: hasImage ? 1.28 : 1.32,
          marginTop: hasImage ? 4 : 5,
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
            <img
              src="/commentbox.svg"
              alt=""
              aria-hidden="true"
              width={18}
              height={18}
              style={{ display: "block" }}
            />
          </button>

          <button className="hylo-action hylo-action--send" type="button" aria-label="Enviar mensaje">
            <img
              src="/send.svg"
              alt=""
              aria-hidden="true"
              width={18}
              height={18}
              style={{ display: "block" }}
            />
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
  const nodoCaptura = useRef<HTMLDivElement | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // El lienzo de 1080x1350 SOLO existe mientras se descarga.
  //
  // Antes vivía montado en las 523 tarjetas del feed, y como html2canvas clona
  // el documento entero para pintar UN elemento, exportar una tarjeta copiaba
  // las 523: 9,9 segundos medidos en producción. Montándolo bajo demanda (y
  // con ignoreElements podando el resto) el clon es diminuto.
  const [montarLienzo, setMontarLienzo] = useState(false);

  const category = safeCategory(r.category);
  const categoryClass = category ?? "uncategorized";
  const authorName = r.is_anonymous ? "Anónimo" : r.name?.trim() || "Usuario";

  // Pinta el lienzo oculto de 1080x1350 y lo entrega.
  //
  // En el iPhone `<a download>` no guarda nada: Safari abre la imagen y ya. Por
  // eso, si el navegador sabe compartir ficheros, se usa la hoja de compartir
  // (desde ahí sí se guarda en Fotos). En escritorio, descarga normal.
  async function descargar() {
    if (ocupado) return;
    setOcupado(true);
    setMontarLienzo(true);
    try {
      // Un respiro para que React monte el lienzo antes de fotografiarlo.
      //
      // Con requestAnimationFrame NO: no se dispara si la pestaña está en
      // segundo plano, y la descarga se quedaba colgada en "Preparando..."
      // para siempre. setTimeout corre igual esté visible o no.
      await new Promise((r) => setTimeout(r, 60));
      const nodo = nodoCaptura.current;
      if (!nodo) return;

      const lienzo = await html2canvas(nodo, {
        width: 1080,
        height: 1350,
        windowWidth: 1080,
        windowHeight: 1350,
        scale: 1,
        useCORS: true,
        backgroundColor: null,
        logging: false,
        // Poda: todo lo que no sea el lienzo ni un antepasado suyo se salta.
        // Sin esto, html2canvas clona también las otras 522 tarjetas visibles.
        ignoreElements: (el) => !(el === nodo || el.contains(nodo) || nodo.contains(el)),
        // El nodo real vive con opacity 0 detrás de todo; html2canvas respeta
        // la opacidad, así que en la COPIA que va a pintar se hace visible.
        onclone: (doc) => {
          const copia = doc.querySelector(
            `[data-captura="${rowKey}"]`,
          ) as HTMLElement | null;
          if (copia) {
            copia.style.opacity = "1";
            copia.style.zIndex = "0";
          }
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
      setMontarLienzo(false);
    }
  }

  return (
      <div
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

        {montarLienzo && (
        <div
          ref={(el) => {
            nodoCaptura.current = el;
          }}
          data-captura={rowKey}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: 1080,
            height: 1350,
            overflow: "hidden",
            background:
              "radial-gradient(circle at top center, rgba(255, 120, 210, 0.10) 0%, transparent 26%), radial-gradient(circle at bottom center, rgba(190, 110, 255, 0.10) 0%, transparent 30%), linear-gradient(180deg, #04040a 0%, #090913 42%, #05050a 100%)",
            color: "white",
            fontFamily: "Raleway, system-ui, sans-serif",
            padding: 72,
            boxSizing: "border-box",
            opacity: 0,
            pointerEvents: "none",
            zIndex: -1,
          }}
        >
          <div
            style={{
              position: "relative",
              zIndex: 2,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 34,
              }}
            >
              <article
                style={{
                  position: "relative",
                  borderRadius: 56,
                  padding: 46,
                  background:
                    "linear-gradient(180deg, rgba(34,34,40,0.96) 0%, rgba(18,18,22,0.985) 100%)",
                  boxShadow: "0 10px 24px rgba(0,0,0,0.20)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 56,
                    pointerEvents: "none",
                    background:
                      "radial-gradient(circle at top left, rgba(244,178,230,0.18) 0%, rgba(244,178,230,0.07) 26%, transparent 56%)",
                  }}
                />

                <div
                  style={{
                    position: "relative",
                    zIndex: 2,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {renderHyloContent(r, category, authorName, {
                    capture: true,
                  })}
                </div>
              </article>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "center",
                gap: 9,
                fontFamily: "Raleway, system-ui, sans-serif",
                fontWeight: 600,
                fontSize: 52,
                letterSpacing: "-0.01em",
                color: "rgba(255,255,255,0.92)",
                whiteSpace: "nowrap",
                background: "#212128",
                // Sangra los 72px de padding del lienzo para llegar a
                // los bordes de la imagen, sin pasarse de ellos.
                margin: "0 -72px -72px",
                padding: "34px 44px",
              }}
            >
              <span>Descarga</span>
              <img
                src="/hylo_logo.png"
                alt="Hylo"
                style={{
                  height: LOGO_CTA_ALTO,
                  width: "auto",
                  display: "block",
                  transform: `translateY(${LOGO_CTA_BAJADA}px)`,
                }}
              />
              <span>. Tu campus ya está dentro.</span>
            </div>

          </div>
        </div>
        )}
      </div>
  );
}
