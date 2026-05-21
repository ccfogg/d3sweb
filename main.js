/* ==========================================================
   D3S Editorial — Three.js (paper + cursor halo) + GSAP + Lenis
   Monochrome, restrained, premium
   ========================================================== */

import * as THREE from "./vendor/three.module.js";

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
const Lenis = window.Lenis;

gsap.registerPlugin(ScrollTrigger);

/* ----------------------------------------------------------
   1) LENIS
   ---------------------------------------------------------- */
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  smoothTouch: false,
});
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
window.__lenis = lenis;

/* ----------------------------------------------------------
   2) THREE.JS — paper texture + cursor light, monochrome
   ---------------------------------------------------------- */
const canvas = document.getElementById("bg-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const uniforms = {
  uTime:     { value: 0 },
  uMouse:    { value: new THREE.Vector2(0.5, 0.5) },
  uMouseVel: { value: 0 },
  uRes:      { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  uInvert:   { value: 0 }, // 0 = light paper, 1 = dark scene
};

const vertexShader = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
`;

const fragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2  uMouse;
  uniform float uMouseVel;
  uniform vec2  uRes;
  uniform float uInvert;

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
    vec3 h = max(0.5 - vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0);
    vec3 n = h*h*h*h * vec3(dot(a, hash(i)), dot(b, hash(i+o)), dot(c, hash(i+1.0)));
    return dot(n, vec3(70.0));
  }
  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.04; a *= 0.5; }
    return v;
  }

  // Brand red — matches data3s.com.tr logo
  const vec3 BRAND_RED = vec3(0.882, 0.145, 0.169);

  // One animated contour-line layer with given scale, speed, density, weight
  float lineLayer(vec2 p, float scale, vec2 drift, float density, float weight) {
    vec2 q = p * scale + drift;
    float n = fbm(q);
    // iso-contour: thin line where the noise crosses each (1/density) step
    float band = abs(fract(n * density) - 0.5) * 2.0;
    float aa   = fwidth(n * density) * weight;
    return 1.0 - smoothstep(0.0, aa, band);
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uRes.x / uRes.y;
    vec2 puv = uv;
    puv.x = (uv.x - 0.5) * aspect + 0.5;

    // Bases: white paper (default) or rich black (compare scene)
    vec3 paperLight = vec3(0.996, 0.992, 0.985);
    vec3 paperDark  = vec3(0.035, 0.035, 0.033);
    vec3 base = mix(paperLight, paperDark, uInvert);

    // Cursor distortion of the field
    vec2 mp = uMouse;
    mp.x = (mp.x - 0.5) * aspect + 0.5;
    float mdist = distance(puv, mp);
    float mInfluence = exp(-mdist * 2.5) * (0.5 + uMouseVel * 1.8);

    // Three flowing layers at different scales and drift directions
    float t = uTime;
    vec2 dist = vec2(mInfluence * 0.6, mInfluence * 0.4);

    float layerA = lineLayer(puv + dist * 0.4, 1.8, vec2( t*0.07, -t*0.05), 7.0,  1.4);
    float layerB = lineLayer(puv + dist * 0.6, 3.2, vec2(-t*0.05,  t*0.08), 12.0, 1.6);
    float layerC = lineLayer(puv + dist * 0.3, 0.9, vec2( t*0.03,  t*0.04), 4.0,  2.2);

    // Combine — layers darker when summed but capped via screen blend
    float lines = layerA * 0.55 + layerB * 0.35 + layerC * 0.65;
    lines = clamp(lines, 0.0, 1.0);

    // Cursor brightens lines near pointer (more visible signal there)
    lines *= 0.55 + mInfluence * 0.8;

    // Edge vignette so lines feel "framed" toward center
    float edge = smoothstep(0.95, 0.45, distance(uv, vec2(0.5)));
    lines *= 0.45 + 0.65 * edge;

    // Compose: lay red lines onto base
    vec3 col = base;
    col = mix(col, BRAND_RED, lines * 0.65);

    // Subtle paper grain
    float grain = (hash(uv * uRes + t * 0.4).x - 0.5) * 0.014;
    col += grain;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const mat = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });
const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
scene.add(mesh);

/* ----------------------------------------------------------
   Mouse + cursor dot
   ---------------------------------------------------------- */
const mouseTarget = new THREE.Vector2(0.5, 0.5);
const mouseSmooth = new THREE.Vector2(0.5, 0.5);
let lastM = { x: 0.5, y: 0.5, t: performance.now() };
let mvTarget = 0, mvSmooth = 0;

const cursorDot = document.getElementById("cursor-dot");

window.addEventListener("pointermove", (e) => {
  const nx = e.clientX / window.innerWidth;
  const ny = 1.0 - e.clientY / window.innerHeight;
  mouseTarget.set(nx, ny);
  const now = performance.now();
  const dt = Math.max(now - lastM.t, 16);
  const dx = nx - lastM.x, dy = ny - lastM.y;
  mvTarget = Math.min(Math.sqrt(dx*dx + dy*dy) / (dt / 1000) * 0.2, 1.0);
  lastM = { x: nx, y: ny, t: now };

  if (cursorDot) {
    cursorDot.style.left = e.clientX + "px";
    cursorDot.style.top  = e.clientY + "px";
  }
}, { passive: true });

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  uniforms.uRes.value.set(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
function render() {
  uniforms.uTime.value = clock.getElapsedTime();
  mouseSmooth.lerp(mouseTarget, 0.08);
  uniforms.uMouse.value.copy(mouseSmooth);
  mvSmooth += (mvTarget - mvSmooth) * 0.08;
  mvTarget *= 0.92;
  uniforms.uMouseVel.value = mvSmooth;
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}
render();

/* ----------------------------------------------------------
   3) Section detection — invert canvas for dark scene
   ---------------------------------------------------------- */
const compareSection = document.getElementById("compare");
if (compareSection) {
  ScrollTrigger.create({
    trigger: compareSection,
    start: "top 50%",
    end:   "bottom 50%",
    onEnter:     () => gsap.to(uniforms.uInvert, { value: 1, duration: 1.0, ease: "power2.inOut" }),
    onLeave:     () => gsap.to(uniforms.uInvert, { value: 0, duration: 1.0, ease: "power2.inOut" }),
    onEnterBack: () => gsap.to(uniforms.uInvert, { value: 1, duration: 1.0, ease: "power2.inOut" }),
    onLeaveBack: () => gsap.to(uniforms.uInvert, { value: 0, duration: 1.0, ease: "power2.inOut" }),
  });
}

/* ----------------------------------------------------------
   4) Spine sidebar updates per scene
   ---------------------------------------------------------- */
const spineMark  = document.getElementById("spine-mark");
const spineLabel = document.getElementById("spine-label");
const folio      = document.getElementById("folio");

function setSpine(mark, label, n) {
  if (!spineMark) return;
  gsap.to(spineMark,  { opacity: 0, y: -8, duration: 0.2, onComplete: () => { spineMark.textContent = mark; gsap.to(spineMark, { opacity: 1, y: 0, duration: 0.4 }); } });
  gsap.to(spineLabel, { opacity: 0, duration: 0.15, onComplete: () => { spineLabel.textContent = label; gsap.to(spineLabel, { opacity: 1, duration: 0.4 }); } });
  if (folio) folio.textContent = String(n).padStart(3, "0") + " — 007";
}

document.querySelectorAll("[data-scene]").forEach((sec) => {
  const id = Number(sec.dataset.scene);
  const mark = sec.dataset.mark || "I";
  const label = sec.dataset.label || "";

  ScrollTrigger.create({
    trigger: sec,
    start: "top 60%",
    end:   "bottom 40%",
    onEnter:     () => setSpine(mark, label, id),
    onEnterBack: () => setSpine(mark, label, id),
  });
});

/* ----------------------------------------------------------
   5) Reveals
   ---------------------------------------------------------- */
document.querySelectorAll(".reveal").forEach((el) => {
  gsap.fromTo(el,
    { y: 40, opacity: 0, filter: "blur(8px)" },
    { y: 0, opacity: 1, filter: "blur(0px)", duration: 1.0, ease: "expo.out",
      scrollTrigger: { trigger: el, start: "top 85%", toggleActions: "play none none reverse" } });
});

/* ----------------------------------------------------------
   6) Hero parallax
   ---------------------------------------------------------- */
const heroDisplay = document.querySelector(".scene-hero .display");
const heroFigure  = document.querySelector(".hero-figure");
if (heroDisplay) {
  gsap.to(heroDisplay, { yPercent: -10, ease: "none",
    scrollTrigger: { trigger: ".scene-hero", start: "top top", end: "bottom top", scrub: true } });
}
if (heroFigure) {
  gsap.to(heroFigure, { yPercent: 12, ease: "none",
    scrollTrigger: { trigger: ".scene-hero", start: "top top", end: "bottom top", scrub: true } });
}

/* ----------------------------------------------------------
   7) Scene 2 — PROMISE pinned word reveal
   ---------------------------------------------------------- */
const promiseSection = document.getElementById("promise");
if (promiseSection) {
  const words = promiseSection.querySelectorAll(".word");
  const margins = promiseSection.querySelectorAll(".promise-margin-item");

  const tl = gsap.timeline({
    scrollTrigger: { trigger: promiseSection, start: "top top", end: "bottom bottom", scrub: 0.4 },
  });
  words.forEach((w, i) => tl.to(w, { opacity: 1, duration: 1 }, i * 0.5));
  margins.forEach((m, i) => tl.to(m, { opacity: 1, x: 0, duration: 1 }, words.length * 0.5 + i * 0.6));
}

/* ----------------------------------------------------------
   8) Scene 3 — MODULES horizontal pinned scroll
   ---------------------------------------------------------- */
const modulesSection = document.getElementById("modules");
const track = document.getElementById("modules-track");
const modCounter = document.getElementById("modules-counter");

if (modulesSection && track) {
  const slides = track.querySelectorAll(".module-slide");

  requestAnimationFrame(() => {
    const totalWidth = track.scrollWidth;
    const viewportWidth = window.innerWidth;
    const sideWidth = document.querySelector(".modules-side").offsetWidth;
    const distance = totalWidth - (viewportWidth - sideWidth) + 80;

    gsap.to(track, { x: () => -distance, ease: "none",
      scrollTrigger: { trigger: modulesSection, start: "top top", end: () => "+=" + distance,
        pin: true, scrub: 0.6, invalidateOnRefresh: true } });

    slides.forEach((slide, i) => {
      ScrollTrigger.create({
        trigger: modulesSection,
        start: () => "top top-=" + (i * distance / slides.length),
        end:   () => "top top-=" + ((i + 1) * distance / slides.length),
        onToggle: (self) => { if (self.isActive && modCounter) modCounter.textContent = String(i + 1).padStart(2, "0"); },
      });
    });

    ScrollTrigger.refresh();
  });
}

/* ----------------------------------------------------------
   9) Scene 4 — WHY pinned statement swap
   ---------------------------------------------------------- */
const whySection = document.getElementById("why");
if (whySection) {
  const slides = whySection.querySelectorAll(".why-slide");
  const counter = document.getElementById("why-counter");
  gsap.set(slides, { opacity: 0 });
  gsap.set(slides[0], { opacity: 1 });

  const tl = gsap.timeline({
    scrollTrigger: { trigger: whySection, start: "top top", end: "bottom bottom", scrub: 0.4,
      onUpdate: (self) => {
        const idx = Math.min(slides.length - 1, Math.floor(self.progress * slides.length));
        if (counter) counter.textContent = String(idx + 1).padStart(2, "0");
      } } });
  for (let i = 1; i < slides.length; i++) {
    tl.to(slides[i-1], { opacity: 0, duration: 1, ease: "power2.inOut" })
      .to(slides[i],   { opacity: 1, duration: 1, ease: "power2.inOut" }, "<");
  }
}

/* ----------------------------------------------------------
   10) Scene 5 — comparison rows cascade
   ---------------------------------------------------------- */
gsap.from(".compare-row.reveal", {
  x: -30, opacity: 0, duration: 0.7, ease: "power2.out", stagger: 0.06,
  scrollTrigger: { trigger: ".compare-list", start: "top 80%", toggleActions: "play none none reverse" } });

/* ----------------------------------------------------------
   11) Scene 6 — VOICES pinned crossfade
   ---------------------------------------------------------- */
const voicesSection = document.getElementById("voices");
if (voicesSection) {
  const cards = voicesSection.querySelectorAll(".voice-card");
  const counter = document.getElementById("voices-counter");
  gsap.set(cards, { opacity: 0, y: 20 });
  gsap.set(cards[0], { opacity: 1, y: 0 });

  const tl = gsap.timeline({
    scrollTrigger: { trigger: voicesSection, start: "top top", end: "bottom bottom", scrub: 0.5,
      onUpdate: (self) => {
        const idx = Math.min(cards.length - 1, Math.floor(self.progress * cards.length));
        if (counter) counter.textContent = String(idx + 1).padStart(2, "0");
      } } });
  for (let i = 1; i < cards.length; i++) {
    tl.to(cards[i-1], { opacity: 0, y: -20, duration: 1, ease: "power2.inOut" })
      .to(cards[i],   { opacity: 1, y: 0,  duration: 1, ease: "power2.inOut" }, "<");
  }
}

/* ----------------------------------------------------------
   12) Logo strip drift
   ---------------------------------------------------------- */
gsap.from(".logo-strip img", {
  y: 20, opacity: 0, duration: 0.6, ease: "power2.out", stagger: 0.03,
  scrollTrigger: { trigger: ".logo-strip", start: "top 85%", toggleActions: "play none none reverse" } });

/* ----------------------------------------------------------
   13) Anchor smoothing via Lenis
   ---------------------------------------------------------- */
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    if (!id || id === "#") return;
    const t = document.querySelector(id);
    if (!t) return;
    e.preventDefault();
    lenis.scrollTo(t, { offset: -40, duration: 1.4 });
  });
});

setTimeout(() => ScrollTrigger.refresh(), 100);
