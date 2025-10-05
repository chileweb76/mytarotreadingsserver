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
  
  // Set content and wait for network idle
  await page.setContent(html, { waitUntil: 'networkidle0' })
  
  const pdfBuffer = await page.pdf(Object.assign({ 
    format: 'A4', 
    printBackground: true 
  }, options))
  
  await page.close()
  return pdfBuffer
}

async function closeBrowser() {
  if (browser) {
    try { await browser.close() } catch (e) { console.warn('Failed closing Puppeteer browser', e) }
    browser = null
  }
}

module.exports = { renderPdfFromHtml, launchBrowser, closeBrowser }
