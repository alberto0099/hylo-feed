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

const naturales = new Map<string, { w: number; h: number } | null>();

/** Alto y ancho reales de una imagen, para resolver los tamaños "auto". */
async function medidaNatural(src: string): Promise<{ w: number; h: number } | null> {
  if (naturales.has(src)) return naturales.get(src) ?? null;
  const medida = await new Promise<{ w: number; h: number } | null>((ok) => {
    const im = new Image();
    im.onload = () => ok({ w: im.naturalWidth, h: im.naturalHeight });
    im.onerror = () => ok(null);
    im.src = src;
  });
  naturales.set(src, medida);
  return medida;
}

/** Una imagen que Safari no va a pintar y que dibujaremos a mano en el lienzo. */
type ImagenSuelta = {
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

/** Mide DÓNDE cae cada imagen dentro de la foto.
 *
 *  Por qué en un iframe y no midiendo la página: la página es adaptable y en un
 *  móvil vale 402 px, pero la foto se compone siempre a 536. Las reglas
 *  @media miran el ancho de la VENTANA, así que midiendo en la página saldrían
 *  las posiciones del diseño estrecho. Un iframe tiene su propia ventana: se le
 *  da el ancho de la foto y ahí dentro el diseño es exactamente el que tendrá.
 *
 *  Devuelve las <img> y también las imágenes de fondo del propio recuadro (las
 *  haches), con sus rectángulos ya resueltos. */
async function medirImagenes(
  html: string,
  css: string,
  ancho: number,
  alto: number,
): Promise<ImagenSuelta[]> {
  const marco = document.createElement("iframe");
  marco.setAttribute("aria-hidden", "true");
  marco.style.cssText =
    `position:fixed;left:-20000px;top:0;border:0;width:${ancho}px;height:${alto}px;`;
  document.body.appendChild(marco);
  try {
    const doc = marco.contentDocument;
    if (!doc) return [];
    doc.open();
    doc.write(
      `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0}${css}</style>${html}`,
    );
    doc.close();
    // Un respiro para que aplique el CSS antes de medir.
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    const fuera: ImagenSuelta[] = [];
    const base = doc.body.getBoundingClientRect();

    for (const im of Array.from(doc.querySelectorAll("img"))) {
      const r = im.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      fuera.push({
        src: im.getAttribute("src") ?? "",
        x: r.left - base.left,
        y: r.top - base.top,
        w: r.width,
        h: r.height,
      });
    }

    // Fondos con imagen: pueden ser VARIAS capas (las seis haches), cada una
    // con su posición. Se resuelven con las mismas cuentas que hace el
    // navegador: el porcentaje reparte el hueco que sobra, no la caja entera.
    for (const el of Array.from(doc.querySelectorAll<HTMLElement>("*"))) {
      const cs = doc.defaultView?.getComputedStyle(el);
      if (!cs || cs.backgroundImage === "none") continue;
      const urls = cs.backgroundImage.split(/,(?![^(]*\))/);
      const tams = cs.backgroundSize.split(",");
      const poss = cs.backgroundPosition.split(",");
      const caja = el.getBoundingClientRect();
      for (let i = 0; i < urls.length; i++) {
        const m = urls[i].match(/url\(["']?(.+?)["']?\)/);
        if (!m) continue;
        const [tw, th] = (tams[i] ?? tams[0] ?? "").trim().split(/\s+/);
        const [px, py] = (poss[i] ?? poss[0] ?? "0% 0%").trim().split(/\s+/);
        // El navegador devuelve el tamaño tal cual se escribió, así que un
        // "119px auto" llega con ese "auto" dentro: hay que resolverlo con la
        // proporción real de la imagen.
        const natural = await medidaNatural(m[1]);
        if (!natural) continue;
        let w = parseFloat(tw);
        let h = parseFloat(th);
        if (!isFinite(w) && !isFinite(h)) {
          w = natural.w;
          h = natural.h;
        } else if (!isFinite(h)) {
          h = (w * natural.h) / natural.w;
        } else if (!isFinite(w)) {
          w = (h * natural.w) / natural.h;
        }
        const resolver = (v: string, hueco: number) =>
          v.endsWith("%") ? (parseFloat(v) / 100) * hueco : parseFloat(v) || 0;
        fuera.push({
          src: m[1],
          x: caja.left - base.left + resolver(px, caja.width - w),
          y: caja.top - base.top + resolver(py, caja.height - h),
          w,
          h,
        });
      }
    }
    return fuera;
  } finally {
    marco.remove();
  }
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
    `-webkit-font-smoothing:antialiased;` +
    // Safari infla el texto por su cuenta cuando cree que el bloque es
    // estrecho (el "text autosizing" de iOS). Dentro del foreignObject eso
    // salía con la letra más grande que en el ordenador y el reclamo partido
    // en dos líneas. Con esto el tamaño es el que dice el CSS y nada más.
    `-webkit-text-size-adjust:none;text-size-adjust:none;`;
  envoltorio.appendChild(clon);

  // OJO: dentro de un SVG esto se lee como XML, así que el HTML tiene que ir
  // bien cerrado (XMLSerializer lo garantiza; outerHTML no) y el CSS dentro de
  // un bloque literal, porque trae ">" y "&" de los selectores y las url().
  const cuerpo = new XMLSerializer().serializeToString(envoltorio);
  // Reglas que solo hacen falta dentro del SVG, para atar en corto a Safari:
  //  - el autosizing otra vez, ahora para todo lo de dentro;
  //  - los iconos de trazo (el corazón) salían RELLENOS: Safari no respeta el
  //    atributo fill="none" ahí dentro, así que se repite como CSS, que sí.
  const parchesWebkit =
    `*{-webkit-text-size-adjust:none;text-size-adjust:none}` +
    `.hylo-like svg{fill:none}` +
    `.hylo-like svg path{fill:none}`;
  const hoja = `${fuentes}\n${css}\n${parchesWebkit}`;   // css ya trae el cssExtra, con sus recursos empotrados

  // LAS IMÁGENES SE PINTAN A MANO, en todos los navegadores.
  //
  // Safari no dibuja imágenes dentro de un foreignObject —ni las <img> ni las
  // de fondo—: en el iPhone la foto salía sin el logotipo y sin las haches.
  // Chrome sí las dibuja, así que la única forma de que las dos salgan IGUALES
  // es no dejárselo a ninguno: se ocultan dentro del SVG (visibility, que no
  // mueve el sitio que ocupan) y luego se dibujan sobre el lienzo, que eso sí
  // lo hacen los dos igual.
  const sinImagenes =
    `img{visibility:hidden!important}` +
    `*{background-image:none!important}`;
  const imagenes = await medirImagenes(cuerpo, hoja, ancho, alto);
  diag.imagenesAMano = imagenes.length;
  diag.fuentesKB = Math.round(fuentes.length / 1024);
  diag.tieneFuenteEmpotrada = fuentes.includes("data:font") || fuentes.includes("data:application/font");
  diag.cssKB = Math.round(css.length / 1024);
  diag.patronEmpotrado = css.includes("patron-h") ? "sin empotrar" : "ok";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">` +
    `<foreignObject x="0" y="0" width="${ancho}" height="${alto}">` +
    `<div xmlns="http://www.w3.org/1999/xhtml">` +
    `<style><![CDATA[${hoja}\n${sinImagenes}]]></style>` +
    cuerpo +
    `</div></foreignObject></svg>`;

  // El SVG va como data: URI y NO como blob: un SVG servido desde blob: MANCHA
  // el lienzo (el navegador lo trata como otro origen) y entonces ni
  // getImageData ni toBlob funcionan, así que no habría foto que descargar.
  diag.svgKB = Math.round(svg.length / 1024);
  const img = new Image();
  img.decoding = "sync";
  await new Promise<void>((ok, mal) => {
    img.onload = () => ok();
    img.onerror = () => mal(new Error("no se pudo dibujar el SVG"));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
  // Safari resuelve `onload` antes de tener el dibujo descodificado más veces
  // de la cuenta; sin esto, lo que se pinta puede salir a medias.
  if (typeof img.decode === "function") await img.decode().catch(() => {});

  const escala = anchoFinal / ancho;
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(ancho * escala);
  lienzo.height = Math.round(alto * escala);
  const ctx = lienzo.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.drawImage(img, 0, 0);

  // Y encima, las imágenes, cada una en el sitio que se midió.
  for (const it of imagenes) {
    try {
      const pieza = new Image();
      pieza.decoding = "sync";
      await new Promise<void>((ok, mal) => {
        pieza.onload = () => ok();
        pieza.onerror = () => mal(new Error("imagen"));
        pieza.src = it.src;
      });
      ctx.drawImage(pieza, it.x, it.y, it.w, it.h);
    } catch {
      // Una imagen que no carga no puede tumbar la foto entera.
    }
  }

  // ¿Ha salido algo? Si el navegador no supo pintar el foreignObject, el lienzo
  // queda transparente y la foto sería un rectángulo vacío. Mejor saberlo aquí
  // que descubrirlo en el carrete.
  // ¿Ha salido algo? Si el navegador no supo pintar el foreignObject, el lienzo
  // queda vacío y la foto sería un rectángulo en blanco. Solo se anota para
  // poder diagnosticarlo; si el lienzo estuviera manchado, getImageData lanza
  // y no pasa nada: la foto se devuelve igual.
  try {
    const m = ctx.getImageData(0, 0, lienzo.width, lienzo.height).data;
    let pintados = 0;
    for (let i = 3; i < m.length; i += 4 * 97) if (m[i] > 8) pintados++;
    diag.lienzoPintado = pintados;
  } catch {
    diag.lienzoPintado = "no se pudo mirar";
  }

  return await new Promise<Blob | null>((res) => lienzo.toBlob(res, "image/png"));
}
