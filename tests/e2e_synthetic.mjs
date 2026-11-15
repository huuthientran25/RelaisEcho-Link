// Optional browser test: runs a full scan on the synthetic video with mock landmarks.
// Setup: npm i -D puppeteer-core ; python3 scripts/make_synthetic_video.py /tmp/synth.y4m ; npm run serve (other terminal)
// Run:   CHROME=/path/to/chrome node tests/e2e_synthetic.mjs   -> expect 72 bpm and 15 /min
import puppeteer from 'puppeteer-core';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    `--use-file-for-fake-video-capture=${process.env.Y4M || '/tmp/synth.y4m'}`, '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() !== 'log') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.setViewport({ width: 1000, height: 1000 });
await page.goto('http://localhost:8080/?mock=1', { waitUntil: 'networkidle0' });
await page.evaluate(() => indexedDB.deleteDatabase('relaisecho-link'));
await page.reload({ waitUntil: 'networkidle0' });
await page.click('[data-nav=setup]'); await sleep(400);
await page.click('#setupForm button[type=submit]');
await sleep(12000);
console.log('chips:', await page.$eval('#chips', (e) => e.textContent.trim()), '|', await page.$eval('#coach', (e) => e.textContent), '|', await page.$eval('#usableText', (e) => e.textContent), '|', await page.$eval('#livePulse', (e) => e.textContent));
await page.screenshot({ path: '/tmp/synth-scan.png' });
for (let i = 0; i < 60; i++) {
  const vis = await page.$eval('main', (m) => [...m.querySelectorAll('.screen')].find((s) => !s.hidden)?.id);
  if (vis === 'screen-results') break;
  await sleep(1000);
}
console.log('pulse:', (await page.$eval('#pulseCard', (e) => e.innerText)).replace(/\n+/g, ' | '));
console.log('resp:', (await page.$eval('#respCard', (e) => e.innerText)).replace(/\n+/g, ' | '));
console.log('cmp:', (await page.$eval('#cmpTable', (e) => e.innerText)).replace(/\n+/g, ' | '));
await page.screenshot({ path: '/tmp/synth-results.png', fullPage: true });
console.log(logs.join('\n') || 'no warnings or errors');
await browser.close();
