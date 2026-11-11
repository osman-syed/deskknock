import { contextBridge, ipcRenderer } from 'electron'

// Overlay API (only used by the overlay window).
contextBridge.exposeInMainWorld('overlay', {
  onShow: (cb: (payload: unknown) => void) => {
    ipcRenderer.on('overlay:show', (_e, payload) => cb(payload))
  },
  answer: (id: string, a: 'coming' | 'busy5' | 'dismissed') => {
    ipcRenderer.send('overlay:answer', id, a)
  }
})
