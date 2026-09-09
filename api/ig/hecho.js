// Marca un mensaje como despachado para que no vuelva a salir en la lista.
import { supa, json } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Solo POST" });
  try {
    const id = req.body?.message_id ?? req.query?.message_id;
    if (!id) return json(res, 400, { error: "Falta message_id" });

    const db = supa();
    if (req.body?.deshacer) {
      await db.from("ig_procesados").delete().eq("message_id", String(id));
    } else {
      await db.from("ig_procesados").upsert({ message_id: String(id) });
    }
    json(res, 200, { ok: true });
  } catch (e) {
    json(res, 500, { error: String(e.message || e) });
  }
}
