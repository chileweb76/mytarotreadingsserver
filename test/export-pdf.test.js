const request = require('supertest')
const express = require('express')
const bodyParser = require('express').json

// We'll create a small express app and mount the route for testing.
const app = express()
app.use(bodyParser())

// Mock pdfWorker to avoid launching Chromium in tests
jest.mock('../utils/pdfWorker', () => ({
  renderPdfFromHtml: async () => Buffer.from('%PDF-1.4 testpdf')
}))

const exportRoute = require('../routes/export-pdf')
app.use('/api/export', exportRoute)

describe('POST /api/export/pdf', () => {
  it('returns 400 without reading', async () => {
    const res = await request(app).post('/api/export/pdf').send({})
    expect(res.statusCode).toBe(400)
  })

  it('returns a PDF when given reading data', async () => {
    const reading = {
      by: 'Tester',
      date: '2025-09-13',
      querent: 'Self',
      spread: 'Three-card',
      deck: 'Rider-Waite',
      question: 'Will I ship code?',
      cards: [{ title: 'The Fool' }, { title: 'The Magician' }],
      interpretation: 'Yes.'
    }

    const res = await request(app).post('/api/export/pdf').send({ reading, fileName: 'test.pdf' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('application/pdf')
    expect(res.body).toBeDefined()
  })
})
