const express = require('express')
const router = express.Router()

// GET /api/health - Health check endpoint
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'My Tarot Readings API',
    version: '1.0.0'
  })
})

module.exports = router
