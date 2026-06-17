/* Prisma Capital — strategy-card 3D mark.
   A small faceted octahedron (a 3D "gem/prism") with spectrum-coloured edges,
   above each strategy name. Slow idle spin; faster on card hover. One tiny
   renderer per card. Degrades silently if WebGL is unavailable. */

import * as THREE from "three";

const SPEC = [[255, 45, 45], [255, 122, 26], [255, 210, 0], [76, 217, 100], [24, 182, 246], [76, 110, 245], [155, 92, 255]];
const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.querySelectorAll(".strat-anim[data-3d]").forEach((mount) => {
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

  const geo = new THREE.OctahedronGeometry(1.2, 0);
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

  let t = 0, raf = 0;
  function loop() {
    t += hov ? 0.03 : 0.011;
    grp.rotation.y = t;
    grp.rotation.x = 0.3 + Math.sin(t * 0.5) * 0.25;
    renderer.render(scene, cam);
    raf = requestAnimationFrame(loop);
  }
  if (reduce) { grp.rotation.set(0.4, 0.6, 0); renderer.render(scene, cam); }
  else raf = requestAnimationFrame(loop);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; }
    else if (!reduce && !raf) raf = requestAnimationFrame(loop);
  });
});
