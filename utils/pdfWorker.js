const playwright = require('playwright')

let browser = null

async function launchBrowser() {
  if (browser) return browser
  // Launch a single Chromium instance for reuse
  browser = await playwright.chromium.launch({ headless: true })
  return browser
}

async function renderPdfFromHtml(html, options = {}) {
  const browser = await launchBrowser()
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  // Set content and wait for network idle
  await page.setContent(html, { waitUntil: 'networkidle' })
  const pdfBuffer = await page.pdf(Object.assign({ format: 'A4', printBackground: true }, options))
  await page.close()
  await context.close()
  return pdfBuffer
}

async function closeBrowser() {
  if (browser) {
    try { await browser.close() } catch (e) { console.warn('Failed closing Playwright browser', e) }
    browser = null
  }
}

module.exports = { renderPdfFromHtml, launchBrowser, closeBrowser }
