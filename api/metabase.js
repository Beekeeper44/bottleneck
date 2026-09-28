// GET /api/metabase?q=<questionId>
// Runs a saved Metabase question and returns its rows as JSON objects.
// Env vars (Vercel → Settings → Environment Variables): METABASE_HOST, METABASE_API_KEY
// Optional: METABASE_ALLOWED_IDS="12345,12346" to restrict which questions can be run.
export default async function handler(req, res) {
  const host = (process.env.METABASE_HOST || '').replace(/\/+$/, '');
  const key = process.env.METABASE_API_KEY;
  if (!host || !key) return res.status(500).json({ error: 'METABASE_HOST or METABASE_API_KEY is not set' });

  const q = String(req.query.q || '');
  if (!/^\d+$/.test(q)) return res.status(400).json({ error: 'q must be a numeric Metabase question id' });
  const allowed = (process.env.METABASE_ALLOWED_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (allowed.length && !allowed.includes(q)) return res.status(403).json({ error: `question ${q} is not allowed` });

  try {
    const r = await fetch(`${host}/api/card/${q}/query/json`, {
      method: 'POST',
      headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ parameters: [] }),
    });
    const text = await r.text();
    if (!r.ok) return res.status(r.status).json({ error: `Metabase returned ${r.status}`, detail: text.slice(0, 500) });
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.status(200).send(text);
  } catch (e) {
    return res.status(502).json({ error: 'Could not reach Metabase', detail: String(e) });
  }
}
