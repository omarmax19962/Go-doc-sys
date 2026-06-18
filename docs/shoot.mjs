import { chromium } from 'playwright-core'

const EXEC = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
const SITE = 'https://go-doc-sys.vercel.app'
const OUT = new URL('./img/', import.meta.url).pathname
const EMAIL = 'sophia@godoc.com'
const PASS = 'GoDoc@2026'

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const browser = await chromium.launch({ executablePath: EXEC })
const ctx = await browser.newContext({ viewport: { width: 430, height: 920 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()

await page.goto(SITE, { waitUntil: 'networkidle' })
await sleep(800)

// Login screen — select Doctor tab
await page.getByRole('button', { name: 'Doctor', exact: true }).click()
await sleep(400)
await page.screenshot({ path: OUT + 'login.png' })
console.log('shot login')

// Sign in
await page.locator('input[type=email]').fill(EMAIL)
await page.locator('input[type=password]').fill(PASS)
await page.getByRole('button', { name: /Sign in/i }).click()

// wait for doctor home
await page.waitForFunction(() => /slots\/wk|upcoming/.test(document.body.innerText), { timeout: 20000 }).catch(()=>{})
await sleep(1500)

const tabs = [['Visits','visits'],['Calendar','calendar'],['Patients','patients'],['Availability','availability']]
for (const [label, file] of tabs) {
  try {
    await page.getByRole('button', { name: label, exact: true }).first().click()
    await sleep(1200)
    await page.screenshot({ path: OUT + file + '.png' })
    console.log('shot', file)
  } catch (e) { console.log('FAIL', file, String(e).slice(0,120)) }
}

await browser.close()
console.log('done')
