// Example env file - DO NOT commit real keys. Copy to assets/env.local.js for local dev.
// Deploy: GitHub Actions will generate assets/env.local.js during deploy from repository secrets.
export const ENV = {
  SUPABASE_URL: "https://your-project.supabase.co",
  SUPABASE_ANON_KEY: "public-anon-key",
  RAZORPAY_KEY_ID: "rzp_test_xxx",
  PLAUSIBLE_DOMAIN: "ahamstree.com"
};
