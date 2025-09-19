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

// Multer setup for uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '..', 'uploads'))
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname)
    // Be defensive: req.user may be missing in some edge cases; fall back to random name
    let idPart
    try {
      idPart = req && req.user && req.user._id ? req.user._id.toString() : null
    } catch (e) {
      idPart = null
    }
    if (!idPart) {
      const crypto = require('crypto')
      idPart = crypto.randomBytes(6).toString('hex')
    }
    const fname = `${idPart}-${Date.now()}${ext}`
    // ensure uploads dir exists
    try {
      const uploadsDir = path.join(__dirname, '..', 'uploads')
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
    } catch (e) {
      // ignore - write will fail later and be handled
      console.warn('Could not ensure uploads dir exists', e)
    }
    cb(null, fname)
  }
})
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }) // 5MB

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' })
}

// Generate a refresh token (long-lived random string)
const generateRefreshToken = () => {
  return crypto.randomBytes(32).toString('hex')
}

// Ensure uploads URLs are absolute (prefix with SERVER_URL or request host)
function absolutizeUploadUrl(url, req) {
  if (!url) return url
  try {
    // already absolute
    const parsed = new URL(url)
    if (parsed.protocol && parsed.hostname) return url
  } catch (e) {
    // not absolute
  }
  if (url.startsWith('/uploads/')) {
    const serverBase = process.env.SERVER_URL || `${req.protocol}://${req.get('host')}`
    return `${serverBase.replace(/\/$/, '')}${url}`
  }
  return url
}

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, verifyPassword } = req.body

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

  await user.save()

  // send verification email via Courier (if configured)
    // Prefer a verify-specific template, fallback to generic template envs when present
    const courierTemplateId = process.env.COURIER_VERIFY_TEMPLATE_ID || process.env.COURIER_TEMPLATE_ID || process.env.COURIER_RESET_TEMPLATE_ID
    if (process.env.COURIER_AUTH_TOKEN && courierTemplateId) {
      try {
  // build a server-side verify URL so the link hits this API's /api/auth/verify route
  const serverBase = `${req.protocol}://${req.get('host')}`
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

        // debug log (no sensitive tokens)
        console.debug('Sending verification email payload to Courier:', { to: email, template: courierTemplateId, verifyUrl })

        await fetch('https://api.courier.com/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.COURIER_AUTH_TOKEN}`
          },
          body: JSON.stringify(payload)
        })
      } catch (err) {
        console.error('Failed to send verification email:', err)
      }
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
    console.error('Registration error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Verify email route
router.get('/verify', async (req, res) => {
  try {
    const { token } = req.query
    if (!token) return res.status(400).json({ error: 'Token is required' })

    const user = await User.findOne({ verificationToken: token, verificationExpires: { $gt: Date.now() } })
    if (!user) return res.status(400).json({ error: 'Invalid or expired token' })

    user.isEmailVerified = true
    user.verificationToken = null
    user.verificationExpires = null
    await user.save()

    // redirect to client success page
    return res.redirect(`${process.env.CLIENT_URL}/auth/success?verified=true`)
  } catch (err) {
    console.error('Verification error:', err)
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
    await user.save()

    // send via Courier if configured
    const courierTemplateId = process.env.COURIER_VERIFY_TEMPLATE_ID || process.env.COURIER_TEMPLATE_ID || process.env.COURIER_RESET_TEMPLATE_ID
    if (process.env.COURIER_AUTH_TOKEN && courierTemplateId) {
      try {
  // build a server-side verify URL so the link hits this API's /api/auth/verify route
  const serverBase = `${req.protocol}://${req.get('host')}`
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

        console.debug('Resend verification payload to Courier:', { to: email, template: courierTemplateId, verifyUrl })

        await fetch('https://api.courier.com/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.COURIER_AUTH_TOKEN}`
          },
          body: JSON.stringify(payload)
        })
      } catch (err) {
        console.error('Failed to send verification email:', err)
      }
    }

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

        console.debug('Sending password reset payload to Courier:', { to: email, template: courierTemplateId, resetUrl })

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
    const { email, password } = req.body

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    // Find user
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // Check if user registered with Google
    if (user.authProvider === 'google') {
      return res.status(401).json({ error: 'Please sign in with Google' })
    }

    // Check password
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
    await user.save()

    // Generate token
    const token = generateToken(user._id)
      // issue refresh token and persist
      const refreshToken = generateRefreshToken()
      user.refreshToken = refreshToken
      await user.save()

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

// Google OAuth routes (only if configured)
router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(400).json({ error: 'Google OAuth not configured' })
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next)
})

router.get('/google/callback', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.redirect(`${process.env.CLIENT_URL}/auth/error`)
  }
  passport.authenticate('google', { session: false })(req, res, next)
}, async (req, res) => {
  try {
    // Generate token
    const token = generateToken(req.user._id)
    
    // Update last login
    req.user.lastLoginAt = new Date()
    await req.user.save()

  // generate refresh token and save
  const refreshToken = generateRefreshToken()
  req.user.refreshToken = refreshToken
  await req.user.save()

    // Redirect to frontend with token and refresh token
    // Note: we only send token in URL; client will call /auth/me to get refresh token via JSON when it exchanges the token.
    res.redirect(`${process.env.CLIENT_URL}/auth/success?token=${token}`)
  } catch (error) {
    console.error('Google callback error:', error)
    res.redirect(`${process.env.CLIENT_URL}/auth/error`)
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
    console.debug('/api/auth/profile-picture called, req.user id=', req.user && req.user._id ? req.user._id.toString() : null)
    console.debug('Uploaded file object (multer):', !!req.file, req.file && { originalname: req.file.originalname, filename: req.file.filename, size: req.file.size })
    const user = await User.findById(req.user && req.user._id)
    if (!user) return res.status(401).json({ error: 'Unauthorized: user not found' })

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    const uploadsDir = path.join(__dirname, '..', 'uploads')
    const serverBase = process.env.SERVER_URL || `${req.protocol}://${req.get('host')}`
    const originalFilename = req.file.filename
    const originalPath = path.join(uploadsDir, originalFilename)

    // Prepare resized variants if sharp is available
    const variants = {}
    if (sharp) {
      try {
        // web-ready max 512x512
        const webName = `${path.parse(originalFilename).name}-512${path.parse(originalFilename).ext}`
        const webPath = path.join(uploadsDir, webName)
        await sharp(originalPath).resize(512, 512, { fit: 'cover' }).toFile(webPath)
        variants.web = `${serverBase.replace(/\/$/, '')}/uploads/${webName}`

        // small 256x256
        const smallName = `${path.parse(originalFilename).name}-256${path.parse(originalFilename).ext}`
        const smallPath = path.join(uploadsDir, smallName)
        await sharp(originalPath).resize(256, 256, { fit: 'cover' }).toFile(smallPath)
        variants.small = `${serverBase.replace(/\/$/, '')}/uploads/${smallName}`

        // thumb 64x64
        const thumbName = `${path.parse(originalFilename).name}-64${path.parse(originalFilename).ext}`
        const thumbPath = path.join(uploadsDir, thumbName)
        await sharp(originalPath).resize(64, 64, { fit: 'cover' }).toFile(thumbPath)
        variants.thumb = `${serverBase.replace(/\/$/, '')}/uploads/${thumbName}`
      } catch (err) {
        console.error('Error resizing image with sharp:', err)
      }
    }

    // Prefer the web-sized variant for profilePicture when available
    user.profilePicture = variants.web || `${serverBase.replace(/\/$/, '')}/uploads/${originalFilename}`
    user.profilePictureSmall = variants.small || user.profilePicture
    user.profilePictureThumb = variants.thumb || user.profilePicture
    user.uploadedAvatar = true
    await user.save()

    res.json({ message: 'Profile picture updated', profilePicture: user.profilePicture, profilePictureSmall: user.profilePictureSmall, profilePictureThumb: user.profilePictureThumb })
  } catch (err) {
    console.error('Profile picture upload error:', err)
    // cleanup partial files if present
    if (req && req.file && req.file.path) {
      try { fs.unlinkSync(req.file.path) } catch (e) {}
    }
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
      // clear any profilePicture fields if they exist (but don't delete remote Google image)
      user.profilePicture = user.profilePicture && user.profilePicture.includes('/uploads/') ? null : user.profilePicture
      user.profilePictureSmall = user.profilePictureSmall && user.profilePictureSmall.includes('/uploads/') ? null : user.profilePictureSmall
      user.profilePictureThumb = user.profilePictureThumb && user.profilePictureThumb.includes('/uploads/') ? null : user.profilePictureThumb
      await user.save()
      return res.json({ message: 'Profile picture cleared', profilePicture: user.profilePicture })
    }

    const uploadsDir = path.join(__dirname, '..', 'uploads')
    const deleteIfExists = async (url) => {
      if (!url) return
      try {
        const parsed = new URL(url)
        // ensure this is our uploads path
        if (parsed.pathname && parsed.pathname.startsWith('/uploads/')) {
          const fname = path.basename(parsed.pathname)
          const p = path.join(uploadsDir, fname)
          const fs = require('fs')
          if (fs.existsSync(p)) fs.unlinkSync(p)
        }
      } catch (err) {
        // ignore
      }
    }

    // remove variants
    await deleteIfExists(user.profilePicture)
    await deleteIfExists(user.profilePictureSmall)
    await deleteIfExists(user.profilePictureThumb)

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

module.exports = router
