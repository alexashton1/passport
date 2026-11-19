// ─────────────────────────────────────────────────────────────
//  Passport settings: the only file you need to edit.
//  Open setup.html on your site to test your Supabase details and generate this file for you.
// ─────────────────────────────────────────────────────────────
window.PASSPORT_CONFIG = {
  supabaseUrl: 'https://lbyopdjqagwqrwulztov.supabase.co',          // Supabase → Project Settings → Data API → Project URL
  supabaseKey: 'sb_publishable_j5TK1cW1BLwyacEJgKt3rg_LEkZbacK',          // Supabase → Project Settings → API Keys → Publishable key (sb_publishable_…)
  launchDate: '2026-11-19', // Puzzle No. 1 (UTC). Set to your launch day; changing it later renumbers every puzzle
  accounts: false,          // Optional email sign-in. Switch to true once Resend (SMTP) is set up in Supabase (keeps book, rank and streak safe; unlocks streak freezes)
  prototype: false          // true = show Replay and Reset (for testing)
};
