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

function heroSlideHtml(slide, index) {
  const isFirst = index === 0;
  const desktopSrc = safeSrc(slide.image_desktop_url || "");
  const mobileSrc = slide.image_mobile_url ? safeSrc(slide.image_mobile_url) : "";
  const alt = escapeAttr(slide.image_alt || slide.title || "");
  const ctaHref = slide.cta_link ? safeUrl(slide.cta_link, { type: "href" }) : "";
  const hasCta = !!(slide.cta_text && ctaHref);
  const hasNote = !!(slide.note_text || slide.note_strong);
  const TitleTag = isFirst ? "h1" : "h2"; // only one <h1> per page — first slide keeps it

  return `
    <article class="hero-slide" data-slide="${index + 1}">
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

export async function hydrateHero() {
  const section = document.getElementById("heroBannerSection");
  const track = document.getElementById("heroTrack");
  const dots = document.getElementById("heroDots");
  if (!section || !track) return;

  try {
    const res = await fetch(HERO_URL, { method: "GET" });
    const data = res.ok ? await res.json().catch(() => null) : null;
    const slides = Array.isArray(data?.slides) ? data.slides : [];

    if (slides.length === 0) {
      section.style.display = "none";
      return;
    }

    track.innerHTML = slides.map(heroSlideHtml).join("");

    if (slides.length > 1 && dots) {
      dots.innerHTML = slides
        .map((_, i) => `<button class="hero-dot" data-go="${i + 1}" aria-label="Go to slide ${i + 1}" aria-current="${i === 0}"></button>`)
        .join("");
      dots.style.display = "";
    } else if (dots) {
      dots.style.display = "none";
    }

    initHeroCarousel(track, dots, slides.length);
  } catch (e) {
    console.error("hydrateHero error:", e);
    section.style.display = "none";
  }
}

function initHeroCarousel(track, dots, count) {
  if (count <= 1) return; // nothing to carousel

  const dotEls = dots ? Array.from(dots.querySelectorAll(".hero-dot")) : [];
  let current = 1;
  let autoplayTimer;

  function go(n) {
    current = n;
    const width = track.clientWidth || 0;
    if (width) track.scrollTo({ left: (n - 1) * width, behavior: "smooth" });
    dotEls.forEach((d, i) => d.setAttribute("aria-current", String(i + 1 === n)));
  }

  function startAutoplay() {
    clearInterval(autoplayTimer);
    autoplayTimer = setInterval(() => go((current % count) + 1), 6500);
  }

  dotEls.forEach(d => d.addEventListener("click", () => {
    go(Number(d.dataset.go));
    startAutoplay();
  }));

  track.addEventListener("scroll", () => {
    const width = track.clientWidth || 1;
    const idx = Math.round(track.scrollLeft / width) + 1;
    if (idx !== current && idx >= 1 && idx <= count) {
      current = idx;
      dotEls.forEach((d, i) => d.setAttribute("aria-current", String(i + 1 === current)));
    }
  }, { passive: true });

  go(1);
  startAutoplay();
}

/* ────────────────── Testimonials ────────────────── */

const stars5 = (n) => "★★★★★".slice(0, Math.max(0, Math.min(5, Number(n || 0))));

function testimonialCardHtml(t) {
  const name = t.customer_name || "";
  const initial = escapeAttr(name.charAt(0).toUpperCase());
  const avatarHtml = t.photo_url
    ? `<img src="${safeSrc(t.photo_url)}" alt="${escapeAttr(name)}" loading="lazy"
         onerror="this.style.display='none';this.parentElement.dataset.initial='${initial}'">`
    : "";

  return `
    <div class="card t-compact-card">
      <div class="t-compact-stars">${stars5(t.stars)}</div>
      <div class="t-compact-quote">"${escapeHtml(t.quote || "")}"</div>
      <div class="t-compact-foot">
        <div class="t-compact-avatar"${t.photo_url ? "" : ` data-initial="${initial}"`}>
          ${avatarHtml}
        </div>
        <div>
          <div class="t-compact-name">${escapeHtml(name)}</div>
          <div class="t-compact-place">${escapeHtml(t.customer_place || "")}</div>
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
