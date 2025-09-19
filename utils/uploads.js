const fs = require('fs')
const path = require('path')
const os = require('os')

// Returns a writable uploads directory. Tries project `uploads/` first and
// creates nested segments if provided. If creation fails (read-only FS)
// falls back to a per-app folder inside the system temp dir.
function getUploadsDir(...segments) {
  const projectUploads = path.join(__dirname, '..', 'uploads')
  try {
    // ensure base exists
    if (!fs.existsSync(projectUploads)) fs.mkdirSync(projectUploads, { recursive: true })

    // create nested segments
    let current = projectUploads
    for (const seg of segments) {
      current = path.join(current, seg)
      if (!fs.existsSync(current)) fs.mkdirSync(current, { recursive: true })
    }
    return path.join(projectUploads, ...segments)
  } catch (err) {
    // fallback to os.tmpdir() if project folder is not writable (e.g., Vercel /var/task)
    try {
      const fallback = path.join(os.tmpdir(), 'mytarot_uploads', ...segments)
      if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true })
      return fallback
    } catch (e) {
      // Last resort: return system temp dir
      return os.tmpdir()
    }
  }
}

module.exports = { getUploadsDir }
