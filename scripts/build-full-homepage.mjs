import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = resolve(process.argv[2] || join(projectRoot, '..', 'firepixel', 'dist'));
const sourceRepository = resolve(sourceRoot, '..');
const outputRoot = resolve(projectRoot, 'site', 'full');

if (outputRoot !== join(projectRoot, 'site', 'full')) {
  throw new Error('Refusing to write outside site/full.');
}

const sourceCommit = execFileSync('git', ['-C', sourceRepository, 'rev-parse', 'HEAD'], {
  encoding: 'utf8',
}).trim();
const sourceHtml = readFileSync(join(sourceRoot, 'index.html'), 'utf8');

const stylesheetMatch = sourceHtml.match(/\/_astro\/([A-Za-z0-9._-]+\.css)/);
if (!stylesheetMatch) throw new Error('The homepage stylesheet was not found.');
const stylesheetName = stylesheetMatch[1];
const sourceCss = readFileSync(join(sourceRoot, '_astro', stylesheetName), 'utf8');

let html = replaceOnce(
  sourceHtml,
  /<script>\(function\(\)\{const GTM_ID = "GTM-WNQ4KZF3";[\s\S]*?<\/script>/,
  '',
  'Google Tag Manager loader',
);
html = replaceOnce(
  html,
  /<noscript>\s*<iframe[^>]+googletagmanager\.com\/ns\.html[\s\S]*?<\/iframe>\s*<\/noscript>/,
  '',
  'Google Tag Manager noscript fallback',
);
html = replaceOnce(
  html,
  /<meta name="viewport" content="width=device-width, initial-scale=1">/,
  '<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow, noarchive">',
  'viewport metadata',
);
html = replaceOnce(
  html,
  '<head>',
  `<head><!-- Host-Off full homepage fixture: source ${sourceCommit}; third-party analytics removed. -->`,
  'head element',
);

html = html.replaceAll('/_astro/', './_astro/');
html = html.replace('href="/favicon.svg"', 'href="./favicon.svg"');
html = html.replace(/href="\/([^"#]*)"/g, (_match, path) => `href="https://firepixel.co.uk/${path}"`);

if (/googletagmanager|cookiepal|clarity\.ms|google-analytics/i.test(html)) {
  throw new Error('A third-party analytics reference remains in the generated HTML.');
}
if (!html.includes('<link rel="canonical" href="https://firepixel.co.uk/">')) {
  throw new Error('The primary-site canonical was not preserved.');
}

const css = sourceCss.replaceAll('/_astro/', './');
const assets = new Set([
  ...assetNames(sourceHtml),
  ...assetNames(sourceCss),
]);

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(join(outputRoot, '_astro'), { recursive: true });
writeFileSync(join(outputRoot, 'index.html'), html);
copyFileSync(join(sourceRoot, 'favicon.svg'), join(outputRoot, 'favicon.svg'));

for (const name of [...assets].sort()) {
  const source = join(sourceRoot, '_astro', name);
  const destination = join(outputRoot, '_astro', name);
  if (name === stylesheetName) writeFileSync(destination, css);
  else copyFileSync(source, destination);
}

const files = [
  'index.html',
  'favicon.svg',
  ...[...assets].sort().map((name) => `_astro/${name}`),
].map((path) => {
  const bytes = readFileSync(join(outputRoot, path));
  return {
    path,
    bytes: statSync(join(outputRoot, path)).size,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
});

const manifest = {
  schemaVersion: '1.0',
  fixture: 'firepixel-full-homepage',
  sourceCommit,
  canonical: 'https://firepixel.co.uk/',
  analyticsRemoved: true,
  files,
  totalBytes: files.reduce((total, file) => total + file.bytes, 0),
};
writeFileSync(join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Built ${files.length} files (${manifest.totalBytes} bytes) from ${sourceCommit}.`);

function assetNames(value) {
  return [...value.matchAll(/\/_astro\/([A-Za-z0-9._-]+)/g)].map((match) => match[1]);
}

function replaceOnce(value, pattern, replacement, label) {
  const count = typeof pattern === 'string'
    ? value.split(pattern).length - 1
    : (value.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)) || []).length;

  if (count !== 1) {
    throw new Error(`Expected exactly one ${label}; found ${count}.`);
  }

  return value.replace(pattern, replacement);
}
