// Manda a Fabio a la pantalla de permisos de Instagram. Se usa UNA vez.
import { config, json } from "./_lib.js";

export default async function handler(_req, res) {
  try {
    const { appId, redirect } = config();
    const url =
      "https://www.instagram.com/oauth/authorize" +
      `?client_id=${encodeURIComponent(appId)}` +
      `&redirect_uri=${encodeURIComponent(redirect)}` +
      "&response_type=code" +
      "&scope=instagram_business_basic%2Cinstagram_business_manage_messages";
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.redirect(302, url);
  } catch (e) {
    json(res, 500, { error: String(e.message || e) });
  }
}
