'use strict';

const { app, BrowserWindow, screen, globalShortcut, ipcMain, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { TypingListener } = require('./src/evdev-typing');
const { pasteViaYdotool } = require('./src/ydotool');
const { suggest } = require('./src/suggestions');

const BAR_W = 700; // window width (bar is 660 + shadow margin)
const BAR_H = 122; // window height (bar ~100 + bottom offset + shadow margin)
const HOTKEY = 'CommandOrControl+Alt+Return';
const QUIT_HOTKEY = 'CommandOrControl+Alt+Q';

const CONFIG_DIR = path.join(
  process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
  'emojis-suggestions'
);
const POSITION_FILE = path.join(CONFIG_DIR, 'position.json');
const RECENTS_FILE = path.join(CONFIG_DIR, 'recents.json');
const SETUP_FILE = path.join(CONFIG_DIR, 'setup-complete');
const SETTINGS_FILE = path.join(CONFIG_DIR, 'settings.json');
const PID_FILE = path.join(process.env.XDG_RUNTIME_DIR || os.tmpdir(), 'emoji-bar.pid');

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

let win = null;
let listener = null;
let lastHotkeyAt = 0;
let savedPosition = null; // {x, y} remembered from the last drag
let saveTimer = null;
let setupWin = null;
let settingsWin = null;
let settings = { theme: 'system', liquid: 'subtle', launchAtLogin: false };

app.on('second-instance', (_event, argv) => {
  if (argv.includes('--quit')) app.quit();
  else if (argv.includes('--setup')) showSetup();
  else if (argv.includes('--settings')) showSettings();
  else if (argv.includes('--show')) onHotkey();
});

function showSetup() {
  if (setupWin && !setupWin.isDestroyed()) {
    setupWin.show();
    setupWin.focus();
    return;
  }
  setupWin = new BrowserWindow({
    width: 480,
    height: 550,
    resizable: false,
    show: false,
    title: 'Set up Emoji Suggestions',
    webPreferences: {
      preload: path.join(__dirname, 'setup-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  setupWin.setMenuBarVisibility(false);
  const html = fs.readFileSync(path.join(__dirname, 'installer.html'), 'utf8')
    .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'; img-src data:">')
    .replace('<link rel="stylesheet" href="src/installer.css">', `<style>${fs.readFileSync(path.join(__dirname, 'src/installer.css'), 'utf8')}</style>`)
    .replace('src="assets/logo-mark.svg"', `src="data:image/svg+xml;base64,${fs.readFileSync(path.join(__dirname, 'assets/logo-mark.svg')).toString('base64')}"`)
    .replace('<script src="src/installer.js"></script>', `<script>${fs.readFileSync(path.join(__dirname, 'src/installer.js'), 'utf8')}</script>`);
  setupWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  setupWin.once('ready-to-show', () => setupWin && setupWin.show());
  setupWin.on('closed', () => { setupWin = null; });
}

function showSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 560,
    height: 590,
    resizable: false,
    show: false,
    title: 'Emoji Suggestions Settings',
    webPreferences: {
      preload: path.join(__dirname, 'settings-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  settingsWin.setMenuBarVisibility(false);
  const htmlPath = path.join(__dirname, 'settings.html');
  const html = fs.readFileSync(htmlPath, 'utf8')
    .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'; img-src data:">')
    .replace('<link rel="stylesheet" href="src/settings.css">', `<style>${fs.readFileSync(path.join(__dirname, 'src/settings.css'), 'utf8')}</style>`)
    .replace('src="assets/logo-mark.svg"', `src="data:image/svg+xml;base64,${fs.readFileSync(path.join(__dirname, 'assets/logo-mark.svg')).toString('base64')}"`)
    .replace('<script src="src/settings.js"></script>', `<script>${fs.readFileSync(path.join(__dirname, 'src/settings.js'), 'utf8')}</script>`);
  settingsWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  settingsWin.once('ready-to-show', () => settingsWin && settingsWin.show());
  settingsWin.on('closed', () => { settingsWin = null; });
}

function loadSettings() {
  try {
    const value = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    if (['system', 'dark', 'light'].includes(value.theme)) settings.theme = value.theme;
    if (['off', 'subtle', 'vivid'].includes(value.liquid)) settings.liquid = value.liquid;
    settings.launchAtLogin = value.launchAtLogin === true;
  } catch { /* defaults for a fresh install */ }
}

function updateLoginEntry(enabled) {
  const home = app.getPath('home');
  const dataHome = process.env.XDG_DATA_HOME || path.join(home, '.local', 'share');
  const autoDir = path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'autostart');
  const entry = path.join(autoDir, 'emoji-suggestions.desktop');
  if (!enabled) {
    try { fs.unlinkSync(entry); } catch (err) { if (err.code !== 'ENOENT') throw err; }
    return;
  }
  fs.mkdirSync(autoDir, { recursive: true });
  let executable = process.execPath;
  let prefix = '';
  if (process.env.APPIMAGE && fs.existsSync(process.env.APPIMAGE)) {
    const installed = path.join(home, 'Applications', 'Emoji Suggestions.AppImage');
    executable = fs.existsSync(installed) ? installed : process.env.APPIMAGE;
    prefix = 'env APPIMAGE_EXTRACT_AND_RUN=1 ';
  }
  const command = app.isPackaged
    ? `${prefix}${desktopQuote(executable)}`
    : `${desktopQuote(process.execPath)} ${desktopQuote(app.getAppPath())}`;
  const icon = path.join(dataHome, 'icons', 'hicolor', 'scalable', 'apps', 'emoji-suggestions.svg');
  const content = ['[Desktop Entry]', 'Type=Application', 'Name=Emoji Suggestions', `Exec=${command}`, `Icon=${icon}`, 'Terminal=false', 'X-GNOME-Autostart-enabled=true', ''].join('\n');
  fs.writeFileSync(entry, content, { mode: 0o644 });
}

ipcMain.handle('settings:load', () => settings);
ipcMain.handle('settings:save', (_event, value) => {
  if (!value || !['system', 'dark', 'light'].includes(value.theme) || !['off', 'subtle', 'vivid'].includes(value.liquid)) {
    throw new Error('Invalid settings');
  }
  settings = { theme: value.theme, liquid: value.liquid, launchAtLogin: value.launchAtLogin === true };
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  updateLoginEntry(settings.launchAtLogin);
  if (win && !win.isDestroyed()) win.webContents.send('settings:changed', settings);
  return true;
});

ipcMain.handle('settings:open', () => { showSettings(); return true; });

ipcMain.handle('settings:uninstall', () => {
  const home = app.getPath('home');
  const dataHome = process.env.XDG_DATA_HOME || path.join(home, '.local', 'share');
  const configHome = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
  const ownedFiles = [
    path.join(home, 'Applications', 'Emoji Suggestions.AppImage'),
    path.join(dataHome, 'applications', 'emoji-suggestions.desktop'),
    path.join(dataHome, 'icons', 'hicolor', 'scalable', 'apps', 'emoji-suggestions.svg'),
    path.join(configHome, 'autostart', 'emoji-suggestions.desktop'),
  ];
  for (const file of ownedFiles) {
    try { fs.unlinkSync(file); } catch (err) { if (err.code !== 'ENOENT') throw err; }
  }

  const base = '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings';
  const showPath = `${base}/emoji-bar/`;
  const quitPath = `${base}/emoji-bar-quit/`;
  const schema = 'org.gnome.settings-daemon.plugins.media-keys';
  const current = execFileSync('gsettings', ['get', schema, 'custom-keybindings'], { encoding: 'utf8' });
  const paths = [...current.matchAll(/'([^']+)'/g)].map((match) => match[1]);
  const remaining = paths.filter((item) => item !== showPath && item !== quitPath);
  execFileSync('gsettings', ['set', schema, 'custom-keybindings', `[${remaining.map((item) => `'${item}'`).join(', ')}]`]);
  for (const suffix of ['emoji-bar', 'emoji-bar-quit']) {
    execFileSync('gsettings', ['reset-recursively', `${schema}.custom-keybinding:${base}/${suffix}/`]);
  }
  fs.rmSync(CONFIG_DIR, { recursive: true, force: true });
  setTimeout(() => app.quit(), 500);
  return true;
});

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function desktopQuote(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

ipcMain.handle('setup:install', () => {
  const home = app.getPath('home');
  const applications = path.join(home, 'Applications');
  fs.mkdirSync(applications, { recursive: true });
  let executable = process.execPath;
  let launcherPrefix = '';

  if (process.env.APPIMAGE && fs.existsSync(process.env.APPIMAGE)) {
    executable = path.join(applications, 'Emoji Suggestions.AppImage');
    fs.copyFileSync(process.env.APPIMAGE, executable);
    fs.chmodSync(executable, 0o755);
    launcherPrefix = 'env APPIMAGE_EXTRACT_AND_RUN=1 ';
  }

  const appCommand = app.isPackaged
    ? `${launcherPrefix}${shellQuote(executable)}`
    : `${shellQuote(process.execPath)} ${shellQuote(app.getAppPath())}`;
  const base = '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings';
  const showPath = `${base}/emoji-bar/`;
  const quitPath = `${base}/emoji-bar-quit/`;
  const settings = 'org.gnome.settings-daemon.plugins.media-keys';
  const current = execFileSync('gsettings', ['get', settings, 'custom-keybindings'], { encoding: 'utf8' });
  const paths = [...current.matchAll(/'([^']+)'/g)].map((match) => match[1]);
  if (!paths.includes(showPath)) paths.push(showPath);
  if (!paths.includes(quitPath)) paths.push(quitPath);
  execFileSync('gsettings', ['set', settings, 'custom-keybindings', `[${paths.map((item) => `'${item}'`).join(', ')}]`]);
  const setShortcut = (suffix, name, binding, command) => {
    const schema = `${settings}.custom-keybinding:${base}/${suffix}/`;
    execFileSync('gsettings', ['set', schema, 'name', name]);
    execFileSync('gsettings', ['set', schema, 'binding', binding]);
    execFileSync('gsettings', ['set', schema, 'command', command]);
  };
  setShortcut('emoji-bar', 'Emoji Suggestions: Open', '<Control><Alt>Return', `${appCommand} --show`);
  setShortcut('emoji-bar-quit', 'Emoji Suggestions: Quit', '<Control><Alt>q', `${appCommand} --quit`);

  const dataHome = process.env.XDG_DATA_HOME || path.join(home, '.local', 'share');
  const desktopDir = path.join(dataHome, 'applications');
  const iconDir = path.join(dataHome, 'icons', 'hicolor', 'scalable', 'apps');
  fs.mkdirSync(desktopDir, { recursive: true });
  fs.mkdirSync(iconDir, { recursive: true });
  const iconPath = path.join(iconDir, 'emoji-suggestions.svg');
  fs.copyFileSync(path.join(__dirname, 'assets', 'logo-mark.svg'), iconPath);
  const desktopCommand = app.isPackaged
    ? `${launcherPrefix}${desktopQuote(executable)} --show`
    : `${desktopQuote(process.execPath)} ${desktopQuote(app.getAppPath())} --show`;
  const desktop = [
    '[Desktop Entry]', 'Type=Application', 'Name=Emoji Suggestions',
    `Exec=${desktopCommand}`, `Icon=${iconPath}`,
    'Categories=Utility;TextTools;', 'Terminal=false', 'StartupNotify=false', '',
  ].join('\n');
  fs.writeFileSync(path.join(desktopDir, 'emoji-suggestions.desktop'), desktop, { mode: 0o644 });
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(SETUP_FILE, '1');
  return { message: 'Installed. Press Ctrl+Alt+Enter to open the emoji bar.' };
});

ipcMain.handle('setup:close', () => {
  if (setupWin && !setupWin.isDestroyed()) setupWin.close();
  return true;
});

function defaultBarBounds() {
  const wa = screen.getPrimaryDisplay().workArea;
  return {
    x: Math.round(wa.x + (wa.width - BAR_W) / 2),
    y: Math.round(wa.y + wa.height - BAR_H - 6),
    width: BAR_W,
    height: BAR_H,
  };
}

// A saved position is only usable if a decent chunk of the bar would land on
// a currently connected display (monitors come and go).
function isUsablePosition(p) {
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
  return screen.getAllDisplays().some((d) => {
    const ox = Math.max(p.x, d.bounds.x);
    const oy = Math.max(p.y, d.bounds.y);
    const cx = Math.min(p.x + BAR_W, d.bounds.x + d.bounds.width);
    const cy = Math.min(p.y + BAR_H, d.bounds.y + d.bounds.height);
    return cx - ox >= 140 && cy - oy >= 60;
  });
}

function loadPosition() {
  try {
    const parsed = JSON.parse(fs.readFileSync(POSITION_FILE, 'utf8'));
    if (isUsablePosition(parsed)) {
      savedPosition = { x: parsed.x, y: parsed.y };
      console.log(`[pos] loaded saved position ${parsed.x},${parsed.y}`);
      return;
    }
    console.log('[pos] saved position is off-screen — using default');
  } catch {
    /* no saved position yet */
  }
  savedPosition = null;
}

function savePositionNow() {
  if (!win) return;
  const b = win.getBounds();
  if (savedPosition && savedPosition.x === b.x && savedPosition.y === b.y) return;
  savedPosition = { x: b.x, y: b.y };
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(POSITION_FILE, JSON.stringify(savedPosition));
    console.log(`[pos] saved ${b.x},${b.y} -> ${POSITION_FILE}`);
  } catch (err) {
    console.warn('[pos] could not save position:', err.message);
  }
}

function scheduleSavePosition() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(savePositionNow, 300);
}

function positionBar() {
  if (!win) return;
  const b =
    savedPosition && isUsablePosition(savedPosition)
      ? { x: savedPosition.x, y: savedPosition.y, width: BAR_W, height: BAR_H }
      : defaultBarBounds();
  win.setBounds(b);
}

// --- recents ---------------------------------------------------------------

let recents = []; // most-recently-picked emoji, newest first

function loadRecents() {
  try {
    const a = JSON.parse(fs.readFileSync(RECENTS_FILE, 'utf8'));
    if (Array.isArray(a)) recents = a.filter((x) => typeof x === 'string' && x).slice(0, 30);
    if (recents.length) console.log(`[recents] loaded ${recents.length} emoji`);
  } catch {
    /* none yet */
  }
}

function addRecent(emoji) {
  recents = [emoji, ...recents.filter((c) => c !== emoji)].slice(0, 30);
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(RECENTS_FILE, JSON.stringify(recents));
  } catch (err) {
    console.warn('[recents] could not save:', err.message);
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: BAR_W,
    height: BAR_H,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    fullscreenable: false,
    title: 'Emoji Suggestions',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  if (win.setVisibleOnAllWorkspaces) {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  win.setMenuBarVisibility(false);
  positionBar();
  win.loadFile(path.join(__dirname, 'index.html'));

  if (process.argv.includes('--show')) {
    win.webContents.once('did-finish-load', () => showBar(''));
  }

  // Clicking/focusing elsewhere dismisses the bar; typing brings it back.
  win.on('blur', () => {
    if (win && win.isVisible()) win.hide();
  });
  // Remember where the user dragged the bar.
  win.on('moved', scheduleSavePosition);
  win.on('closed', () => {
    win = null;
  });
}

function showBar(seed) {
  if (!win) return;
  const visible = win.isVisible();
  if (!visible) {
    positionBar();
    win.show();
    win.webContents.send('show', { seed: seed || '', animate: true });
  }
  const b = win.getBounds();
  console.log(`[show] bar visible=${visible} at ${b.x},${b.y}`);
  focusBar(0);
}

// GNOME Wayland can refuse the first programmatic focus (focus-stealing
// prevention, often while the `--show` helper process is exiting), so retry
// briefly instead of giving up after one attempt.
function focusBar(attempt) {
  if (!win) return;
  win.focus();
  if (win.isFocused()) {
    if (attempt > 0) console.log(`[focus] bar focused on retry ${attempt}`);
    return;
  }
  if (attempt < 8) {
    setTimeout(() => focusBar(attempt + 1), 250);
  } else {
    console.warn('[focus] compositor did not focus the emoji bar');
  }
}

function onHotkey() {
  const now = Date.now();
  if (now - lastHotkeyAt < 400) return; // evdev + globalShortcut may both fire
  lastHotkeyAt = now;
  console.log('[hotkey] focusing bar');
  showBar(listener ? listener.seedWord() : '');
}

function registerShortcuts() {
  try {
    const ok = globalShortcut.register(HOTKEY, onHotkey);
    console.log(
      ok
        ? `[hotkey] ${HOTKEY} registered via globalShortcut`
        : `[hotkey] ${HOTKEY} refused by another app (evdev hotkey still active)`
    );
  } catch (err) {
    console.log(`[hotkey] globalShortcut unavailable (${err.message}); relying on evdev`);
  }
  try {
    globalShortcut.register(QUIT_HOTKEY, () => app.quit());
  } catch {
    /* ignore */
  }
}

// --- IPC -------------------------------------------------------------------

ipcMain.handle('suggest', (_e, word) => {
  try {
    return suggest(word, recents);
  } catch (err) {
    console.error('[suggest]', err);
    return [];
  }
});

ipcMain.handle('read-clipboard', () => {
  try {
    return clipboard.readText() || '';
  } catch {
    return '';
  }
});

ipcMain.handle('close', () => {
  if (win) win.hide();
  return true;
});

// --- manual window drag ----------------------------------------------------
// The renderer forwards pointer events from the bar's surface (CSS app-region
// drag does not engage GNOME's move grab here); we move the window ourselves.
let dragOffset = null;

ipcMain.on('drag-start', (_e, p) => {
  if (!win || !p || !Number.isFinite(p.screenX)) return;
  const b = win.getBounds();
  dragOffset = { x: p.screenX - b.x, y: p.screenY - b.y };
  console.log(`[drag] start at ${p.screenX},${p.screenY} (window ${b.x},${b.y})`);
});

ipcMain.on('drag-move', (_e, p) => {
  if (!win || !dragOffset || !p || !Number.isFinite(p.screenX)) return;
  let x = Math.round(p.screenX - dragOffset.x);
  let y = Math.round(p.screenY - dragOffset.y);
  // Keep a usable slice of the bar within the union of connected displays.
  const ds = screen.getAllDisplays().map((d) => d.bounds);
  const minX = Math.min(...ds.map((d) => d.x));
  const maxX = Math.max(...ds.map((d) => d.x + d.width));
  const minY = Math.min(...ds.map((d) => d.y));
  const maxY = Math.max(...ds.map((d) => d.y + d.height));
  x = Math.min(Math.max(x, minX + 40), maxX - BAR_W - 40);
  y = Math.min(Math.max(y, minY + 30), maxY - BAR_H - 10);
  win.setPosition(x, y);
});

ipcMain.on('drag-end', () => {
  if (!dragOffset) return;
  dragOffset = null;
  scheduleSavePosition();
});

// Shift+Enter: paste the emoji into the app behind, then reopen the bar so
// more emoji can be added without starting over.
ipcMain.handle('insert', async (_e, emoji) => {
  if (typeof emoji !== 'string' || !emoji) return { ok: false };
  clipboard.writeText(emoji);
  addRecent(emoji);

  if (listener) listener.pause(900); // don't let our own injection disturb state
  if (win && win.isVisible()) win.hide(); // focus returns to the target app
  console.log(`[insert] ${emoji} — pasting, bar will reopen`);

  setTimeout(async () => {
    let failed = null;
    try {
      await pasteViaYdotool();
    } catch (err) {
      failed = err;
      console.error('[ydotool] injection failed:', err.message, err.stderr || '');
    }
    setTimeout(() => {
      if (!win) return;
      win.show();
      win.focus(); // renderer keeps its query/selection — no 'show' reset
      if (failed) {
        win.webContents.send('status', 'ydotool failed — emoji is on the clipboard');
      } else {
        console.log('[insert] bar reopened');
      }
    }, 90);
  }, 140);

  return { ok: true };
});

ipcMain.handle('pick', async (_e, emoji) => {
  if (typeof emoji !== 'string' || !emoji) return { ok: false };
  clipboard.writeText(emoji);
  addRecent(emoji);

  if (listener) {
    listener.clear();
    listener.pause(800); // don't let our own injection disturb state
  }
  if (win && win.isVisible()) win.hide(); // focus returns to the previous app

  // Give the compositor a moment to restore focus, then paste via ydotool.
  setTimeout(async () => {
    try {
      await pasteViaYdotool();
      console.log(`[pick] pasted ${emoji}`);
    } catch (err) {
      console.error('[ydotool] injection failed:', err.message, err.stderr || '');
      if (win) {
        showBar('');
        win.webContents.send('status', 'ydotool failed — emoji is on the clipboard, press Ctrl+V');
      }
    }
  }, 140);

  return { ok: true };
});

// --- Lifecycle -------------------------------------------------------------

app.whenReady().then(() => {
  // A second instance only exists to hand its argv to the running one
  // (handled via the 'second-instance' event) — exit without starting up.
  if (!hasSingleInstanceLock) {
    app.quit();
    return;
  }
  if (process.argv.includes('--quit')) {
    app.quit();
    return;
  }
  loadPosition();
  loadRecents();
  loadSettings();
  createWindow();
  if (process.argv.includes('--setup') || !fs.existsSync(SETUP_FILE)) showSetup();
  if (process.argv.includes('--settings')) showSettings();
  registerShortcuts();

  if (process.env.EMOJI_BAR_ENABLE_KEYBOARD_MONITOR === '1') {
    listener = new TypingListener();
    listener.on('ready', ({ opened, denied }) => {
      if (opened.length === 0) {
        console.warn('[input] opted-in keyboard monitor could not read any /dev/input devices');
      } else {
        console.log(`[input] opted-in keyboard monitor reading ${opened.length} device(s)`);
      }
      if (denied.length) console.warn(`[input] ${denied.length} unreadable device(s): ${denied.join(', ')}`);
    });
    listener.on('error', (err) => console.error('[input]', err.message));
    // Monitoring is opt-in, never auto-shows the bar, and only adds last-word
    // seeding plus evdev hotkey fallback.
    listener.on('hotkey', onHotkey);
    listener.on('quit', () => app.quit());
    listener.start();
  } else {
    console.log('[input] raw keyboard monitoring disabled (opt-in via EMOJI_BAR_ENABLE_KEYBOARD_MONITOR=1)');
  }

  screen.on('display-metrics-changed', positionBar);

  // Fallback hotkey: any process can focus the bar with `kill -USR1 $(cat pidfile)`
  // (see scripts/show-bar.sh — bind it in GNOME Settings > Keyboard > Shortcuts).
  try {
    fs.writeFileSync(PID_FILE, String(process.pid));
  } catch (err) {
    console.warn('[app] could not write pidfile:', err.message);
  }
  process.on('SIGUSR1', onHotkey);
  process.on('SIGUSR2', () => app.quit());

  console.log('[app] running — hotkey: Ctrl+Alt+Enter, quit: Ctrl+Alt+Q');
});

app.on('will-quit', () => {
  clearTimeout(saveTimer);
  savePositionNow(); // flush a pending drag position
  globalShortcut.unregisterAll();
  if (listener) listener.stop();
  try {
    fs.unlinkSync(PID_FILE);
  } catch {
    /* already gone */
  }
});

// Stay alive if the window is ever closed; quit only via hotkey/pkill.
app.on('window-all-closed', () => {});
