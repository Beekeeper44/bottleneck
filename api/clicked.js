// Tracks which Mis-match Set cards have been opened, shared across everyone using the app.
// GET    /api/clicked                 -> { keys: ["8812000", ...] }
// POST   /api/clicked  {root_key}     -> mark opened (hides it for everyone)
// DELETE /api/clicked  {root_key}     -> put it back (Undo / Put back)
// Env: DATABASE_URL (Neon Postgres connection string)
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
let ready;
const init = () => ready ??= sql`
  CREATE TABLE IF NOT EXISTS mismatch_clicked (
    root_key   TEXT PRIMARY KEY,
    section    TEXT NOT NULL DEFAULT 'mismatch',
    clicked_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

export default async function handler(req, res) {
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL is not set' });
  try {
    await init();
    if (req.method === 'GET') {
      const rows = await sql`SELECT root_key FROM mismatch_clicked`;
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ keys: rows.map(r => r.root_key) });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const key = String(body.root_key || '').trim();
    if (!/^[\w-]{1,64}$/.test(key)) return res.status(400).json({ error: 'root_key is required' });

    if (req.method === 'POST') {
      await sql`INSERT INTO mismatch_clicked (root_key, section) VALUES (${key}, ${body.section || 'mismatch'})
                ON CONFLICT (root_key) DO UPDATE SET clicked_at = now()`;
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      await sql`DELETE FROM mismatch_clicked WHERE root_key = ${key}`;
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: 'Database error', detail: String(e) });
  }
}
