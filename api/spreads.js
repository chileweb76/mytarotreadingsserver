const express = require('express');
const { createRequestHandler } = require('@vercel/functions');

const app = express();

// Comprehensive CORS middleware for spreads endpoints
app.use((req, res, next) => {
  // Set CORS headers for all requests
  res.header('Access-Control-Allow-Origin', process.env.CLIENT_URL || 'https://mytarotreadings.vercel.app');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-vercel-blob-store');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Spreads API: Handling OPTIONS preflight request');
    return res.status(200).end();
  }

  console.log(`Spreads API: ${req.method} ${req.url}`, {
    origin: req.headers.origin,
    userAgent: req.headers['user-agent']?.substring(0, 50)
  });

  next();
});

// Body parsing middleware
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Mount spreads routes
const spreadsRouter = require('../../routes/spreads');
app.use('/', spreadsRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Spreads API Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  console.log(`Spreads API: 404 - ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Spreads endpoint not found' });
});

module.exports = createRequestHandler({
  app,
  binary: ['image/*']
});