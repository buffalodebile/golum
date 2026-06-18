/* Prisma Capital — hero signature ("la lumière décomposée").
   A near-black glass cube; a thin white beam enters from the top-right, scatters
   to a bright hotspot inside, and fans out into a spectrum of individually
   spreading rays toward the lower-left. The cube reorients toward the cursor;
   HUD readouts track it. Bloom gives the beam + spectrum their glow. Degrades
   gracefully: no WebGL / reduced-motion -> canvas hidden, headline stands alone. */

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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
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

    // --- Emergent spectral fan: each colour spreads as its own ray ---
    // The dispersion fan widens with the cube's angle; every wavelength gets its
    // own additive plane so the colours read as distinct rays, not one band.
    // A soft cross-beam falloff (bright core -> transparent edges) gives each ray
    // a coloured glow rather than a hard line.
    function beamTexture() {
      const TW = 256, TH = 64;
      const c = document.createElement("canvas"); c.width = TW; c.height = TH;
      const x = c.getContext("2d");
      const vg = x.createLinearGradient(0, 0, 0, TH);     // glow across the width
      vg.addColorStop(0.0, "rgba(255,255,255,0)");
      vg.addColorStop(0.42, "rgba(255,255,255,.55)");
      vg.addColorStop(0.5, "rgba(255,255,255,1)");
      vg.addColorStop(0.58, "rgba(255,255,255,.55)");
      vg.addColorStop(1.0, "rgba(255,255,255,0)");
      x.fillStyle = vg; x.fillRect(0, 0, TW, TH);
      x.globalCompositeOperation = "destination-in";       // fade alpha along length
      const hg = x.createLinearGradient(0, 0, TW, 0);
      hg.addColorStop(0, "rgba(0,0,0,1)"); hg.addColorStop(0.5, "rgba(0,0,0,.8)"); hg.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = hg; x.fillRect(0, 0, TW, TH);
      return new THREE.CanvasTexture(c);
    }
    const beamTex = beamTexture();

    // Pale, low-contrast spectrum (each hue mixed toward white) so the rays read
    // as soft tinted light rather than saturated colour bars.
    const SPECTRUM = [0xff8c8c, 0xffb681, 0xffe772, 0x9deaaa, 0x80d7fa, 0x9daffa, 0xc8a5ff];
    const RAY_LEN = 9;
    const fan = new THREE.Group();
    fan.position.copy(beamDir.clone().multiplyScalar(1.25));   // emerge from behind the exit face
    fan.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), beamDir.clone());
    const rays = SPECTRUM.map((hex) => {
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(RAY_LEN, 0.34),
        new THREE.MeshBasicMaterial({ map: beamTex, color: hex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
      );
      plane.position.x = RAY_LEN / 2;
      const holder = new THREE.Group();
      holder.add(plane);
      fan.add(holder);
      return holder;
    });
    rig.add(fan);

    // --- Bloom ---
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(W(), H()), 0.8, 0.75, 0.12);
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

      // Fan the spectrum: each ray rotates out from the centre, brighter at the core.
      // Keep the cone tight even at full tilt so it never opens past a gentle fan.
      const spread = 0.04 + tilt * 0.085;
      const mid = (rays.length - 1) / 2;
      rays.forEach((holder, i) => {
        const k = i - mid;
        holder.rotation.z = k * spread;
        holder.children[0].material.opacity = (0.3 + tilt * 0.36) * (1 - Math.abs(k) / (rays.length + 0.5));
      });
      if (++hudTick % 5 === 0) {
        setHud("hud-refraction", (5.2 + tilt * 4).toFixed(1) + "°");
        setHud("hud-dispersion", (11 + tilt * 9).toFixed(1) + "°");
      }
      composer.render();
    }
    function loop() { t += 0.0038; render(); raf = requestAnimationFrame(loop); }

    // Only run the loop when the hero is actually visible: pause when the tab is
    // hidden or the section is scrolled out of view. The composer + bloom pass is
    // the expensive part, so not rendering it off-screen keeps the rest of the
    // page smooth on lower-end devices.
    let inView = true;
    function start() { if (!reduce && !raf && inView && !document.hidden) raf = requestAnimationFrame(loop); }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

    if (reduce) render(); else start();
    document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); else start(); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        inView = entries[0].isIntersecting;
        if (inView) start(); else stop();
      }, { threshold: 0.01 }).observe(mount);
    }
  } catch (e) { fail(); }
}
