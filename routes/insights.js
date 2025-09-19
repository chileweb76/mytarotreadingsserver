const express = require('express')
const router = express.Router()
const Reading = require('../models/Reading')
const mongoose = require('mongoose')

// GET /api/insights/count?querent=<id|self>&start=YYYY-MM-DD&end=YYYY-MM-DD&deck=<deckId|all>
router.get('/count', async (req, res) => {
  try {
    const { querent, start, end, deck, tags } = req.query
    const filters = {}

    // date range filter: inclusive
    // Interpret date-only strings (YYYY-MM-DD) as UTC day boundaries so
    // clients and servers in different timezones don't accidentally exclude
    // readings on the end day. If an ISO datetime (contains 'T') is provided
    // use it as-is.
    const parseDayStart = (s) => {
      if (!s) return null
      return s.includes('T') ? new Date(s) : new Date(`${s}T00:00:00.000Z`)
    }
    const parseDayEnd = (s) => {
      if (!s) return null
      return s.includes('T') ? new Date(s) : new Date(`${s}T23:59:59.999Z`)
    }

    if (start || end) {
      filters.dateTime = {}
      const s = parseDayStart(start)
      const e = parseDayEnd(end)
      if (s) filters.dateTime.$gte = s
      if (e) filters.dateTime.$lte = e
    }

    // deck filter
    if (deck && deck !== 'all') {
      if (mongoose.Types.ObjectId.isValid(String(deck))) filters.deck = new mongoose.Types.ObjectId(String(deck))
    }

    // tags filter: accept comma-separated ids or JSON array
    if (tags) {
      let parsed = []
      try {
        if (tags.startsWith('[')) parsed = JSON.parse(tags)
        else parsed = String(tags).split(',').map(s => s.trim()).filter(Boolean)
      } catch (e) {
        parsed = String(tags).split(',').map(s => s.trim()).filter(Boolean)
      }
      const validIds = parsed.filter(id => mongoose.Types.ObjectId.isValid(String(id))).map(id => new mongoose.Types.ObjectId(String(id)))
      if (validIds.length) {
        // any reading that has at least one of the selected tags
        filters.selectedTags = { $in: validIds }
      }
    }

    // querent filter: accept 'self' which maps to global Self querent (userId: null)
    if (typeof querent !== 'undefined' && querent !== null && querent !== '') {
      const q = String(querent)
      if (q === 'self') {
        // find global Self querent id
        const Querent = require('../models/Querent')
        const selfQ = await Querent.findOne({ name: 'Self', userId: null }).lean()
        if (selfQ && selfQ._id) filters.querent = selfQ._id
        else filters.querent = null
      } else if (mongoose.Types.ObjectId.isValid(q)) {
        filters.querent = new mongoose.Types.ObjectId(q)
      } else {
        // not an object id and not 'self' -> ignore querent filter
      }
    }

    const count = await Reading.countDocuments(filters)
    res.json({ count })
  } catch (e) {
    console.error('Insights count error', e)
    res.status(500).json({ error: 'Failed to compute insights count' })
  }
})

    // GET /api/insights/suits?querent=<id|self>&start=YYYY-MM-DD&end=YYYY-MM-DD&deck=<deckId|all>&tags=<ids>
    router.get('/suits', async (req, res) => {
      try {
        const { querent, start, end, deck, tags } = req.query
        const match = {}

            // date range filter (same semantics as /count)
            const parseDayStart = (s) => {
              if (!s) return null
              return s.includes('T') ? new Date(s) : new Date(`${s}T00:00:00.000Z`)
            }
            const parseDayEnd = (s) => {
              if (!s) return null
              return s.includes('T') ? new Date(s) : new Date(`${s}T23:59:59.999Z`)
            }

            if (start || end) {
              match.dateTime = {}
              const s = parseDayStart(start)
              const e = parseDayEnd(end)
              if (s) match.dateTime.$gte = s
              if (e) match.dateTime.$lte = e
            }

        if (deck && deck !== 'all') {
          if (mongoose.Types.ObjectId.isValid(String(deck))) match.deck = new mongoose.Types.ObjectId(String(deck))
        }

        if (tags) {
          let parsed = []
          try {
            if (tags.startsWith('[')) parsed = JSON.parse(tags)
            else parsed = String(tags).split(',').map(s => s.trim()).filter(Boolean)
          } catch (e) {
            parsed = String(tags).split(',').map(s => s.trim()).filter(Boolean)
          }
          const validIds = parsed.filter(id => mongoose.Types.ObjectId.isValid(String(id))).map(id => new mongoose.Types.ObjectId(String(id)))
          if (validIds.length) match.selectedTags = { $in: validIds }
        }

        if (typeof querent !== 'undefined' && querent !== null && querent !== '') {
          const q = String(querent)
          if (q === 'self') {
            const Querent = require('../models/Querent')
            const selfQ = await Querent.findOne({ name: 'Self', userId: null }).lean()
            if (selfQ && selfQ._id) match.querent = selfQ._id
            else match.querent = null
          } else if (mongoose.Types.ObjectId.isValid(q)) {
            match.querent = new mongoose.Types.ObjectId(q)
          }
        }

        // aggregation: unwind drawnCards.suit and group
        const pipeline = [
          { $match: match },
          { $unwind: '$drawnCards' },
          { $group: { _id: { $ifNull: [ '$drawnCards.suit', 'Unknown' ] }, count: { $sum: 1 } } },
          { $project: { suit: '$_id', count: 1, _id: 0 } }
        ]

        const results = await Reading.aggregate(pipeline)
        // normalize to object map
        const suits = {}
        results.forEach(r => {
          suits[r.suit || 'Unknown'] = r.count || 0
        })

        res.json({ suits })
      } catch (e) {
        console.error('Insights suits error', e)
        res.status(500).json({ error: 'Failed to compute suit frequencies' })
      }
    })

    // GET /api/insights/cards?querent=<id|self>&start=YYYY-MM-DD&end=YYYY-MM-DD&deck=<deckId|all>&tags=<ids>
    router.get('/cards', async (req, res) => {
      try {
        const { querent, start, end, deck, tags } = req.query
        const match = {}

        // date range parsing (same helper semantics)
        const parseDayStart = (s) => {
          if (!s) return null
          return s.includes('T') ? new Date(s) : new Date(`${s}T00:00:00.000Z`)
        }
        const parseDayEnd = (s) => {
          if (!s) return null
          return s.includes('T') ? new Date(s) : new Date(`${s}T23:59:59.999Z`)
        }

        if (start || end) {
          match.dateTime = {}
          const s = parseDayStart(start)
          const e = parseDayEnd(end)
          if (s) match.dateTime.$gte = s
          if (e) match.dateTime.$lte = e
        }

        if (deck && deck !== 'all') {
          if (mongoose.Types.ObjectId.isValid(String(deck))) match.deck = new mongoose.Types.ObjectId(String(deck))
        }

        if (tags) {
          let parsed = []
          try {
            if (tags.startsWith('[')) parsed = JSON.parse(tags)
            else parsed = String(tags).split(',').map(s => s.trim()).filter(Boolean)
          } catch (e) {
            parsed = String(tags).split(',').map(s => s.trim()).filter(Boolean)
          }
          const validIds = parsed.filter(id => mongoose.Types.ObjectId.isValid(String(id))).map(id => new mongoose.Types.ObjectId(String(id)))
          if (validIds.length) match.selectedTags = { $in: validIds }
        }

        if (typeof querent !== 'undefined' && querent !== null && querent !== '') {
          const q = String(querent)
          if (q === 'self') {
            const Querent = require('../models/Querent')
            const selfQ = await Querent.findOne({ name: 'Self', userId: null }).lean()
            if (selfQ && selfQ._id) match.querent = selfQ._id
            else match.querent = null
          } else if (mongoose.Types.ObjectId.isValid(q)) {
            match.querent = new mongoose.Types.ObjectId(q)
          }
        }

        // aggregation: unwind drawnCards and group by card name
        // include an example suit and image (first encountered) for display
        const pipeline = [
          { $match: match },
          { $unwind: '$drawnCards' },
          { $group: {
              _id: { $ifNull: [ '$drawnCards.card', 'Unknown' ] },
              count: { $sum: 1 },
              suit: { $first: '$drawnCards.suit' }
            }
          },
          { $project: { card: '$_id', count: 1, suit: 1, _id: 0 } },
          { $sort: { count: -1, card: 1 } }
        ]

        const results = await Reading.aggregate(pipeline)
  const cards = results.map(r => ({ card: r.card || 'Unknown', count: r.count || 0, suit: r.suit || null }))

        res.json({ cards })
      } catch (e) {
        console.error('Insights cards error', e)
        res.status(500).json({ error: 'Failed to compute card frequencies' })
      }
    })

module.exports = router
