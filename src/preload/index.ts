import { contextBridge, ipcRenderer } from 'electron'

// Overlay API (only used by the overlay window).
contextBridge.exposeInMainWorld('overlay', {
  onShow: (cb: (payload: unknown) => void) => {
    ipcRenderer.on('overlay:show', (_e, payload) => cb(payload))
  },
  // Tell main the listener is registered; main then flushes any pending payload.
  ready: () => {
    ipcRenderer.send('overlay:ready')
  },
  answer: (id: string, a: 'coming' | 'busy5' | 'dismissed') => {
    ipcRenderer.send('overlay:answer', id, a)
  }
})

// Main window API.
contextBridge.exposeInMainWorld('deskknock', {
  onState: (cb: (s: unknown) => void) => {
    ipcRenderer.on('deskknock:state', (_e, s) => cb(s))
    ipcRenderer.send('deskknock:ready') // main replies with the current state
  },
  knock: (peerId: string) => ipcRenderer.send('deskknock:knock', peerId),
  cancel: (peerId: string) => ipcRenderer.send('deskknock:cancel', peerId),
  saveSettings: (s: unknown) => ipcRenderer.send('deskknock:saveSettings', s)
})
