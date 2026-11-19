'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('emojiBar', {
  suggest: (word) => ipcRenderer.invoke('suggest', word),
  pick: (emoji) => ipcRenderer.invoke('pick', emoji),
  insert: (emoji) => ipcRenderer.invoke('insert', emoji),
  close: () => ipcRenderer.invoke('close'),
  readClipboard: () => ipcRenderer.invoke('read-clipboard'),
  onShow: (cb) => ipcRenderer.on('show', (_e, payload) => cb(payload)),
  onStatus: (cb) => ipcRenderer.on('status', (_e, text) => cb(text)),
  dragStart: (p) => ipcRenderer.send('drag-start', p),
  dragMove: (p) => ipcRenderer.send('drag-move', p),
  dragEnd: () => ipcRenderer.send('drag-end'),
});
