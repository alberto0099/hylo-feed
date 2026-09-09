import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import {
  TarjetaHylo,
  type PanelPostRow,
} from "./tarjeta";
import { supabase } from "./supabaseClient";
import "./index.css";

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


export default function App() {
  const [rows, setRows] = useState<PanelPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openImageUrl, setOpenImageUrl] = useState<string | null>(null);

  const particles = useMemo(() => Array.from({ length: 24 }), []);

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
              const rowKey = r.source_key ?? String(r.id);

              return (
                <TarjetaHylo
                  key={rowKey}
                  r={r}
                  rowKey={rowKey}
                  onAbrirImagen={setOpenImageUrl}
                />
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
