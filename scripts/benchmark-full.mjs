import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const playwrightPath = resolve(
  projectRoot,
  '..',
  'firepixel',
  'node_modules',
  '@playwright',
  'test',
  'index.mjs',
);
const { chromium } = await import(pathToFileURL(playwrightPath));

const coldRuns = positiveInteger(process.env.COLD_RUNS, 5);
const burstTrials = positiveInteger(process.env.BURST_TRIALS, 3);
const burstConcurrency = positiveInteger(process.env.BURST_CONCURRENCY, 6);
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const outputPath = resolve(process.argv[2] || join(projectRoot, 'results', 'full-browser-2026-09-01.json'));

const mirrors = [
  {
    id: 'cloudflare-pages',
    label: 'Cloudflare Pages',
    protocol: 'HTTP/2',
    url: 'https://firepixel-hostoff.pages.dev/full/',
  },
  {
    id: 'github-pages',
    label: 'GitHub Pages',
    protocol: 'HTTP/2',
    url: 'https://discontinuitythesis.github.io/firepixel-hostoff/full/',
  },
  {
    id: 'mechanicweb',
    label: 'MechanicWeb',
    protocol: 'HTTP/2',
    url: 'https://unitcostdominance.com/hostoff/full/',
  },
  {
    id: 'hetzner-cx43-tunnel',
    label: 'Hetzner CX43 through Tunnel',
    protocol: 'HTTP/2',
    url: 'https://firepixel.co.uk/hostoff/full/',
  },
  {
    id: 'hetzner-cx43-direct',
    label: 'Hetzner CX43 direct',
    protocol: 'HTTP/2',
    url: 'https://hostoff.firepixel.co.uk/full/',
  },
  {
    id: 'hetzner-cx23',
    label: 'Hetzner CX23',
    protocol: 'HTTP/1.1',
    url: 'http://178.105.83.180/hostoff/full/',
  },
];

const launchOptions = {
  headless: true,
  args: [
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-sync',
    '--metrics-recording-only',
    '--no-first-run',
  ],
};
if (existsSync(chromePath)) launchOptions.executablePath = chromePath;

const cold = [];
for (let round = 0; round < coldRuns; round += 1) {
  for (const mirror of rotatedMirrors(round)) {
    const measurement = await measureCold(mirror);
    cold.push({ round: round + 1, ...mirror, ...measurement });
    console.log(
      `cold ${round + 1}/${coldRuns} ${mirror.label}: ` +
      `${measurement.ttfbMs} ms TTFB, ${measurement.lcpMs} ms LCP, ` +
      `${measurement.loadMs} ms load, ${measurement.transferBytes} B`,
    );
  }
}

const bursts = [];
for (let trial = 0; trial < burstTrials; trial += 1) {
  for (const mirror of rotatedMirrors(trial + 2)) {
    const measurement = await measureBurst(mirror, burstConcurrency);
    bursts.push({ trial: trial + 1, ...mirror, ...measurement });
    console.log(
      `burst ${trial + 1}/${burstTrials} ${mirror.label}: ` +
      `${measurement.pagesPerSecond} pages/s, p95 ${measurement.p95LoadMs} ms, ` +
      `${measurement.failures} failures`,
    );
  }
}

const summary = mirrors.map((mirror) => summarize(
  mirror,
  cold.filter((item) => item.id === mirror.id),
  bursts.filter((item) => item.id === mirror.id),
));

const result = {
  schemaVersion: '1.0',
  generatedAt: new Date().toISOString(),
  client: {
    location: 'Dublin, Ireland',
    browser: 'local headless Google Chrome',
    coldDefinition: 'A new Chrome process and browser context for every navigation.',
  },
  fixture: {
    path: '/full/',
    storedBytes: 329864,
    indexSha256: '35bbe17938a2da4c1fac521cdc0ec0bb19c196924cc8592bd34ec82f96f5f9e8',
    expectedRequests: 9,
  },
  settings: { coldRuns, burstTrials, burstConcurrency },
  summary,
  cold,
  bursts,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(`\nWrote ${outputPath}`);
console.table(summary);

async function measureCold(mirror) {
  const browser = await chromium.launch(launchOptions);
  try {
    const context = await browser.newContext({
      viewport: { width: 1365, height: 768 },
      deviceScaleFactor: 1,
      serviceWorkers: 'block',
    });
    const measurement = await measurePage(context, mirror.url);
    await context.close();
    return measurement;
  } finally {
    await browser.close();
  }
}

async function measureBurst(mirror, concurrency) {
  const browser = await chromium.launch(launchOptions);
  const contexts = await Promise.all(Array.from({ length: concurrency }, () => browser.newContext({
    viewport: { width: 1365, height: 768 },
    deviceScaleFactor: 1,
    serviceWorkers: 'block',
  })));
  const preparedPages = await Promise.all(contexts.map((context) => preparePage(context)));

  const startedAt = performance.now();
  try {
    const pages = await Promise.all(preparedPages.map((prepared) => measurePreparedPage(prepared, mirror.url)));
    const wallMs = performance.now() - startedAt;
    const failures = pages.reduce((total, page) => total + page.failures, 0);
    return {
      concurrency,
      wallMs: rounded(wallMs),
      pagesPerSecond: rounded((concurrency * 1000) / wallMs, 2),
      medianTtfbMs: rounded(median(pages.map((page) => page.ttfbMs))),
      medianLcpMs: rounded(median(pages.map((page) => page.lcpMs))),
      medianLoadMs: rounded(median(pages.map((page) => page.loadMs))),
      p95LoadMs: rounded(percentile(pages.map((page) => page.loadMs), 0.95)),
      totalTransferBytes: pages.reduce((total, page) => total + page.transferBytes, 0),
      failures,
      pages,
    };
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
    await browser.close();
  }
}

async function measurePage(context, url) {
  return measurePreparedPage(await preparePage(context), url);
}

async function preparePage(context) {
  const page = await context.newPage();
  const failedRequests = [];
  const badResponses = [];

  page.on('requestfailed', (request) => {
    failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' });
  });
  page.on('response', (response) => {
    if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() });
  });

  await page.addInitScript(() => {
    window.__hostoffVitals = { cls: 0, lcp: 0 };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__hostoffVitals.lcp = entry.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__hostoffVitals.cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });

  return { page, failedRequests, badResponses };
}

async function measurePreparedPage({ page, failedRequests, badResponses }, url) {
  const wallStartedAt = performance.now();
  const response = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);

  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource');
    const firstContentfulPaint = performance.getEntriesByName('first-contentful-paint')[0];
    const image = document.querySelector('main img');
    const localResources = resources.filter((entry) => entry.name.startsWith(location.origin));
    const externalResources = resources.filter((entry) => !entry.name.startsWith(location.origin));
    return {
      url: location.href,
      title: document.title,
      canonical: document.querySelector('link[rel="canonical"]')?.href || null,
      robots: document.querySelector('meta[name="robots"]')?.content || null,
      ttfbMs: navigation.responseStart,
      domContentLoadedMs: navigation.domContentLoadedEventEnd,
      loadMs: navigation.loadEventEnd,
      fcpMs: firstContentfulPaint?.startTime || 0,
      lcpMs: window.__hostoffVitals.lcp,
      cls: window.__hostoffVitals.cls,
      requestCount: localResources.length + 1,
      externalRequestCount: externalResources.length,
      transferBytes: navigation.transferSize + localResources.reduce((total, entry) => total + entry.transferSize, 0),
      encodedBodyBytes: navigation.encodedBodySize + localResources.reduce((total, entry) => total + entry.encodedBodySize, 0),
      imageLoaded: Boolean(image?.complete && image.naturalWidth > 0),
      imageWidth: image?.naturalWidth || 0,
    };
  });

  await page.close();
  const failures = failedRequests.length + badResponses.length + (response ? 0 : 1);
  return {
    ...metrics,
    status: response?.status() || 0,
    wallMs: rounded(performance.now() - wallStartedAt),
    ttfbMs: rounded(metrics.ttfbMs),
    domContentLoadedMs: rounded(metrics.domContentLoadedMs),
    loadMs: rounded(metrics.loadMs),
    fcpMs: rounded(metrics.fcpMs),
    lcpMs: rounded(metrics.lcpMs),
    cls: rounded(metrics.cls, 4),
    failures,
    failedRequests,
    badResponses,
  };
}

function summarize(mirror, coldRows, burstRows) {
  const burstPages = burstRows.flatMap((row) => row.pages);
  return {
    mirror: mirror.label,
    protocol: mirror.protocol,
    coldTtfbMs: rounded(median(coldRows.map((row) => row.ttfbMs))),
    coldFcpMs: rounded(median(coldRows.map((row) => row.fcpMs))),
    coldLcpMs: rounded(median(coldRows.map((row) => row.lcpMs))),
    coldLoadMs: rounded(median(coldRows.map((row) => row.loadMs))),
    coldTransferKiB: rounded(median(coldRows.map((row) => row.transferBytes)) / 1024, 1),
    coldRequests: rounded(median(coldRows.map((row) => row.requestCount))),
    burstPagesPerSecond: rounded(median(burstRows.map((row) => row.pagesPerSecond)), 2),
    burstP95LoadMs: rounded(percentile(burstPages.map((row) => row.loadMs), 0.95)),
    failures: coldRows.reduce((total, row) => total + row.failures, 0) +
      burstRows.reduce((total, row) => total + row.failures, 0),
  };
}

function rotatedMirrors(offset) {
  const rotation = offset % mirrors.length;
  const rows = [...mirrors.slice(rotation), ...mirrors.slice(0, rotation)];
  return offset % 2 === 0 ? rows : rows.reverse();
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(values, proportion) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * proportion) - 1)];
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function rounded(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
