// assets/instagram-reels.js
//
// "Follow us on Instagram" section for the homepage. Admin-managed (Admin →
// Reel Manager) — the store owner pastes Instagram Reel/post URLs there and
// they show up here, no code changes needed. Uses Instagram's own official
// embed widget (embed.js), so each video plays right on the page via
// Instagram's own iframe — no scraping, no API tokens, nothing to keep
// refreshed. If a visitor has embeds blocked (privacy extensions, some
// corporate networks) or the widget script fails to load, each card still
// degrades to a plain "View this post on Instagram" link — never a blank
// hole.

import { escapeAttr, safeHref } from "./safe.js";

const FUNCTIONS_URL = "https://mgmgkwoxirvzdnmayhwq.supabase.co/functions/v1/get-active-reels";

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

function reelCard(r) {
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

    try {
      await loadInstagramEmbedScript();
      if (window.instgrm && window.instgrm.Embeds && window.instgrm.Embeds.process) {
        window.instgrm.Embeds.process();
      }
    } catch (_) {
      // Embed script blocked/failed — the blockquotes above already render
      // as plain "View this post on Instagram" links, so visitors still get
      // something useful.
    }
  } catch (e) {
    console.error("hydrateInstagramReels error:", e);
    section.style.display = "none";
  }
}
