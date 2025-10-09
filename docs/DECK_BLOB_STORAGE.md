# Deck Blob Storage - Hierarchical Structure

## Overview
This implementation provides a hierarchical blob storage structure for deck images organized by deck, owner, and image type.

## Folder Structure

```
decks/
  └── {deckId}/
      └── {ownerUsername}/
          ├── cover/
          │   └── cover.{ext}
          └── cards/
              ├── the_fool.{ext}
              ├── the_magician.{ext}
              ├── ace_of_cups.{ext}
              └── ... (all card images)
```

### Path Components:
- **deckId**: MongoDB ObjectId of the deck
- **ownerUsername**: Sanitized username of the deck owner (fetched from User model)
- **cover**: Subfolder for deck cover image
- **cards**: Subfolder for all card images

## Implementation

### New Utility: `deckBlobStorage.js`

Located at: `/utils/deckBlobStorage.js`

#### Functions:

1. **`uploadDeckCover(buffer, originalName, deckId, ownerId)`**
   - Uploads deck cover image
   - Path: `decks/{deckId}/{ownerUsername}/cover/cover.{ext}`
   - Returns: `{ url, pathname, filename, size }`

2. **`uploadDeckCard(buffer, originalName, cardName, deckId, ownerId)`**
   - Uploads individual card image
   - Path: `decks/{deckId}/{ownerUsername}/cards/{sanitized_card_name}.{ext}`
   - Returns: `{ url, pathname, filename, cardName, size }`

3. **`createDeckFolderStructure(deckId, ownerId)`**
   - Called when a new deck is created
   - Returns expected folder paths for reference
   - Returns: `{ deckPath, coverPath, cardsPath }`

4. **`deleteFromBlob(url)`**
   - Deletes a blob from storage
   - Safe - won't throw errors if deletion fails

## API Endpoints Updated

### 1. Create Deck - `POST /api/decks`
- **Authentication**: Required (JWT)
- **Creates**: Folder structure initialized when deck is created
- **Logging**: Folder structure paths logged for verification

### 2. Upload Deck Cover - `POST /api/decks/:deckId/upload`
- **Authentication**: Required (JWT)
- **Authorization**: Must be deck owner
- **Upload to**: `decks/{deckId}/{ownerUsername}/cover/cover.{ext}`
- **Updates**: `deck.image` with blob URL
- **Returns**: Success response with `blobPath`

### 3. Upload Card Image - `POST /api/decks/:deckId/card/:cardName/upload`
- **Authentication**: Required (JWT)
- **Authorization**: Must be deck owner
- **Upload to**: `decks/{deckId}/{ownerUsername}/cards/{cardName}.{ext}`
- **Updates**: Corresponding card's `image` field in deck.cards array
- **Returns**: Success response with card data and `blobPath`

### 4. Generic Upload Endpoint - `POST /api/decks/:deckId/upload`
- **Authentication**: Required (JWT)
- **Authorization**: Must be deck owner
- **Detects**: Cover vs card upload based on `cardName` in request body
- **Routes to**: Either `uploadDeckCover` or `uploadDeckCard`

## Changes from Old Implementation

### Before:
```
/uploads/decks/{deckId}/{filename}
```
- Flat structure
- No owner separation
- Mixed cover and card images
- Used disk storage

### After:
```
decks/{deckId}/{ownerUsername}/cover/cover.{ext}
decks/{deckId}/{ownerUsername}/cards/{cardName}.{ext}
```
- Hierarchical structure
- Owner-based organization
- Type-separated folders (cover vs cards)
- Cloud blob storage (Vercel)

## Benefits

1. **Organization**: Clear separation of deck assets by owner and type
2. **Scalability**: Cloud-based storage instead of local disk
3. **Security**: Owner verification on all uploads
4. **Maintainability**: Easy to locate and manage deck images
5. **Performance**: Public blob URLs with CDN distribution
6. **Cleanup**: Easy to delete all deck assets by removing folder

## Database Schema

### Deck Model (`models/Deck.js`)
```javascript
{
  deckName: String,
  description: String,
  image: String,           // Blob URL for cover image
  owner: ObjectId,         // Reference to User
  cards: [{
    name: String,
    image: String          // Blob URL for card image
  }],
  isGlobal: Boolean,
  createdAt: Date
}
```

## Security

- All upload endpoints require JWT authentication
- Owner verification on all mutations
- Rider-Waite deck is protected from edits
- File type validation (images only)
- Size limits enforced (5MB max)

## Usage Example

### Creating a New Deck
```javascript
POST /api/decks
Headers: { Authorization: "Bearer {jwt}" }
Body: {
  deckName: "My Custom Deck",
  description: "A personalized tarot deck"
}

// Creates folder structure:
// decks/{newDeckId}/johndoe/cover/
// decks/{newDeckId}/johndoe/cards/
```

### Uploading Deck Cover
```javascript
POST /api/decks/{deckId}/upload
Headers: { Authorization: "Bearer {jwt}" }
Body: FormData with 'image' file

// Uploads to: decks/{deckId}/johndoe/cover/cover.jpg
// Updates deck.image with blob URL
```

### Uploading Card Image
```javascript
POST /api/decks/{deckId}/card/The%20Fool/upload
Headers: { Authorization: "Bearer {jwt}" }
Body: FormData with 'card' file

// Uploads to: decks/{deckId}/johndoe/cards/the_fool.jpg
// Updates corresponding card.image with blob URL
```

## Error Handling

- Invalid file types rejected with 400 error
- Missing authentication returns 401
- Unauthorized access returns 403
- Deck not found returns 404
- Duplicate deck names return 409
- Upload failures return 500 with error message

## Testing

To test the implementation:

1. Create a new deck (authenticated)
2. Verify folder structure in logs
3. Upload a cover image
4. Verify blob URL in deck.image
5. Upload card images
6. Verify blob URLs in deck.cards[].image
7. Check Vercel blob storage for correct folder structure

## Future Enhancements

- Batch card upload endpoint
- Image resizing/optimization
- Thumbnail generation
- Deck export with all images
- Deck cloning with image duplication
- Image versioning support
