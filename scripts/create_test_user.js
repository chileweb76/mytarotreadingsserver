#!/usr/bin/env node
/*
Simple script to create a verified test user in the configured MongoDB.
Usage:
  MONGODB_URI="..." node scripts/create_test_user.js --email test@example.com --password password123

If no args provided, defaults are:
  email: test+<timestamp>@example.com
  password: Passw0rd!

The script will create the user with isEmailVerified=true so it can login immediately.
*/

const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const path = require('path')
const fs = require('fs')

// load .env if present in project root
const dotenvPath = path.resolve(__dirname, '..', '.env')
if (fs.existsSync(dotenvPath)) {
  require('dotenv').config({ path: dotenvPath })
}

const argv = require('minimist')(process.argv.slice(2))
const email = (argv.email || argv.e || `test+${Date.now()}@example.com`).toString()
const password = (argv.password || argv.p || 'Passw0rd!').toString()
const username = argv.username || `testuser${Date.now().toString().slice(-6)}`

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGODB_URI not set in environment. Set it or place it in .env at project root.')
    process.exit(2)
  }

  // Lazy require of User model by path
  const User = require('../models/User')

  console.log('Connecting to MongoDB...')
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })

  // check existing
  let existing = await User.findOne({ email: email.toLowerCase().trim() })
  if (existing) {
    console.log('User already exists:', email)
    console.log('id:', existing._id.toString())
    process.exit(0)
  }

  const salt = await bcrypt.genSalt(12)
  const hashed = await bcrypt.hash(password, salt)

  const newUser = new User({
    username,
    email: email.toLowerCase().trim(),
    password: hashed,
    authProvider: 'local',
    isEmailVerified: true
  })

  await newUser.save()
  console.log('Created test user:')
  console.log('  email:', newUser.email)
  console.log('  password:', password)
  console.log('  id:', newUser._id.toString())

  await mongoose.disconnect()
  process.exit(0)
}

main().catch(err => {
  console.error('Error creating test user:', err)
  process.exit(1)
})
