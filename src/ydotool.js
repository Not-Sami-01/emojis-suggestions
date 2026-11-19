'use strict';

const { execFile } = require('child_process');

// ydotool `type` only maps ASCII (ascii2keycode_map), so emoji insertion is:
// put the emoji on the clipboard, then simulate Ctrl+V through ydotool.
//   29 = KEY_LEFTCTRL, 47 = KEY_V ; :1 = press, :0 = release
const PASTE_SEQ = ['29:1', '47:1', '47:0', '29:0'];

function keySequence(seq) {
  return new Promise((resolve, reject) => {
    execFile('ydotool', ['key', ...seq], { timeout: 4000 }, (err, stdout, stderr) => {
      if (err) {
        err.stderr = (stderr || '').trim();
        return reject(err);
      }
      resolve(stdout);
    });
  });
}

function pasteViaYdotool() {
  return keySequence(PASTE_SEQ);
}

module.exports = { pasteViaYdotool, keySequence };
