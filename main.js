/* ==========================================================
   D3S Storytelling — Three.js + GSAP ScrollTrigger + Lenis
   ========================================================== */

import * as THREE from "three";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

/* ==========================================================
   1) LENIS — buttery smooth scroll
   ========================================================== */
const lenis = new Lenis({
  duration: 1.25,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  smoothTouch: false,
  wheelMultiplier: 1,
  touchMultiplier: 1.4,
});

lenis.on("scroll", ScrollTrigger.update);

gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0);

/* ==========================================================
   2) THREE.JS — Painted texture background reacting to cursor
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

// Palette definitions — one per scene
const PALETTES = {
  dawn:    { a: [0.96, 0.71, 0.55], b: [0.18, 0.09, 0.28], c: [0.78, 0.36, 0.40] }, // peach → plum
  ember:   { a: [0.99, 0.50, 0.30], b: [0.32, 0.04, 0.12], c: [0.95, 0.79, 0.42] }, // ember
  dusk:    { a: [0.45, 0.22, 0.62], b: [0.10, 0.06, 0.22], c: [0.92, 0.40, 0.55] }, // dusk
  aurora:  { a: [0.20, 0.78, 0.74], b: [0.06, 0.18, 0.28], c: [0.58, 0.92, 0.62] }, // aurora
  violet:  { a: [0.60, 0.28, 0.95], b: [0.07, 0.04, 0.20], c: [0.95, 0.36, 0.78] }, // violet
  ocean:   { a: [0.13, 0.42, 0.78], b: [0.02, 0.08, 0.22], c: [0.36, 0.85, 0.92] }, // ocean
  finale:  { a: [0.99, 0.42, 0.20], b: [0.20, 0.04, 0.20], c: [0.99, 0.80, 0.62] }, // finale sunset
};

// Painted-texture fragment shader (organic flowing color w/ cursor displacement)
const uniforms = {
  uTime:      { value: 0 },
  uMouse:     { value: new THREE.Vector2(0.5, 0.5) },
  uMouseVel:  { value: 0 },
  uRes:       { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  uColorA:    { value: new THREE.Vector3(...PALETTES.dawn.a) },
  uColorB:    { value: new THREE.Vector3(...PALETTES.dawn.b) },
  uColorC:    { value: new THREE.Vector3(...PALETTES.dawn.c) },
  uScroll:    { value: 0 },
};

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform float uTime;
  uniform vec2  uMouse;
  uniform float uMouseVel;
  uniform vec2  uRes;
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform vec3  uColorC;
  uniform float uScroll;

  // ------- hash + noise (Inigo Quilez style) -------
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

  // domain-warped fBM => painted look
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uRes.x / uRes.y;
    vec2 p = uv;
    p.x *= aspect;

    // mouse field with falloff (painted "brush" trail)
    vec2 mouse = uMouse;
    mouse.x *= aspect;
    float d = distance(p, mouse);
    float brush = exp(-d * 3.0) * (0.6 + uMouseVel * 1.8);

    // domain warp driven by time + scroll + mouse
    vec2 q = vec2(
      fbm(p * 1.6 + vec2(0.0, uTime * 0.06) + brush * 0.4),
      fbm(p * 1.6 + vec2(5.2, -uTime * 0.05) + brush * 0.4)
    );

    vec2 r = vec2(
      fbm(p * 2.0 + 4.0 * q + vec2(1.7, 9.2) + uScroll * 0.6),
      fbm(p * 2.0 + 4.0 * q + vec2(8.3, 2.8) - uScroll * 0.4)
    );

    float f = fbm(p * 1.8 + 4.0 * r);
    f = smoothstep(-0.3, 1.0, f);

    // 3-color blend
    vec3 col = mix(uColorB, uColorA, clamp(f * 1.2, 0.0, 1.0));
    col = mix(col, uColorC, smoothstep(0.55, 0.95, length(r) * 0.7));

    // brush highlight near cursor
    col += brush * 0.18 * uColorC;

    // subtle grain (paper feel)
    float grain = (hash(uv * uRes + uTime).x) * 0.025;
    col += grain;

    // vignette
    float vg = smoothstep(1.2, 0.35, distance(uv, vec2(0.5)));
    col *= 0.65 + 0.5 * vg;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const mat = new THREE.ShaderMaterial({
  uniforms,
  vertexShader,
  fragmentShader,
});

const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
scene.add(mesh);

/* ------- Mouse tracking with velocity ------- */
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

/* ------- Scroll → shader ------- */
let scrollVal = 0;
lenis.on("scroll", ({ scroll, limit }) => {
  scrollVal = limit > 0 ? scroll / limit : 0;
});

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

  uniforms.uScroll.value += (scrollVal - uniforms.uScroll.value) * 0.06;

  renderer.render(scene, camera);
  requestAnimationFrame(render);
}
render();

/* ==========================================================
   3) GSAP ScrollTrigger — palette crossfade + scene reveals
   ========================================================== */

// --- Palette crossfade per scene ---
const scenes = document.querySelectorAll(".scene[data-palette]");
scenes.forEach((sec) => {
  const key = sec.dataset.palette;
  const pal = PALETTES[key];
  if (!pal) return;

  ScrollTrigger.create({
    trigger: sec,
    start: "top 60%",
    end:   "bottom 40%",
    onEnter:     () => fadeTo(pal),
    onEnterBack: () => fadeTo(pal),
  });
});

function fadeTo(pal) {
  gsap.to(uniforms.uColorA.value, { x: pal.a[0], y: pal.a[1], z: pal.a[2], duration: 1.6, ease: "power2.inOut" });
  gsap.to(uniforms.uColorB.value, { x: pal.b[0], y: pal.b[1], z: pal.b[2], duration: 1.6, ease: "power2.inOut" });
  gsap.to(uniforms.uColorC.value, { x: pal.c[0], y: pal.c[1], z: pal.c[2], duration: 1.6, ease: "power2.inOut" });
}

// --- Cinematic reveals: stagger every .reveal inside a scene as it enters ---
scenes.forEach((sec) => {
  const targets = sec.querySelectorAll(".reveal");
  if (!targets.length) return;

  gsap.fromTo(targets,
    { y: 60, opacity: 0, filter: "blur(8px)" },
    {
      y: 0,
      opacity: 1,
      filter: "blur(0px)",
      duration: 1.1,
      ease: "expo.out",
      stagger: 0.08,
      scrollTrigger: {
        trigger: sec,
        start: "top 75%",
        toggleActions: "play none none reverse",
      },
    }
  );
});

// --- Hero parallax: drift display text on scroll ---
const heroDisplay = document.querySelector(".scene-hero .display");
const heroLead = document.querySelector(".scene-hero .lead");
if (heroDisplay) {
  gsap.to(heroDisplay, {
    yPercent: -30,
    opacity: 0.2,
    ease: "none",
    scrollTrigger: {
      trigger: ".scene-hero",
      start: "top top",
      end:   "bottom top",
      scrub: true,
    },
  });
}
if (heroLead) {
  gsap.to(heroLead, {
    yPercent: -20,
    opacity: 0,
    ease: "none",
    scrollTrigger: {
      trigger: ".scene-hero",
      start: "top top",
      end:   "bottom top",
      scrub: true,
    },
  });
}

// --- Module cards: subtle 3D tilt on enter, one after another ---
const moduleCards = document.querySelectorAll(".module-card");
moduleCards.forEach((card, i) => {
  gsap.from(card, {
    y: 80,
    rotateX: -10,
    opacity: 0,
    duration: 0.9,
    ease: "power3.out",
    delay: (i % 5) * 0.04,
    scrollTrigger: {
      trigger: card,
      start: "top 85%",
      toggleActions: "play none none reverse",
    },
  });
});

// --- Comparison rows: cascade in ---
const rows = document.querySelectorAll(".ct-row:not(.ct-head)");
gsap.from(rows, {
  x: -40,
  opacity: 0,
  duration: 0.7,
  ease: "power2.out",
  stagger: 0.06,
  scrollTrigger: {
    trigger: ".compare-table",
    start: "top 75%",
    toggleActions: "play none none reverse",
  },
});

// --- Voice quotes: alternating drift ---
const voices = document.querySelectorAll(".voice");
voices.forEach((v, i) => {
  gsap.from(v, {
    x: i % 2 === 0 ? -40 : 40,
    y: 30,
    opacity: 0,
    duration: 0.9,
    ease: "power2.out",
    scrollTrigger: {
      trigger: v,
      start: "top 85%",
      toggleActions: "play none none reverse",
    },
  });
});

// --- Progress bar ---
const progressFill = document.querySelector(".progress-fill");
if (progressFill) {
  gsap.to(progressFill, {
    width: "100%",
    ease: "none",
    scrollTrigger: {
      trigger: document.body,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.3,
    },
  });
}

// --- Smooth anchor scrolling via Lenis ---
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    if (!id || id === "#") return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: 0, duration: 1.4 });
  });
});

// Final ScrollTrigger refresh once everything's wired up
ScrollTrigger.refresh();
