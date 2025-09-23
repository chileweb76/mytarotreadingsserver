#!/usr/bin/env node
// Usage: node scripts/one_off_verify.js <token>

const path = require('path')
const fs = require('fs')
const token = process.argv[2]
if (!token) {
  console.error('Usage: node scripts/one_off_verify.js <token>')
  process.exit(2)
}

async function main() {
  // load env
  const dotenvPath = path.resolve(__dirname, '..', '.env')
  if (fs.existsSync(dotenvPath)) require('dotenv').config({ path: dotenvPath })

  const { connectToDatabase } = require('../utils/connectToDatabase')
  await connectToDatabase()
  const mongoose = require('mongoose')
  const User = require('../models/User')
  const user = await User.findOne({ verificationToken: token, verificationExpires: { $gt: Date.now() } })
  if (!user) {
    console.log('No user found or token expired')
    await mongoose.disconnect()
    process.exit(1)
  }
  user.isEmailVerified = true
  user.verificationToken = null
  user.verificationExpires = null
  await user.save()
  console.log('Verified user:', user._id.toString(), user.email)
  await mongoose.disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
