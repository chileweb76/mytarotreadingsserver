const mongoose = require('mongoose')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const Querent = require('../models/Querent')

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mytarotreadings'
  await mongoose.connect(uri)
  console.log('Connected to MongoDB')
  const q = new Querent({ name: 'Test Querent', userId: 'test-user-123' })
  await q.save()
  console.log('Created querent:', q._id.toString())
  await mongoose.disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
