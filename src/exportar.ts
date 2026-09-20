/**
 * Exportar la tarjeta a PNG dibujándola con el PROPIO navegador.
 *
 * html2canvas vuelve a dibujar la página a mano y no sabe pintar perspectiva,
 * sombras ni fondos: la foto salía plana, con otro fondo y con el texto sin
 * espacios. Aquí se mete el nodo tal cual dentro de un <foreignObject> de un
 * SVG y se pinta esa imagen en un lienzo: lo renderiza el motor del navegador,
 * así que sale EXACTAMENTE lo que se ve, y a la resolución que se pida.
 *
 * Lo único que hay que preparar es que dentro del SVG no queden referencias a
 * ficheros de fuera (tipografías, imágenes): se empotran como datos.
 */

const cacheRecurso = new Map<string, string>();

/** Para depurar desde la consola: window.__diagExport */
export const diag: Record<string, unknown> = {};

async function aDatos(url: string): Promise<string> {
  const ya = cacheRecurso.get(url);
  if (ya) return ya;
  const res = await fetch(url, { mode: "cors" });
  const blob = await res.blob();
  const datos = await new Promise<string>((ok, mal) => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result));
    fr.onerror = mal;
    fr.readAsDataURL(blob);
  });
  cacheRecurso.set(url, datos);
  return datos;
}

/** El CSS de Raleway con los ficheros de la tipografía ya empotrados. */
let cssFuentes: string | null = null;
async function fuentesEmpotradas(): Promise<string> {
  if (cssFuentes !== null) return cssFuentes;
  try {
    const url =
      "https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;600;700;800&display=swap";
    const hoja = await (await fetch(url)).text();
    // Solo los bloques de latín: los demás alfabetos no se usan y pesan.
    const bloques = hoja
      .split("@font-face")
      .filter((b) => /unicode-range:[^;]*U\+00/.test(b) || /unicode-range:[^;]*U\+0100/.test(b))
      .map((b) => "@font-face" + b);
    let out = bloques.join("\n");
    for (const [, u] of out.matchAll(/url\((https:\/\/[^)]+)\)/g)) {
      try {
        out = out.split(u).join(await aDatos(u));
      } catch {
        // Si una variante no se deja descargar, se queda la URL: el navegador
        // ya la tiene en caché para la página, y si no, usa otra variante.
      }
    }
    cssFuentes = out;
  } catch {
    cssFuentes = "";
  }
  return cssFuentes;
}

/** Todo el CSS de la página, tal cual, para meterlo dentro del SVG. */
function cssDeLaPagina(): string {
  let css = "";
  for (const hoja of Array.from(document.styleSheets)) {
    try {
      for (const regla of Array.from(hoja.cssRules)) css += regla.cssText + "\n";
    } catch {
      // Hoja de otro origen (las tipografías): se empotran aparte.
    }
  }
  return css;
}

/** Cambia las url(...) de recursos locales por sus datos. */
async function empotrarRecursosCss(css: string): Promise<string> {
  const urls = new Set<string>();
  for (const [, u] of css.matchAll(/url\(["']?(\/[^)"']+)["']?\)/g)) urls.add(u);
  let out = css;
  for (const u of urls) {
    try {
      out = out.split(u).join(await aDatos(new URL(u, location.origin).href));
    } catch {
      // Recurso que no está: se deja como está.
    }
  }
  return out;
}

/** Las <img> del clon, también empotradas. */
async function empotrarImagenes(raiz: HTMLElement) {
  const imgs = Array.from(raiz.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) return;
      try {
        img.setAttribute("src", await aDatos(new URL(src, location.origin).href));
      } catch {
        // Imagen que no deja copiarse: se queda tal cual.
      }
    }),
  );
}

export type OpcionesExportar = {
  /** Ancho en píxeles CSS del recorte (el recuadro 4:5). */
  ancho: number;
  /** Alto en píxeles CSS del recorte. */
  alto: number;
  /** Ancho final del PNG. 1080 para Instagram. */
  anchoFinal: number;
  /** CSS extra solo para la foto (quitar líneas del marco, etc.). */
  cssExtra?: string;
};

export async function exportarNodoAPng(
  nodo: HTMLElement,
  { ancho, alto, anchoFinal, cssExtra = "" }: OpcionesExportar,
): Promise<Blob | null> {
  try {
    await document.fonts?.ready;
  } catch {
    // Navegador sin la API.
  }

  const clon = nodo.cloneNode(true) as HTMLElement;
  clon.style.width = `${ancho}px`;
  clon.style.height = `${alto}px`;
  clon.style.margin = "0";
  await empotrarImagenes(clon);

  const css = await empotrarRecursosCss(cssDeLaPagina() + "\n" + cssExtra);
  const fuentes = await fuentesEmpotradas();

  // Dentro del SVG no hay <body>, así que lo que la página hereda de él
  // (tipografía, color, interlineado) hay que ponérselo al envoltorio a mano:
  // si no, el texto sale con la tipografía de defecto del navegador.
  const delBody = getComputedStyle(document.body);
  const envoltorio = document.createElement("div");
  envoltorio.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  envoltorio.style.cssText =
    `width:${ancho}px;height:${alto}px;overflow:hidden;` +
    `font-family:${delBody.fontFamily};font-size:${delBody.fontSize};` +
    `line-height:${delBody.lineHeight};color:${delBody.color};` +
    `-webkit-font-smoothing:antialiased;`;
  envoltorio.appendChild(clon);

  // OJO: dentro de un SVG esto se lee como XML, así que el HTML tiene que ir
  // bien cerrado (XMLSerializer lo garantiza; outerHTML no) y el CSS dentro de
  // un bloque literal, porque trae ">" y "&" de los selectores y las url().
  const cuerpo = new XMLSerializer().serializeToString(envoltorio);
  const hoja = `${fuentes}\n${css}`;   // css ya trae el cssExtra, con sus recursos empotrados
  diag.fuentesKB = Math.round(fuentes.length / 1024);
  diag.tieneFuenteEmpotrada = fuentes.includes("data:font") || fuentes.includes("data:application/font");
  diag.cssKB = Math.round(css.length / 1024);
  diag.patronEmpotrado = css.includes("patron-h") ? "sin empotrar" : "ok";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">` +
    `<foreignObject x="0" y="0" width="${ancho}" height="${alto}">` +
    `<div xmlns="http://www.w3.org/1999/xhtml">` +
    `<style><![CDATA[${hoja}]]></style>` +
    cuerpo +
    `</div></foreignObject></svg>`;

  const img = new Image();
  img.decoding = "sync";
  await new Promise<void>((ok, mal) => {
    img.onload = () => ok();
    img.onerror = () => mal(new Error("no se pudo dibujar el SVG"));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });

  const escala = anchoFinal / ancho;
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(ancho * escala);
  lienzo.height = Math.round(alto * escala);
  const ctx = lienzo.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.drawImage(img, 0, 0);

  return await new Promise<Blob | null>((res) => lienzo.toBlob(res, "image/png"));
}
