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
  market: { emoji: "🛍️", label: "Mercado" },
  eventos: { emoji: "🏟️", label: "Eventos" },
  oportunidades: { emoji: "✨", label: "Oportunidades" },
  objetos_perdidos: { emoji: "🔍", label: "Objetos perdidos" },
  general: { emoji: "💬", label: "General" },
} as const;

type CategoryKey = keyof typeof MAP;

type PanelPostRow = {
  id: number | string;
  name: string | null;
  body: string;
  category: string;
  is_anonymous: boolean;
  image_url: string | null;
  created_at: string;
  source_key?: string;
};

type AppHyloRow = {
  id: number;
  body: string;
  category: string;
  is_anonymous: boolean;
  image_url: string | null;
  created_at: string;
  author_id: string | null;
  panel_author_name: string | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
};

const FEED_AUTHOR_OVERRIDES_BY_BODY: Record<string, string> = {
  "alguien para ir al cine a ver la nueva de spielberg?": "Daniel",
};

const EXTRA_FEED_ROWS: PanelPostRow[] = [
  {
    id: -1406,
    name: null,
    body: "Chica rubia que estaba en el fitness park alas 10pm, iba de negro",
    category: "crushes",
    is_anonymous: true,
    image_url: null,
    created_at: "2026-06-02T20:19:42.06944+00:00",
  },
  {
    id: -2245,
    name: null,
    body: "Se alquila piso en el alto de extremadura para el próximo curso, escribeme en hylo.",
    category: "pisos",
    is_anonymous: true,
    image_url: null,
    created_at: "2026-06-02T10:00:00.000+00:00",
  },
  {
    id: -5001,
    name: null,
    body: "Holaa estamos buscando grupo de gente que se quede en villa este verano para hacer planes",
    category: "actividades",
    is_anonymous: true,
    image_url: null,
    created_at: "2026-06-05T12:56:00.000+00:00",
  },
  {
    id: -5002,
    name: null,
    body: "African girl friday at jowke, need her @",
    category: "crushes",
    is_anonymous: true,
    image_url: null,
    created_at: "2026-06-06T10:12:00.000+00:00",
  },
  {
    id: -5003,
    name: "Oax",
    body: "Buscamos chica para grabar videos para redes sociales para un gran proyecto. Si estás interesada, envíanos:\n• Tu nombre y edad.\n• Ciudad de residencia.\n• Tu Instagram o TikTok.\n• 2 o 3 fotos recientes.\n• Un breve vídeo de presentación.\n\n¡Te esperamos!\n\noaxproject@gmail.com",
    category: "oportunidades",
    is_anonymous: false,
    image_url: null,
    created_at: "2026-06-07T00:00:32.000Z",
  },
  {
    id: -6001,
    name: null,
    body: "Se alquila habitación a partir de julio en monte de la villa, al lado de la uni, escribeme por hylo,",
    category: "pisos",
    is_anonymous: true,
    image_url: null,
    created_at: "2026-06-06T16:54:00.000Z",
  },
  {
    id: -6002,
    name: null,
    body: "Compro Macbook de mínimo 24gb, escribeme por hylo si tienes",
    category: "market",
    is_anonymous: true,
    image_url: null,
    created_at: "2026-06-06T19:04:00.000Z",
  },
  {
    id: -8001,
    name: "Daniel",
    body: "alguien para ir al cine a ver la nueva de spielberg?",
    category: "actividades",
    is_anonymous: false,
    image_url: null,
    created_at: "2026-06-08T15:54:00.000Z",
  },
  {
    id: -8002,
    name: null,
    body: "Se alquila habitación próximamente en calle Ebro, justo en frente de la parada de bus",
    category: "pisos",
    is_anonymous: true,
    image_url: null,
    created_at: "2026-06-08T18:20:00.000Z",
  },
  {
    id: -11001,
    name: "Sarah",
    body: "Se busca monitor/a para campamento de verano con niños peques para colegio en Villaviciosa de Odón, para actividades como baloncesto, tenis, hockey.",
    category: "oportunidades",
    is_anonymous: false,
    image_url: null,
    created_at: "2026-06-11T19:03:00.000Z",
  },
  {
    id: -13001,
    name: null,
    body: "I need help converting to Islam. I'm a bit lost, but I feel an attraction to this religion that I can't explain.",
    category: "",
    is_anonymous: true,
    image_url: null,
    created_at: "2026-06-13T10:04:00.000Z",
  },
];

function mergeFeedRows(baseRows: PanelPostRow[]) {
  const rowsWithExtras = [
    ...baseRows,
    ...EXTRA_FEED_ROWS.filter(
      (extraRow) => !baseRows.some((row) => row.body === extraRow.body)
    ),
  ];
  const seen = new Set<string>();

  return rowsWithExtras
    .filter((row) => {
      const dedupeKey = `${row.body.trim()}__${row.created_at}`;
      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}

function safeCategory(category: string): CategoryKey | null {
  const normalizedCategory = category.trim();

  if (!normalizedCategory || normalizedCategory === "general") return null;
  if (normalizedCategory in MAP) return normalizedCategory as CategoryKey;
  return "crushes";
}

// Mismo sistema date/time que la app RN (relativeTimeShort de lib/format.ts):
//   1seg … 59seg → 1min … 59min → 1h … 23h → 1d … 6d → dd/mm/aa (año 2 dígitos)
function formatFeedDate(iso: string) {
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

export default function App() {
  const [rows, setRows] = useState<PanelPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openImageUrl, setOpenImageUrl] = useState<string | null>(null);

  const particles = useMemo(() => Array.from({ length: 24 }), []);
  const captureRefs = useRef<Record<string, HTMLDivElement | null>>({});

  async function fetchPosts() {
    try {
      const response = await fetch(`/api/feed?ts=${Date.now()}`, {
        cache: "no-store",
      });

      if (response.ok) {
        const apiRows = (await response.json()) as PanelPostRow[];
        setRows(mergeFeedRows(apiRows));
        setLoading(false);
        return;
      }

      console.error("FETCH API FEED ERROR:", await response.text());
    } catch (error) {
      console.error("FETCH API FEED ERROR:", error);
    }

    const { data: panelData, error: panelError } = await supabase
      .from("panel_posts")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: hyloData, error: hyloError } = await supabase
      .from("hylos")
      .select(
        "id, body, category, is_anonymous, image_url, created_at, panel_author_name, author_id"
      )
      .eq("review_status", "approved")
      .eq("is_hidden", false)
      .order("created_at", { ascending: false });

    if (panelError) {
      console.error("FETCH PANEL POSTS ERROR:", panelError);
    }

    if (hyloError) {
      console.error("FETCH APP HYLOS ERROR:", hyloError);
    }

    const panelRows = ((panelData as PanelPostRow[]) ?? []).map((row) => ({
      ...row,
      source_key: `panel-${row.id}`,
    }));

    const hyloRows = (hyloData as unknown as AppHyloRow[] | null) ?? [];
    const authorIds = Array.from(
      new Set(
        hyloRows
          .filter((row) => !row.is_anonymous && row.author_id)
          .map((row) => row.author_id as string)
      )
    );

    let profilesById = new Map<string, ProfileRow>();

    if (authorIds.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, full_name")
        .in("id", authorIds);

      if (profileError) {
        console.error("FETCH HYLO AUTHORS ERROR:", profileError);
      } else {
        profilesById = new Map(
          ((profileData as ProfileRow[] | null) ?? []).map((profile) => [
            profile.id,
            profile,
          ])
        );
      }
    }

    const appRows = hyloRows.map((row) => {
      const profile = row.author_id ? profilesById.get(row.author_id) : null;

      return {
        id: `app-${row.id}`,
        name: row.is_anonymous
          ? null
          : FEED_AUTHOR_OVERRIDES_BY_BODY[row.body.trim()] ||
            row.panel_author_name?.trim() ||
            profile?.full_name?.trim() ||
            profile?.username?.trim() ||
            null,
        body: row.body,
        category: row.category,
        is_anonymous: row.is_anonymous,
        image_url: row.image_url,
        created_at: row.created_at,
        source_key: `app-${row.id}`,
      };
    });

    setRows(mergeFeedRows([...panelRows, ...appRows]));
    setLoading(false);
  }

  useEffect(() => {
    fetchPosts();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("hylo-feed-posts")
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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "hylos",
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
    category: CategoryKey | null,
    authorName: string,
    opts?: {
      capture?: boolean;
    }
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
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginTop: meta ? (hasImage ? 8 : 10) : 0,
          }}
        >
          <div className="hylo-authorline">
            <div
              className="hylo-author"
              style={{
                fontSize: capture ? 16 : hasImage ? 14 : 16,
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
              fontSize: capture ? 13 : hasImage ? 12 : 13,
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
                        setOpenImageUrl(r.image_url);
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
              const categoryClass = category ?? "uncategorized";
              const rowKey = r.source_key ?? String(r.id);
              const authorName = r.is_anonymous
                ? "Anónimo"
                : (r.name?.trim() || "Usuario");

              return (
                <div
                  key={rowKey}
                  className={`hylo-item ${r.image_url ? "hylo-item--image" : ""}`}
                  style={{
                    paddingLeft: 10,
                    paddingRight: 10,
                  }}
                >
                  <article
                    className={`hylo-card hylo-card--${categoryClass} ${
                      r.image_url ? "hylo-card--image" : ""
                    }`}
                  >
                    <div className={`hylo-card-overlay hylo-card-overlay--${categoryClass}`} />

                    <div className="hylo-card-content">
                      {renderHyloContent(r, category, authorName)}
                    </div>
                  </article>

                  <div className="hylo-logo-slot" aria-hidden="true">
                    <img src="/hylo_logospain.png" alt="" className="hylo-bottom-logo" />
                  </div>

                  <div
                    ref={(el) => {
                      captureRefs.current[rowKey] = el;
                    }}
                    style={{
                      position: "fixed",
                      top: 0,
                      left: 0,
                      width: 1080,
                      height: 1350,
                      overflow: "hidden",
                      background: "#000000",
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
                              background: "transparent",
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
