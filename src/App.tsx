import { useEffect, useMemo, useState, type CSSProperties } from "react";
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

  if (d >= startToday) return "Hoy";
  if (d >= startYesterday) return "Ayer";
  if (d >= startAnteayer) return "Anteayer";

  return d.toLocaleDateString("es-ES");
}

export default function App() {
  const [rows, setRows] = useState<PanelPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const particles = useMemo(() => Array.from({ length: 24 }), []);

  useEffect(() => {
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

    fetchPosts();
  }, []);

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
              const meta = MAP[category];
              const authorName = r.is_anonymous
                ? "Anónimo"
                : (r.name?.trim() || "Usuario");

              return (
                <div key={r.id} className="hylo-item">
                  <article className="hylo-card">
                    <div className={`hylo-card-overlay hylo-card-overlay--${category}`} />

                    <div className="hylo-card-content">
                      <div className={`hylo-badge hylo-badge--${category}`}>
                        {meta.emoji ? (
                          <span className="hylo-badge-emoji" aria-hidden="true">
                            {meta.emoji}
                          </span>
                        ) : null}
                        <span>{meta.label}</span>
                      </div>

                      <div className="hylo-meta">
                        <div className="hylo-authorline">
                          <div className="hylo-author">{authorName}</div>
                        </div>

                        <div className="hylo-time">{formatFeedDate(r.created_at)}</div>
                      </div>

                      <p className="hylo-body">{r.body}</p>

                      {r.image_url ? (
                        <img
                          src={r.image_url}
                          alt=""
                          className="hylo-post-img"
                          loading="lazy"
                        />
                      ) : null}
                    </div>
                  </article>

                  <div className="hylo-promo-slot">
                    <img
                      src="/hylo-promo.png"
                      alt="Hylo promo"
                      className="hylo-promo-img"
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}