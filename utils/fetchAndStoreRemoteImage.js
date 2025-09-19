const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')
const { URL } = require('url')
let sharp
try { sharp = require('sharp') } catch (e) { /* graceful fallback */ }
const crypto = require('crypto')

// Downloads a remote image, validates simple content-type, writes to uploads and
// creates resized variants if sharp is available. Returns object with web/small/thumb URLs.
module.exports = async function fetchAndStoreRemoteImage(remoteUrl, serverBase, hintName = 'avatar') {
  if (!remoteUrl) return null
  let parsed
  try {
    parsed = new URL(remoteUrl)
    if (!['http:', 'https:'].includes(parsed.protocol)) return null
  } catch (err) {
    return null
  }

  const uploadsDir = path.join(__dirname, '..', 'uploads')
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

  const ext = path.extname(parsed.pathname) || '.jpg'
  const safe = crypto.randomBytes(8).toString('hex')
  const baseName = `${hintName}-${Date.now()}-${safe}`
  const originalName = `${baseName}${ext}`
  const originalPath = path.join(uploadsDir, originalName)

  // Download with size limit
  const MAX_BYTES = 5 * 1024 * 1024 // 5MB

  const getter = parsed.protocol === 'https:' ? https : http

  const downloaded = await new Promise((resolve, reject) => {
    const req = getter.get(parsed.href, (res) => {
      const status = res.statusCode
      if (status >= 300 && status < 400 && res.headers.location) {
        // follow redirect (simple)
        return resolve(module.exports(res.headers.location, serverBase, hintName))
      }

      if (status !== 200) return reject(new Error('Failed to fetch image: ' + status))

      const contentType = res.headers['content-type'] || ''
      if (!contentType.startsWith('image/')) return reject(new Error('Not an image content-type'))

      const writeStream = fs.createWriteStream(originalPath)
      let downloadedBytes = 0
      res.on('data', chunk => {
        downloadedBytes += chunk.length
        if (downloadedBytes > MAX_BYTES) {
          req.destroy()
          writeStream.destroy()
          try { fs.unlinkSync(originalPath) } catch (e) {}
          return reject(new Error('Image too large'))
        }
      })
      res.pipe(writeStream)
      writeStream.on('finish', () => resolve(true))
      writeStream.on('error', err => reject(err))
    })
    req.on('error', reject)
    req.setTimeout(15000, () => {
      req.destroy()
      reject(new Error('Timeout fetching remote image'))
    })
  }).catch(err => { console.warn('fetchAndStoreRemoteImage download failed', err); return null })

  if (!downloaded) return null

  const variants = {}
  try {
    if (sharp) {
      const webName = `${baseName}-512${ext}`
      const smallName = `${baseName}-256${ext}`
      const thumbName = `${baseName}-64${ext}`

      await sharp(originalPath).resize(512, 512, { fit: 'cover' }).toFile(path.join(uploadsDir, webName))
      await sharp(originalPath).resize(256, 256, { fit: 'cover' }).toFile(path.join(uploadsDir, smallName))
      await sharp(originalPath).resize(64, 64, { fit: 'cover' }).toFile(path.join(uploadsDir, thumbName))

      variants.web = `${serverBase.replace(/\/$/, '')}/uploads/${webName}`
      variants.small = `${serverBase.replace(/\/$/, '')}/uploads/${smallName}`
      variants.thumb = `${serverBase.replace(/\/$/, '')}/uploads/${thumbName}`
    } else {
      // no sharp: use original for all
      variants.web = variants.small = variants.thumb = `${serverBase.replace(/\/$/, '')}/uploads/${originalName}`
    }
  } catch (err) {
    console.warn('fetchAndStoreRemoteImage resize failed', err)
    // fallback: set original
    variants.web = variants.small = variants.thumb = `${serverBase.replace(/\/$/, '')}/uploads/${originalName}`
  }

  return variants
}
