/* Prisma Capital — hero signature ("la lumière décomposée").
   A near-black glass cube; a thin white beam enters from the top-right, scatters
   to a bright hotspot inside, and exits as a single continuous rainbow beam
   toward the lower-left. The cube reorients toward the cursor; HUD readouts track
   it. Bloom gives the beam + spectrum their glow. Degrades gracefully: no WebGL /
   reduced-motion -> canvas hidden, headline stands alone. */

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const mount = document.getElementById("cube-stage");
const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const setHud = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

function fail() { if (mount) mount.classList.add("no-webgl"); }

function radialTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,.9)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

if (mount) {
  let renderer = null;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" }); }
  catch (e) { renderer = null; }

  if (!renderer) {
    fail();
  } else try {
    const W = () => mount.clientWidth || 1;
    const H = () => mount.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    renderer.setSize(W(), H());
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(33, W() / H(), 0.1, 100);
    camera.position.set(0, 0, 8);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.22;          // keep the cube dark

    const rig = new THREE.Group();
    scene.add(rig);

    // --- Near-black glass cube ---
    const cube = new THREE.Mesh(
      new RoundedBoxGeometry(2.4, 2.4, 2.4, 6, 0.1),
      new THREE.MeshPhysicalMaterial({
        transmission: 0.85, thickness: 2.4, ior: 1.52, dispersion: 7,
        roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06,
        color: 0x0c0f16, attenuationColor: 0x0a0c12, attenuationDistance: 1.6,
        envMapIntensity: 0.35,
      })
    );
    rig.add(cube);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(2.4, 2.4, 2.4)),
      new THREE.LineBasicMaterial({ color: 0x9fb6d6, transparent: true, opacity: 0.18 })
    );
    cube.add(edges);

    const beamDir = new THREE.Vector3(1, -0.55, -0.04).normalize();  // enters top-left, exits lower-right

    // --- Incoming white beam (top-right) ---
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.045, 9, 18, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    beam.position.copy(beamDir.clone().multiplyScalar(-2.7));
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), beamDir);
    rig.add(beam);

    // --- Bright entry hotspot inside the cube ---
    const tex = radialTexture();
    const hotspot = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    hotspot.scale.setScalar(1.1);
    hotspot.position.copy(beamDir.clone().multiplyScalar(-0.55));
    rig.add(hotspot);

    // --- Single continuous rainbow beam exiting toward lower-left ---
    const STOPS = [[255,40,40],[255,120,20],[255,210,0],[60,220,110],[20,180,250],[80,110,245],[160,90,255]];
    const spectrum = (t) => {
      const x = Math.max(0, Math.min(1, t)) * (STOPS.length - 1);
      const i = Math.floor(x), f = x - i, a = STOPS[i], b = STOPS[Math.min(i + 1, STOPS.length - 1)];
      return new THREE.Color((a[0]+(b[0]-a[0])*f)/255, (a[1]+(b[1]-a[1])*f)/255, (a[2]+(b[2]-a[2])*f)/255);
    };
    // Rainbow beam as ONE textured plane: spectrum across the width, fading along
    // the length. (Stacking additive colour bands summed to white — this keeps the
    // colours distinct while staying tight.)
    const RW = 256, RH = 64;
    const rc = document.createElement("canvas"); rc.width = RW; rc.height = RH;
    const rx = rc.getContext("2d");
    const vg = rx.createLinearGradient(0, 0, 0, RH);
    ["#ff2d2d", "#ff7a1a", "#ffd400", "#4cd964", "#18b6f6", "#4c6ef5", "#9b5cff"]
      .forEach((c, i, a) => vg.addColorStop(i / (a.length - 1), c));
    rx.fillStyle = vg; rx.fillRect(0, 0, RW, RH);
    rx.globalCompositeOperation = "destination-in";          // fade alpha along length
    const hg = rx.createLinearGradient(0, 0, RW, 0);
    hg.addColorStop(0, "rgba(0,0,0,1)"); hg.addColorStop(0.45, "rgba(0,0,0,.7)"); hg.addColorStop(1, "rgba(0,0,0,0)");
    rx.fillStyle = hg; rx.fillRect(0, 0, RW, RH);
    const rainbowTex = new THREE.CanvasTexture(rc);

    const LEN = 9, WIDTH = 0.6;
    const beamGrp = new THREE.Group();
    beamGrp.position.copy(beamDir.clone().multiplyScalar(1.25));
    beamGrp.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), beamDir.clone());
    const rainbow = new THREE.Mesh(
      new THREE.PlaneGeometry(LEN, WIDTH),
      new THREE.MeshBasicMaterial({ map: rainbowTex, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    rainbow.position.x = LEN / 2;
    beamGrp.add(rainbow);
    rig.add(beamGrp);

    // --- Bloom ---
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(W(), H()), 0.8, 0.7, 0.1);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    // --- Interaction ---
    const target = { x: -0.3, y: 0.45 }, cur = { x: -0.3, y: 0.45 };
    function onPointer(e) {
      const r = mount.getBoundingClientRect(); if (!r.width) return;
      const nx = ((e.touches ? e.touches[0].clientX : e.clientX) - r.left) / r.width * 2 - 1;
      const ny = ((e.touches ? e.touches[0].clientY : e.clientY) - r.top) / r.height * 2 - 1;
      target.y = 0.45 + nx * 0.9; target.x = -0.3 + ny * 0.65;
    }
    window.addEventListener("pointermove", onPointer, { passive: true });

    function layout() {
      const w = W(), h = H(), aspect = w / h;
      renderer.setSize(w, h); composer.setSize(w, h);
      camera.aspect = aspect; camera.updateProjectionMatrix();
      rig.position.set(aspect > 1.05 ? 1.95 : 0, aspect > 1.05 ? 0.15 : 0.15, 0);
      rig.scale.setScalar(aspect > 1.05 ? 0.58 : 0.42);
    }
    layout();
    window.addEventListener("resize", layout);

    let t = 0, raf = 0, hudTick = 0;
    function render() {
      cur.x += (target.x - cur.x) * 0.05; cur.y += (target.y - cur.y) * 0.05;
      cube.rotation.x = cur.x + Math.sin(t * 0.6) * 0.03;
      cube.rotation.y = cur.y + t * 0.09;
      const tilt = Math.abs(Math.sin(cube.rotation.y)) * Math.abs(Math.cos(cube.rotation.x));
      beam.material.opacity = 0.78;
      hotspot.material.opacity = 0.85;
      if (++hudTick % 5 === 0) {
        setHud("hud-refraction", (5.2 + tilt * 4).toFixed(1) + "°");
        setHud("hud-dispersion", (11 + tilt * 9).toFixed(1) + "°");
      }
      composer.render();
    }
    function loop() { t += 0.0038; render(); raf = requestAnimationFrame(loop); }
    if (reduce) render(); else raf = requestAnimationFrame(loop);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; }
      else if (!reduce && !raf) raf = requestAnimationFrame(loop);
    });
  } catch (e) { fail(); }
}
