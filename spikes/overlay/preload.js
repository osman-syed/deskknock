const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('spike', { reply: (a) => ipcRenderer.send('reply', a) });
