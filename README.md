# D3S — Inception CRM Storytelling Site

Orta ölçek farma şirketleri için tasarlanmış D3S Inception CRM platformunun storytelling tarzında tanıtım sitesi. Tek sayfa, yedi sinematik sahne, scroll-driven anlatım.

---

## Genel Bakış

**Amaç:** Inception CRM ürününü "klasik kurumsal SaaS sayfası" yerine bir hikâye gibi anlatmak. Kullanıcı sayfada kaydırdıkça yedi bölümden oluşan bir editöryel anlatımdan geçer; her sahnenin kendine özgü mizanpajı, tipografisi ve giriş animasyonu vardır.

**Hedef kitle:** Orta pazar farma şirketlerinin saha, satış ve pazarlama yöneticileri.

**Marka:** D3S a.s. — Inception CRM ürünü, data3s.com.tr Türkiye temsilciliği. Logo ve marka kırmızısı (`#e1252b`) data3s.com.tr'den alınmıştır.

---

## Teknoloji Yığını

| Katman | Araç | Sürüm | Konum |
|--------|------|-------|-------|
| 3D / Shader | Three.js | 0.160 | `vendor/three.module.js` (ESM) |
| Animasyon | GSAP + ScrollTrigger | 3.12.5 | `vendor/gsap.min.js`, `vendor/ScrollTrigger.min.js` (UMD) |
| Smooth scroll | Lenis | 1.1.13 | `vendor/lenis.min.js` (UMD) |
| Tipografi | Fraunces (serif) + Inter (sans) | — | Google Fonts |
| Görseller | WebP / PNG | — | inceptioncrm.com'dan |

Tüm kütüphaneler `vendor/` altında yerel olarak host edilir; CDN bağımlılığı yoktur.

---

## Sayfa Yapısı — Yedi Sahne

| # | Sahne | İçerik | Mizanpaj |
|---|-------|--------|----------|
| I | **Açılış** | Devasa serif başlık + sıcak fotoğraf + telefon mockup | İki kolonlu hero |
| II | **Söz** | "Aylar süren kurulumlar yerine, haftalar içinde sahada." | Pinned, kelime-kelime reveal |
| III | **On Modül** | HCP'den Satış Analitiği'ne 10 modül, her birinde tablet + telefon | Yatay scroll, pinned |
| IV | **Neden Biz** | Hız / bağımsızlık / gerçek zaman / şeffaflık — 4 statement | Pinned, crossfade |
| V | **Karşılaştırma** | Inception vs. Geleneksel CRM — 10 satırlık tablo | Dramatic siyah sahne |
| VI | **Sesler** | 6 müşteri yorumu (Polonya, Kıbrıs, İspanya, UK, Çekya, Slovakya) | Pinned, crossfade |
| VII | **Son Sahne** | Demo formu + iletişim | CTA finali |

Sahneler arasında iki marquee bandı — yavaş yatay kayan italic serif metin. Ayrıca hero altında müşteri logo şeridi (Phoenix, Novartis, Sandoz, Glenmark, Medochemie, easyMed, Agel, Farmak, Accord, Viatris, Senimed, Mylan, NAOS, Neuraxpharm, Aurobindo, Pharmapal).

---

## Tasarım Sistemi

### Renkler

```
--bg:       #ffffff    Beyaz kağıt zemin
--ink:      #0a0a0a    Ana metin
--ink-mid:  #3a3a38    İkincil metin
--ink-mute: #8a8a86    Meta metin
--rule:     #e8e6e0    Hairline ayraç
--red:      #e1252b    Marka kırmızısı (data3s logosundan)
--dark:     #0a0a0a    Karşılaştırma sahnesi zemin
--dark-paper: #f5f5f0  Karşılaştırma sahnesi metin
```

Sahne başına kağıt tonu çok hafif kayar (sıcak krem ↔ soğuk fildişi ↔ şeftali) — GSAP ile `uBase` uniform'u tween edilir.

### Tipografi

- **Serif (display):** Fraunces, italic + roman karışımı, 300-500 ağırlık, `clamp(56px, 11vw, 200px)`
- **Sans (body):** Inter, 300-700 ağırlık, gövde 16-19px
- **Roman numeraller:** Spine'da büyük italic Roman (I, II, III...) — sahne göstergesi
- **Letter-spacing:** display'de sıkı (-0.04em)

### Anahtar tipografik öğeler

- `.display em` — italic + kırmızı vurgu kelimesi
- `.eyebrow` — küçük caps üstbaşlık, sol kenarda hairline ile başlar
- `.chap-no` — italic Roman bölüm numarası, kırmızı

---

## Animasyon ve Etkileşim

### Smooth scroll

Lenis — 1.2s duration, exponential easing. ScrollTrigger ile senkronize.

### Sahne girişleri (sinematik)

- Her `.display` başlığı kelime kelime parçalanır (`.headline-word`) ve girişte stagger ile y/blur/rotateX tweenlenir
- `.reveal` öğeleri: y/opacity/blur/scale
- Fotoğraflar: clip-path soldan açılır (`inset(0 100% 0 0)` → `inset(0 0% 0 0)`)
- Module visuals: yukarıdan clip-path ile açılır

### Pinned sahneler

| Sahne | Mekanizma |
|-------|-----------|
| II Promise | CSS `position: sticky` + GSAP scrub timeline (kelime reveal) |
| III Modules | ScrollTrigger `pin: true` + yatay `x` translate, scrub 0.6 |
| IV Why | CSS sticky + scrub timeline, 4 slide crossfade |
| VI Voices | CSS sticky + scrub timeline, 6 quote crossfade |

### Three.js arka plan

Tek tam ekran shader. Per-scene uniform'lar:
- `uBase` (vec3): kağıt tonu
- `uInvert` (float): 0 = beyaz, 1 = siyah (Karşılaştırma sahnesi için)
- `uMouse`, `uMouseVel`: imleç pozisyonu ve hızı
- `uTime`, `uScroll`: zaman ve scroll konumu

Şu an minimal: sadece kağıt tonu + cursor'un peşinden gelen çok ince halo.

### Marquee bantları

İki yatay marquee — duplicate edilmiş içerik üzerinde sonsuz GSAP loop (80s tam tur). Hero–Promise arası ileri yönde, Voices–CTA arası ters yönde.

### Spine indicator

Sol kenarda sticky sidebar: büyük italic Roman numeral (mevcut sahne) + dikey label + alt köşede "D3S 2026" küçük meta. ScrollTrigger her sahnede günceller.

---

## Dosya Yapısı

```
d3sweb/
├── index.html              # Tek sayfa markup, 7 sahne
├── styles.css              # Tüm stiller, tasarım sistemi
├── main.js                 # Three.js shader + GSAP + Lenis
├── vendor/                 # Yerel kütüphaneler (CDN bağımlılığı yok)
│   ├── three.module.js
│   ├── gsap.min.js
│   ├── ScrollTrigger.min.js
│   └── lenis.min.js
└── assets/
    ├── d3s-logo.png        # Marka logosu (data3s.com.tr)
    ├── inception-logo.png  # Inception CRM logo varyantı
    ├── hero-bg.webp        # Hero fotoğrafı
    ├── phone-*.webp        # 10 telefon mockup
    ├── tablet-*.webp       # 9 tablet/desktop mockup
    ├── logos/              # 18 farma müşteri logosu
    ├── badges/             # 5 G2 ödül rozeti
    └── scene-*.webp        # Sahne arka planları
```

---

## Geliştirme

```bash
# Lokal sunucu
python3 -m http.server 8765

# Tarayıcıda
open http://localhost:8765
```

Build adımı yok — tüm dosyalar statik servis edilir.

### Test (opsiyonel)

Playwright ile headless tarayıcıda otomatik screenshot ve hata yakalama:
```bash
node /tmp/test-d3s.cjs
```

---

## Yayınlama

GitHub Pages üzerinden yayınlanır:

- **Repo:** `ccfogg/d3sweb`
- **Branch:** `claude/redesign-storytelling-site-saYls`
- **URL:** `https://ccfogg.github.io/d3sweb/`

Her push otomatik deploy tetikler (1–2 dk). Hard refresh (Ctrl+Shift+R) yeni sürümü görmek için gerekli olabilir.

### Custom domain (data3s.com.tr için)

GitHub Pages ayarlarında Custom domain alanına `data3s.com.tr` girilip DNS sağlayıcısında CNAME `ccfogg.github.io`'ya yönlendirilebilir. "Enforce HTTPS" işaretlenir.

---

## İçerik kuralı

Fiyat / pricing / "€40-100 per user" gibi fiyat bilgisi sitede gösterilmez — bu açık bir tasarım kararıdır.

---

## Erişilebilirlik

- `prefers-reduced-motion` desteklenir — tüm animasyonlar `0.01ms`'a düşer, reveal öğeleri direkt görünür gelir
- Semantik HTML: `<nav>`, `<main>`, `<section>`, `<article>`, `<blockquote>`, `<footer>`
- ARIA labels: dekoratif öğelerde `aria-hidden="true"`
- Klavye odak desteği nav linklerinde

---

## Tarayıcı desteği

Modern evergreen tarayıcılar (Chrome, Firefox, Safari, Edge — son 2 sürüm). WebGL 2 gerekli (Three.js shader için). ESM import map desteği gerekli (mobil tarayıcılarda Safari 16.4+).
