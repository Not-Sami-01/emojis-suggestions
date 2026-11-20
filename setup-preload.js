'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('setupApi', {
  install: () => ipcRenderer.invoke('setup:install'),
  close: () => ipcRenderer.invoke('setup:close'),
});
