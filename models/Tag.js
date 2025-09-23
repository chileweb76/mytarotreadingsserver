const mongoose = require('mongoose')
const { Schema } = mongoose

const tagSchema = new Schema({
  name: { type: String, required: true, trim: true },
  // normalized lowercase name for case-insensitive uniqueness
  nameLower: { type: String, required: true, trim: true, lowercase: true },
  // store user as ObjectId; null means a global tag
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  isGlobal: { type: Boolean, default: false }
}, { timestamps: true })

// Unique per (nameLower, userId) pair. Global tags will have userId === null.
tagSchema.index({ nameLower: 1, userId: 1 }, { unique: true })

tagSchema.pre('validate', function (next) {
  if (this.name) this.nameLower = this.name.trim().toLowerCase()
  next()
})

module.exports = mongoose.models.Tag || mongoose.model('Tag', tagSchema)