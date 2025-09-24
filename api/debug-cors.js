/**
 * Debug endpoint to test CORS and see exactly what's happening
 */
module.exports = async (req, res) => {
  try {
    const origin = req.headers.origin;
    const method = req.method;
    const url = req.url;
    
    console.log('DEBUG CORS - Method:', method, 'URL:', url, 'Origin:', origin, 'Headers:', JSON.stringify(req.headers, null, 2));
    
    // Always set comprehensive CORS headers
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, X-Requested-With, Accept, Origin');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length,X-Request-Id');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      console.log('DEBUG CORS - Preflight request handled successfully');
      return res.status(200).end();
    }

    // For actual requests, return debug info
    return res.status(200).json({
      success: true,
      message: 'CORS Debug Endpoint Working',
      origin: origin,
      method: method,
      url: url,
      timestamp: new Date().toISOString(),
      headers: req.headers
    });
    
  } catch (error) {
    console.error('DEBUG CORS handler error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};