/**
 * La foto del hylo, dibujada en 3D con el mismo motor y la misma luz que las
 * animaciones de Hylo.
 *
 * Cómo funciona, en corto:
 *  1. La tarjeta se fotografía PLANA (sin giro ni sombra) con exportar.ts, que
 *     la dibuja con el navegador: así el texto, los emojis y la etiqueta salen
 *     exactos, con su tipografía.
 *  2. Esa imagen se pega como textura sobre una losa 3D de cantos redondeados.
 *  3. Se enciende la misma luz de las animaciones (clave, relleno, contraluz
 *     rosa y el entorno), se pone el fondo oscuro con las haches y se saca la
 *     foto a 1080 de ancho.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { exportarNodoAPng } from "./exportar";

const U = 0.01; // 1 píxel de la tarjeta = 0,01 unidades, como en las animaciones
const ROSA = "#f4b2e6";

/** Losa redondeada con normales exactas: el canto sale liso, sin facetas. */
function losa(wPx: number, hPx: number, rPx: number, depthPx: number, bevelPx: number) {
  const w = wPx * U, h = hPx * U, d = Math.max(0.001, depthPx * U);
  const b = Math.max(1e-4, Math.min(bevelPx * U, d / 2 - 1e-4, w / 2 - 1e-4, h / 2 - 1e-4));
  const ri = Math.max(1e-4, Math.min(rPx * U, w / 2, h / 2) - b);
  const cx0 = Math.max(0, w / 2 - b - ri), cy0 = Math.max(0, h / 2 - b - ri);
  const NC = 40, NB = 12;
  const ring: number[][] = [];
  for (const [sx, sy, a0] of [[1, -1, -Math.PI / 2], [1, 1, 0], [-1, 1, Math.PI / 2], [-1, -1, Math.PI]]) {
    for (let i = 0; i <= NC; i++) {
      const a = a0 + (i / NC) * Math.PI / 2, c = Math.cos(a), sn = Math.sin(a);
      ring.push([sx * cx0 + ri * c, sy * cy0 + ri * sn, c, sn]);
    }
  }
  const prof: number[][] = [];
  for (let j = 0; j <= NB; j++) prof.push([(j / NB) * Math.PI / 2, d / 2 - b]);
  for (let j = 0; j <= NB; j++) prof.push([Math.PI / 2 + (j / NB) * Math.PI / 2, -(d / 2 - b)]);
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  const put = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => {
    pos.push(x, y, z); nor.push(nx, ny, nz); uv.push(x / w + 0.5, y / h + 0.5);
  };
  for (const [ph, zc] of prof) {
    const sp = Math.sin(ph), cp = Math.cos(ph);
    for (const [x, y, nx, ny] of ring) put(x + nx * b * sp, y + ny * b * sp, zc + b * cp, nx * sp, ny * sp, cp);
  }
  const C = ring.length, R = prof.length;
  const grupos: number[][] = [];   // [inicio, cuantos, material]
  for (let r = 0; r < R - 1; r++) {
    for (let c = 0; c < C; c++) {
      const c1 = (c + 1) % C, a = r * C + c, bb = r * C + c1, cc = (r + 1) * C + c1, dd = (r + 1) * C + c;
      idx.push(a, cc, bb, a, dd, cc);
    }
  }
  grupos.push([0, idx.length, 0]);            // el canto
  const cap: { x: number; y: number }[] = [];
  for (const [x, y] of ring) {
    const ult = cap[cap.length - 1];
    if (!ult || Math.hypot(ult.x - x, ult.y - y) > 1e-7) cap.push({ x, y });
  }
  const tris = THREE.ShapeUtils.triangulateShape(cap.map((p) => new THREE.Vector2(p.x, p.y)), []);
  for (const [zz, nz] of [[d / 2, 1], [-d / 2, -1]]) {
    const base = pos.length / 3;
    const desde = idx.length;
    for (const v of cap) put(v.x, v.y, zz, 0, 0, nz);
    for (const [i0, i1, i2] of tris) {
      const e = (cap[i1].x - cap[i0].x) * (cap[i2].y - cap[i0].y) - (cap[i1].y - cap[i0].y) * (cap[i2].x - cap[i0].x);
      if ((e > 0) === (nz > 0)) idx.push(base + i0, base + i1, base + i2);
      else idx.push(base + i0, base + i2, base + i1);
    }
    grupos.push([desde, idx.length - desde, nz > 0 ? 1 : 0]);   // 1 = la cara
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeBoundingSphere();
  for (const [a, n, m] of grupos) g.addGroup(a, n, m);
  return g;
}

/** Lo que mide el mosaico de haches en la página, en píxeles CSS.
 *  Tiene que ser el mismo número que `background-size` en index.css. */
export const HACHE_PX = 240;

/** El fondo de la foto: oscuro con las haches, igual que la página. */
async function texturaFondo(w: number, h: number, ladoHache: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d")!;
  // El mismo degradado de .app-shell, pero contado ya mezclado con el fondo:
  // en la página el rosa va al 50% sobre #140c13, o sea #251622.
  const g = x.createRadialGradient(w / 2, h * 0.3, 30, w / 2, h * 0.34, h * 1.1);
  g.addColorStop(0, "#180f17"); g.addColorStop(0.55, "#150d14"); g.addColorStop(1, "#130b12");
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  const patron = await new Promise<HTMLImageElement | null>((ok) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = () => ok(null);
    im.src = "/patron-h.png";
  });
  if (patron) {
    const lado = Math.max(8, Math.round(ladoHache));
    x.save();
    x.globalAlpha = 0.055;                       // la misma que .app-shell::before
    x.translate(w / 2, h / 2);
    x.rotate((-11 * Math.PI) / 180);
    x.translate(-w, -h);
    const altoLado = Math.round(lado * patron.height / patron.width);
    for (let yy = 0; yy < h * 2.2; yy += altoLado) {
      for (let xx = 0; xx < w * 2.2; xx += lado) {
        x.drawImage(patron, xx, yy, lado, altoLado);
      }
    }
    x.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export type Opciones3D = {
  /** Ancho del PNG. 1080 para Instagram. */
  anchoFinal?: number;
  /** Proporción. 1.25 = 4:5. */
  proporcion?: number;
  /** El reclamo de debajo ("Descarga hylo…"), para que salga también en la foto. */
  nodoCta?: HTMLElement | null;
};

/**
 * Dibuja la tarjeta `nodoTarjeta` (el <article class="hylo-card">) como una
 * losa 3D y devuelve el PNG.
 */
export async function exportarTarjeta3D(
  nodoTarjeta: HTMLElement,
  { anchoFinal = 1080, proporcion = 1.25, nodoCta = null }: Opciones3D = {},
): Promise<Blob | null> {
  const caja = nodoTarjeta.getBoundingClientRect();
  // El ancho/alto SIN el escalado del CSS: la losa se hace a esa medida.
  const anchoTarjeta = nodoTarjeta.offsetWidth;
  const altoTarjeta = nodoTarjeta.offsetHeight;

  // 1) La cara de la tarjeta, plana y a triple resolución.
  const caraBlob = await exportarNodoAPng(nodoTarjeta, {
    ancho: anchoTarjeta,
    alto: altoTarjeta,
    anchoFinal: anchoTarjeta * 3,
    cssExtra:
      ".hylo-card{transform:none!important;box-shadow:none!important;margin:0!important;" +
      "border-radius:0!important}" +
      ".hylo-card::after,.hylo-card::before{display:none!important}",
  });
  if (!caraBlob) return null;
  const cara = await createImageBitmap(caraBlob);

  // 1 bis) El reclamo de debajo, igual de plano y con el fondo transparente:
  // va suelto sobre el fondo de la foto, sin tira ni caja detrás.
  const anchoCta = nodoCta ? nodoCta.offsetWidth : 0;
  const altoCta = nodoCta ? nodoCta.offsetHeight : 0;
  let cta: ImageBitmap | null = null;
  if (nodoCta && anchoCta > 0 && altoCta > 0) {
    const ctaBlob = await exportarNodoAPng(nodoCta, {
      ancho: anchoCta,
      alto: altoCta,
      anchoFinal: anchoCta * 3,
      cssExtra: ".hylo-cta-slot{display:block!important;margin:0!important}",
    });
    if (ctaBlob) cta = await createImageBitmap(ctaBlob);
  }

  // 2) La escena, con la luz de las animaciones.
  const W = anchoFinal, H = Math.round(anchoFinal * proporcion);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;

  const escena = new THREE.Scene();
  escena.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  escena.environmentIntensity = 0.25;

  // OJO: la cara de la tarjeta NO se ilumina (va con MeshBasicMaterial), así
  // que sale con el color exacto de la página. Estas luces solo modelan el
  // canto y tiran la sombra; por eso son mucho más flojas que en los vídeos.
  const luz = new THREE.DirectionalLight("#ffffff", 1.15);
  luz.position.set(-2.8, 7.5, 11);
  luz.castShadow = true;
  luz.shadow.mapSize.set(2048, 2048);
  Object.assign(luz.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
  luz.shadow.radius = 28; luz.shadow.blurSamples = 32; luz.shadow.bias = -0.0006; luz.shadow.normalBias = 0.02;
  escena.add(luz, luz.target);
  const contraluz = new THREE.PointLight(ROSA, 7, 30, 2); contraluz.position.set(3.5, 3.2, -1.2); escena.add(contraluz);
  escena.add(new THREE.HemisphereLight("#ffffff", "#140c13", 0.25));

  // 4) La tarjeta: la losa con su cara pegada.
  const texCara = new THREE.CanvasTexture(document.createElement("canvas"));
  {
    const c = texCara.image as HTMLCanvasElement;
    c.width = cara.width; c.height = cara.height;
    c.getContext("2d")!.drawImage(cara, 0, 0);
    texCara.colorSpace = THREE.SRGBColorSpace;
    texCara.anisotropy = 16;
    texCara.needsUpdate = true;
  }
  const tarjeta = new THREE.Mesh(
    losa(anchoTarjeta, altoTarjeta, 30, 20, 6),
    [
      // 0 · el canto y el dorso: sí reciben luz, y son los que hacen la caja.
      new THREE.MeshPhysicalMaterial({
        color: "#26262e", roughness: 0.6, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.45,
      }),
      // 1 · la cara: sin luz ni tono, idéntica a como se ve en la página.
      new THREE.MeshBasicMaterial({ map: texCara, toneMapped: false }),
    ],
  );
  tarjeta.castShadow = true; tarjeta.receiveShadow = true;
  tarjeta.rotation.set(-0.028, -0.095, 0.006);   // algo menos de giro, como en la página
  escena.add(tarjeta);

  // 4 bis) El reclamo, debajo. Es un plano sin luz (el relieve ya va pintado en
  // la propia letra) con el mismo giro suave que la tarjeta: acompaña al 3D sin
  // hacerse notar. El conjunto tarjeta + reclamo se centra en el encuadre.
  const hueco = cta ? Math.round(altoTarjeta * 0.16) : 0;
  const altoTodo = altoTarjeta + hueco + (cta ? altoCta : 0);
  if (cta) {
    tarjeta.position.y = (altoTodo / 2 - altoTarjeta / 2) * U;
    const lienzoCta = document.createElement("canvas");
    lienzoCta.width = cta.width; lienzoCta.height = cta.height;
    lienzoCta.getContext("2d")!.drawImage(cta, 0, 0);
    const texCta = new THREE.CanvasTexture(lienzoCta);
    texCta.colorSpace = THREE.SRGBColorSpace;
    texCta.anisotropy = 16;
    texCta.needsUpdate = true;
    const reclamo = new THREE.Mesh(
      new THREE.PlaneGeometry(anchoCta * U, altoCta * U),
      new THREE.MeshBasicMaterial({ map: texCta, transparent: true, toneMapped: false, depthWrite: false }),
    );
    reclamo.position.set(0, -(altoTodo / 2 - altoCta / 2) * U, 0.02);
    reclamo.rotation.set(-0.02, -0.06, 0.004);
    reclamo.renderOrder = 5;
    escena.add(reclamo);
  }

  // 5) Cámara: encuadra la tarjeta dejando aire, como en los vídeos.
  const camara = new THREE.PerspectiveCamera(28, W / H, 0.1, 100);
  // Hay que encuadrar por lo que más pide: la tarjeta es más ancha que alta,
  // así que si se calcula solo por el alto se sale por los lados.
  // Aire a los lados: el de siempre alrededor de la tarjeta, y lo justo para
  // que el reclamo (que es más ancho que ella) tampoco se salga.
  const porAncho = Math.max(anchoTarjeta * 1.3, anchoCta * 1.06) * U * proporcion;
  const porAlto = (altoTodo * U) * (cta ? 1.42 : 1.9);
  const altoVisible = Math.max(porAncho, porAlto);
  const dist = altoVisible / (2 * Math.tan((28 * Math.PI) / 360));
  camara.position.set(0.12, 0.05, dist);
  camara.lookAt(0, 0, 0);
  luz.target.position.set(0, 0, 0);

  // 3) Fondo y plano que recoge la sombra, justo del tamaño del encuadre a su
  //    profundidad: así el patrón sale a su tamaño y no estirado.
  const zFondo = -1.4;
  const altoFondo = 2 * Math.tan((28 * Math.PI) / 360) * (dist - zFondo);
  const anchoFondo = altoFondo * (W / H);
  // El mosaico, al mismo tamaño relativo que en la página: se pasa de píxeles
  // de pantalla a píxeles de la foto con lo que abarca el encuadre.
  const pxVisibles = (altoVisible * (W / H)) / U;
  const fondoTex = await texturaFondo(1080, Math.round(1080 * proporcion), (1080 * HACHE_PX) / pxVisibles);
  const fondo = new THREE.Mesh(
    new THREE.PlaneGeometry(anchoFondo, altoFondo),
    new THREE.MeshBasicMaterial({ map: fondoTex, toneMapped: false }),
  );
  fondo.position.z = zFondo;
  escena.add(fondo);
  const recogeSombra = new THREE.Mesh(
    new THREE.PlaneGeometry(anchoFondo, altoFondo),
    new THREE.ShadowMaterial({ opacity: 0.42 }),
  );
  recogeSombra.position.z = zFondo + 0.05;
  recogeSombra.receiveShadow = true;
  escena.add(recogeSombra);

  renderer.render(escena, camara);
  const blob = await new Promise<Blob | null>((res) => renderer.domElement.toBlob(res, "image/png"));
  renderer.dispose();
  void caja;
  return blob;
}
