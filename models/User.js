const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: function() {
      // Password is required only if not using Google OAuth
      return !this.googleId
    },
    minlength: 6
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true // Allows multiple null values but unique non-null values
  },
  profilePicture: {
    type: String,
    default: null
  },
  profilePictureSmall: {
    type: String,
    default: null
  },
  profilePictureThumb: {
    type: String,
    default: null
  },
  // whether the avatar was uploaded to our server (vs using third-party Google photo)
  uploadedAvatar: {
    type: Boolean,
    default: false
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: {
    type: String,
    default: null,
    index: true,
    sparse: true
  },
  verificationExpires: {
    type: Date,
    default: null
  },
  // Password reset fields
  resetPasswordToken: {
    type: String,
    default: null,
    index: true,
    sparse: true
  },
  resetPasswordExpires: {
    type: Date,
    default: null
  },
  // Refresh token for issuing new JWTs
  refreshToken: {
    type: String,
    default: null,
    sparse: true
  },
  readingsCount: {
    type: Number,
    default: 0
  },
  lastLoginAt: {
    type: Date,
    default: Date.now
  }
  ,
  // Soft-delete fields
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  }
  ,
  // Admin flag
  isAdmin: {
    type: Boolean,
    default: false
  }
  ,
  // Deletion notification tracking
  deletionNotified: {
    type: Boolean,
    default: false
  },
  deletionNotificationSentAt: {
    type: Date,
    default: null
  }
  ,
  deletionFinalNotified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
})

// Note: indexes are created via `unique: true` on schema fields above.
// Removed explicit schema.index() calls to avoid duplicate index warnings.

// Hash password before saving (only for local auth)
userSchema.pre('save', async function(next) {
  // Only hash password if it's new or modified and not Google auth
  if (!this.isModified('password') || this.authProvider === 'google') {
    return next()
  }
  
  try {
    const salt = await bcrypt.genSalt(12)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (error) {
    next(error)
  }
})

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) {
    return false // Google users don't have password
  }
  return bcrypt.compare(candidatePassword, this.password)
}

// Method to generate username from Google name
userSchema.statics.generateUsernameFromGoogleName = async function(googleName) {
  let baseUsername = googleName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove special characters
    .substring(0, 20) // Limit length
  
  if (baseUsername.length < 2) {
    baseUsername = 'user' + Date.now().toString().slice(-6)
  }
  
  let username = baseUsername
  let counter = 1
  
  // Check for existing usernames and append number if needed
  while (await this.findOne({ username })) {
    username = `${baseUsername}${counter}`
    counter++
  }
  
  return username
}

// Method to create user from Google profile
userSchema.statics.createFromGoogleProfile = async function(profile) {
  const username = await this.generateUsernameFromGoogleName(profile.displayName || profile.name?.givenName || 'user')
  
  const userData = {
    googleId: profile.id,
    username,
    email: profile.emails[0].value,
  // We will attempt to download/store the Google photo on the server side and set the fields there.
  profilePicture: null,
    authProvider: 'google',
    isEmailVerified: true, // Google emails are verified
    lastLoginAt: new Date()
  }
  
  const user = await this.create(userData)
  return user
}

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const userObject = this.toObject()
  delete userObject.password
  delete userObject.__v
  return userObject
}

module.exports = mongoose.model('User', userSchema)
