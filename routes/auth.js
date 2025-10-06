const express = require('express')
const jwt = require('jsonwebtoken')
const passport = require('passport')
const User = require('../models/User')
const router = express.Router()
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const Reading = require('../models/Reading')
const Deck = require('../models/Deck')
const Querent = require('../models/Querent')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
let sharp
try {
  sharp = require('sharp')
} catch (e) {
  console.warn('sharp is not installed; image resizing will be skipped. Install sharp for optimal images.')
}

// Blob storage for profile pictures
const { uploadToBlob, deleteFromBlob } = require('../utils/blobStorage')

// Multer setup for blob uploads (memory storage)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    // Only allow images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image files are allowed'), false)
    }
  }
})

// Small utility: race a promise against a timeout
function withTimeout(promise, ms, errMsg = 'operation timeout') {
  let timeoutId
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errMsg)), ms)
  })
  return Promise.race([promise.finally(() => clearTimeout(timeoutId)), timeout])
}

// Helper to echo CORS headers when an Origin header is present and allowed
function echoCorsIfAllowed(req, res) {
  try {
    const origin = req.headers && req.headers.origin
    if (!origin) return
    const { allowedOrigins } = require('../utils/corsConfig')
    if (allowedOrigins && allowedOrigins.indexOf(origin) !== -1) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Allow-Credentials', 'true')
    }
  } catch (e) {
    // ignore errors here
  }
}

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' })
}

// Generate a refresh token (long-lived random string)
const generateRefreshToken = () => {
  return crypto.randomBytes(32).toString('hex')
}

// Helper function for blob URLs (they're already absolute, so just return as-is)
function absolutizeUploadUrl(url, req) {
  return url // Blob URLs are already absolute
}

const { buildServerBase } = require('../utils/serverBase')

// Register new user
router.post('/register', async (req, res) => {
  try {
    // Helpful debug: log the incoming body shape when developing
    if (process.env.NODE_ENV !== 'production') {
      // Debug logging removed for production
    }
    const { username, email: rawEmail, password, verifyPassword } = req.body
    const email = rawEmail && rawEmail.toString().trim().toLowerCase()

    // Validation
    if (!username || !email || !password || !verifyPassword) {
      return res.status(400).json({ error: 'All fields are required' })
    }

    if (password !== verifyPassword) {
      return res.status(400).json({ error: 'Passwords do not match' })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' })
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    })

    if (existingUser) {
      const field = existingUser.email === email ? 'email' : 'username'
      return res.status(400).json({ error: `User with this ${field} already exists` })
    }

    // Create new user
    const user = new User({
      username,
      email,
      password,
      authProvider: 'local'
    })

  // create verification token
  const verificationToken = crypto.randomBytes(20).toString('hex')
  user.verificationToken = verificationToken
    // expires in 24 hours
    user.verificationExpires = Date.now() + 24 * 60 * 60 * 1000

  // save user with a short timeout so DB hangs don't block registration indefinitely
  await withTimeout(user.save(), 5000, 'user.save timeout')

  // send verification email via Courier (if configured). Fire-and-forget so slow
  // mail providers don't block the registration response. Log any failure.
    const courierTemplateId = process.env.COURIER_VERIFY_TEMPLATE_ID || process.env.COURIER_TEMPLATE_ID || process.env.COURIER_RESET_TEMPLATE_ID
    if (process.env.COURIER_AUTH_TOKEN && courierTemplateId) {
      // build a server-side verify URL so the link hits this API's /api/auth/verify route
      const serverBase = buildServerBase(req)
      const verifyUrl = `${serverBase}/api/auth/verify?token=${verificationToken}`
      const payload = {
        message: {
          to: { email },
          template: courierTemplateId,
          data: {
            username: username,
            verify_url: verifyUrl,
            verifyUrl: verifyUrl
          }
        }
      }

      try { require('../utils/log').debug('Scheduling verification email to Courier (token redacted):', { to: email, template: courierTemplateId }) } catch (e) {}
      // Attempt to send the verification email and await a short timeout so
      // serverless functions don't terminate before the request is dispatched.
      try {
        const resp = await withTimeout(fetch('https://api.courier.com/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.COURIER_AUTH_TOKEN}`
          },
          body: JSON.stringify(payload)
        }), 3000, 'courier.send timeout')

        if (!resp || !resp.ok) {
          let text = ''
          try { text = await resp.text() } catch (e) { text = String(e) }
          console.error('Courier send returned non-OK during registration:', resp && resp.status, text)
        } else {
          console.info('Verification email scheduled/sent to Courier for', email)
        }
      } catch (err) {
        // Log the error so we can see why sends fail in server logs.
        console.error('Failed to send verification email during registration:', err && err.stack ? err.stack : err)
      }
    } else {
      // Warn if Courier is not configured so admins know emails won't be sent
      console.warn('⚠️  Courier not configured - verification email NOT sent for:', email)
      console.warn('   Set COURIER_AUTH_TOKEN and COURIER_VERIFY_TEMPLATE_ID environment variables to enable email verification')
    }

    // Do NOT issue JWT until email is verified
    res.status(201).json({
      message: 'User registered successfully. Please verify your email to activate your account.',
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    })
  } catch (error) {
    console.error('Registration error:', error && error.stack ? error.stack : error)
    // In dev, include a little more detail so we can triage quickly
    if (process.env.NODE_ENV !== 'production') {
      return res.status(500).json({ error: 'Internal server error', details: error && error.message ? error.message : String(error) })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Verify email route
// Accept both GET (legacy links) and POST (client-side verification flow).
router.options('/verify', (req, res) => res.sendStatus(204))
router.get('/verify', async (req, res) => {
  try {
    const { token } = req.query
    if (!token) return res.status(400).json({ error: 'Token is required' })

    // Wrap DB ops in timeout to avoid long cold-start DB hangs
    const user = await withTimeout(User.findOne({ verificationToken: token, verificationExpires: { $gt: Date.now() } }).exec(), 5000, 'DB lookup timeout')
    if (!user) return res.status(400).json({ error: 'Invalid or expired token' })

    user.isEmailVerified = true
    user.verificationToken = null
    user.verificationExpires = null
    await withTimeout(user.save(), 5000, 'DB save timeout')

    // redirect to client success page, normalize CLIENT_URL
    const clientBase = (process.env.CLIENT_URL || process.env.NEXT_PUBLIC_CLIENT_URL || '').replace(/\/$/, '') || ''
    if (clientBase) {
      return res.redirect(`${clientBase}/auth/success?verified=true`)
    }
    // Fallback: return JSON when no client URL configured
    return res.json({ ok: true, message: 'Email verified' })
  } catch (err) {
    console.error('Verification error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Verify email via POST (accepts JSON { token }) - useful for client-side
// verification flows where the user is redirected to a client page which then
// POSTs the token to the API. This is more reliable in serverless environments
// where direct GET verification may hit cold-start timeouts when connecting to DB.
router.options('/verify', (req, res) => res.sendStatus(204))
router.post('/verify', async (req, res) => {
  try {
    const token = req.body && req.body.token
    if (!token) return res.status(400).json({ error: 'Token is required' })
    // use timed DB lookup/save
    const user = await withTimeout(User.findOne({ verificationToken: token, verificationExpires: { $gt: Date.now() } }).exec(), 5000, 'DB lookup timeout')
    if (!user) return res.status(400).json({ error: 'Invalid or expired token' })

    user.isEmailVerified = true
    user.verificationToken = null
    user.verificationExpires = null
    await withTimeout(user.save(), 5000, 'DB save timeout')

    // Echo CORS headers explicitly when Origin is present and allowed so
    // browsers will accept the response when credentials are used.
    echoCorsIfAllowed(req, res)

    return res.json({ ok: true, message: 'Email verified' })
  } catch (err) {
    console.error('Verification POST error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Resend verification email
router.post('/resend', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email is required' })

    const user = await User.findOne({ email })
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (user.isEmailVerified) return res.status(400).json({ error: 'Email already verified' })

    // generate new token
    const verificationToken = crypto.randomBytes(20).toString('hex')
    user.verificationToken = verificationToken
    user.verificationExpires = Date.now() + 24 * 60 * 60 * 1000
    await withTimeout(user.save(), 5000, 'user.save timeout')

    // send via Courier if configured (background)
    const courierTemplateId = process.env.COURIER_VERIFY_TEMPLATE_ID || process.env.COURIER_TEMPLATE_ID || process.env.COURIER_RESET_TEMPLATE_ID
    if (process.env.COURIER_AUTH_TOKEN && courierTemplateId) {
      const serverBase = buildServerBase(req)
      const verifyUrl = `${serverBase}/api/auth/verify?token=${verificationToken}`
      const payload = {
        message: {
          to: { email },
          template: courierTemplateId,
          data: {
            username: user.username,
            verify_url: verifyUrl,
            verifyUrl: verifyUrl
          }
        }
      }

  try { require('../utils/log').debug('Scheduling resend verification email (token redacted):', { to: email, template: courierTemplateId }) } catch (e) {}
  try {
    const resp = await withTimeout(fetch('https://api.courier.com/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.COURIER_AUTH_TOKEN}`
      },
      body: JSON.stringify(payload)
    }), 3000, 'courier.send timeout')

    if (!resp || !resp.ok) {
      let text = ''
      try { text = await resp.text() } catch (e) { text = String(e) }
      console.error('Courier send returned non-OK during resend:', resp && resp.status, text)
    } else {
      console.info('Resend verification email sent for', email)
    }
  } catch (err) {
    console.error('Failed to resend verification email:', err && err.stack ? err.stack : err)
  }
    }

    // Echo CORS when present so client accepts response
    echoCorsIfAllowed(req, res)

    return res.json({ message: 'Verification email resent if configured' })
  } catch (err) {
    console.error('Resend error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Forgot password - request reset email
router.post('/forgot', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email is required' })

    const user = await User.findOne({ email })
    if (!user) return res.status(200).json({ message: 'If that email exists, a reset link has been sent.' })

    // generate reset token
    const resetToken = crypto.randomBytes(20).toString('hex')
    user.resetPasswordToken = resetToken
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000 // 1 hour
    await user.save()

    // send reset email via Courier if configured
    const courierTemplateId = process.env.COURIER_RESET_TEMPLATE_ID || process.env.COURIER_TEMPLATE_ID
    if (process.env.COURIER_AUTH_TOKEN && courierTemplateId) {
      try {
        const serverBase = `${req.protocol}://${req.get('host')}`
        const resetUrl = `${process.env.CLIENT_URL || serverBase}/auth/reset?token=${resetToken}`
        const payload = {
          message: {
            to: { email },
            template: courierTemplateId,
            data: {
              username: user.username,
              reset_url: resetUrl,
              resetUrl: resetUrl
            }
          }
        }

  try { require('../utils/log').debug('Sending password reset payload to Courier:', { to: email, template: courierTemplateId, resetUrl }) } catch (e) {}

        await fetch('https://api.courier.com/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.COURIER_AUTH_TOKEN}`
          },
          body: JSON.stringify(payload)
        })
      } catch (err) {
        console.error('Failed to send reset email via Courier:', err)
      }
    }

    return res.json({ message: 'If that email exists, a reset link has been sent.' })
  } catch (err) {
    console.error('Forgot password error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Reset password - consume token and set new password
router.post('/reset', async (req, res) => {
  try {
    const { token, newPassword, verifyPassword } = req.body
    if (!token || !newPassword || !verifyPassword) return res.status(400).json({ error: 'Token and new passwords are required' })
    if (newPassword !== verifyPassword) return res.status(400).json({ error: 'Passwords do not match' })
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

    const user = await User.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } })
    if (!user) return res.status(400).json({ error: 'Invalid or expired token' })

  // Assign plaintext password and let User.pre('save') hash it once
  user.password = newPassword
    user.resetPasswordToken = null
    user.resetPasswordExpires = null
    await user.save()

    return res.json({ message: 'Password has been reset. You may now sign in.' })
  } catch (err) {
    console.error('Reset password error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {}

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    // Normalize email input
    const normalizedEmail = (email || '').toString().trim().toLowerCase()

    // Find user by normalized email
    const user = await User.findOne({ email: normalizedEmail })
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // Check if user registered with Google
    if (user.authProvider === 'google') {
      return res.status(401).json({ error: 'Please sign in with Google' })
    }

    // Check password using model helper
    const isPasswordValid = await user.comparePassword(password)
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // Require email verification for local accounts
    if (!user.isEmailVerified) {
      return res.status(403).json({ error: 'Please verify your email before logging in' })
    }

    // Block login for soft-deleted accounts
    if (user.isDeleted) {
      return res.status(403).json({ error: 'Account marked for deletion. Contact support to restore.' })
    }

    // Update last login
    user.lastLoginAt = new Date()

    // Generate tokens
    // Ensure JWT_SECRET is present
    if (!process.env.JWT_SECRET) {
      console.error('Missing JWT_SECRET environment variable')
      return res.status(500).json({ error: 'Server misconfiguration' })
    }

    const token = generateToken(user._id)
    const refreshToken = generateRefreshToken()
    user.refreshToken = refreshToken
    await user.save()

    // Cookie options
    const isProd = process.env.NODE_ENV === 'production'
    const cookieOptions = {
      httpOnly: true,
      // Only set Secure and SameSite=None in production. Browsers will reject
      // SameSite=None cookies that are not Secure. Use 'lax' in development so
      // local testing (http://localhost) works without Secure.
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }

    try {
      // Set token and refreshToken as httpOnly cookies for browsers that use credentials
      res.cookie('token', token, cookieOptions)
      // refresh token longer lived
      res.cookie('refreshToken', refreshToken, Object.assign({}, cookieOptions, { maxAge: 30 * 24 * 60 * 60 * 1000 }))
    } catch (e) {
      console.warn('Failed to set cookies on login response:', e)
    }

    // Return JSON payload for API clients (keeps backward compatibility)
    res.json({
      message: 'Login successful',
      token,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        authProvider: user.authProvider,
        profilePicture: absolutizeUploadUrl(user.profilePicture, req),
        profilePictureSmall: absolutizeUploadUrl(user.profilePictureSmall, req),
        profilePictureThumb: absolutizeUploadUrl(user.profilePictureThumb, req),
        readingsCount: user.readingsCount
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})



// Exchange refresh token for new JWT
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body || {}
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken is required' })
    const user = await User.findOne({ refreshToken })
    if (!user) return res.status(401).json({ error: 'Invalid refresh token' })
    // rotate refresh token
    const newRefresh = generateRefreshToken()
    user.refreshToken = newRefresh
    await user.save()
    const token = generateToken(user._id)
    res.json({ token, refreshToken: newRefresh })
  } catch (err) {
    console.error('Refresh error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get current user
router.get('/me', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        authProvider: user.authProvider,
  profilePicture: absolutizeUploadUrl(user.profilePicture, req),
  profilePictureSmall: absolutizeUploadUrl(user.profilePictureSmall, req),
  profilePictureThumb: absolutizeUploadUrl(user.profilePictureThumb, req),
        readingsCount: user.readingsCount,
        isEmailVerified: user.isEmailVerified,
        isDeleted: user.isDeleted,
        deletedAt: user.deletedAt,
        isAdmin: user.isAdmin,
        softDeleteRetentionDays: Number(process.env.SOFT_DELETE_RETENTION_DAYS || 30),
  createdAt: user.createdAt,
  refreshToken: user.refreshToken || null
      }
    })
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Upload or update profile picture - with robust multer error handling
router.put('/profile-picture', passport.authenticate('jwt', { session: false }), (req, res, next) => {
  // run multer and handle errors here
  upload.single('picture')(req, res, (err) => {
    if (err) {
      // Multer errors
      console.warn('Multer error on profile-picture upload:', err)
      // if file was partially written, remove it
      if (req && req.file && req.file.path) {
        try { fs.unlinkSync(req.file.path) } catch (e) {}
      }
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large (max 5MB)' })
      return res.status(400).json({ error: err.message || 'Upload failed' })
    }
    return next()
  })
}, async (req, res) => {
  try {
  try { require('../utils/log').debug('/api/auth/profile-picture called, req.user id=', req.user && req.user._id ? req.user._id.toString() : null) } catch (e) {}
  try { require('../utils/log').debug('Uploaded file object (multer):', !!req.file, req.file && { originalname: req.file.originalname, size: req.file.size }) } catch (e) {}
    const user = await User.findById(req.user && req.user._id)
    if (!user) return res.status(401).json({ error: 'Unauthorized: user not found' })

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    // Upload original to Vercel Blob
    const originalResult = await uploadToBlob(
      req.file.buffer,
      req.file.originalname,
      'profiles',
      user._id.toString()
    )

    // Prepare resized variants if sharp is available
    const variants = {
      web: originalResult.url,
      small: originalResult.url,
      thumb: originalResult.url
    }

    if (sharp) {
      try {
        // web-ready max 512x512
        const webBuffer = await sharp(req.file.buffer).resize(512, 512, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer()
        const webResult = await uploadToBlob(webBuffer, `${path.parse(req.file.originalname).name}-512.jpg`, 'profiles', user._id.toString())
        variants.web = webResult.url

        // small 256x256
        const smallBuffer = await sharp(req.file.buffer).resize(256, 256, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer()
        const smallResult = await uploadToBlob(smallBuffer, `${path.parse(req.file.originalname).name}-256.jpg`, 'profiles', user._id.toString())
        variants.small = smallResult.url

        // thumb 64x64
        const thumbBuffer = await sharp(req.file.buffer).resize(64, 64, { fit: 'cover' }).jpeg({ quality: 75 }).toBuffer()
        const thumbResult = await uploadToBlob(thumbBuffer, `${path.parse(req.file.originalname).name}-64.jpg`, 'profiles', user._id.toString())
        variants.thumb = thumbResult.url
      } catch (err) {
        console.error('Error resizing image with sharp:', err)
      }
    }

    // Delete old profile pictures if they exist
    if (user.uploadedAvatar && user.profilePicture) {
      try {
        await deleteFromBlob(user.profilePicture)
        await deleteFromBlob(user.profilePictureSmall)
        await deleteFromBlob(user.profilePictureThumb)
      } catch (err) {
        console.warn('Failed to delete old profile pictures:', err)
      }
    }

    // Update user with new blob URLs
    user.profilePicture = variants.web
    user.profilePictureSmall = variants.small
    user.profilePictureThumb = variants.thumb
    user.uploadedAvatar = true
    await user.save()

    res.json({ 
      message: 'Profile picture updated', 
      profilePicture: user.profilePicture, 
      profilePictureSmall: user.profilePictureSmall, 
      profilePictureThumb: user.profilePictureThumb 
    })
  } catch (err) {
    console.error('Profile picture upload error:', err)
    res.status(500).json({ error: 'Internal server error during upload' })
  }
})

// Remove uploaded profile picture
router.delete('/profile-picture', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    // Only allow removal of uploaded avatars (don't remove Google external URLs)
    if (!user.uploadedAvatar) {
      // Clear any profilePicture fields if they exist (but don't delete remote Google image)
      user.profilePicture = user.profilePicture && (user.profilePicture.includes('/uploads/') || user.profilePicture.includes('blob.vercel-storage.com')) ? null : user.profilePicture
      user.profilePictureSmall = user.profilePictureSmall && (user.profilePictureSmall.includes('/uploads/') || user.profilePictureSmall.includes('blob.vercel-storage.com')) ? null : user.profilePictureSmall
      user.profilePictureThumb = user.profilePictureThumb && (user.profilePictureThumb.includes('/uploads/') || user.profilePictureThumb.includes('blob.vercel-storage.com')) ? null : user.profilePictureThumb
      await user.save()
      return res.json({ message: 'Profile picture cleared', profilePicture: user.profilePicture })
    }

    // Delete from Vercel Blob
    try {
      await deleteFromBlob(user.profilePicture)
      await deleteFromBlob(user.profilePictureSmall)
      await deleteFromBlob(user.profilePictureThumb)
    } catch (err) {
      console.warn('Failed to delete blob files:', err)
    }

    user.profilePicture = null
    user.profilePictureSmall = null
    user.profilePictureThumb = null
    user.uploadedAvatar = false
    await user.save()

    res.json({ message: 'Uploaded profile picture removed' })
  } catch (err) {
    console.error('Remove profile picture error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Change username (authenticated)
router.put('/username', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { username } = req.body
    if (!username || typeof username !== 'string' || username.length < 2) {
      return res.status(400).json({ error: 'Invalid username' })
    }

    // check unique username
    const existing = await User.findOne({ username })
    if (existing && existing._id.toString() !== req.user._id.toString()) {
      return res.status(400).json({ error: 'Username already taken' })
    }

    const user = await User.findById(req.user._id)
    user.username = username
    await user.save()

    // update stored user in client side if token still present
    res.json({
      message: 'Username updated',
      user: {
        id: user._id,
        username: user.username,
        profilePicture: user.profilePicture,
        profilePictureSmall: user.profilePictureSmall,
        profilePictureThumb: user.profilePictureThumb,
        isEmailVerified: user.isEmailVerified,
        isDeleted: user.isDeleted
      }
    })
  } catch (err) {
    console.error('Change username error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Change password (authenticated)
router.put('/password', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { currentPassword, newPassword, verifyPassword } = req.body
    if (!currentPassword || !newPassword || !verifyPassword) {
      return res.status(400).json({ error: 'All fields are required' })
    }
    if (newPassword !== verifyPassword) {
      return res.status(400).json({ error: 'New passwords do not match' })
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    const user = await User.findById(req.user._id)
    const isMatch = await user.comparePassword(currentPassword)
    if (!isMatch) return res.status(401).json({ error: 'Current password incorrect' })

  // Assign plaintext password and let User.pre('save') hash it
  user.password = newPassword
    await user.save()

    res.json({ message: 'Password updated successfully' })
  } catch (err) {
    console.error('Change password error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete account (hard delete user and their readings)
router.delete('/delete', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const userId = req.user._id
    const { currentPassword } = req.body || {}

    // For local users, require current password
    const user = await User.findById(userId)
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (user.authProvider === 'local') {
      if (!currentPassword) return res.status(400).json({ error: 'Current password required' })
      const match = await user.comparePassword(currentPassword)
      if (!match) return res.status(401).json({ error: 'Current password incorrect' })
    } else {
      // google users cannot hard-delete via password re-auth; require soft-delete + admin or other flow
      // but allow deletion if provider is google (no password) — optional: block here
    }

  // delete readings associated with the user
  await Reading.deleteMany({ userId: userId.toString() })
  // delete decks owned by the user
  await Deck.deleteMany({ owner: userId.toString() })
  // delete querents for the user
  await Querent.deleteMany({ userId: userId.toString() })

  // delete the user
  await User.findByIdAndDelete(userId)

  console.log(`User ${userId} and their readings, decks, and querents deleted`)
  return res.json({ message: 'Account and all associated data deleted' })
  } catch (err) {
    console.error('Delete account error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Soft-delete (user requests deletion) - marks account as deleted but keeps data
router.post('/delete-request', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const userId = req.user._id
    const user = await User.findById(userId)
    if (!user) return res.status(404).json({ error: 'User not found' })

    user.isDeleted = true
    user.deletedAt = new Date()
    await user.save()

    return res.json({ message: 'Account marked for deletion (soft-delete)' })
  } catch (err) {
    console.error('Soft-delete error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Admin restore endpoint - require admin JWT (isAdmin flag)
router.post('/restore/:userId', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    // only admins may restore
    if (!req.user || !req.user._id) return res.status(401).json({ error: 'Unauthorized' })
    const adminUser = await User.findById(req.user._id)
    if (!adminUser || !adminUser.isAdmin) return res.status(403).json({ error: 'Admin privileges required' })

    const { userId } = req.params
    const user = await User.findById(userId)
    if (!user) return res.status(404).json({ error: 'User not found' })

    user.isDeleted = false
    user.deletedAt = null
    await user.save()

    return res.json({ message: 'User restored' })
  } catch (err) {
    console.error('Restore error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Cancel soft-delete (user can cancel their deletion request)
router.post('/cancel-delete', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    if (!user) return res.status(404).json({ error: 'User not found' })
    user.isDeleted = false
    user.deletedAt = null
    await user.save()
    return res.json({ message: 'Account deletion canceled' })
  } catch (err) {
    console.error('Cancel delete error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Logout (client-side token removal)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logout successful' })
})

// Preview verification payload (local debug only) - does NOT send email
router.get('/preview-verify', (req, res) => {
  const { email } = req.query
  if (!email) return res.status(400).json({ error: 'Email is required' })

  const verificationToken = 'preview-token-12345'
  const serverBase = `${req.protocol}://${req.get('host')}`
  const verifyUrl = `${serverBase}/api/auth/verify?token=${verificationToken}`
  const courierTemplateId = process.env.COURIER_VERIFY_TEMPLATE_ID || process.env.COURIER_TEMPLATE_ID || process.env.COURIER_RESET_TEMPLATE_ID || null

  const payload = {
    message: {
      to: { email },
      template: courierTemplateId,
      data: {
        username: 'preview-user',
        verify_url: verifyUrl,
        verifyUrl: verifyUrl
      }
    }
  }

  res.json({ payload })
})

// Google OAuth routes
// Initiate Google OAuth flow
router.get('/google', passport.authenticate('google', { 
  scope: ['profile', 'email'] 
}))

// Google OAuth callback
router.get('/google/callback', 
  passport.authenticate('google', { session: false }),
  async (req, res) => {
    try {
      echoCorsIfAllowed(req, res)
      
      if (!req.user) {
        console.error('Google OAuth callback: No user found')
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000'
        return res.redirect(`${clientUrl}/auth/error?error=oauth_failed`)
      }

      // Generate JWT token
      const token = generateToken(req.user._id)
      
      // For cross-domain deployments, we need to relay the token to the frontend
      // so it can set its own cookie. We'll create a temporary, secure redirect.
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000'
      
      // Check if we're dealing with cross-origin (different domains)
      const backendHost = req.get('host') || ''
      const clientHost = clientUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
      const isCrossOrigin = backendHost !== clientHost && !clientUrl.includes('localhost')
      
      if (isCrossOrigin) {
        // For cross-origin: redirect with token in URL (will be handled by frontend)
        // This is secure because: 1) HTTPS only, 2) immediate consumption, 3) frontend clears URL
        console.log('Cross-origin OAuth detected, using token relay method')
        return res.redirect(`${clientUrl}/auth/success?provider=google&token=${encodeURIComponent(token)}`)
      } else {
        // Same-origin: use traditional cookie method
        res.cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        })
        return res.redirect(`${clientUrl}/auth/success?provider=google`)
      }
      
    } catch (error) {
      console.error('Google OAuth callback error:', error)
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000'
      res.redirect(`${clientUrl}/auth/error?error=oauth_callback_failed`)
    }
  }
)

// Token relay endpoint - allows frontend to exchange OAuth token for cookie
router.post('/token-relay', async (req, res) => {
  try {
    echoCorsIfAllowed(req, res)
    
    const { token } = req.body
    if (!token) {
      return res.status(400).json({ error: 'Token is required' })
    }

    // Verify the token is valid
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const user = await User.findById(decoded.userId)
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid token - user not found' })
      }

      // Token is valid, return user data (don't set cookie here - frontend will handle it)
      res.json({
        success: true,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          authProvider: user.authProvider,
          profilePicture: absolutizeUploadUrl(user.profilePicture, req),
          profilePictureSmall: absolutizeUploadUrl(user.profilePictureSmall, req),
          profilePictureThumb: absolutizeUploadUrl(user.profilePictureThumb, req),
          readingsCount: user.readingsCount
        },
        token // Return the token so frontend can set its own cookie
      })
      
    } catch (jwtError) {
      console.error('Token relay - Invalid JWT:', jwtError)
      return res.status(401).json({ error: 'Invalid token' })
    }
    
  } catch (error) {
    console.error('Token relay error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
