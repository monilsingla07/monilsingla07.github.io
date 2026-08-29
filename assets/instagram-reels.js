// assets/instagram-reels.js
//
// "Follow us on Instagram" section for the homepage. Admin-managed (Admin →
// Reel Manager) — the store owner uploads the actual video file for each
// reel there and it shows up here, no code changes needed.
//
// Videos are self-hosted (uploaded to Supabase Storage via the admin panel).
// Earlier this played fully inline via a plain <video controls> element —
// but inline playback of these files was inconsistent/rough for visitors
// (buffering, no real Instagram chrome, awkward mobile tap-to-play). So the
// card now shows the video as a silent, non-interactive preview (muted, no
// controls) with a play-button overlay, and the whole media area is a link
// straight to the real Instagram post/reel — clicking it takes visitors to
// instagram.com to actually watch it there, where playback is reliable.
//
// Older reels that were never given a video file (video_url is empty) still
// degrade to a "View this post on Instagram" link — never a blank hole.

import { escapeHtml, escapeAttr, safeHref, safeSrc } from "./safe.js";

const FUNCTIONS_URL = "https://mgmgkwoxirvzdnmayhwq.supabase.co/functions/v1/get-active-reels";
const LOGO_SRC = "assets/images/ahamstree-logo.png";

function iconHeartOutline() {
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20.5s-7.5-4.6-10-9.2C.4 8 1.8 4.5 5 3.4c2.3-.8 4.6.1 6 2 1.4-1.9 3.7-2.8 6-2 3.2 1.1 4.6 4.6 3 7.9-2.5 4.6-10 9.2-10 9.2z"/></svg>`;
}
function iconCommentOutline() {
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.94L3 20l1.06-4.24A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5z"/></svg>`;
}
function iconShareOutline() {
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>`;
}
function iconBookmarkOutline() {
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>`;
}
function iconDots() {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>`;
}
function iconPlay() {
  return `<svg viewBox="0 0 24 24" width="26" height="26" fill="#fff" stroke="none"><path d="M8 5v14l11-7L8 5z"/></svg>`;
}

function videoCard(r) {
  const postUrl = safeHref(r.reel_url);
  const videoSrc = safeSrc(r.video_url);
  const caption = r.caption ? escapeHtml(r.caption) : "";

  // Muted, controls-less preview — this is a thumbnail, not a player.
  // Wrapped in a link to the real Instagram post whenever we have one, with
  // a play-button overlay for click affordance; falls back to a plain,
  // non-clickable preview only in the rare case there's no post URL at all.
  const mediaInner = `
    <video class="ig-video" src="${videoSrc}" muted playsinline preload="metadata" tabindex="-1" aria-hidden="true"></video>
    <span class="ig-play-overlay" aria-hidden="true">${iconPlay()}</span>
  `;
  const mediaHtml = postUrl
    ? `<a class="ig-media" href="${postUrl}" target="_blank" rel="noopener noreferrer" aria-label="Watch this reel on Instagram">${mediaInner}</a>`
    : `<div class="ig-media">${mediaInner}</div>`;

  return `
    <div class="reel-tile">
      <div class="ig-card">
        <div class="ig-card-head">
          <img class="ig-avatar" src="${LOGO_SRC}" alt="" loading="lazy" />
          <div class="ig-head-text">
            <div class="ig-handle">ahamstree</div>
          </div>
          ${postUrl ? `<a class="ig-dots-link" href="${postUrl}" target="_blank" rel="noopener noreferrer" aria-label="View this post on Instagram">${iconDots()}</a>` : iconDots()}
        </div>

        ${mediaHtml}

        <div class="ig-actions">
          <span class="ig-action">${iconHeartOutline()}</span>
          <span class="ig-action">${iconCommentOutline()}</span>
          <span class="ig-action">${iconShareOutline()}</span>
          <span class="ig-spacer"></span>
          <span class="ig-action">${iconBookmarkOutline()}</span>
        </div>

        ${caption ? `<div class="ig-caption"><strong>ahamstree</strong> ${caption}</div>` : ""}
        ${postUrl ? `<a class="ig-view-link" href="${postUrl}" target="_blank" rel="noopener noreferrer">Watch on Instagram ↗</a>` : ""}
      </div>
    </div>
  `;
}

// Legacy fallback for any reel saved before video uploads existed (no
// video_url on file) — degrades to Instagram's own oEmbed widget, same as
// the original implementation.
let _embedScriptPromise = null;
function loadInstagramEmbedScript() {
  if (window.instgrm && window.instgrm.Embeds) return Promise.resolve();
  if (_embedScriptPromise) return _embedScriptPromise;
  _embedScriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://www.instagram.com/embed.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Instagram embed script"));
    document.head.appendChild(s);
  });
  return _embedScriptPromise;
}

function legacyEmbedCard(r) {
  const url = safeHref(r.reel_url);
  if (!url) return "";
  const label = r.caption ? escapeAttr(r.caption) : "View this post on Instagram";
  return `
    <div class="reel-tile">
      <blockquote class="instagram-media" data-instgrm-permalink="${url}" data-instgrm-version="14"
        style="background:#FFF; border:1px solid #dbdbdb; border-radius:12px; margin:0; width:100%;">
        <a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>
      </blockquote>
    </div>
  `;
}

function reelCard(r) {
  if (r.video_url) return videoCard(r);
  return legacyEmbedCard(r);
}

export async function hydrateInstagramReels() {
  const section = document.getElementById("instagramReelsSection");
  const box = document.getElementById("instagramReelsStrip");
  if (!section || !box) return;

  try {
    const res = await fetch(FUNCTIONS_URL, { method: "GET" });
    const json = await res.json().catch(() => ({}));
    const reels = Array.isArray(json.reels) ? json.reels : [];

    if (reels.length === 0) {
      // Nothing published yet — keep the section out of the way entirely
      // rather than showing an empty strip.
      section.style.display = "none";
      return;
    }

    box.innerHTML = reels.map(reelCard).join("");

    // Only needed for any legacy (video-less) reels still using the old
    // Instagram embed widget.
    if (reels.some((r) => !r.video_url)) {
      try {
        await loadInstagramEmbedScript();
        if (window.instgrm && window.instgrm.Embeds && window.instgrm.Embeds.process) {
          window.instgrm.Embeds.process();
        }
      } catch (_) {
        // Embed script blocked/failed — those cards already render as plain
        // "View this post on Instagram" links, so visitors still get
        // something useful.
      }
    }
  } catch (e) {
    console.error("hydrateInstagramReels error:", e);
    section.style.display = "none";
  }
}
