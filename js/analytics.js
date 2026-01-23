// ---- GA4 tracking (optional) ----
// 1) Create GA4 property
// 2) Put your Measurement ID below (e.g. G-XXXXXXXXXX)
// 3) This will track page views + custom events.
window.AHAM_GA_MEASUREMENT_ID = ""; // <-- add later

export function loadGA4(){
  const id = window.AHAM_GA_MEASUREMENT_ID;
  if(!id) return;

  const s1 = document.createElement("script");
  s1.async = true;
  s1.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s1);

  window.dataLayer = window.dataLayer || [];
  function gtag(){ window.dataLayer.push(arguments); }
  window.gtag = gtag;

  gtag("js", new Date());
  gtag("config", id, { anonymize_ip: true });
}

export function track(eventName, params={}){
  // console for dev
  // eslint-disable-next-line no-console
  console.log("[track]", eventName, params);

  // GA4
  if(window.gtag && window.AHAM_GA_MEASUREMENT_ID){
    window.gtag("event", eventName, params);
  }
}

export function addRecentlyViewed(productId){
  try{
    const key = "aham_recently_viewed";
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    const next = [productId, ...arr.filter(x => x !== productId)].slice(0, 12);
    localStorage.setItem(key, JSON.stringify(next));
  }catch(e){}
}

export function getRecentlyViewed(){
  try{
    const raw = localStorage.getItem("aham_recently_viewed");
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}

/*
Future backend (Firebase/Supabase) idea:
- On login, tie events to userId
- Send view_product / add_to_wishlist / enquiry events to backend
- Store per-user browsing history

For now, this file gives GA4 + localStorage tracking without backend.
*/
