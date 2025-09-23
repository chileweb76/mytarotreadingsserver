#!/usr/bin/env node
/*
Reset a user's password by setting the plaintext and saving so the User.pre('save')
hook will hash it correctly.
Usage:
  node scripts/reset_test_user_password.js --email test@example.com --password NewPass123!
*/

const mongoose = require('mongoose')
const path = require('path')
const fs = require('fs')

// load .env if present
const dotenvPath = path.resolve(__dirname, '..', '.env')
if (fs.existsSync(dotenvPath)) require('dotenv').config({ path: dotenvPath })

const argv = require('minimist')(process.argv.slice(2))
const email = (argv.email || argv.e)
const password = (argv.password || argv.p)

if (!email || !password) {
  console.error('Usage: --email user@example.com --password NewPass123!')
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
    console.error('User not found:', email)
    await mongoose.disconnect()
    process.exit(1)
  }

  user.password = password
  await user.save()
  console.log('Password reset for', email)
  await mongoose.disconnect()
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
