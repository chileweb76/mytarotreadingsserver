/**
 * Simple test endpoint to verify CORS is working
 */
module.exports = async (req, res) => {
  const origin = req.headers.origin;
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  res.json({
    message: 'CORS test endpoint working',
    origin: origin,
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url
  });
};