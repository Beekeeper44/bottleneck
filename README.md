# PL Dashboard — Mis-match Set

public/index.html   the app
api/metabase.js     runs a saved Metabase question, returns rows as JSON
api/clicked.js      shared list of cards already opened (Neon Postgres)

## Setup
1. Question ids are already set in public/index.html → SECTIONS:
   - Mis-match Set       6351  https://arena-club.metabaseapp.com/question/6351
   - Pending Data Issue  6310  https://arena-club.metabaseapp.com/question/6310
   - Customer Support    7527  https://arena-club.metabaseapp.com/question/7527
2. Make sure the API key's group can view the collections those questions live in.
3. Vercel → Settings → Environment Variables:
   - METABASE_HOST      https://arena-club.metabaseapp.com
   - METABASE_API_KEY   Metabase API key with access to that question's collection
   - DATABASE_URL       Neon connection string (table is created automatically)
   - METABASE_ALLOWED_IDS (optional) 6351,6310,7527
4. Deploy.

## How opened cards work
Clicking "Click Me" opens the card in admin and removes it from the list for everyone.
New cards from Metabase always appear. "Opened (n)" shows removed cards with a "Put back" button.
Without DATABASE_URL the app falls back to saving opened cards in the browser only.

Column names from Metabase are lowercased. Each question must return:

Mis-match Set (SECTIONS → mismatch):
url, set_sport, card_sport, player_name, grader_name, verified_date, source, card_status, set_name (root_key optional — card id is read from the url)

Pending Data Issue (SECTIONS → pending):
card_url, card_status, ac8_number, cert_number, set_name, player_name, set_number, grade

Customer Support (SECTIONS → support):
url, order_number, status, full_name, raw, graded, total_cards, bins, pending_scan_cards
(bins can hold several values separated by "; ", e.g. "#217; #279")
