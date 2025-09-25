/**
 * Simple CORS test endpoint to verify preflight requests work
 */
module.exports = async (req, res) => {
  const origin = req.headers.origin;
  
  console.log('CORS test - Method:', req.method, 'URL:', req.url, 'Origin:', origin);
  
  // Set comprehensive CORS headers
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, X-Requested-With, Accept, Origin, x-vercel-blob-store');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length,X-Request-Id');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    console.log('CORS test: Handling OPTIONS preflight');
    return res.status(200).json({ message: 'CORS preflight successful' });
  }

  res.json({
    message: 'CORS test endpoint',
    method: req.method,
    origin: origin,
    headers: req.headers,
    timestamp: new Date().toISOString()
  });
};