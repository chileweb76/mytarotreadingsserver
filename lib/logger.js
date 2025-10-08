// Server-side logger (CommonJS)
// Usage: const logger = require('./lib/logger')
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 }

function getLevelFromEnv() {
  const env = process.env.LOG_LEVEL || process.env.NODE_ENV === 'development' ? 'debug' : 'warn'
  if (process.env.LOG_LEVEL && LEVELS[process.env.LOG_LEVEL]) return process.env.LOG_LEVEL
  if (process.env.NODE_ENV === 'development') return 'debug'
  return 'info'
}

let current = getLevelFromEnv()
let currentVal = LEVELS[current] || LEVELS.info

const safeConsole = console

function shouldLog(name) {
  const v = LEVELS[name]
  if (!v) return false
  return v >= currentVal
}

function prefix(args) {
  return ['[tarot-server]', ...args]
}

module.exports = {
  setLevel(name) { if (LEVELS[name]) { current = name; currentVal = LEVELS[name] } },
  getLevel() { return current },
  debug(...args) { if (shouldLog('debug')) safeConsole.debug(...prefix(args)) },
  info(...args) { if (shouldLog('info')) safeConsole.info(...prefix(args)) },
  warn(...args) { if (shouldLog('warn')) safeConsole.warn(...prefix(args)) },
  error(...args) { if (shouldLog('error')) safeConsole.error(...prefix(args)) },
  log(...args) { if (shouldLog('info')) safeConsole.log(...prefix(args)) }
}
