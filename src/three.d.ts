// three.js no trae sus propios tipos (van en @types/three, que no está
// instalado). Con esto TypeScript acepta el import y lo trata como `any`:
// suficiente, porque el uso está encerrado en render3d.ts.
declare module "three";
declare module "three/examples/jsm/environments/RoomEnvironment.js";
