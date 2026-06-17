/* Prisma Capital — hero signature.
   A glass cube refracts an incoming white beam (from the top-right) into a
   visible spectrum. The cube reorients toward the cursor and the dispersion fan
   widens with its angle, "more or less respecting" real refraction. Three.js
   MeshPhysicalMaterial transmission + dispersion produces the chromatic split;
   a stylized additive fan renders the emergent spectrum so the effect reads at a
   glance. Degrades gracefully: no WebGL / reduced-motion -> the canvas hides and
   the headline stands on its own. */

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const mount = document.getElementById("cube-stage");
const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function fail() { if (mount) mount.classList.add("no-webgl"); }

if (mount) {
  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) { renderer = null; }

  if (!renderer) {
    fail();
  } else try {
    const W = () => mount.clientWidth || 1;
    const H = () => mount.clientHeight || 1;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W(), H());
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.82;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, W() / H(), 0.1, 100);
    camera.position.set(0, 0, 7.4);

    // Environment gives the glass something to refract & reflect — dimmed so the
    // cube reads as dark glass on the near-black bg, not a bright white box.
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.5;

    // rig holds cube + beam + fan so they shift together (cube to the right on
    // desktop, centred on mobile — set in layout()).
    const rig = new THREE.Group();
    scene.add(rig);

    // --- The glass cube (the prism) ---
    const cube = new THREE.Mesh(
      new RoundedBoxGeometry(2.1, 2.1, 2.1, 6, 0.14),
      new THREE.MeshPhysicalMaterial({
        transmission: 1,
        thickness: 2.2,
        ior: 1.5,
        dispersion: 9,          // chromatic split (three r167+)
        roughness: 0.02,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        color: 0xeef3ff,
        attenuationColor: 0x9fb6e6,
        attenuationDistance: 3.4,
        envMapIntensity: 0.7,
      })
    );
    rig.add(cube);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(2.1, 2.1, 2.1)),
      new THREE.LineBasicMaterial({ color: 0x9fb6d6, transparent: true, opacity: 0.16 })
    );
    cube.add(edges);

    const beamDir = new THREE.Vector3(-1, -0.6, 0.16).normalize();

    // --- Incoming white beam from the top-right toward the cube centre ---
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.05, 7.2, 18, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    beam.position.copy(beamDir.clone().multiplyScalar(-2.0));
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), beamDir);
    rig.add(beam);

    // --- Emergent spectral fan on the far side (stylized dispersion) ---
    const SPECTRUM = [0xff2d2d, 0xff7a1a, 0xffd400, 0x4cd964, 0x18b6f6, 0x4c6ef5, 0x9b5cff];
    const fan = new THREE.Group();
    fan.position.copy(beamDir.clone().multiplyScalar(1.25));
    fan.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), beamDir.clone());
    const rays = SPECTRUM.map((hex) => {
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(5.4, 0.05),
        new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
      );
      plane.position.x = 2.7;
      const holder = new THREE.Group();
      holder.add(plane);
      fan.add(holder);
      return holder;
    });
    rig.add(fan);

    // --- Interaction ---
    const target = { x: -0.32, y: 0.5 };
    const cur = { x: -0.32, y: 0.5 };
    function onPointer(e) {
      const r = mount.getBoundingClientRect();
      if (!r.width) return;
      const nx = ((e.touches ? e.touches[0].clientX : e.clientX) - r.left) / r.width * 2 - 1;
      const ny = ((e.touches ? e.touches[0].clientY : e.clientY) - r.top) / r.height * 2 - 1;
      target.y = 0.5 + nx * 0.9;
      target.x = -0.32 + ny * 0.7;
    }
    window.addEventListener("pointermove", onPointer, { passive: true });

    function layout() {
      renderer.setSize(W(), H());
      const aspect = W() / H();
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      // push the cube to the right on wide screens so it never sits under the copy
      rig.position.x = aspect > 1.05 ? 1.7 : 0;
      rig.scale.setScalar(aspect > 1.05 ? 1 : 0.82);
    }
    layout();
    window.addEventListener("resize", layout);

    let t = 0, raf = 0;
    function render() {
      cur.x += (target.x - cur.x) * 0.05;
      cur.y += (target.y - cur.y) * 0.05;
      cube.rotation.x = cur.x + Math.sin(t * 0.7) * 0.04;
      cube.rotation.y = cur.y + t * 0.12;

      const tilt = Math.abs(Math.sin(cube.rotation.y)) * Math.abs(Math.cos(cube.rotation.x));
      const spread = 0.10 + tilt * 0.34;
      const mid = (rays.length - 1) / 2;
      rays.forEach((holder, i) => {
        const k = i - mid;
        holder.rotation.z = k * spread;
        holder.children[0].material.opacity = (0.22 + tilt * 0.6) * (1 - Math.abs(k) / (rays.length + 0.5));
      });
      beam.material.opacity = 0.34 + tilt * 0.22;

      renderer.render(scene, camera);
    }
    function loop() { t += 0.0045; render(); raf = requestAnimationFrame(loop); }

    if (reduce) render();
    else raf = requestAnimationFrame(loop);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; }
      else if (!reduce && !raf) raf = requestAnimationFrame(loop);
    });
  } catch (e) {
    fail();
  }
}
