const { MongoClient } = require('mongodb');
const dns = require('dns').promises;
const tls = require('tls');
const { URL } = require('url');

function redactUri(uri) {
  return uri.replace(/:\/\/.*?:.*?@/, '://[REDACTED]:[REDACTED]@');
}

async function probeTls(host, port = 27017, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const result = { host, port };
    const opts = { host, port, servername: host, rejectUnauthorized: false }; // don't fail on unknown CA for probe
    const socket = tls.connect(opts, () => {
      try {
        result.tls = {
          authorized: socket.authorized,
          authorizationError: socket.authorizationError || null,
          cipher: socket.getCipher ? socket.getCipher() : null,
          protocol: socket.getProtocol ? socket.getProtocol() : null,
          peerCertificate: (() => {
            try { const c = socket.getPeerCertificate(true); return c && c.subject ? { subject: c.subject, issuer: c.issuer, valid_from: c.valid_from, valid_to: c.valid_to } : null; } catch (e) { return null; }
          })(),
        };
      } catch (e) {
        result.tlsError = String(e);
      }
      socket.end();
      resolve(result);
    });
    socket.setTimeout(timeoutMs, () => {
      result.tlsError = 'timeout';
      try { socket.destroy(); } catch (e) {}
      resolve(result);
    });
    socket.on('error', (err) => {
      result.tlsError = err && err.message ? err.message : String(err);
      resolve(result);
    });
  });
}

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

  // Run DNS SRV/TXT probes if the URI is an SRV string
  const probes = { srv: null, txt: null, tlsProbes: [] };
  try {
    if (uri.startsWith('mongodb+srv://')) {
      // extract host between mongodb+srv:// and the next slash
      const host = uri.split('mongodb+srv://')[1].split('/')[0].split('?')[0];
      try {
        probes.srv = await dns.resolveSrv(host);
      } catch (e) {
        probes.srv = { error: String(e) };
      }
      try {
        probes.txt = await dns.resolveTxt(host);
      } catch (e) {
        probes.txt = { error: String(e) };
      }
      // attempt TLS to each resolved SRV target (if any)
      if (Array.isArray(probes.srv)) {
        for (const r of probes.srv.slice(0, 4)) {
          const p = await probeTls(r.name, r.port || 27017, 6000);
          probes.tlsProbes.push(p);
        }
      }
    } else {
      // try parse host from non-SRV URI
      try {
        const url = new URL(uri.replace('mongodb://', 'http://'));
        probes.tlsProbes.push(await probeTls(url.hostname, Number(url.port) || 27017, 6000));
      } catch (e) {
        probes.tlsParseError = String(e);
      }
    }
  } catch (e) {
    probes._error = String(e);
  }

  // Attempt MongoClient connect (short timeout)
  let client;
  let mongoResult = null;
  try {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000 });
    await client.connect();
    const db = client.db();
    const names = await db.admin().listDatabases();
    mongoResult = { ok: true, databases: names.databases.slice(0, 6).map(d => d.name) };
  } catch (err) {
    mongoResult = { ok: false, name: err.name, message: err.message, stack: err.stack, code: err.code || null, reason: err.reason || null };
    console.error('test-mongo mongo error', mongoResult);
  } finally {
    try { if (client && client.close) await client.close(); } catch (e) { /* ignore */ }
  }

  const safeUri = redactUri(uri);
  return res.status(mongoResult && mongoResult.ok ? 200 : 500).json({ ok: !!(mongoResult && mongoResult.ok), info: { ...info, safeUri }, probes, mongoResult });
};
