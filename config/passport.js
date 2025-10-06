const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const JwtStrategy = require('passport-jwt').Strategy
const ExtractJwt = require('passport-jwt').ExtractJwt
const User = require('../models/User')

// Google OAuth Strategy (only if credentials are provided)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  // Allow the callback URL to be overridden via env var when behind a
  // proxy (e.g. Vercel). Prefer an absolute HTTPS URL if `SERVER_URL` or
  // `GOOGLE_CALLBACK_URL` is provided. Otherwise fall back to the
  // previous relative path which works for local development.
  // Prefer explicit override, then SERVER_URL. When running on Vercel,
  // prefer production domain over deployment-specific URLs:
  // - VERCEL_PROJECT_PRODUCTION_URL (production domain like "mytarotreadingsserver.vercel.app")
  // - VERCEL_URL (deployment-specific like "mytarotreadingsserver-abc123.vercel.app")
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL
    || (process.env.SERVER_URL ? `${process.env.SERVER_URL.replace(/\/$/, '')}/api/auth/google/callback` :
        (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/$/, '')}/api/auth/google/callback` :
         (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/\/$/, '')}/api/auth/google/callback` : '/api/auth/google/callback')))

  passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: callbackUrl
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
            const { uploadToBlob } = require('../utils/blobStorage')
            
            const remote = profile.photos?.[0]?.value
            if (remote) {
              // Fetch the image from Google
              const response = await fetch(remote)
              if (response.ok) {
                const buffer = Buffer.from(await response.arrayBuffer())
                
                // Upload to Vercel Blob
                const result = await uploadToBlob(
                  buffer,
                  `google-${profile.id}.jpg`,
                  'profiles',
                  user._id.toString()
                )
                
                user.profilePicture = result.url
                user.profilePictureSmall = result.url
                user.profilePictureThumb = result.url
                user.uploadedAvatar = true
              } else {
                user.profilePicture = profile.photos?.[0]?.value || user.profilePicture
              }
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
          const { uploadToBlob } = require('../utils/blobStorage')
          const remote = profile.photos?.[0]?.value
          if (remote && user) {
            // Fetch the image from Google
            const response = await fetch(remote)
            if (response.ok) {
              const buffer = Buffer.from(await response.arrayBuffer())
              
              // Upload to Vercel Blob
              const result = await uploadToBlob(
                buffer,
                `google-${profile.id}.jpg`,
                'profiles',
                user._id.toString()
              )
              
              user.profilePicture = result.url
              user.profilePictureSmall = result.url
              user.profilePictureThumb = result.url
              user.uploadedAvatar = true
              await user.save()
            }
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
// Accept tokens from Authorization header (Bearer) OR stateless cookie named 'token'.
// We avoid adding cookie-parser as a hard dependency by parsing the Cookie
// header directly if `req.cookies` is not present.
if (process.env.JWT_SECRET && process.env.JWT_SECRET !== 'your-super-secret-jwt-key-change-this-in-production-12345') {
  const cookieTokenExtractor = (req) => {
    try {
      if (!req) return null
      // If cookie-parser is used upstream, prefer req.cookies
      if (req.cookies && req.cookies.token) return req.cookies.token
      // Fallback: parse raw Cookie header
      const raw = req.headers && (req.headers.cookie || req.headers.Cookie)
      if (!raw) return null
      // Basic parse: split on ';' and find token key
      const parts = raw.split(';').map(p => p.trim())
      for (const p of parts) {
        const idx = p.indexOf('=')
        if (idx === -1) continue
        const key = decodeURIComponent(p.slice(0, idx).trim())
        const val = decodeURIComponent(p.slice(idx + 1).trim())
        if (key === 'token') return val
      }
      return null
    } catch (e) {
      return null
    }
  }

  // Use custom JWT verification to handle Vercel SubtleCrypto issues
  const { verifyJWT } = require('../utils/jwtVerify')
  
  passport.use(new JwtStrategy({
      jwtFromRequest: ExtractJwt.fromExtractors([ExtractJwt.fromAuthHeaderAsBearerToken(), cookieTokenExtractor]),
      secretOrKey: process.env.JWT_SECRET,
      // Disable built-in verification since we'll do it manually
      ignoreExpiration: false,
      // Use custom verify function
      passReqToCallback: false
    },
    async (payload, done) => {
      try {
        // Payload is already verified by passport-jwt, but let's be extra sure
        const user = await User.findById(payload.userId)
        if (user) {
          return done(null, user)
        }
        return done(null, false)
      } catch (error) {
        console.error('JWT user lookup error:', error)
        return done(error, false)
      }
    }
  ))
  
  // Add custom JWT middleware for cases where passport fails
  const customJWTAuth = async (req, res, next) => {
    try {
      // Extract token using the same logic as passport
      let token = null
      
      // Try Authorization header first
      const authHeader = req.headers.authorization
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1]
      }
      
      // Try cookie fallback
      if (!token) {
        token = cookieTokenExtractor(req)
      }
      
      if (!token) {
        return res.status(401).json({ error: 'No authentication token provided' })
      }
      
      // Use our robust JWT verification
      const payload = await verifyJWT(token, process.env.JWT_SECRET)
      const user = await User.findById(payload.userId)
      
      if (!user) {
        return res.status(401).json({ error: 'User not found' })
      }
      
      req.user = user
      next()
    } catch (error) {
      console.error('Custom JWT auth error:', error)
      return res.status(401).json({ error: 'Invalid authentication token' })
    }
  }
  
  // Export custom auth middleware
  module.exports.customJWTAuth = customJWTAuth
} else {
  console.log('⚠️  JWT_SECRET not configured properly - please set a strong secret in .env file')
  
  // Provide fallback middleware when JWT is not configured
  const fallbackJWTAuth = (req, res, next) => {
    console.error('JWT authentication not configured - JWT_SECRET missing')
    return res.status(500).json({ error: 'Authentication service not configured' })
  }
  
  module.exports.customJWTAuth = fallbackJWTAuth
}

module.exports = passport
