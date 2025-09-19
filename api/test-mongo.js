const { MongoClient } = require('mongodb');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  const uri = process.env.MONGODB_URI || '';

  const info = {
    node: process.versions.node,
    openssl: process.versions.openssl,
    hasUri: !!uri,
    timestamp: new Date().toISOString(),
  };

  if (!uri) {
    return res.status(400).json({ ok: false, info, error: 'MONGODB_URI not set in env' });
  }

  let client;
  try {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000 });
    await client.connect();
    // test a light operation
    const db = client.db();
    const names = await db.admin().listDatabases();
    await client.close();
    return res.json({ ok: true, info, databases: names.databases.slice(0, 6).map(d => d.name) });
  } catch (err) {
    // sanitize before returning: remove credentials from uri if present
    const safeUri = uri.replace(/:\/\/.*?:.*?@/, '://[REDACTED]:[REDACTED]@');
    const e = {
      name: err.name,
      message: err.message,
      stack: err.stack,
      code: err.code || null,
      reason: err.reason || null,
    };
    console.error('test-mongo error', e);
    return res.status(500).json({ ok: false, info: { ...info, safeUri }, error: e });
  } finally {
    try { if (client && client.close) await client.close(); } catch (e) { /* ignore */ }
  }
};
