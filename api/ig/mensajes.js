// Los DMs de la cuenta, ya en el formato que come la tarjeta del feed.
//
// Dos límites de la API de Meta que conviene tener presentes:
//   - solo se pueden leer los 20 mensajes más recientes de cada conversación;
//     los anteriores devuelven "borrado"
//   - las solicitudes de mensaje inactivas más de 30 días no se devuelven
//
// `?folder=` se deja pasar a la API a propósito: la gran incógnita es si las
// SOLICITUDES (casi todos los cotilleos vienen de gente que no sigue la
// cuenta) salen en el listado normal o hay que pedirlas aparte. Con esto se
// prueba sin tener que volver a desplegar.
//
// `?crudo=1` devuelve la respuesta tal cual llega de Meta, para diagnosticar.

import { GRAPH, tokenVigente, supa, json } from "./_lib.js";

export default async function handler(req, res) {
  try {
    const cuenta = await tokenVigente();
    if (!cuenta) {
      json(res, 200, { conectado: false, mensajes: [] });
      return;
    }

    const carpeta = req.query?.folder ? `&folder=${encodeURIComponent(req.query.folder)}` : "";
    const campos =
      "id,updated_time,participants,messages.limit(20){id,created_time,from,message}";

    const r = await fetch(
      `${GRAPH}/me/conversations?platform=instagram` +
        `&fields=${encodeURIComponent(campos)}` +
        `&limit=50${carpeta}` +
        `&access_token=${encodeURIComponent(cuenta.token)}`,
    );
    const datos = await r.json();

    if (req.query?.crudo) {
      json(res, r.ok ? 200 : 400, { estado: r.status, cuenta: cuenta.username, datos });
      return;
    }
    if (!r.ok) {
      json(res, 400, {
        conectado: true,
        error: datos?.error?.message || "Instagram devolvió un error",
        detalle: datos?.error ?? datos,
      });
      return;
    }

    // Ya despachados, para no volver a enseñarlos.
    const { data: hechos } = await supa().from("ig_procesados").select("message_id");
    const yaHechos = new Set((hechos ?? []).map((f) => f.message_id));

    const mios = String(cuenta.ig_user_id || "");
    const mensajes = [];

    for (const conv of datos?.data ?? []) {
      for (const m of conv?.messages?.data ?? []) {
        const texto = String(m.message || "").trim();
        // Fuera los vacíos (fotos, stickers, respuestas a stories sin texto)
        // y todo lo que haya escrito la propia cuenta.
        if (!texto) continue;
        if (mios && String(m.from?.id || "") === mios) continue;
        if (yaHechos.has(m.id)) continue;

        mensajes.push({
          id: m.id,
          source_key: m.id,
          name: null,
          body: texto,
          category: "",
          is_anonymous: true,
          image_url: null,
          created_at: m.created_time ?? conv.updated_time ?? new Date().toISOString(),
          // Solo para que Fabio sepa de quién es; NO se pinta en la tarjeta.
          remitente: m.from?.username ?? null,
        });
      }
    }

    mensajes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    json(res, 200, { conectado: true, cuenta: cuenta.username, mensajes });
  } catch (e) {
    json(res, 500, { error: String(e.message || e) });
  }
}
