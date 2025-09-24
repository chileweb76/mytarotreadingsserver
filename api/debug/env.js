// Temporary debug endpoint to check URL generation and environment
async function handler(req, res) {
  try {
    const serverBase = process.env.SERVER_URL
      || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/$/, '')}` :
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/\/$/, '')}` :
           `${req.protocol}://${req.get('host')}`))

    const debug = {
      serverBase,
      env: {
        SERVER_URL: process.env.SERVER_URL ? 'SET' : 'NOT SET',
        VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'SET' : 'NOT SET',
        VERCEL_URL: process.env.VERCEL_URL ? 'SET' : 'NOT SET',
        NODE_ENV: process.env.NODE_ENV
      },
      request: {
        protocol: req.protocol,
        host: req.get('host'),
        originalUrl: req.originalUrl
      },
      sampleUploadUrl: `/uploads/test-image.jpg`,
      absolutizedUrl: serverBase + '/uploads/test-image.jpg'
    }

    return res.json(debug)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

module.exports = handler