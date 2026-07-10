module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    res.status(503).json({
      configured: false,
      error: 'Supabase is not configured yet.'
    });
    return;
  }

  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  res.status(200).json({ configured: true, url, anonKey });
};
