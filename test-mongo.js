// Simple script to test MongoDB Atlas connection using MONGODB_URI from .env
const mongoose = require('mongoose')
require('dotenv').config()

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGODB_URI is not set. Please add it to your .env or set environment variable.')
    process.exit(1)
  }

  try {
    console.log('Attempting to connect to MongoDB Atlas...')
    await mongoose.connect(uri)
    console.log('✅ Connected to MongoDB Atlas successfully')
    await mongoose.disconnect()
    process.exit(0)
  } catch (err) {
    console.error('❌ MongoDB connection error:')
    console.error(err)
    process.exit(1)
  }
}

main()
