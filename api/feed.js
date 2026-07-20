import { createClient } from "@supabase/supabase-js";

const FEED_AUTHOR_OVERRIDES_BY_BODY = {
  "alguien para ir al cine a ver la nueva de spielberg?": "Daniel",
};

function sortAndDedupe(rows) {
  const seen = new Set();

  return rows
    .filter((row) => {
      const dedupeKey = `${String(row.body || "").trim()}__${row.created_at}`;
      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}

export default async function handler(_request, response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    response.status(500).json({ error: "Missing Supabase server config" });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const [panelResult, hyloResult] = await Promise.all([
    supabase
      .from("panel_posts")
      .select("id, name, body, category, is_anonymous, image_url, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("hylos")
      .select(
        "id, body, category, is_anonymous, image_url, created_at, panel_author_name, author_id"
      )
      .eq("review_status", "approved")
      .eq("is_hidden", false)
      .order("created_at", { ascending: false }),
  ]);

  if (panelResult.error && hyloResult.error) {
    response.status(500).json({
      error: "Could not fetch feed",
      panelError: panelResult.error.message,
      hyloError: hyloResult.error.message,
    });
    return;
  }

  const panelRows = (panelResult.data ?? []).map((row) => ({
    ...row,
    source_key: `panel-${row.id}`,
  }));

  const hyloRows = hyloResult.data ?? [];
  const authorIds = Array.from(
    new Set(
      hyloRows
        .filter((row) => !row.is_anonymous && row.author_id)
        .map((row) => row.author_id)
    )
  );

  let profilesById = new Map();

  if (authorIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, full_name")
      .in("id", authorIds);

    if (!profileError) {
      profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    }
  }

  const appRows = hyloRows.map((row) => {
    const profile = row.author_id ? profilesById.get(row.author_id) : null;

    return {
      id: `app-${row.id}`,
      name: row.is_anonymous
        ? null
        : FEED_AUTHOR_OVERRIDES_BY_BODY[String(row.body || "").trim()] ||
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

  response.status(200).json(sortAndDedupe([...panelRows, ...appRows]));
}
