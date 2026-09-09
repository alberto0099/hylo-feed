// Piezas compartidas por los endpoints de Instagram.
//
// El token de la cuenta vive en Supabase (tabla ig_cuenta, con RLS y sin
// políticas: solo la service role la ve). Nunca sale al navegador.

import { createClient } from "@supabase/supabase-js";

export const GRAPH = "https://graph.instagram.com/v23.0";

export function supa() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Falta la configuración de Supabase");
  return createClient(url, key, { auth: { persistSession: false } });
}

export function config() {
  const appId = process.env.IG_APP_ID;
  const appSecret = process.env.IG_APP_SECRET;
  // La URL de retorno tiene que coincidir LETRA POR LETRA con la que esté
  // dada de alta en el panel de Meta, o el intercambio del código falla.
  const redirect =
    process.env.IG_REDIRECT_URI ||
    "https://hylo-feed.vercel.app/api/ig/callback";
  if (!appId || !appSecret) {
    throw new Error("Faltan IG_APP_ID / IG_APP_SECRET en las variables de Vercel");
  }
  return { appId, appSecret, redirect };
}

/**
 * Devuelve un token válido, renovándolo si le quedan menos de 7 días.
 *
 * Los tokens largos de Instagram duran 60 días y se renuevan llamando a
 * refresh_access_token. Mientras alguien abra la herramienta cada dos meses,
 * la sesión no caduca jamás y Fabio no vuelve a iniciar sesión.
 */
export async function tokenVigente() {
  const db = supa();
  const { data, error } = await db.from("ig_cuenta").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(`No se pudo leer la cuenta: ${error.message}`);
  if (!data) return null;

  const quedan = new Date(data.caduca_en).getTime() - Date.now();
  const SIETE_DIAS = 7 * 24 * 60 * 60 * 1000;
  if (quedan > SIETE_DIAS) return data;

  const r = await fetch(
    `${GRAPH.replace("/v23.0", "")}/refresh_access_token` +
      `?grant_type=ig_refresh_token&access_token=${encodeURIComponent(data.token)}`,
  );
  const j = await r.json();
  if (!r.ok || !j.access_token) {
    // Renovar falló: se devuelve el que hay. Si ya está muerto, el endpoint
    // que lo use dará un error claro y Fabio tendrá que volver a conectar.
    return data;
  }

  const caduca = new Date(Date.now() + (j.expires_in ?? 5184000) * 1000).toISOString();
  await db
    .from("ig_cuenta")
    .update({ token: j.access_token, caduca_en: caduca, actualizado_en: new Date().toISOString() })
    .eq("id", 1);

  return { ...data, token: j.access_token, caduca_en: caduca };
}

export function json(res, code, cuerpo) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.status(code).json(cuerpo);
}
