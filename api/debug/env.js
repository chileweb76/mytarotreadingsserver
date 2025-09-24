// Temporary debug endpoint to check URL generation and environment
async function handler(req, res) {
  try {
    const serverBase = process.env.SERVER_URL
      || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/$/, '')}` :
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/\/$/, '')}` :
           `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`))

    const debug = {
      serverBase,
      env: {
        SERVER_URL: process.env.SERVER_URL || 'NOT SET',
        VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL || 'NOT SET',
        VERCEL_URL: process.env.VERCEL_URL || 'NOT SET',
        NODE_ENV: process.env.NODE_ENV || 'NOT SET'
      },
      request: {
        protocol: req.headers['x-forwarded-proto'] || 'http',
        host: req.headers.host,
        originalUrl: req.url
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