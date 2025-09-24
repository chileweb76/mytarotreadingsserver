const { connectToDatabase } = require('../utils/connectToDatabase');

module.exports = async (req, res) => {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', 'https://mytarotreadings.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      console.log('Images API: Handling OPTIONS preflight request');
      return res.status(200).end();
    }

    console.log(`Images API: ${req.method} ${req.url}`, {
      origin: req.headers.origin,
      query: req.query
    });

    // Connect to database
    await connectToDatabase();

    // Mount images routes
    const express = require('express');
    const imagesRouter = require('../routes/images');
    
    const app = express();
    app.use('/', imagesRouter);

    // Handle the request
    app(req, res);

  } catch (error) {
    console.error('Images API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
};