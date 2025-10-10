const puppeteer = require('puppeteer-core')
const chromium = require('@sparticuz/chromium')

let browser = null

async function launchBrowser() {
  if (browser) return browser
  
  // Determine if running in production (Vercel) or local dev
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
  
  if (isProd) {
    // Use serverless Chromium for Vercel
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    })
  } else {
    // Use local Chromium for development
    // You need to have Chrome/Chromium installed locally
    const chromePath = process.platform === 'darwin' 
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : process.platform === 'win32'
      ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      : '/usr/bin/google-chrome'
    
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
  }
  
  return browser
}

async function renderPdfFromHtml(html, options = {}) {
  const browser = await launchBrowser()
  const page = await browser.newPage()
  
  await page.setViewport({ width: 1280, height: 800 })

  // Increase default navigation timeout to allow slower environments (serverless cold starts)
  // Use a higher ceiling than Puppeteer's default (30s). We still try to keep things bounded.
  try {
    page.setDefaultNavigationTimeout(120000) // 120s
  } catch (e) {
    // ignore if runtime doesn't support it
  }

  // Collect console and page errors for diagnostics (useful in server logs)
  const diagnostics = { console: [], pageErrors: [] }
  try {
    page.on && page.on('console', (msg) => {
      try { diagnostics.console.push({ type: msg.type && msg.type(), text: msg.text && msg.text() }) } catch (e) {}
    })
    page.on && page.on('pageerror', (err) => {
      try { diagnostics.pageErrors.push(String(err)) } catch (e) {}
    })
  } catch (e) {
    // ignore if events can't be attached
  }

  // Try a robust sequence: prefer networkidle0, but fall back to domcontentloaded or no-wait
  let setContentErr = null
  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 })
  } catch (err) {
    setContentErr = err
    console.warn('renderPdfFromHtml: setContent(networkidle0) failed or timed out, retrying with domcontentloaded', err && err.message ? err.message : err)
    try {
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 })
    } catch (err2) {
      console.warn('renderPdfFromHtml: setContent(domcontentloaded) failed, retrying without wait', err2 && err2.message ? err2.message : err2)
      try {
        await page.setContent(html, { timeout: 30000 })
      } catch (err3) {
        // Keep the last error for reporting
        const finalErr = err3 || err2 || err
        console.error('renderPdfFromHtml: setContent failed after retries', finalErr && finalErr.stack ? finalErr.stack : finalErr)
        try { await page.close() } catch (e) {}
        // Attach diagnostics to the thrown error for higher-level logging
        finalErr.diagnostics = diagnostics
        throw finalErr
      }
    }
  }

  try {
    const pdfBuffer = await page.pdf(Object.assign({ 
      format: 'A4', 
      printBackground: true 
    }, options))
    try { await page.close() } catch (e) { console.warn('Failed to close page after pdf generation', e) }
    return pdfBuffer
  } catch (pdfErr) {
    // Surface diagnostics to logs to help debugging timeouts or render errors
    try {
      console.error('renderPdfFromHtml: PDF generation failed', pdfErr && pdfErr.stack ? pdfErr.stack : pdfErr)
      console.error('renderPdfFromHtml: setContent error (if any):', setContentErr && (setContentErr.stack || setContentErr.message || setContentErr))
      console.error('renderPdfFromHtml: recent console messages (truncated):', diagnostics.console.slice(-20))
      console.error('renderPdfFromHtml: recent page errors (truncated):', diagnostics.pageErrors.slice(-10))
    } catch (logErr) {
      // ignore logging errors
    }
    try { await page.close() } catch (e) { console.warn('Failed to close page after pdf error', e) }
    throw pdfErr
  }
}

async function closeBrowser() {
  if (browser) {
    try { await browser.close() } catch (e) { console.warn('Failed closing Puppeteer browser', e) }
    browser = null
  }
}

module.exports = { renderPdfFromHtml, launchBrowser, closeBrowser }
