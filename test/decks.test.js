const express = require('express')
const request = require('supertest')
const path = require('path')
const fs = require('fs')

// We'll load the router and replace Deck model methods via jest mocking
jest.mock('../models/Deck')
const Deck = require('../models/Deck')
const decksRouter = require('../routes/decks')
const { deleteDeckHandler } = require('../routes/decks')

// helper to mount router with a stubbed passport.authenticate that sets req.user
function appWithUser(user) {
  const app = express()
  app.use(express.json())
  // simple middleware to inject req.user for test routes that require auth
  app.use((req, res, next) => { req.user = user; next() })
  // mount the handler directly for DELETE to bypass passport middleware in tests
  app.delete('/api/decks/:id', deleteDeckHandler)
  app.use('/api/decks', decksRouter)
  return app
}

describe('DELETE /api/decks/:id owner-scoped', () => {
  const sampleId = 'deck123'
  const uploadsPath = path.join(__dirname, '..', 'uploads', 'decks', sampleId)

  beforeEach(() => {
    jest.clearAllMocks()
    // ensure uploads path exists for cleanup test
    if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true })
    // create a dummy file
    fs.writeFileSync(path.join(uploadsPath, 'dummy.txt'), 'x')
  })

  afterEach(() => {
    // cleanup any created path
    try { if (fs.existsSync(uploadsPath)) fs.rmSync(uploadsPath, { recursive: true, force: true }) } catch (e) {}
  })

  test('should prevent deletion when owner mismatch', async () => {
    // deck owned by userA
    Deck.findById = jest.fn().mockResolvedValue({ _id: sampleId, owner: { toString: () => 'userA' } })

    const app = appWithUser({ id: 'userB' })
    const res = await request(app).delete(`/api/decks/${sampleId}`)
    expect(res.status).toBe(403)
    expect(res.body.error).toMatch(/Not authorized/i)
    // ensure uploads still exist
    expect(fs.existsSync(uploadsPath)).toBe(true)
  })

  test('should delete deck and cleanup uploads for owner', async () => {
    // deck owned by userA
    Deck.findById = jest.fn().mockResolvedValue({ _id: sampleId, owner: { toString: () => 'userA' } })
    Deck.findByIdAndDelete = jest.fn().mockResolvedValue(true)

    const app = appWithUser({ id: 'userA' })
    const res = await request(app).delete(`/api/decks/${sampleId}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    // uploads should have been removed
    expect(fs.existsSync(uploadsPath)).toBe(false)
  })
})
