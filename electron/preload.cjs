const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktopApp', {
  isElectron: true,
  platform: process.platform,
  onOpenSettings: (callback) => {
    if (typeof callback !== 'function') {
      return () => {}
    }

    const listener = () => callback()
    ipcRenderer.on('app:open-settings', listener)

    return () => {
      ipcRenderer.removeListener('app:open-settings', listener)
    }
  },
})
