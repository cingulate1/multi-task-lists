const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('tdl', {
  load: () => ipcRenderer.invoke('tdl:load'),
  save: (data) => ipcRenderer.invoke('tdl:save', data),
})
