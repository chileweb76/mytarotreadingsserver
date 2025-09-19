const express = require('express')
const router = express.Router()
const Handlebars = require('handlebars')
const path = require('path')
const fs = require('fs')
const { renderPdfFromHtml } = require('../utils/pdfWorker')

// Ensure fetch is available in Node (Node 18+ has global fetch). If not, try to require 'node-fetch'.
if (typeof fetch === 'undefined') {
  try {
    global.fetch = require('node-fetch')
  } catch (e) {
    console.warn('Global fetch is not available and node-fetch could not be loaded. Remote image inlining may fail.')
  }
}

// POST /api/export/pdf
// Accepts structured reading data and returns a generated PDF
// Expected body: { reading: { by, date, querent, spread, deck, question, cards: [{title}], interpretation }, fileName }
router.post('/pdf', async (req, res) => {
  try {
    const { reading, fileName = 'reading.pdf', html } = req.body

    // If caller provided raw HTML, render it directly to PDF. This allows clients
    // (like the Insights page) to assemble a full HTML snapshot (including an
    // inlined chart image) and have the server return a PDF of exactly that HTML.
    if (html && typeof html === 'string') {
      console.log('[export-pdf] Rendering raw HTML payload to PDF (fileName=%s, htmlLength=%d)', fileName, html.length)
      const pdfBuffer = await renderPdfFromHtml(html)
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': pdfBuffer.length
      })
      return res.send(pdfBuffer)
    }

  const readData = reading || req.body.reading
  if (!readData) return res.status(400).json({ error: 'reading object required' })
  const normalizedReading = readData

    // Load and compile template
    const tplPath = path.join(__dirname, '..', 'templates', 'reading-template.hbs')
    const tplRaw = fs.readFileSync(tplPath, 'utf8')
    const tpl = Handlebars.compile(tplRaw)

    // Ensure safe defaults
    const data = Object.assign({
      by: 'Guest',
      date: new Date().toLocaleString(),
      querent: 'Self',
      spread: 'Unknown',
      deck: 'Unknown deck',
      question: '',
      cards: [],
      interpretation: '',
      exportedAt: new Date().toLocaleString()
    }, normalizedReading)

    // Normalize image URLs: make relative paths absolute using request host
    try {
      const host = req.get('host')
      const proto = req.protocol || 'http'

      // Normalize top-level reading image (if present)
      if (data.image && typeof data.image === 'string') {
        const img = data.image.trim()
        if (!img.startsWith('data:') && !/^https?:\/\//i.test(img)) {
          if (img.startsWith('/')) {
            data.image = `${proto}://${host}${img}`
          } else {
            data.image = `${proto}://${host}/${img}`
          }
        }
      }

      // Normalize card image URLs
      if (Array.isArray(data.cards)) {
        data.cards = data.cards.map(c => {
          const copy = Object.assign({}, c)
          if (copy.image && typeof copy.image === 'string') {
            const img = copy.image.trim()
            // skip data URLs and absolute http(s) URLs
            if (!img.startsWith('data:') && !/^https?:\/\//i.test(img)) {
              // If starts with '/', make absolute
              if (img.startsWith('/')) {
                copy.image = `${proto}://${host}${img}`
              } else {
                // otherwise treat as relative to server root
                copy.image = `${proto}://${host}/${img}`
              }
            }
          }
          return copy
        })
      }
    } catch (e) {
      // ignore normalization errors and proceed
      console.warn('Image normalization failed', e)
    }

    // Attempt to inline remote/absolute images as data URLs so Playwright can render them
    try {
      const tryInline = async (imgUrl) => {
        try {
          // Only attempt for http(s) URLs
          if (!/^https?:\/\//i.test(imgUrl)) return null
          const r = await fetch(imgUrl)
          if (!r.ok) return null
          const buf = await r.arrayBuffer()
          const ct = r.headers.get('content-type') || 'image/jpeg'
          const b64 = Buffer.from(buf).toString('base64')
          return `data:${ct};base64,${b64}`
        } catch (e) {
          console.warn('Failed to inline image', imgUrl, e)
          return null
        }
      }

      // Inline top-level image if it's an absolute URL
      if (data.image && typeof data.image === 'string' && /^https?:\/\//i.test(data.image)) {
        const inlined = await tryInline(data.image)
        if (inlined) data.image = inlined
      }

      // Inline card images
      if (Array.isArray(data.cards)) {
        for (let i = 0; i < data.cards.length; i++) {
          const c = data.cards[i]
          if (c && c.image && typeof c.image === 'string' && /^https?:\/\//i.test(c.image)) {
            const inlined = await tryInline(c.image)
            if (inlined) c.image = inlined
          }
        }
      }
    } catch (e) {
      console.warn('Image inlining step failed', e)
    }

  const renderedHtml = tpl(data)

    // Render PDF using reusable worker
  const pdfBuffer = await renderPdfFromHtml(renderedHtml)

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': pdfBuffer.length
    })
    return res.send(pdfBuffer)
  } catch (err) {
    console.error('PDF export failed', err)
    return res.status(500).json({ error: 'Failed to generate PDF', details: err.message })
  }
})

module.exports = router
