'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT = path.join(__dirname, '..', 'data', 'sources');
const SOURCES = [
  {
    name: 'emoji-test.txt',
    url: 'https://www.unicode.org/Public/emoji/16.0/emoji-test.txt',
  },
  {
    name: 'cldr-en.xml',
    url: 'https://raw.githubusercontent.com/unicode-org/cldr/release-46/common/annotations/en.xml',
  },
  {
    name: 'cldr-en-derived.xml',
    url: 'https://raw.githubusercontent.com/unicode-org/cldr/release-46/common/annotationsDerived/en.xml',
  },
];

function download(url, destination, redirects = 5) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'emoji-suggestions-bar/1.0' } }, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        response.resume();
        if (redirects <= 0) return reject(new Error(`Too many redirects downloading ${url}`));
        return resolve(download(new URL(response.headers.location, url).href, destination, redirects - 1));
      }
      if (response.statusCode !== 200) {
        response.resume();
        return reject(new Error(`Download failed (${response.statusCode}): ${url}`));
      }
      const file = fs.createWriteStream(destination);
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', (err) => {
        fs.rmSync(destination, { force: true });
        reject(err);
      });
    });
    request.setTimeout(30000, () => request.destroy(new Error(`Timed out downloading ${url}`)));
    request.on('error', reject);
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const source of SOURCES) {
    const destination = path.join(OUT, source.name);
    if (fs.existsSync(destination) && fs.statSync(destination).size > 1000) {
      console.log(`Using cached ${source.name}`);
      continue;
    }
    console.log(`Downloading ${source.url}`);
    await download(source.url, destination);
  }
})().catch((err) => {
  console.error(`[emoji data] ${err.message}`);
  process.exitCode = 1;
});
