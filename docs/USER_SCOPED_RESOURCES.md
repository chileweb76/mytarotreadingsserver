# User-Scoped Resources Implementation

## Overview
This update implements proper user isolation for decks, querents, and spreads, allowing multiple users to create resources with identical names without conflicts.

## Changes Made

### 1. Database Schema Updates

#### Models Updated:
- **`models/Deck.js`**: Added compound unique index `{ deckName: 1, owner: 1 }`
- **`models/Querent.js`**: Added compound unique index `{ name: 1, userId: 1 }`
- **`models/Spread.js`**: Added compound unique index `{ spread: 1, owner: 1 }`

### 2. Route Logic Updates

#### Decks (`routes/decks.js`):
- Updated POST `/api/decks` to check for duplicates only within the current user's decks
- Error message changed from "A deck with that name already exists" to "You already have a deck with that name"

#### Querents (`routes/querents.js`):
- Updated POST `/api/querents` to check for duplicates only within the current user's querents
- Added case-insensitive duplicate checking

#### Spreads (`routes/spreads.js`):
- Updated POST `/api/spreads` to check for duplicates only within the current user's spreads
- Added case-insensitive duplicate checking

## Benefits

1. **User Isolation**: Each user can have decks/querents/spreads with identical names
2. **Global Resources**: System resources (Rider-Waite deck, default querents) remain shared with `owner: null` or `isGlobal: true`
3. **Database Efficiency**: Compound indexes optimize queries by user
4. **Scalability**: Handles millions of user-scoped documents efficiently

## Migration

To add the compound indexes to your existing MongoDB database:

```bash
cd /Users/chris/Desktop/mytarotreadingsserver
node scripts/add-compound-indexes.js
```

This script:
- Checks if indexes already exist before creating them
- Creates compound unique indexes for all three collections
- Provides detailed feedback on the migration process
- Safe to run multiple times (idempotent)

## Example Scenarios

### Before (Globally Unique Names):
❌ User A creates "My Custom Deck"  
❌ User B tries to create "My Custom Deck" → **ERROR: Deck already exists**

### After (User-Scoped Names):
✅ User A creates "My Custom Deck"  
✅ User B creates "My Custom Deck" → **SUCCESS: Each user has their own deck**  
✅ Global "Rider-Waite Tarot Deck" remains accessible to all users

## Database Queries

### How it works:

**Creating a deck:**
```javascript
// OLD: Check globally
const existing = await Deck.findOne({ deckName: 'My Deck' })

// NEW: Check only current user's decks
const existing = await Deck.findOne({ 
  deckName: 'My Deck',
  owner: currentUserId 
})
```

**Fetching decks:**
```javascript
// Get user's decks + global decks
const decks = await Deck.find({
  $or: [
    { owner: currentUserId },      // User's own decks
    { owner: null },               // Global decks
    { isGlobal: true }             // Explicitly marked global
  ]
})
```

## Technical Details

### Compound Index Structure:
```javascript
// Decks
{ deckName: 1, owner: 1 }  // Unique together

// Querents  
{ name: 1, userId: 1 }     // Unique together

// Spreads
{ spread: 1, owner: 1 }    // Unique together
```

### Index Behavior:
- Two users can have resources with the same name (different owner)
- One user cannot have two resources with the same name (same owner)
- Global resources (owner: null) can coexist with user-owned resources

## Deployment Notes

1. **Deploy Model Changes**: Models with index definitions must be deployed first
2. **Run Migration Script**: Execute `add-compound-indexes.js` after deployment
3. **Verify Indexes**: Check MongoDB Atlas or run:
   ```javascript
   db.decks.getIndexes()
   db.querents.getIndexes()
   db.spreads.getIndexes()
   ```

## Backward Compatibility

- Existing resources with `owner: null` or `isGlobal: true` continue to work
- No data migration required (only index creation)
- API responses unchanged (backward compatible)

## Testing Recommendations

1. Test deck creation with duplicate names by different users
2. Verify global resources remain accessible
3. Test error messages for actual duplicates (same user)
4. Verify queries return correct scoped results

## Related Files

- `/models/Deck.js`
- `/models/Querent.js`
- `/models/Spread.js`
- `/routes/decks.js`
- `/routes/querents.js`
- `/routes/spreads.js`
- `/scripts/add-compound-indexes.js`
