import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const url = process.argv[2] || 'http://localhost:3000';
const width = Number(process.argv[3]) || 1440;
const dsf = Number(process.argv[4]) || 2;
const dir = 'temporary screenshots';
await mkdir(dir, { recursive: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width, height: 1000, deviceScaleFactor: dsf });
await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
await page.evaluate(() => document.querySelectorAll('.reveal').forEach(e => e.classList.add('in')));
await new Promise(r => setTimeout(r, 600));

const targets = [
  ['hero', 'section.hero'],
  ['about', '#about'],
  ['services', '#services'],
  ['menu', '#menu'],
  ['facts', 'section.facts'],
  ['portfolio', '#portfolio'],
  ['reviews', '#reviews'],
  ['book', '#book'],
  ['cta', 'section.cta'],
  ['footer', 'footer.footer'],
];
for (const [name, selector] of targets) {
  const el = await page.$(selector);
  if (!el) { console.log('MISSING', selector); continue; }
  await el.screenshot({ path: `${dir}/sec-${name}.png` });
  console.log('Saved', `sec-${name}.png`);
}
await browser.close();
