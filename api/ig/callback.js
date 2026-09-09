// Instagram vuelve aquí con un código. Se cambia por un token corto (1 hora),
// ese por uno largo (60 días), y el largo se guarda en la base.
import { config, supa, json } from "./_lib.js";

export default async function handler(req, res) {
  try {
    const { appId, appSecret, redirect } = config();
    const code = req.query?.code;

    if (req.query?.error) {
      json(res, 400, { error: req.query.error_description || req.query.error });
      return;
    }
    if (!code) {
      json(res, 400, { error: "Instagram no devolvió ningún código" });
      return;
    }

    // 1) Código -> token corto
    const cuerpo = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirect,
      code: String(code),
    });
    const r1 = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: cuerpo,
    });
    const t1 = await r1.json();
    if (!r1.ok || !t1.access_token) {
      json(res, 400, { paso: "token corto", respuesta: t1 });
      return;
    }

    // 2) Token corto -> token largo (60 días)
    const r2 = await fetch(
      "https://graph.instagram.com/access_token" +
        "?grant_type=ig_exchange_token" +
        `&client_secret=${encodeURIComponent(appSecret)}` +
        `&access_token=${encodeURIComponent(t1.access_token)}`,
    );
    const t2 = await r2.json();
    if (!r2.ok || !t2.access_token) {
      json(res, 400, { paso: "token largo", respuesta: t2 });
      return;
    }

    // 3) De quién es la cuenta (para enseñarlo en la pantalla)
    let username = null;
    try {
      const r3 = await fetch(
        `https://graph.instagram.com/v23.0/me?fields=user_id,username&access_token=${encodeURIComponent(t2.access_token)}`,
      );
      const p = await r3.json();
      username = p?.username ?? null;
    } catch {
      // El nombre es decorativo: si falla, seguimos.
    }

    const { error } = await supa()
      .from("ig_cuenta")
      .upsert({
        id: 1,
        ig_user_id: String(t1.user_id ?? ""),
        username,
        token: t2.access_token,
        caduca_en: new Date(Date.now() + (t2.expires_in ?? 5184000) * 1000).toISOString(),
        actualizado_en: new Date().toISOString(),
      });
    if (error) {
      json(res, 500, { paso: "guardar", error: error.message });
      return;
    }

    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.redirect(302, "/cotilleo");
  } catch (e) {
    json(res, 500, { error: String(e.message || e) });
  }
}
