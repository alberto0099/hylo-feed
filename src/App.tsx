import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { supabase } from "./supabaseClient";
import "./index.css";

const MAP = {
  crushes: { emoji: "😍", label: "Crushes" },
  apuntes: { emoji: "📚", label: "Apuntes" },
  fiestas: { emoji: "🎉", label: "Fiestas" },
  pisos: { emoji: "🏠", label: "Pisos" },
  actividades: { emoji: "📆", label: "Actividades" },
  market: { emoji: "🛒", label: "Mercado" },
  eventos: { emoji: "🏟️", label: "Eventos" },
  objetos_perdidos: { emoji: "🔍", label: "Objetos perdidos" },
} as const;

type CategoryKey = keyof typeof MAP;

type PanelPostRow = {
  id: number;
  name: string | null;
  body: string;
  category: string;
  is_anonymous: boolean;
  image_url: string | null;
  created_at: string;
};

function safeCategory(category: string): CategoryKey {
  if (category in MAP) return category as CategoryKey;
  return "crushes";
}

function formatFeedDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();

  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  const startAnteayer = new Date(startToday);
  startAnteayer.setDate(startAnteayer.getDate() - 2);

  const time = d.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (d >= startToday) return `Hoy   ${time}`;
  if (d >= startYesterday) return `Ayer   ${time}`;
  if (d >= startAnteayer) return `Anteayer   ${time}`;

  const fullDate = d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return `${fullDate}   ${time}`;
}

export default function App() {
  const [rows, setRows] = useState<PanelPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openImageUrl, setOpenImageUrl] = useState<string | null>(null);

  const particles = useMemo(() => Array.from({ length: 24 }), []);
  const captureRefs = useRef<Record<number, HTMLDivElement | null>>({});

  async function fetchPosts() {
    const { data, error } = await supabase
      .from("panel_posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("FETCH PANEL POSTS ERROR:", error);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data as PanelPostRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchPosts();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("panel-posts-feed")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "panel_posts",
        },
        async () => {
          await fetchPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      fetchPosts();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  function renderHyloContent(
    r: PanelPostRow,
    category: CategoryKey,
    authorName: string,
    opts?: {
      capture?: boolean;
    }
  ): ReactNode {
    const capture = !!opts?.capture;
    const hasImage = !!r.image_url && !capture;
    const meta = MAP[category];

    return (
      <>
        <div
          className={`hylo-badge hylo-badge--${category}`}
          style={{
            fontSize: capture ? 15 : hasImage ? 13 : 14,
            padding: capture ? "7px 14px" : hasImage ? "6px 12px" : "7px 13px",
            borderRadius: 999,
            fontWeight: 600,
          }}
        >
          {meta.emoji ? (
            <span
              className="hylo-badge-emoji"
              aria-hidden="true"
              style={{
                width: capture ? 24 : hasImage ? 17 : 18,
                height: capture ? 24 : hasImage ? 17 : 18,
                fontSize: capture ? 20 : hasImage ? 14 : 15,
              }}
            >
              {meta.emoji}
            </span>
          ) : null}
          <span>{meta.label}</span>
        </div>

        <div
          className="hylo-meta"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginTop: hasImage ? 8 : 10,
          }}
        >
          <div className="hylo-authorline">
            <div
              className="hylo-author"
              style={{
                fontSize: capture ? 16 : hasImage ? 13 : 15,
                fontWeight: 600,
                marginTop: hasImage ? 3 : 4,
              }}
            >
              {authorName}
            </div>
          </div>

          <div
            className="hylo-time"
            style={{
              fontSize: capture ? 13 : hasImage ? 11 : 12,
              opacity: 0.85,
              fontWeight: 500,
              marginTop: hasImage ? 3 : 4,
              whiteSpace: "pre",
            }}
          >
            {formatFeedDate(r.created_at)}
          </div>
        </div>

        <p
          className="hylo-body"
          style={{
            fontSize: capture ? 16 : hasImage ? 13 : 15,
            lineHeight: hasImage ? 1.32 : 1.36,
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
              paddingLeft: capture ? 0 : hasImage ? 0 : 2,
              paddingRight: capture ? 0 : hasImage ? 0 : 2,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: capture ? "100%" : "auto",
                maxWidth: capture ? "100%" : hasImage ? 210 : 260,
                maxHeight: capture ? 560 : hasImage ? 210 : 260,
                borderRadius: hasImage ? 20 : 22,
                overflow: "hidden",
                background: "transparent",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
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
                        setOpenImageUrl(r.image_url);
                      }
                }
                style={{
                  width: "auto",
                  height: "auto",
                  maxWidth: "100%",
                  maxHeight: capture ? 560 : hasImage ? 210 : 260,
                  objectFit: "contain",
                  display: "block",
                  borderRadius: hasImage ? 20 : 22,
                  cursor: capture ? "default" : "zoom-in",
                }}
              />
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="app-shell">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />

      <div className="particles" aria-hidden="true">
        {particles.map((_, i) => (
          <span
            key={i}
            className={`particle particle-${(i % 6) + 1}`}
            style={
              {
                "--left": `${4 + ((i * 11) % 88)}%`,
                "--size": `${4 + (i % 4) * 2}px`,
                "--delay": `${(i % 7) * 0.8}s`,
                "--duration": `${8 + (i % 5)}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="hylo-wrap">
        <div className="hylo-grid">
          {loading ? (
            <div className="hylo-empty">Cargando hylos...</div>
          ) : rows.length === 0 ? (
            <div className="hylo-empty">Aún no hay hylos publicados.</div>
          ) : (
            rows.map((r) => {
              const category = safeCategory(r.category);
              const authorName = r.is_anonymous
                ? "Anónimo"
                : (r.name?.trim() || "Usuario");

              return (
                <div
                  key={r.id}
                  className={`hylo-item ${r.image_url ? "hylo-item--image" : ""}`}
                  style={{
                    paddingLeft: 10,
                    paddingRight: 10,
                  }}
                >
                  <article
                    className={`hylo-card hylo-card--${category} ${
                      r.image_url ? "hylo-card--image" : ""
                    }`}
                  >
                    <div className={`hylo-card-overlay hylo-card-overlay--${category}`} />

                    <div className="hylo-card-content">
                      {renderHyloContent(r, category, authorName)}
                    </div>
                  </article>

                  <div className="hylo-promo-slot">
                    <img
                      src="/hylo-promo.png"
                      alt="Hylo promo"
                      className="hylo-promo-img"
                    />
                  </div>

                  <div
                    ref={(el) => {
                      captureRefs.current[r.id] = el;
                    }}
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
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        overflow: "hidden",
                      }}
                    >
                      {particles.map((_, i) => (
                        <span
                          key={`capture-p-${i}`}
                          style={{
                            position: "absolute",
                            left: `${4 + ((i * 11) % 88)}%`,
                            bottom: `${(i * 37) % 1000 - 80}px`,
                            width: `${4 + (i % 4) * 2}px`,
                            height: `${4 + (i % 4) * 2}px`,
                            borderRadius: 999,
                            background:
                              i % 6 === 0
                                ? "rgba(243, 179, 234, 0.75)"
                                : i % 6 === 1
                                ? "rgba(255, 158, 220, 0.58)"
                                : i % 6 === 2
                                ? "rgba(232, 170, 255, 0.55)"
                                : i % 6 === 3
                                ? "rgba(255, 190, 235, 0.52)"
                                : i % 6 === 4
                                ? "rgba(243, 179, 234, 0.42)"
                                : "rgba(255, 140, 210, 0.48)",
                            boxShadow:
                              "0 0 10px rgba(243,179,234,0.28), 0 0 20px rgba(243,179,234,0.14)",
                            opacity: 0.75,
                          }}
                        />
                      ))}
                    </div>

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
                          paddingTop: 18,
                        }}
                      >
                        <img
                          src="/hylo-promo.png"
                          alt="Hylo promo"
                          crossOrigin="anonymous"
                          style={{
                            width: "100%",
                            height: "auto",
                            display: "block",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {openImageUrl && (
        <div
          onClick={() => setOpenImageUrl(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.92)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "64px 18px 18px",
          }}
        >
          <img
            src={openImageUrl}
            alt=""
            style={{
              maxWidth: "100%",
              maxHeight: "90vh",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              borderRadius: 22,
              display: "block",
              boxShadow: "0 20px 60px rgba(0,0,0,0.40)",
            }}
          />

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenImageUrl(null);
            }}
            style={{
              position: "fixed",
              top: 24,
              right: 24,
              width: 42,
              height: 42,
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(255,255,255,0.10)",
              color: "white",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100000,
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

