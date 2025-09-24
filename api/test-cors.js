// Minimal test function to check CORS handling
async function handler(req, res) {
  try {
    console.log('Test CORS handler called with method:', req.method)
    console.log('Origin:', req.headers.origin)

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      const origin = req.headers.origin
      
      // Simple CORS response without complex logic
      if (origin && origin.includes('mytarotreadings.vercel.app')) {
        res.setHeader('Access-Control-Allow-Origin', origin)
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, X-Requested-With, Accept, Origin')
        res.setHeader('Access-Control-Allow-Credentials', 'true')
      }

      return res.status(200).json({ message: 'CORS preflight OK' })
    }

    // For non-OPTIONS requests
    return res.status(200).json({ message: 'Test endpoint OK' })

  } catch (error) {
    console.error('Test CORS handler error:', error)
    return res.status(500).json({ error: 'Internal server error', details: error.message })
  }
}

module.exports = handler