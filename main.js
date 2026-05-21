/* ==========================================================
   D3S — Three.js corner-blob shader + GSAP + Lenis
   ========================================================== */

import * as THREE from "./vendor/three.module.js";

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
const Lenis = window.Lenis;

gsap.registerPlugin(ScrollTrigger);

/* ==========================================================
   1) LENIS — smooth scroll
   ========================================================== */
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  smoothTouch: false,
  wheelMultiplier: 1,
  touchMultiplier: 1.4,
});

lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

/* ==========================================================
   2) THREE.JS — white canvas with 4 corner color blobs
   ========================================================== */
const canvas = document.getElementById("bg-canvas");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// Blob color constants (matching CSS --c-red/yellow/green/blue)
const COLORS = {
  red:    [1.00, 0.353, 0.373],
  yellow: [1.00, 0.788, 0.267],
  green:  [0.361, 0.788, 0.478],
  blue:   [0.243, 0.545, 1.00],
};

// Initial blob state — 4 corners, low intensity
function makeBlob(x, y, color, radius, intensity) {
  return { pos: new THREE.Vector2(x, y), color: new THREE.Vector3(...color), radius, intensity };
}

const blobs = [
  makeBlob(0.15, 0.85, COLORS.red,    0.55, 0.85),  // top-left
  makeBlob(0.85, 0.85, COLORS.yellow, 0.55, 0.65),  // top-right
  makeBlob(0.15, 0.15, COLORS.green,  0.55, 0.55),  // bottom-left
  makeBlob(0.85, 0.15, COLORS.blue,   0.55, 0.55),  // bottom-right
];

const uniforms = {
  uTime:     { value: 0 },
  uMouse:    { value: new THREE.Vector2(0.5, 0.5) },
  uMouseVel: { value: 0 },
  uRes:      { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  uBlobPos:    { value: blobs.map(b => b.pos) },
  uBlobColor:  { value: blobs.map(b => b.color) },
  uBlobRadius: { value: blobs.map(b => b.radius) },
  uBlobIntensity: { value: blobs.map(b => b.intensity) },
};

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;
  varying vec2 vUv;

  uniform float uTime;
  uniform vec2  uMouse;
  uniform float uMouseVel;
  uniform vec2  uRes;

  uniform vec2  uBlobPos[4];
  uniform vec3  uBlobColor[4];
  uniform float uBlobRadius[4];
  uniform float uBlobIntensity[4];

  // hash + noise
  vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
  }
  float noise(vec2 p) {
    const float K1 = 0.366025404;
    const float K2 = 0.211324865;
    vec2 i = floor(p + (p.x + p.y) * K1);
    vec2 a = p - i + (i.x + i.y) * K2;
    float m = step(a.y, a.x);
    vec2 o = vec2(m, 1.0 - m);
    vec2 b = a - o + K2;
    vec2 c = a - 1.0 + 2.0 * K2;
    vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
    vec3 n = h * h * h * h * vec3(
      dot(a, hash(i + 0.0)),
      dot(b, hash(i + o)),
      dot(c, hash(i + 1.0))
    );
    return dot(n, vec3(70.0));
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.05;
      a *= 0.5;
    }
    return v;
  }

  // soft radial falloff
  float blob(vec2 uv, vec2 c, float r) {
    float d = distance(uv, c);
    return smoothstep(r, 0.0, d);
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uRes.x / uRes.y;
    vec2 puv = uv;
    puv.x = (uv.x - 0.5) * aspect + 0.5;

    // organic wobble — domain warp the sample positions
    float t = uTime * 0.08;
    vec2 warp = vec2(
      fbm(puv * 1.6 + vec2(t, 0.0)),
      fbm(puv * 1.6 + vec2(0.0, -t))
    ) * 0.06;
    vec2 suv = uv + warp;

    // accumulate blobs (additive on white base)
    vec3 col = vec3(1.0);
    for (int i = 0; i < 4; i++) {
      vec2 bp = uBlobPos[i];
      bp.x = (bp.x - 0.5) * aspect + 0.5;
      vec2 sp = suv;
      sp.x = (sp.x - 0.5) * aspect + 0.5;
      float w = blob(sp, bp, uBlobRadius[i]);
      w = pow(w, 1.5);
      // tint white toward blob color
      col = mix(col, uBlobColor[i], w * uBlobIntensity[i] * 0.7);
    }

    // cursor brush — soft warm white wipe with subtle color
    vec2 mp = uMouse;
    mp.x = (mp.x - 0.5) * aspect + 0.5;
    vec2 sp2 = suv;
    sp2.x = (sp2.x - 0.5) * aspect + 0.5;
    float mdist = distance(sp2, mp);
    float brush = exp(-mdist * 6.0) * (0.25 + uMouseVel * 1.5);
    // brush pulls colors toward white center and adds a tiny rainbow shimmer
    vec3 shimmer = vec3(
      0.5 + 0.5 * sin(uTime * 1.2 + mdist * 8.0),
      0.5 + 0.5 * sin(uTime * 1.4 + mdist * 8.0 + 2.0),
      0.5 + 0.5 * sin(uTime * 1.6 + mdist * 8.0 + 4.0)
    );
    col = mix(col, mix(vec3(1.0), shimmer, 0.35), brush);

    // paper grain
    float grain = hash(uv * uRes + uTime * 0.5).x * 0.012;
    col -= grain;

    // soft vignette toward edges to focus content
    float vg = smoothstep(1.1, 0.4, distance(uv, vec2(0.5)));
    col = mix(vec3(1.0), col, 0.4 + 0.6 * vg);

    gl_FragColor = vec4(col, 1.0);
  }
`;

const mat = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });
const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
scene.add(mesh);

/* ------- Mouse tracking ------- */
const mouseTarget = new THREE.Vector2(0.5, 0.5);
const mouseSmooth = new THREE.Vector2(0.5, 0.5);
let lastMouse = { x: 0.5, y: 0.5, t: performance.now() };
let mouseVelTarget = 0;
let mouseVelSmooth = 0;

window.addEventListener("pointermove", (e) => {
  const nx = e.clientX / window.innerWidth;
  const ny = 1.0 - e.clientY / window.innerHeight;
  mouseTarget.set(nx, ny);

  const now = performance.now();
  const dt = Math.max(now - lastMouse.t, 16);
  const dx = nx - lastMouse.x;
  const dy = ny - lastMouse.y;
  const v = Math.min(Math.sqrt(dx * dx + dy * dy) / (dt / 1000) * 0.25, 1.0);
  mouseVelTarget = v;
  lastMouse = { x: nx, y: ny, t: now };
}, { passive: true });

/* ------- Resize ------- */
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  uniforms.uRes.value.set(window.innerWidth, window.innerHeight);
});

/* ------- Render loop ------- */
const clock = new THREE.Clock();
function render() {
  const t = clock.getElapsedTime();
  uniforms.uTime.value = t;

  mouseSmooth.lerp(mouseTarget, 0.08);
  uniforms.uMouse.value.copy(mouseSmooth);

  mouseVelSmooth += (mouseVelTarget - mouseVelSmooth) * 0.08;
  mouseVelTarget *= 0.92;
  uniforms.uMouseVel.value = mouseVelSmooth;

  renderer.render(scene, camera);
  requestAnimationFrame(render);
}
render();

/* ==========================================================
   3) Scene palettes — each section tweaks blob state
   ========================================================== */

// Each scene: array of 4 blob configs [{pos:[x,y], color, radius, intensity}]
const SCENE_PALETTES = {
  1: [ // Hero — red dominant, soft cool counterparts
    { pos: [0.18, 0.82], color: COLORS.red,    radius: 0.65, intensity: 0.95 },
    { pos: [0.88, 0.78], color: COLORS.yellow, radius: 0.55, intensity: 0.55 },
    { pos: [0.12, 0.20], color: COLORS.green,  radius: 0.50, intensity: 0.40 },
    { pos: [0.85, 0.22], color: COLORS.blue,   radius: 0.55, intensity: 0.50 },
  ],
  2: [ // Promise — yellow + blue build
    { pos: [0.15, 0.85], color: COLORS.red,    radius: 0.50, intensity: 0.45 },
    { pos: [0.82, 0.85], color: COLORS.yellow, radius: 0.70, intensity: 0.90 },
    { pos: [0.18, 0.18], color: COLORS.green,  radius: 0.45, intensity: 0.45 },
    { pos: [0.88, 0.18], color: COLORS.blue,   radius: 0.65, intensity: 0.85 },
  ],
  3: [ // Modules — balanced rainbow aurora
    { pos: [0.10, 0.88], color: COLORS.red,    radius: 0.55, intensity: 0.75 },
    { pos: [0.90, 0.88], color: COLORS.yellow, radius: 0.55, intensity: 0.75 },
    { pos: [0.10, 0.12], color: COLORS.green,  radius: 0.55, intensity: 0.75 },
    { pos: [0.90, 0.12], color: COLORS.blue,   radius: 0.55, intensity: 0.75 },
  ],
  4: [ // Why — green + blue trust
    { pos: [0.15, 0.85], color: COLORS.red,    radius: 0.40, intensity: 0.30 },
    { pos: [0.85, 0.85], color: COLORS.yellow, radius: 0.45, intensity: 0.45 },
    { pos: [0.18, 0.18], color: COLORS.green,  radius: 0.70, intensity: 0.95 },
    { pos: [0.82, 0.18], color: COLORS.blue,   radius: 0.65, intensity: 0.90 },
  ],
  5: [ // Comparison — diagonal contrast red vs blue
    { pos: [0.12, 0.88], color: COLORS.red,    radius: 0.65, intensity: 0.95 },
    { pos: [0.88, 0.85], color: COLORS.yellow, radius: 0.40, intensity: 0.30 },
    { pos: [0.15, 0.15], color: COLORS.green,  radius: 0.40, intensity: 0.30 },
    { pos: [0.88, 0.12], color: COLORS.blue,   radius: 0.65, intensity: 0.95 },
  ],
  6: [ // Voices — warm yellow + red glow
    { pos: [0.18, 0.85], color: COLORS.red,    radius: 0.65, intensity: 0.85 },
    { pos: [0.82, 0.82], color: COLORS.yellow, radius: 0.70, intensity: 0.95 },
    { pos: [0.15, 0.18], color: COLORS.green,  radius: 0.40, intensity: 0.35 },
    { pos: [0.85, 0.22], color: COLORS.blue,   radius: 0.40, intensity: 0.30 },
  ],
  7: [ // CTA finale — all corners saturated, dramatic
    { pos: [0.08, 0.92], color: COLORS.red,    radius: 0.75, intensity: 1.10 },
    { pos: [0.92, 0.92], color: COLORS.yellow, radius: 0.75, intensity: 1.10 },
    { pos: [0.08, 0.08], color: COLORS.green,  radius: 0.75, intensity: 1.10 },
    { pos: [0.92, 0.08], color: COLORS.blue,   radius: 0.75, intensity: 1.10 },
  ],
};

function tweenToScene(sceneId) {
  const target = SCENE_PALETTES[sceneId];
  if (!target) return;
  target.forEach((b, i) => {
    gsap.to(uniforms.uBlobPos.value[i],   { x: b.pos[0], y: b.pos[1], duration: 1.6, ease: "power2.inOut" });
    gsap.to(uniforms.uBlobColor.value[i], { x: b.color[0], y: b.color[1], z: b.color[2], duration: 1.6, ease: "power2.inOut" });
    gsap.to(uniforms.uBlobRadius.value,   { [i]: b.radius, duration: 1.6, ease: "power2.inOut" });
    gsap.to(uniforms.uBlobIntensity.value,{ [i]: b.intensity, duration: 1.6, ease: "power2.inOut" });
  });
}

/* ==========================================================
   4) GSAP ScrollTrigger — scene reveals & palette swaps
   ========================================================== */
const sceneEls = document.querySelectorAll(".scene[data-scene]");

sceneEls.forEach((sec) => {
  const id = Number(sec.dataset.scene);

  // Palette swap when scene enters viewport center
  ScrollTrigger.create({
    trigger: sec,
    start: "top 60%",
    end:   "bottom 40%",
    onEnter:     () => tweenToScene(id),
    onEnterBack: () => tweenToScene(id),
  });

  // Reveal targets inside scene
  const targets = sec.querySelectorAll(".reveal");
  if (targets.length) {
    gsap.fromTo(targets,
      { y: 50, opacity: 0, filter: "blur(8px)" },
      {
        y: 0,
        opacity: 1,
        filter: "blur(0px)",
        duration: 1.0,
        ease: "expo.out",
        stagger: 0.07,
        scrollTrigger: {
          trigger: sec,
          start: "top 80%",
          toggleActions: "play none none reverse",
        },
      }
    );
  }
});

// Hero parallax
const heroDisplay = document.querySelector(".scene-hero .display");
const heroVisual  = document.querySelector(".hero-visual");
if (heroDisplay) {
  gsap.to(heroDisplay, {
    yPercent: -20,
    opacity: 0.4,
    ease: "none",
    scrollTrigger: { trigger: ".scene-hero", start: "top top", end: "bottom top", scrub: true },
  });
}
if (heroVisual) {
  gsap.to(heroVisual, {
    yPercent: 15,
    ease: "none",
    scrollTrigger: { trigger: ".scene-hero", start: "top top", end: "bottom top", scrub: true },
  });
}

// Module cards cascade
document.querySelectorAll(".module-card").forEach((card, i) => {
  gsap.from(card, {
    y: 60,
    opacity: 0,
    duration: 0.7,
    ease: "power3.out",
    delay: (i % 5) * 0.05,
    scrollTrigger: { trigger: card, start: "top 90%", toggleActions: "play none none reverse" },
  });
});

// Comparison rows
gsap.from(".ct-row:not(.ct-head)", {
  x: -30,
  opacity: 0,
  duration: 0.6,
  ease: "power2.out",
  stagger: 0.05,
  scrollTrigger: { trigger: ".compare-table", start: "top 80%", toggleActions: "play none none reverse" },
});

// Voices alternate drift
document.querySelectorAll(".voice").forEach((v, i) => {
  gsap.from(v, {
    x: i % 2 === 0 ? -30 : 30,
    y: 30,
    opacity: 0,
    duration: 0.8,
    ease: "power2.out",
    scrollTrigger: { trigger: v, start: "top 85%", toggleActions: "play none none reverse" },
  });
});

// Progress rail
const progressFill = document.querySelector(".progress-fill");
if (progressFill) {
  gsap.to(progressFill, {
    width: "100%",
    ease: "none",
    scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: 0.3 },
  });
}

// Logo strip — gentle continuous drift on enter
gsap.from(".logo-strip img", {
  y: 20, opacity: 0, duration: 0.8, ease: "power2.out", stagger: 0.04,
  scrollTrigger: { trigger: ".logo-strip", start: "top 90%", toggleActions: "play none none reverse" },
});

// Anchor smoothing via Lenis
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    if (!id || id === "#") return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -60, duration: 1.4 });
  });
});

ScrollTrigger.refresh();
