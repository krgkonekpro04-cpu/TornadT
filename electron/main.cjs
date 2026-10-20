const { app, BrowserWindow, dialog, shell } = require('electron');
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');

const tileRoutes = [
  ['/tiles/esri-dark-labels/', 'server.arcgisonline.com', '/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/'],
  ['/tiles/esri-satellite/', 'server.arcgisonline.com', '/ArcGIS/rest/services/World_Imagery/MapServer/tile/'],
  ['/tiles/esri-reference/', 'server.arcgisonline.com', '/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/'],
  ['/tiles/esri-dark/', 'server.arcgisonline.com', '/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/'],
  ['/tiles/osm/', 'tile.openstreetmap.org', '/'],
  ['/tiles/radar/', 'tilecache.rainviewer.com', '/'],
];
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.json':'application/json' };
let server;
const maxBugReportBodyBytes = 30 * 1024 * 1024;
const defaultBugReportRecipient = 'krg.konekpro04@gmail.com';
const updateReleaseUrl = 'https://github.com/krgkonekpro04-cpu/TornadT/releases/latest';
const updateApiUrl = 'https://api.github.com/repos/krgkonekpro04-cpu/TornadT/releases/latest';

function bugReportSettingsPath() { return path.join(app.getPath('userData'), 'bug-report-settings.json'); }
function readBugReportRecipient() {
  try {
    const recipient = JSON.parse(fs.readFileSync(bugReportSettingsPath(), 'utf8')).recipient;
    return typeof recipient === 'string' ? recipient : defaultBugReportRecipient;
  } catch { return defaultBugReportRecipient; }
}
function saveBugReportRecipient(recipient) {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(bugReportSettingsPath(), JSON.stringify({ recipient }), { mode: 0o600 });
}

function jsonResponse(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let oversized = false;
    req.on('data', chunk => {
      if (oversized) return;
      size += chunk.length;
      if (size > maxBugReportBodyBytes) {
        oversized = true;
        reject(Object.assign(new Error('Report is too large. Reduce photo sizes and try again.'), { statusCode: 413 }));
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(Object.assign(new Error('Report data could not be read.'), { statusCode: 400 })); }
    });
    req.on('error', reject);
  });
}

function makeBugReportMultipart(report, files) {
  const title = report.title.trim().slice(0, 160);
  const boundary = `----TornadT-${crypto.randomBytes(18).toString('hex')}`;
  const body = [
    report.description.trim().slice(0, 8000), '', '--- App context ---',
    `Page: ${String(report.page ?? '').slice(0, 500)}`,
    `App version: ${String(report.appVersion ?? 'unknown').slice(0, 40)}`,
    `Platform: ${String(report.platform ?? 'unknown').slice(0, 100)}`,
    `User agent: ${String(report.userAgent ?? 'unknown').slice(0, 500)}`,
    `Attached photos: ${files.length}`,
  ].join('\n').replace(/\r?\n/g, '\r\n');
  const parts = [];
  const field = (name, value) => parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  field('_subject', `TornadT bug report: ${title}`);
  // FormSubmit needs the source page URL for submissions sent by apps and other
  // clients that do not provide a normal browser Referer header.
  field('_url', String(report.page ?? 'http://127.0.0.1/').slice(0, 500));
  field('summary', title);
  field('message', body);
  field('name', 'TornadT bug report');
  for (const file of files) {
    const name = file.name.replace(/["\\\r\n]/g, '_');
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="attachment"; filename="${name}"\r\nContent-Type: ${file.type}\r\n\r\n`));
    parts.push(file.bytes, Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { boundary, body: Buffer.concat(parts) };
}

async function sendBugReport(req, res) {
  try {
    const report = await readJsonBody(req);
    const recipient = typeof report.recipient === 'string' ? report.recipient.trim() : '';
    const title = typeof report.title === 'string' ? report.title.trim().slice(0, 160) : '';
    const description = typeof report.description === 'string' ? report.description.trim().slice(0, 8000) : '';
    const attachments = Array.isArray(report.attachments) ? report.attachments : [];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return jsonResponse(res, 400, { error: 'Enter a valid email address.' });
    if (!title || !description) return jsonResponse(res, 400, { error: 'Add a short summary and details before sending.' });
    if (attachments.length > 5) return jsonResponse(res, 400, { error: 'Attach up to five photos.' });

    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']);
    const files = [];
    let totalBytes = 0;
    for (let i = 0; i < attachments.length; i++) {
      const item = attachments[i];
      const match = typeof item.data === 'string' && item.data.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/]+=*)$/i);
      const type = match?.[1]?.toLowerCase();
      if (!type || !allowedTypes.has(type)) return jsonResponse(res, 400, { error: 'Use JPG, PNG, WebP, GIF, or HEIC photos.' });
      const bytes = Buffer.from(match[2], 'base64');
      if (!bytes.length || bytes.length > 8 * 1024 * 1024) return jsonResponse(res, 400, { error: 'Each photo must be 8 MB or smaller.' });
      totalBytes += bytes.length;
      if (totalBytes > 9 * 1024 * 1024) return jsonResponse(res, 400, { error: 'All photos together must be 9 MB or smaller.' });
      const name = path.basename(String(item.name ?? `photo-${i + 1}`)).replace(/[\r\n\0]/g, '_').slice(0, 180) || `photo-${i + 1}`;
      files.push({ bytes, type, name });
    }

    const { boundary, body } = makeBugReportMultipart({ ...report, title, description }, files);
    saveBugReportRecipient(recipient);
    const response = await fetch(`https://formsubmit.co/${encodeURIComponent(recipient)}`, {
      method: 'POST', headers: { 'content-type': `multipart/form-data; boundary=${boundary}` }, body,
      signal: AbortSignal.timeout(30_000),
    });
    const resultText = await response.text();
    if (!response.ok || /unable to submit form|invalid email/i.test(resultText))
      throw Object.assign(new Error(`Email relay could not accept the report (${response.status}).`), { statusCode: 502 });
    jsonResponse(res, 200, { ok: true, recipient });
  } catch (error) {
    console.error('Could not send TornadT bug report through FormSubmit:', error?.message || error);
    const status = Number(error?.statusCode) || 500;
    const message = status === 413 || status === 400
      ? error.message
      : status === 502 ? error.message : 'Could not send the report. Check your internet connection and try again.';
    if (!res.headersSent && !res.destroyed) jsonResponse(res, status, { error: message });
  }
}

function startServer() {
  const root = path.join(__dirname, '..', 'dist');
  server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/bug-report/settings') {
      jsonResponse(res, 200, { recipient: readBugReportRecipient() });
      return;
    }
    if (req.method === 'POST' && req.url === '/bug-report') {
      void sendBugReport(req, res);
      return;
    }
    let external;
    if (req.url.startsWith('/geocode/')) {
      external = { hostname: 'geocoding-api.open-meteo.com', path: req.url.slice('/geocode'.length), origin: 'https://geocoding-api.open-meteo.com' };
    } else if (req.url.startsWith('/open-meteo/')) {
      external = { hostname: 'api.open-meteo.com', path: req.url.slice('/open-meteo'.length), origin: 'https://api.open-meteo.com' };
    } else if (req.url.startsWith('/nws/')) {
      external = { hostname: 'api.weather.gov', path: req.url.slice('/nws'.length), origin: 'https://api.weather.gov' };
    } else if (req.url.startsWith('/reverse-geocode?')) {
      external = { hostname: 'nominatim.openstreetmap.org', path: '/reverse' + req.url.slice('/reverse-geocode'.length), origin: 'https://nominatim.openstreetmap.org' };
    } else if (req.url.startsWith('/noaa-storm-events/')) {
      external = { hostname: 'www.ncei.noaa.gov', path: '/pub/data/swdi/stormevents' + req.url.slice('/noaa-storm-events'.length), origin: 'https://www.ncei.noaa.gov' };
    } else if (req.url === '/radar-index') {
      external = { hostname: 'api.rainviewer.com', path: '/public/weather-maps.json', origin: 'https://api.rainviewer.com' };
    } else {
      const tileRoute = tileRoutes.find(([prefix]) => req.url.startsWith(prefix));
      if (tileRoute) {
        const [prefix, hostname, upstreamPath] = tileRoute;
        external = { hostname, path: upstreamPath + req.url.slice(prefix.length), origin: `https://${hostname}` };
      }
    }
    if (external) {
      const options = {
        hostname: external.hostname,
        port: 443,
        path: external.path,
        method: req.method,
        headers: {
          ...req.headers,
          host: external.hostname,
          origin: external.origin,
          referer: external.origin + '/',
          'user-agent': 'TornadT/2.0 (personal weather and historical data app)',
        },
      };
      const proxy = https.request(options, upstream => { res.writeHead(upstream.statusCode || 502, upstream.headers); upstream.pipe(res); });
      proxy.setTimeout(15000, () => proxy.destroy(new Error('Upstream request timed out')));
      proxy.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('TornadT data service is unavailable.'); });
      req.pipe(proxy);
      return;
    }
    let file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
    res.setHeader('content-type', mime[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => {
    server.once('error', () => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
    server.listen(41731, '127.0.0.1', () => resolve(server.address().port));
  });
}
async function createWindow() {
  const port = await startServer();
  const win = new BrowserWindow({ width: 1440, height: 920, minWidth: 960, minHeight: 680, title: 'TornadT', backgroundColor: '#07111f', autoHideMenuBar: true, icon: path.join(__dirname, '..', 'build', 'icon.png'), webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      if (new URL(url).protocol === 'https:') shell.openExternal(url);
    } catch (_) {}
    return { action: 'deny' };
  });
  win.loadURL(`http://127.0.0.1:${port}/`);
}
function compareVersions(left, right) {
  const parse = value => String(value).replace(/^v/i, '').split(/[+-]/, 1)[0].split('.').map(part => Number.parseInt(part, 10));
  const a = parse(left);
  const b = parse(right);
  if (a.length < 3 || b.length < 3 || [...a, ...b].some(value => !Number.isFinite(value))) return 0;
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  }
  return 0;
}
function checkForUpdates() {
  if (!app.isPackaged || !['darwin', 'win32'].includes(process.platform)) return;
  const request = https.get(updateApiUrl, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'TornadT-updater' },
  }, response => {
    let body = '';
    response.setEncoding('utf8');
    response.on('data', chunk => { body += chunk; });
    response.on('end', () => {
      if (response.statusCode !== 200) return;
      try {
        const release = JSON.parse(body);
        const latestVersion = release.tag_name;
        if (release.draft || release.prerelease || !latestVersion || compareVersions(latestVersion, app.getVersion()) <= 0) return;
        const options = {
          type: 'info',
          title: 'TornadT update available',
          message: `TornadT ${latestVersion} is available. You are using ${app.getVersion()}.`,
          detail: 'Download and install the latest version from the official TornadT GitHub Releases page.',
          buttons: ['Open GitHub Releases', 'Later'],
          defaultId: 0,
          cancelId: 1,
        };
        const window = BrowserWindow.getAllWindows()[0];
        const prompt = window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options);
        prompt.then(({ response: choice }) => {
          if (choice === 0) shell.openExternal(updateReleaseUrl);
        }).catch(() => {});
      } catch (_) {}
    });
  });
  request.setTimeout(8000, () => request.destroy());
  request.on('error', () => {});
}
app.whenReady().then(async () => {
  await createWindow();
  setTimeout(checkForUpdates, 4000);
});
app.on('window-all-closed', () => { if (server) server.close(); if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
