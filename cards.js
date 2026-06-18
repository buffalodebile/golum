/* Prisma Capital — strategy-card 3D mark.
   A small faceted 3D gem with spectrum-coloured edges, above each strategy name:
   an octahedron by default, or a cube when the mount sets data-shape="cube".
   Slow idle spin around the vertical axis; on card hover it speeds up and tilts
   into a diagonal corner-to-corner tumble. One tiny renderer per card. Degrades
   silently if WebGL is unavailable. */

const SPEC = [[255, 45, 45], [255, 122, 26], [255, 210, 0], [76, 217, 100], [24, 182, 246], [76, 110, 245], [155, 92, 255]];
const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// Like the hero, skip these WebGL marks on small / touch screens and load
// three.js lazily so phones never download it.
const isMobile = window.matchMedia && window.matchMedia("(max-width: 680px), (pointer: coarse)").matches;
const mounts = document.querySelectorAll(".strat-anim[data-3d]");

if (mounts.length && !isMobile) initCards();

async function initCards() {
  const THREE = await import("three");
  mounts.forEach((mount) => initCard(THREE, mount));
}

function initCard(THREE, mount) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); }
  catch (e) { return; }
  const S = 84;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(S, S);
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 10);
  cam.position.z = 3.5;

  const geo = mount.dataset.shape === "cube"
    ? new THREE.BoxGeometry(1.5, 1.5, 1.5)
    : new THREE.OctahedronGeometry(1.2, 0);
  const face = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x0e1320, transparent: true, opacity: 0.5 }));

  // spectrum-coloured wireframe edges (per-vertex gradient by height)
  const eg = new THREE.EdgesGeometry(geo);
  const pos = eg.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y < minY) minY = y; if (y > maxY) maxY = y; }
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - minY) / (maxY - minY || 1);
    const x = t * (SPEC.length - 1), j = Math.floor(x), f = x - j;
    const a = SPEC[j], b = SPEC[Math.min(j + 1, SPEC.length - 1)];
    colors[i * 3] = (a[0] + (b[0] - a[0]) * f) / 255;
    colors[i * 3 + 1] = (a[1] + (b[1] - a[1]) * f) / 255;
    colors[i * 3 + 2] = (a[2] + (b[2] - a[2]) * f) / 255;
  }
  eg.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const edges = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 }));

  const grp = new THREE.Group();
  grp.add(face, edges);
  scene.add(grp);

  const card = mount.closest(".strat-card");
  let hov = false;
  if (card) {
    card.addEventListener("pointerenter", () => { hov = true; });
    card.addEventListener("pointerleave", () => { hov = false; });
  }

  // Spin via quaternion so we can swing the rotation axis from vertical (idle)
  // to a diagonal corner-to-corner tumble on hover.
  const baseEuler = new THREE.Euler();
  const baseTilt = new THREE.Quaternion();
  const spinQuat = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  function orient(spin, hf, nod) {
    axis.set(hf, 1, hf * 0.4).normalize();           // vertical turn -> diagonal on hover
    spinQuat.setFromAxisAngle(axis, spin);
    baseEuler.set(nod, 0, 0);
    baseTilt.setFromEuler(baseEuler);
    grp.quaternion.copy(baseTilt).multiply(spinQuat);
  }

  let t = 0, hf = 0, raf = 0;
  function loop() {
    hf += ((hov ? 1 : 0) - hf) * 0.08;                // smooth ramp in/out of hover
    t += 0.011 + hf * 0.026;                          // faster while hovering
    orient(t, hf, 0.32 + Math.sin(t * 0.5) * 0.12);
    renderer.render(scene, cam);
    raf = requestAnimationFrame(loop);
  }
  if (reduce) { orient(0.6, 1, 0.4); renderer.render(scene, cam); }
  else raf = requestAnimationFrame(loop);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; }
    else if (!reduce && !raf) raf = requestAnimationFrame(loop);
  });
}
