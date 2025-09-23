const path = require('path')
const fs = require('fs')

// Load environment variables from project .env so this script can run
// from the repository root (matches how index.js loads .env).
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })

async function main() {
  try {
    // connect to DB using existing helper
    const { connectToDatabase } = require('../utils/connectToDatabase')
    await connectToDatabase()

    const Spread = require('../models/Spread')
    const Deck = require('../models/Deck')

    const base = path.join(__dirname, '..', 'public')

    // 1) Seed spreads.json
    const spreadsPath = path.join(base, 'spreads.json')
    if (fs.existsSync(spreadsPath)) {
      const raw = fs.readFileSync(spreadsPath, 'utf8')
      let spreads = []
      try { spreads = JSON.parse(raw) } catch (e) { console.error('Failed to parse spreads.json', e); spreads = [] }

      for (const s of spreads) {
        if (!s || !s.spread) continue
        const existing = await Spread.findOne({ spread: s.spread, owner: null })
        if (existing) {
          console.log('Spread exists, skipping:', s.spread)
          continue
        }

        const doc = new Spread({
          spread: s.spread,
          cards: Array.isArray(s.cards) ? s.cards : [],
          image: s.image || '/images/spreads/custom.png',
          numberofCards: typeof s.numberofCards === 'number' ? s.numberofCards : (Array.isArray(s.cards) ? s.cards.length : undefined),
          owner: null,
          isCustom: false
        })
        await doc.save()
        console.log('Seeded spread:', s.spread)
      }
    } else {
      console.warn('spreads.json not found at', spreadsPath)
    }

    // 2) Seed rider_waite.json as a Deck
    const riderPath = path.join(base, 'rider_waite.json')
    if (fs.existsSync(riderPath)) {
      const raw = fs.readFileSync(riderPath, 'utf8')
      let deckData = null
      try { deckData = JSON.parse(raw) } catch (e) { console.error('Failed to parse rider_waite.json', e); deckData = null }

      if (deckData && deckData.deckName) {
        const existing = await Deck.findOne({ deckName: deckData.deckName })
        if (existing) {
          console.log('Deck exists, skipping:', deckData.deckName)
        } else {
          const cards = Array.isArray(deckData.cards) ? deckData.cards.map(c => ({ name: c.name || c, image: c.image || undefined })) : []
          const deck = new Deck({
            deckName: deckData.deckName,
            description: deckData.description || '',
            image: deckData.image || undefined,
            owner: null,
            cards
          })
          await deck.save()
          console.log('Seeded deck:', deckData.deckName)
        }
      }
    } else {
      console.warn('rider_waite.json not found at', riderPath)
    }

    // 3) Optionally seed public/cards.json as a generic deck
    const cardsPath = path.join(base, 'cards.json')
    if (fs.existsSync(cardsPath)) {
      const raw = fs.readFileSync(cardsPath, 'utf8')
      let all = null
      try { all = JSON.parse(raw) } catch (e) { console.error('Failed to parse cards.json', e); all = null }

      if (all && Array.isArray(all.cards)) {
        const deckName = 'Standard Tarot Cards'
        const existing = await Deck.findOne({ deckName })
        if (existing) {
          console.log('Deck exists, skipping:', deckName)
        } else {
          // flatten cards across suits
          const cards = []
          for (const suit of all.cards) {
            if (!suit || !Array.isArray(suit.cards)) continue
            for (const c of suit.cards) {
              const name = c.name || c
              cards.push({ name })
            }
          }
          const deck = new Deck({ deckName, description: 'Flattened tarot cards from public/cards.json', cards })
          await deck.save()
          console.log('Seeded deck:', deckName)
        }
      }
    }

    console.log('Seeding complete')
    process.exit(0)
  } catch (err) {
    console.error('Seeding failed', err)
    process.exit(1)
  }
}

main()
