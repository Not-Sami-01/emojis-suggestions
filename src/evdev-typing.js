'use strict';

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const EV_KEY = 0x01;
const EVENT_SIZE = 24; // struct timeval(16) + __u16 type + __u16 code + __s32 value

// Key codes considered "typing text" (letters, digits, common punctuation).
const TYPE_KEYS = new Set();
for (let i = 2; i <= 11; i++) TYPE_KEYS.add(i); // 1..0
[12, 13, 14, 15].forEach((c) => TYPE_KEYS.add(c)); // - = backspace tab
for (let i = 16; i <= 28; i++) TYPE_KEYS.add(i); // q..p [ ] enter
for (let i = 30; i <= 53; i++) if (i !== 42) TYPE_KEYS.add(i); // a..l ; ' ` \ z..m , . / (skip shift)
TYPE_KEYS.add(57); // space

// Keys that update the word buffer but should not pop the bar up.
const QUIET_KEYS = new Set([15, 28]); // tab, enter

const BACKSPACE_KEY = 14;
const ENTER_KEY = 28;
const CTRL_KEYS = new Set([29, 97]); // left/right ctrl
const ALT_KEYS = new Set([56, 100]); // left/right alt

// USB HID key code -> character (lowercase; shift handling is irrelevant for search)
const CODE_TO_CHAR = {
  2: '1', 3: '2', 4: '3', 5: '4', 6: '5', 7: '6', 8: '7', 9: '8', 10: '9', 11: '0',
  12: '-', 13: '=',
  16: 'q', 17: 'w', 18: 'e', 19: 'r', 20: 't', 21: 'y', 22: 'u', 23: 'i', 24: 'o', 25: 'p',
  26: '[', 27: ']',
  30: 'a', 31: 's', 32: 'd', 33: 'f', 34: 'g', 35: 'h', 36: 'j', 37: 'k', 38: 'l',
  39: ';', 40: "'", 41: '`', 43: '\\',
  44: 'z', 45: 'x', 46: 'c', 47: 'v', 48: 'b', 49: 'n', 50: 'm',
  51: ',', 52: '.', 53: '/', 57: ' ',
};

// Never read our own injection devices (would re-trigger the bar after a pick).
const SKIP_NAME_RE = /ydotoold/i;

class TypingListener extends EventEmitter {
  constructor() {
    super();
    this.fds = [];
    this.denied = [];
    this.buffer = '';
    this.word = '';
    this.ctrlDown = false;
    this.altDown = false;
    this.ignoreUntil = 0;
    this.lastPressCode = -1;
    this.lastPressAt = 0;
    this.timer = null;
    this.chunk = Buffer.alloc(EVENT_SIZE * 64);
  }

  start() {
    let entries = [];
    try {
      entries = fs.readdirSync('/dev/input').filter((f) => /^event\d+$/.test(f));
    } catch (err) {
      this.emit('error', err);
      return this;
    }

    for (const f of entries) {
      const full = path.join('/dev/input', f);
      let name = f;
      try {
        name = fs.readFileSync(`/sys/class/input/${f}/device/name`, 'utf8').trim() || f;
      } catch {
        /* name unknown */
      }
      if (SKIP_NAME_RE.test(name)) continue;

      let fd;
      try {
        fd = fs.openSync(full, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK);
      } catch {
        this.denied.push(name);
        continue;
      }
      this.fds.push({ fd, name });
    }

    this.timer = setInterval(() => this.poll(), 8);
    if (this.timer.unref) this.timer.unref();

    this.emit('ready', {
      opened: this.fds.map((d) => d.name),
      denied: this.denied,
    });
    return this;
  }

  poll() {
    const ignore = Date.now() < this.ignoreUntil;
    for (const dev of this.fds) {
      for (;;) {
        let n;
        try {
          n = fs.readSync(dev.fd, this.chunk, 0, this.chunk.length, null);
        } catch (err) {
          break; // EAGAIN (no data), EIO/ENODEV (unplugged)
        }
        if (n <= 0) break;
        const usable = n - (n % EVENT_SIZE);
        for (let off = 0; off < usable; off += EVENT_SIZE) {
          const type = this.chunk.readUInt16LE(off + 16);
          if (type !== EV_KEY) continue;
          const code = this.chunk.readUInt16LE(off + 18);
          const value = this.chunk.readInt32LE(off + 20);
          this.handleKey(code, value, ignore);
        }
      }
    }
  }

  handleKey(code, value, ignore) {
    // Track modifiers even while ignoring (injection sends clean press/release pairs).
    if (CTRL_KEYS.has(code)) this.ctrlDown = value !== 0;
    if (ALT_KEYS.has(code)) this.altDown = value !== 0;

    if (value !== 1) return; // only fresh presses (skip autorepeat + releases)
    if (ignore) return;

    const now = Date.now();

    // Ctrl+Alt+Enter -> focus the bar; Ctrl+Alt+Q -> quit.
    // Detected from raw evdev so it works even when the compositor swallows the combo.
    if (code === ENTER_KEY && this.ctrlDown && this.altDown) {
      this.lastPressCode = code;
      this.lastPressAt = now;
      this.emit('hotkey');
      return;
    }
    if (code === 16 /* KEY_Q */ && this.ctrlDown && this.altDown) {
      this.lastPressCode = code;
      this.lastPressAt = now;
      this.emit('quit');
      return;
    }

    // Same physical key can arrive on two devices (e.g. keyd virtual + raw) — dedupe.
    if (code === this.lastPressCode && now - this.lastPressAt < 6) return;
    this.lastPressCode = code;
    this.lastPressAt = now;

    if (!TYPE_KEYS.has(code)) return;

    if (code === BACKSPACE_KEY) {
      this.buffer = this.ctrlDown ? '' : this.buffer.slice(0, -1);
    } else {
      const ch = CODE_TO_CHAR[code];
      if (ch === ' ') {
        this.commit();
      } else if (ch) {
        this.buffer += ch;
      } else if (QUIET_KEYS.has(code)) {
        this.commit();
      }
    }

    if (!QUIET_KEYS.has(code)) this.emit('typing');
  }

  commit() {
    const w = this.buffer.trim();
    if (w) this.word = w;
    this.buffer = '';
  }

  // Word to pre-fill the bar with when it opens.
  seedWord() {
    return this.buffer.trim() || this.word;
  }

  clear() {
    this.buffer = '';
    this.word = '';
  }

  // Ignore keystrokes for a while (used around our own ydotool injection).
  pause(ms) {
    this.ignoreUntil = Date.now() + ms;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const dev of this.fds) {
      try {
        fs.closeSync(dev.fd);
      } catch {
        /* already closed */
      }
    }
    this.fds = [];
  }
}

module.exports = { TypingListener };
