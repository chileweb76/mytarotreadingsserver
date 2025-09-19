const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const JwtStrategy = require('passport-jwt').Strategy
const ExtractJwt = require('passport-jwt').ExtractJwt
const User = require('../models/User')

// Google OAuth Strategy (only if credentials are provided)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/auth/google/callback"
    },
  async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists with this Google ID
        let user = await User.findOne({ googleId: profile.id })
        
  if (user) {
          // User exists, update last login and return
          user.lastLoginAt = new Date()
          await user.save()
          return done(null, user)
        }

        // Check if user exists with the same email (from local registration)
        user = await User.findOne({ email: profile.emails[0].value })
        
        if (user) {
          // Link Google account to existing user
          user.googleId = profile.id
          user.authProvider = 'google'
          user.isEmailVerified = true
          user.lastLoginAt = new Date()

          // Attempt to download and store Google profile photo locally
          try {
            const fetchAndStore = require('../utils/fetchAndStoreRemoteImage')
            // Use SERVER_URL (API host) when available; fallback to localhost with server PORT
            const serverBase = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5002}`
            const remote = profile.photos?.[0]?.value
            const variants = await fetchAndStore(remote, serverBase, `google-${profile.id}`)
            if (variants) {
              user.profilePicture = variants.web
              user.profilePictureSmall = variants.small
              user.profilePictureThumb = variants.thumb
              user.uploadedAvatar = true
            } else {
              user.profilePicture = profile.photos?.[0]?.value || user.profilePicture
            }
          } catch (e) {
            console.warn('Failed to download Google avatar for existing user', e)
            user.profilePicture = profile.photos?.[0]?.value || user.profilePicture
          }

          await user.save()
          return done(null, user)
        }

        // Create new user from Google profile
        user = await User.createFromGoogleProfile(profile)
        // If createFromGoogleProfile didn't download (legacy), attempt to download now
        try {
          const fetchAndStore = require('../utils/fetchAndStoreRemoteImage')
          const serverBase = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5002}`
          const remote = profile.photos?.[0]?.value
          const variants = await fetchAndStore(remote, serverBase, `google-${profile.id}`)
          if (variants && user) {
            user.profilePicture = variants.web
            user.profilePictureSmall = variants.small
            user.profilePictureThumb = variants.thumb
            user.uploadedAvatar = true
            await user.save()
          }
        } catch (e) {
          // ignore
        }
        return done(null, user)
        
      } catch (error) {
        console.error('Google OAuth error:', error)
        return done(error, null)
      }
    }
  ))
} else {
  console.log('⚠️  Google OAuth not configured - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET required')
}

// JWT Strategy (only if secret is provided)
if (process.env.JWT_SECRET && process.env.JWT_SECRET !== 'your-super-secret-jwt-key-change-this-in-production-12345') {
  passport.use(new JwtStrategy({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET
    },
    async (payload, done) => {
      try {
        const user = await User.findById(payload.userId)
        if (user) {
          return done(null, user)
        }
        return done(null, false)
      } catch (error) {
        console.error('JWT verification error:', error)
        return done(error, false)
      }
    }
  ))
} else {
  console.log('⚠️  JWT_SECRET not configured properly - please set a strong secret in .env file')
}

module.exports = passport
