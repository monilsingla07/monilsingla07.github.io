// assets/site-content.js
//
// Homepage hero-banner carousel + testimonials — both fully admin-managed
// (Admin → Hero & Testimonials), no code changes or redeploys needed to
// swap a slide's image/copy or add/remove a testimonial. Previously both
// sections were hardcoded directly in index.html's markup/inline script.
//
// Fails quietly on any error — a content-loading problem here must never
// break the rest of the homepage.

import { escapeHtml, escapeAttr, safeSrc, safeUrl } from "./safe.js";

const HERO_URL = "https://mgmgkwoxirvzdnmayhwq.supabase.co/functions/v1/get-active-hero-slides";
const TESTIMONIALS_URL = "https://mgmgkwoxirvzdnmayhwq.supabase.co/functions/v1/get-active-testimonials";

/* ────────────────── Hero banner ────────────────── */

function heroSlideHtml(slide, index, total) {
  const isFirst = index === 0;
  const desktopSrc = safeSrc(slide.image_desktop_url || "");
  const mobileSrc = slide.image_mobile_url ? safeSrc(slide.image_mobile_url) : "";
  const alt = escapeAttr(slide.image_alt || slide.title || "");
  const ctaHref = slide.cta_link ? safeUrl(slide.cta_link, { type: "href" }) : "";
  const hasCta = !!(slide.cta_text && ctaHref);
  const hasNote = !!(slide.note_text || slide.note_strong);
  const TitleTag = isFirst ? "h1" : "h2"; // only one <h1> per page — first slide keeps it

  return `
    <article class="hero-slide" data-slide="${index + 1}" role="group" aria-roledescription="slide" aria-label="Slide ${index + 1} of ${total}"${isFirst ? "" : ' inert aria-hidden="true"'}>
      <picture class="hero-media">
        ${mobileSrc ? `<source media="(max-width: 768px)" srcset="${mobileSrc}">` : ""}
        <img src="${desktopSrc}" alt="${alt}" loading="${isFirst ? "eager" : "lazy"}" ${isFirst ? 'fetchpriority="high"' : ""}>
      </picture>
      <div class="hero-deco" aria-hidden="true"></div>
      <div class="hero-overlay">
        ${slide.kicker ? `<div class="hero-kicker">${escapeHtml(slide.kicker)}</div>` : ""}
        <${TitleTag} class="hero-title">${escapeHtml(slide.title || "")}</${TitleTag}>
        ${slide.subtitle ? `<p class="hero-subtitle">${escapeHtml(slide.subtitle)}</p>` : ""}
        ${(hasCta || hasNote) ? `
        <div class="hero-cta">
          ${hasCta ? `<a class="btn" href="${escapeAttr(ctaHref)}">${escapeHtml(slide.cta_text)}</a>` : ""}
          ${hasNote ? `<span class="hero-note">${escapeHtml(slide.note_text || "")}${slide.note_strong ? ` <strong>${escapeHtml(slide.note_strong)}</strong>` : ""}</span>` : ""}
        </div>` : ""}
      </div>
    </article>
  `;
}

// UX-027: stale-while-revalidate. The last good hero payload lives in
// localStorage; a repeat visit renders it instantly (no network wait before
// the LCP image can start loading) and only re-fetches once it is older than
// HERO_TTL_MS. A changed payload re-renders in place. The inline script in
// index.html's <head> reads the same key to preload the first slide image and
// starts the very first fetch early, exposing it as window.__heroFetch.
const HERO_CACHE_KEY = "ahamstree_hero_v1";
const HERO_TTL_MS = 10 * 60 * 1000;
const HERO_MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;

function readHeroCache() {
  try {
    const c = JSON.parse(localStorage.getItem(HERO_CACHE_KEY) || "null");
    if (!c || !Array.isArray(c.slides) || !c.slides.length) return null;
    const age = Date.now() - Number(c.t || 0);
    if (!(age >= 0) || age > HERO_MAX_STALE_MS) return null;
    return { slides: c.slides, fresh: age < HERO_TTL_MS };
  } catch (_) { return null; }
}
function writeHeroCache(slides) {
  try {
    if (slides && slides.length) localStorage.setItem(HERO_CACHE_KEY, JSON.stringify({ t: Date.now(), slides }));
    else localStorage.removeItem(HERO_CACHE_KEY);
  } catch (_) {}
}

async function fetchHeroSlides() {
  // Reuse the request the <head> script already started, once.
  const early = window.__heroFetch;
  window.__heroFetch = null;
  let data = null;
  if (early) { try { data = await early; } catch (_) {} }
  if (!data) {
    const res = await fetch(HERO_URL, { method: "GET" });
    data = res.ok ? await res.json().catch(() => null) : null;
  }
  return Array.isArray(data?.slides) ? data.slides : null;
}

export async function hydrateHero() {
  const section = document.getElementById("heroBannerSection");
  const track = document.getElementById("heroTrack");
  const dots = document.getElementById("heroDots");
  if (!section || !track) return;

  let teardown = null;
  let renderedSig = "";
  const render = (slides) => {
    if (teardown) teardown();
    section.style.display = "";
    track.innerHTML = slides.map((s, i) => heroSlideHtml(s, i, slides.length)).join("");
    if (slides.length > 1 && dots) {
      dots.innerHTML = slides
        .map((_, i) => `<button class="hero-dot" data-go="${i + 1}" aria-label="Go to slide ${i + 1}" aria-current="${i === 0}" type="button"></button>`)
        .join("");
      dots.style.display = "";
    } else if (dots) {
      dots.innerHTML = "";
      dots.style.display = "none";
    }
    teardown = initHeroCarousel(section, track, dots, slides.length);
    renderedSig = JSON.stringify(slides);
  };

  const cached = readHeroCache();
  if (cached) {
    try { render(cached.slides); } catch (e) { console.error("hero cache render:", e); }
    if (cached.fresh) return;
  }

  try {
    const slides = await fetchHeroSlides();
    if (slides === null) throw new Error("hero fetch failed");
    writeHeroCache(slides);
    if (slides.length === 0) {
      if (teardown) teardown();
      section.style.display = "none";
      return;
    }
    if (JSON.stringify(slides) !== renderedSig) render(slides);
  } catch (e) {
    console.error("hydrateHero error:", e);
    if (!cached) section.style.display = "none";
  }
}

const ICON_PAUSE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
const ICON_PLAY = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>';

function initHeroCarousel(section, track, dots, count) {
  if (count <= 1) return null; // nothing to carousel

  // Every listener below is tied to this controller so a re-render (fresh
  // hero payload) can tear the previous carousel down cleanly.
  const ac = new AbortController();
  const sig = { signal: ac.signal };

  const dotEls = dots ? Array.from(dots.querySelectorAll(".hero-dot")) : [];
  const slideEls = Array.from(track.querySelectorAll(".hero-slide"));
  const reduceMq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const reduced = () => !!(reduceMq && reduceMq.matches);

  let current = 1;
  let autoplayTimer = null;
  let userPaused = false;
  let hovering = false;
  let focusWithin = false;
  let announceTimer = null;

  // Pause/Play control (UX-012). Not created when the visitor prefers
  // reduced motion: there is no autoplay to pause in that case.
  let pauseBtn = null;
  if (!reduced()) {
    pauseBtn = document.createElement("button");
    pauseBtn.type = "button";
    pauseBtn.className = "hero-pause";
    pauseBtn.setAttribute("aria-label", "Pause slideshow");
    pauseBtn.innerHTML = ICON_PAUSE;
    section.appendChild(pauseBtn);
    pauseBtn.addEventListener("click", () => {
      userPaused = !userPaused;
      pauseBtn.setAttribute("aria-label", userPaused ? "Play slideshow" : "Pause slideshow");
      pauseBtn.innerHTML = userPaused ? ICON_PLAY : ICON_PAUSE;
    }, sig);
  }

  // Off-screen slides are inert + aria-hidden so their CTAs are not tab stops.
  function syncSlideState() {
    slideEls.forEach((el, i) => {
      const on = i + 1 === current;
      if (on) { el.removeAttribute("inert"); el.removeAttribute("aria-hidden"); }
      else { el.setAttribute("inert", ""); el.setAttribute("aria-hidden", "true"); }
    });
    dotEls.forEach((d, i) => d.setAttribute("aria-current", String(i + 1 === current)));
  }

  function announceSlide() {
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      window.announce?.("Slide " + current + " of " + count);
    }, 700);
  }

  function setCurrent(n, { announce } = {}) {
    if (n === current) return;
    current = n;
    syncSlideState();
    if (announce !== false) announceSlide();
  }

  function go(n) {
    // Make the target interactive before scrolling to it.
    setCurrent(n);
    const width = track.clientWidth || 0;
    if (width) track.scrollTo({ left: (n - 1) * width, behavior: reduced() ? "auto" : "smooth" });
  }

  const paused = () => userPaused || hovering || focusWithin || document.hidden;

  function startAutoplay() {
    clearInterval(autoplayTimer);
    autoplayTimer = null;
    if (reduced()) return; // static first slide, no motion
    autoplayTimer = setInterval(() => {
      if (!paused()) go((current % count) + 1);
    }, 6500);
  }

  section.addEventListener("mouseenter", () => { hovering = true; }, sig);
  section.addEventListener("mouseleave", () => { hovering = false; }, sig);
  section.addEventListener("focusin", () => { focusWithin = true; }, sig);
  section.addEventListener("focusout", (e) => {
    if (!e.relatedTarget || !section.contains(e.relatedTarget)) focusWithin = false;
  }, sig);

  dotEls.forEach(d => d.addEventListener("click", () => {
    go(Number(d.dataset.go));
    startAutoplay();
  }, sig));

  track.addEventListener("scroll", () => {
    const width = track.clientWidth || 1;
    const idx = Math.round(track.scrollLeft / width) + 1;
    if (idx >= 1 && idx <= count) setCurrent(idx);
  }, { passive: true, signal: ac.signal });

  if (reduceMq && reduceMq.addEventListener) {
    reduceMq.addEventListener("change", () => {
      if (reduced()) {
        clearInterval(autoplayTimer);
        autoplayTimer = null;
        if (pauseBtn) pauseBtn.hidden = true;
      } else {
        if (pauseBtn) pauseBtn.hidden = false;
        startAutoplay();
      }
    }, sig);
  }

  syncSlideState();
  startAutoplay();

  return () => {
    ac.abort();
    clearInterval(autoplayTimer);
    clearTimeout(announceTimer);
    if (pauseBtn) pauseBtn.remove();
  };
}

/* ────────────────── Testimonials ────────────────── */

const stars5 = (n) => "★★★★★".slice(0, Math.max(0, Math.min(5, Number(n || 0))));

// Rendered as an editorial pull-quote (large serif quotation mark, thin
// gold rule, no card box) rather than a bordered testimonial card — the
// boxed-card-with-lettered-avatar pattern read as generic template chrome
// against the rest of the site's editorial, photography-led design.
function testimonialCardHtml(t) {
  const name = t.customer_name || "";
  const place = t.customer_place || "";
  const avatarHtml = t.photo_url
    ? `<img class="testimonial-avatar" src="${safeSrc(t.photo_url)}" alt="${escapeAttr(name)}" loading="lazy" onerror="this.remove()">`
    : "";

  return `
    <div class="testimonial-item">
      <div class="testimonial-mark" aria-hidden="true">&ldquo;</div>
      <div class="testimonial-stars">${stars5(t.stars)}</div>
      <p class="testimonial-quote">${escapeHtml(t.quote || "")}</p>
      <div class="testimonial-rule" aria-hidden="true"></div>
      <div class="testimonial-foot">
        ${avatarHtml}
        <div>
          <div class="testimonial-name">${escapeHtml(name)}</div>
          ${place ? `<div class="testimonial-place">${escapeHtml(place)}</div>` : ""}
        </div>
      </div>
    </div>
  `;
}

export async function hydrateTestimonials() {
  const section = document.getElementById("testimonialsSection");
  const grid = document.getElementById("testimonialsGrid");
  if (!grid) return;

  try {
    const res = await fetch(TESTIMONIALS_URL, { method: "GET" });
    const data = res.ok ? await res.json().catch(() => null) : null;
    const items = Array.isArray(data?.testimonials) ? data.testimonials : [];

    if (items.length === 0) {
      if (section) section.style.display = "none";
      return;
    }

    grid.innerHTML = items.map(testimonialCardHtml).join("");
  } catch (e) {
    console.error("hydrateTestimonials error:", e);
    if (section) section.style.display = "none";
  }
}
