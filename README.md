# AhamStree — monilsingla07.github.io

This repository contains the AhamStree static storefront. The site uses Supabase (for product data and auth) and Razorpay for payments.

Quick overview
- Main pages: `index.html`, `products.html`, `product.html`, `cart.html`, `checkout.html`, `login.html`, `success.html`
- Shared UI: `assets/ui.js`
- Styles: `assets/styles.css`
- Data and auth: `assets/supabase.js` (uses Supabase project)
- Cart helper: `assets/cart.js`

Getting started (local)
1. Clone:
   git clone https://github.com/monilsingla07/monilsingla07.github.io
2. Copy environment example:
   cp assets/env.example.js assets/env.local.js
3. Edit `assets/env.local.js` and fill in:
   - SUPABASE_URL and SUPABASE_ANON_KEY
   - RAZORPAY_KEY_ID (public)
   Note: Do not commit `env.local.js`. Use server-side code for secret Razorpay operations.
4. Open `index.html` in your browser for local testing (static files). For some features (CORS, Supabase rules) use a local static server:
   npx http-server -c-1
   or
   python -m http.server 8080

Deployment
- GitHub Pages: push to `main` (or `gh-pages`) and enable Pages in repo settings (or add an Actions workflow to publish automatically).
- If you rely on server-side order verification, deploy a small serverless endpoint (Cloud Run, Vercel, Netlify Functions, or Supabase Edge Functions).

Environment variables (client)
- SUPABASE_URL: https://YOUR-SUPABASE.supabase.co
- SUPABASE_ANON_KEY: public anon key
- RAZORPAY_KEY_ID: Razorpay public key (for checkout script)

Security notes
- Razorpay secret keys must never be exposed in client code — use server-side endpoints for order creation and verification.
- Rotate keys if they are in repo history.

Roadmap ideas
- Add server-side webhook to verify Razorpay payments and persist order state.
- Add search and product filters.
- Add admin product management UI (protected).
- Add PWA support and offline fallback for product pages.
- Add analytics + cookie consent.

If you want, I can:
- Draft the GitHub Actions workflow to deploy to Pages.
- Implement a simple search page (client-side) using Supabase.
- Create a sample serverless function to verify Razorpay payment webhooks.