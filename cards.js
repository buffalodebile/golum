/* Prisma Capital — strategy-card 3D mark.
   A small glowing blue/cyan WIREFRAME solid above each strategy name, with the
   full mesh grid visible ("traits visibles"): an octahedron by default, a cube
   when data-shape="cube", and a ring/torus when data-shape="torus".
   Slow idle spin around the vertical axis; on card hover it speeds up and tilts
   into a diagonal corner-to-corner tumble. One tiny renderer per card. Degrades
   silently if WebGL is unavailable. */

const WIRE = 0x5bc8ff;   // accent cyan — matches --accent
const GLOW = 0x8fe0ff;   // lighter cyan for the additive halo
const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// These little wireframe marks render on mobile too (Paul wants them visible on
// phones). three.js is still imported lazily, only when a mount is present, and
// the spin pauses when the tab is hidden — see below. prefers-reduced-motion
// still drops to a single static frame.
const mounts = document.querySelectorAll(".strat-anim[data-3d]");

if (mounts.length) initCards();

async function initCards() {
  const THREE = await import("three");
  mounts.forEach((mount) => initCard(THREE, mount));
}

// Segmented geometries so the wireframe shows a full lat/long-style grid, not
// just the silhouette edges.
function makeGeo(THREE, shape) {
  switch (shape) {
    case "torus": return new THREE.TorusGeometry(0.82, 0.33, 14, 36);
    case "cube":  return new THREE.BoxGeometry(1.35, 1.35, 1.35, 3, 3, 3);
    case "icosa": return new THREE.IcosahedronGeometry(1.15, 1);
    default:      return new THREE.OctahedronGeometry(1.2, 1);
  }
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

  const geo = makeGeo(THREE, mount.dataset.shape);
  // One wireframe geometry, drawn twice: a crisp core + a softly blown-out halo.
  // Additive blending makes the line crossings bloom, for the "mèche" glow.
  const wireGeo = new THREE.WireframeGeometry(geo);
  const core = new THREE.LineSegments(
    wireGeo,
    new THREE.LineBasicMaterial({ color: WIRE, transparent: true, opacity: 0.92 })
  );
  const halo = new THREE.LineSegments(
    wireGeo,
    new THREE.LineBasicMaterial({
      color: GLOW, transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  halo.scale.setScalar(1.06);

  const grp = new THREE.Group();
  grp.add(core, halo);
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
