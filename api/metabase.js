// GET /api/metabase?q=<questionId>
// Runs a saved Metabase question and returns its rows as an array of objects.
// Env: METABASE_HOST, METABASE_API_KEY. Optional: METABASE_ALLOWED_IDS="635,6310,7527"
// Tries the export endpoint first (no 2,000-row cap), then falls back to the standard query endpoint.
export default async function handler(req, res) {
  const host = (process.env.METABASE_HOST || '').trim().replace(/\/+$/, '');
  const key = (process.env.METABASE_API_KEY || '').trim();
  if (!host || !key) return res.status(500).json({ error: 'METABASE_HOST or METABASE_API_KEY is not set in Vercel' });

  const q = String(req.query.q || '');
  if (!/^\d+$/.test(q)) return res.status(400).json({ error: 'q must be a numeric Metabase question id' });
  const allowed = (process.env.METABASE_ALLOWED_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (allowed.length && !allowed.includes(q)) return res.status(403).json({ error: `question ${q} is not in METABASE_ALLOWED_IDS` });

  const tries = [];
  try {
    // 1) Export endpoint — form-encoded body, returns an array of row objects
    const r1 = await fetch(`${host}/api/card/${q}/query/json`, {
      method: 'POST',
      headers: { 'x-api-key': key, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'format_rows=false&parameters=%5B%5D',
    });
    const t1 = await r1.text();
    tries.push({ endpoint: 'query/json', status: r1.status, sample: t1.slice(0, 300) });
    if (r1.ok) {
      try { const d = JSON.parse(t1); if (Array.isArray(d)) return send(res, d); } catch {}
    }

    // 2) Standard query endpoint — returns { data: { cols, rows } }
    const r2 = await fetch(`${host}/api/card/${q}/query`, {
      method: 'POST',
      headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ parameters: [] }),
    });
    const t2 = await r2.text();
    tries.push({ endpoint: 'query', status: r2.status, sample: t2.slice(0, 300) });
    if (r2.ok) {
      const d = JSON.parse(t2);
      if (d?.data?.rows && d?.data?.cols) {
        const names = d.data.cols.map(c => c.name || c.display_name);
        return send(res, d.data.rows.map(row => Object.fromEntries(row.map((v, i) => [names[i], v]))));
      }
      if (d?.error) tries[tries.length - 1].metabase_error = d.error;
    }
  } catch (e) {
    return res.status(502).json({ error: `Could not reach ${host}`, detail: String(e) });
  }
  const last = tries[tries.length - 1] || {};
  const hint = [401, 403].includes(last.status) ? 'API key rejected or no access to this question\'s collection'
             : last.status === 404 ? `question ${q} not found on ${host}` : 'Metabase returned an error';
  return res.status(502).json({ error: hint, tries });
}

function send(res, rows) {
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
  return res.status(200).json(rows);
}
