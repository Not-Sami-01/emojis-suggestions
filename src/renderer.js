'use strict';

(() => {
  const api = window.emojiBar;
  const barEl = document.getElementById('bar');
  const wordEl = document.getElementById('word');
  const nameEl = document.getElementById('name');
  const listEl = document.getElementById('list');

  let query = '';
  let items = [];
  let sel = 0;
  let debounce = null;
  let statusTimer = null;

  function currentWord() {
    const tokens = query.split(/\s+/);
    const last = tokens[tokens.length - 1] || '';
    return last.replace(/^[^\p{L}\p{N}]+/u, '').toLowerCase();
  }

  async function refresh() {
    const w = currentWord();
    try {
      items = await api.suggest(w);
    } catch (err) {
      console.error('suggest failed', err);
      items = [];
    }
    sel = 0;
    render();
  }

  function scheduleRefresh() {
    clearTimeout(debounce);
    debounce = setTimeout(refresh, 60);
  }

  function updateSelection() {
    const kids = listEl.querySelectorAll('.emoji');
    kids.forEach((k, i) => k.classList.toggle('sel', i === sel));
    const it = items[sel];
    if (it && !nameEl.classList.contains('status')) nameEl.textContent = it.n;
    const el = kids[sel];
    if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function render() {
    wordEl.textContent = query;
    listEl.innerHTML = '';
    if (!items.length) {
      const d = document.createElement('div');
      d.className = 'empty';
      d.textContent = query ? `No emoji for “${currentWord()}”` : 'No emoji found';
      listEl.appendChild(d);
      nameEl.textContent = '';
      return;
    }
    items.forEach((it, i) => {
      const b = document.createElement('button');
      b.className = 'emoji' + (i === sel ? ' sel' : '');
      b.style.setProperty('--i', i);
      b.textContent = it.c;
      b.title = it.n;
      b.addEventListener('click', () => pick(i));
      b.addEventListener('mouseenter', () => {
        sel = i;
        updateSelection();
      });
      listEl.appendChild(b);
    });
    updateSelection();
  }

  function move(delta) {
    if (!items.length) return;
    sel = (sel + delta + items.length) % items.length;
    updateSelection();
  }

  async function pick(index) {
    const it = items[index ?? sel];
    if (!it) return;
    try {
      await api.pick(it.c);
    } catch (err) {
      console.error('pick failed', err);
    }
  }

  // Shift+Enter: insert but keep the bar open for more.
  async function insert(index) {
    const it = items[index ?? sel];
    if (!it) return;
    try {
      await api.insert(it.c);
    } catch (err) {
      console.error('insert failed', err);
    }
  }

  function setStatus(text) {
    nameEl.textContent = text;
    nameEl.classList.add('status');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      nameEl.classList.remove('status');
      const it = items[sel];
      nameEl.textContent = it ? it.n : '';
    }, 3200);
  }

  // --- keyboard -------------------------------------------------------------

  window.addEventListener('keydown', (e) => {
    const k = e.key;

    if (k === 'Escape') {
      e.preventDefault();
      api.close();
      return;
    }

    // Enter picks and closes; Shift+Enter inserts but keeps the bar open.
    if (k === 'Enter') {
      e.preventDefault();
      if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        if (e.shiftKey) insert(sel);
        else pick(sel);
      }
      return;
    }

    if (k === 'ArrowRight' || k === 'ArrowDown') {
      e.preventDefault();
      move(1);
      return;
    }
    if (k === 'ArrowLeft' || k === 'ArrowUp') {
      e.preventDefault();
      move(-1);
      return;
    }
    if (k === 'Tab') {
      e.preventDefault(); // navigation is arrows-only; don't let Tab move focus
      return;
    }

    // Paste a word from the clipboard into the search.
    if ((e.ctrlKey || e.metaKey) && (k === 'v' || k === 'V')) {
      e.preventDefault();
      api.readClipboard().then((text) => {
        if (text) {
          query = text;
          scheduleRefresh();
        }
      });
      return;
    }

    // Ctrl+Backspace clears the whole query.
    if ((e.ctrlKey || e.metaKey) && k === 'Backspace') {
      e.preventDefault();
      query = '';
      scheduleRefresh();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return; // leave other combos alone

    if (k === 'Backspace') {
      e.preventDefault();
      query = query.slice(0, -1);
      scheduleRefresh();
      return;
    }

    if (k.length === 1) {
      e.preventDefault();
      query += k;
      scheduleRefresh();
    }
  });

  // Trackpad/mouse wheel scrolls the emoji row horizontally.
  listEl.addEventListener(
    'wheel',
    (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        listEl.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    },
    { passive: false }
  );

  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('auxclick', (e) => e.preventDefault());

  // --- main-process events --------------------------------------------------

  api.onShow(({ seed, animate }) => {
    query = seed || '';
    clearTimeout(debounce);
    nameEl.classList.remove('status');
    wordEl.textContent = query;
    if (animate) {
      barEl.classList.remove('enter');
      void barEl.offsetWidth; // restart the entrance animation
      barEl.classList.add('enter');
    }
    refresh();
  });

  api.onStatus(setStatus);

  // Warm the default list so the first show is instant.
  refresh();
})();
