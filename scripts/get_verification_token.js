#!/usr/bin/env node
// Usage: MONGODB_URI=... node scripts/get_verification_token.js --email user@example.com

const mongoose = require('mongoose')
const path = require('path')
const fs = require('fs')
const argv = require('minimist')(process.argv.slice(2))

// load .env if present
const dotenvPath = path.resolve(__dirname, '..', '.env')
if (fs.existsSync(dotenvPath)) require('dotenv').config({ path: dotenvPath })

const email = (argv.email || argv.e)
if (!email) {
  console.error('Usage: --email user@example.com')
  process.exit(2)
}

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGODB_URI not set in environment')
    process.exit(2)
  }

  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  const User = require('../models/User')
  const user = await User.findOne({ email: email.toLowerCase().trim() })
  if (!user) {
    console.error('User not found')
    await mongoose.disconnect()
    process.exit(1)
  }
  console.log('id:', user._id.toString())
  console.log('email:', user.email)
  console.log('isEmailVerified:', user.isEmailVerified)
  console.log('verificationToken:', user.verificationToken)
  await mongoose.disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
