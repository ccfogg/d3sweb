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

let scrollTarget = 0;   // updated from lenis (normalized px → screens)
lenis.on("scroll", ({ scroll }) => { scrollTarget = scroll / window.innerHeight; });

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
  uTime:        { value: 0 },
  uMouse:       { value: new THREE.Vector2(0.5, 0.5) },
  uMouseVel:    { value: 0 },
  uRes:         { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  uInvert:      { value: 0 },     // 0 = light paper, 1 = dark scene
  uScroll:      { value: 0 },     // smoothed scroll position (screens)
  uOrientation: { value: 0 },     // 0 = horizontal lines only, 1 = vertical lines only
  uBase:        { value: new THREE.Vector3(0.997, 0.994, 0.989) }, // per-scene paper tint
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
  uniform float uScroll;
  uniform float uOrientation;
  uniform vec3  uBase;

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

  // Distance to one horizontal line at y = pos (line spans full width)
  float hLine(float py, float pos, float thickness) {
    float d = abs(py - pos);
    return 1.0 - smoothstep(thickness * 0.5, thickness * 1.5, d);
  }
  // Distance to one vertical line at x = pos (line spans full height)
  float vLine(float px, float pos, float thickness) {
    float d = abs(px - pos);
    return 1.0 - smoothstep(thickness * 0.5, thickness * 1.5, d);
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uRes.x / uRes.y;
    vec2 p = vec2(uv.x * aspect, uv.y);

    // Per-scene paper tint (set by GSAP) OR rich black (compare scene)
    vec3 paperDark = vec3(0.035, 0.035, 0.033);
    vec3 base = mix(uBase, paperDark, uInvert);

    float t = uTime;
    float s = uScroll;

    // -------- 3 horizontal lines (always horizontal — no orientation switch)
    //  [0] = thick accent stroke, [1..2] = thin secondaries
    //  Motion VERY minimal — barely-perceptible drift, no scroll parallax
    float hBase[3];   hBase[0]=0.62;   hBase[1]=0.18;   hBase[2]=0.88;
    float hPx[3];     hPx[0]=0.0;      hPx[1]=0.0;      hPx[2]=0.0;
    float hDrift[3];  hDrift[0]=0.0004; hDrift[1]=0.0006; hDrift[2]=0.0005;
    float hThick[3];  hThick[0]=0.0042; hThick[1]=0.0013; hThick[2]=0.0011;

    float hLines = 0.0;
    for (int i = 0; i < 3; i++) {
      float raw = hBase[i] + s * hPx[i] + t * hDrift[i];
      float y = mod(raw, 1.2) - 0.1;
      float L = hLine(p.y, y, hThick[i]);
      float cycle = mod(raw, 1.2) / 1.2;
      L *= smoothstep(0.0, 0.05, cycle) * smoothstep(1.0, 0.95, cycle);
      hLines += L;
    }

    // -------- 3 vertical lines (uOrientation 1)
    //  [0] = thick accent, [1..2] = thin secondaries
    //  Motion intentionally minimal — gentle drift only, no scroll parallax
    float vBase[3];   vBase[0]=0.35;   vBase[1]=0.78;   vBase[2]=0.14;
    float vPx[3];     vPx[0]=-0.010;   vPx[1]= 0.018;   vPx[2]= 0.008;
    float vDrift[3];  vDrift[0]=0.0012; vDrift[1]=-0.0022; vDrift[2]=0.0018;
    float vThick[3];  vThick[0]=0.0040; vThick[1]=0.0012; vThick[2]=0.0010;

    float aw = aspect;
    float vLines = 0.0;
    for (int i = 0; i < 3; i++) {
      float raw = vBase[i] * aw + s * vPx[i] * aw + t * vDrift[i] * aw;
      float spanX = aw + 0.2;
      float x = mod(raw, spanX) - 0.1;
      float L = vLine(p.x, x, vThick[i]);
      float cycle = mod(raw, spanX) / spanX;
      L *= smoothstep(0.0, 0.05, cycle) * smoothstep(1.0, 0.95, cycle);
      vLines += L;
    }

    // Lines removed per user request — flat paper only.
    // (hLines/vLines computed above are intentionally discarded.)

    // Very subtle cursor halo on the paper (no red)
    vec2 mp = uMouse;
    mp.x = mp.x * aspect;
    float mdist = distance(p, mp);
    float halo = exp(-mdist * 3.0) * 0.04;

    vec3 col = base + vec3(halo) + vec3(hLines * 0.0 + vLines * 0.0);

    // Subtle paper grain
    float grain = (hash(uv * uRes + t * 0.4).x - 0.5) * 0.012;
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
let scrollSmooth = 0;
function render() {
  uniforms.uTime.value = clock.getElapsedTime();
  mouseSmooth.lerp(mouseTarget, 0.08);
  uniforms.uMouse.value.copy(mouseSmooth);
  mvSmooth += (mvTarget - mvSmooth) * 0.08;
  mvTarget *= 0.92;
  uniforms.uMouseVel.value = mvSmooth;
  // smooth scroll-driven uniform — lines shift with scroll
  scrollSmooth += (scrollTarget - scrollSmooth) * 0.12;
  uniforms.uScroll.value = scrollSmooth;
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}
render();

/* ----------------------------------------------------------
   3) Per-scene look — orientation (H/V), paper tint, dark invert
   ---------------------------------------------------------- */
// Horizontal lines only throughout — no orientation switching (per user)
const SCENE_LOOK = {
  1: { orient: 0, base: [0.997, 0.994, 0.989], invert: 0 }, // Hero      — warm cream
  2: { orient: 0, base: [1.000, 0.998, 0.994], invert: 0 }, // Promise   — neutral
  3: { orient: 0, base: [0.992, 0.995, 1.000], invert: 0 }, // Modules   — cool ivory
  4: { orient: 0, base: [0.998, 0.995, 0.988], invert: 0 }, // Why       — warm
  5: { orient: 0, base: [0.997, 0.994, 0.989], invert: 1 }, // Compare   — full black
  6: { orient: 0, base: [0.999, 0.992, 0.984], invert: 0 }, // Voices    — peach
  7: { orient: 0, base: [1.000, 1.000, 1.000], invert: 0 }, // CTA       — pure white
};

function applySceneLook(id) {
  const look = SCENE_LOOK[id];
  if (!look) return;
  gsap.to(uniforms.uOrientation, { value: look.orient, duration: 1.6, ease: "power2.inOut" });
  gsap.to(uniforms.uBase.value,  { x: look.base[0], y: look.base[1], z: look.base[2], duration: 1.6, ease: "power2.inOut" });
  gsap.to(uniforms.uInvert,      { value: look.invert, duration: 1.0, ease: "power2.inOut" });
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
    onEnter:     () => { setSpine(mark, label, id); applySceneLook(id); },
    onEnterBack: () => { setSpine(mark, label, id); applySceneLook(id); },
  });
});

// initialize scene 1 immediately so paper opens warm
applySceneLook(1);

/* ----------------------------------------------------------
   5) Reveals — cinematic entries
   ---------------------------------------------------------- */

// Split every .display headline into per-word spans for staggered reveal
document.querySelectorAll(".display").forEach((h) => {
  if (h.dataset.split === "done") return;
  // Walk text nodes only; preserve <em>, <br>, <span> children
  const walker = document.createTreeWalker(h, NodeFilter.SHOW_TEXT, null);
  const texts = [];
  let n; while ((n = walker.nextNode())) texts.push(n);
  texts.forEach((node) => {
    const parts = node.nodeValue.split(/(\s+)/).filter(Boolean);
    const frag = document.createDocumentFragment();
    parts.forEach((part) => {
      if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); }
      else {
        const span = document.createElement("span");
        span.className = "headline-word";
        span.textContent = part;
        frag.appendChild(span);
      }
    });
    node.parentNode.replaceChild(frag, node);
  });
  // also wrap any inline <em> contents as words
  h.querySelectorAll("em").forEach((em) => {
    if (em.dataset.split === "done") return;
    const txt = em.textContent;
    em.textContent = "";
    const span = document.createElement("span");
    span.className = "headline-word";
    span.textContent = txt;
    em.appendChild(span);
    em.dataset.split = "done";
  });
  h.dataset.split = "done";
});

// Cinematic word-by-word reveal on every display headline
document.querySelectorAll(".display").forEach((h) => {
  const words = h.querySelectorAll(".headline-word");
  if (!words.length) return;
  gsap.fromTo(words,
    { y: 80, opacity: 0, filter: "blur(14px)", rotateX: -30 },
    {
      y: 0, opacity: 1, filter: "blur(0px)", rotateX: 0,
      duration: 1.2, ease: "expo.out", stagger: 0.06,
      scrollTrigger: { trigger: h, start: "top 88%", toggleActions: "play none none reverse" },
    });
});

// Other .reveal items: standard rise + blur + slight scale
document.querySelectorAll(".reveal").forEach((el) => {
  if (el.classList.contains("display")) {
    // headlines animate per-word; ensure parent is fully visible so words show
    el.style.opacity = "1";
    el.style.transform = "none";
    el.style.filter = "none";
    return;
  }
  gsap.fromTo(el,
    { y: 50, opacity: 0, filter: "blur(10px)", scale: 0.98 },
    { y: 0, opacity: 1, filter: "blur(0px)", scale: 1, duration: 1.1, ease: "expo.out",
      scrollTrigger: { trigger: el, start: "top 85%", toggleActions: "play none none reverse" } });
});

// Photographs/figures: clip-path wipe from left + subtle zoom-out
document.querySelectorAll(".hero-figure").forEach((fig) => {
  gsap.fromTo(fig,
    { clipPath: "inset(0 100% 0 0)", scale: 1.06 },
    { clipPath: "inset(0 0% 0 0)", scale: 1, duration: 1.6, ease: "expo.out",
      scrollTrigger: { trigger: fig, start: "top 85%", toggleActions: "play none none reverse" } });
});

// Module visuals (tablet + phone): clip-path open + scale settle
document.querySelectorAll(".module-visuals").forEach((v) => {
  gsap.fromTo(v,
    { clipPath: "inset(100% 0 0 0)", opacity: 0 },
    { clipPath: "inset(0% 0 0 0)", opacity: 1, duration: 1.2, ease: "expo.out",
      scrollTrigger: { trigger: v, start: "left 90%", horizontal: false, toggleActions: "play none none reverse" } });
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
   11.5) Marquee strips — duplicate + infinite translate
   ---------------------------------------------------------- */
document.querySelectorAll("[data-marquee]").forEach((track) => {
  // duplicate children for seamless loop
  const clone = track.innerHTML;
  track.innerHTML = clone + clone;
  const direction = track.dataset.direction === "reverse" ? 1 : -1;
  const half = () => -track.scrollWidth / 2;
  // Slow steady drift — no scroll-velocity coupling (was causing motion sickness)
  gsap.to(track, {
    x: () => direction * Math.abs(half()),
    duration: 80,
    ease: "none",
    repeat: -1,
  });
});

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
