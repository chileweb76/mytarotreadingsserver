// Minimal logging helper: ensure debug is available across runtimes
const debug = (...args) => {
  if (console && typeof console.debug === 'function') return console.debug(...args)
  if (console && typeof console.log === 'function') return console.log(...args)
}

module.exports = { debug }
