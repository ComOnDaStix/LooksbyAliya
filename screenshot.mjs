import puppeteer from 'puppeteer-core';
import { mkdir, readdir } from 'node:fs/promises';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const url = process.argv[2] || 'http://localhost:3000';
const label = process.argv[3] || '';
const width = Number(process.argv[4]) || 1440;
const mobile = width < 600;

const dir = 'temporary screenshots';
await mkdir(dir, { recursive: true });
let n = 1;
try {
  const files = await readdir(dir);
  const nums = files.map(f => Number((f.match(/screenshot-(\d+)/) || [])[1])).filter(Boolean);
  if (nums.length) n = Math.max(...nums) + 1;
} catch {}
const out = `${dir}/screenshot-${n}${label ? '-' + label : ''}.png`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width, height: mobile ? 900 : 1000, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
// force-reveal all scroll-animation content so the static capture isn't blank
await page.evaluate(() => document.querySelectorAll('.reveal').forEach(e => e.classList.add('in')));
await new Promise(r => setTimeout(r, 700));
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('Saved', out);
