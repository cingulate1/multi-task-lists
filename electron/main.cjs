const { app, BrowserWindow, Menu, ipcMain } = require('electron')
const fs = require('fs')
const path = require('path')

// Portable build: keep state.json next to the .exe so the app travels as one unit.
const exeDir = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath)
const stateFile = app.isPackaged
  ? path.join(exeDir, 'state.json')
  : path.join(__dirname, '..', 'state.json')

ipcMain.handle('tdl:load', () => {
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'))
  } catch {
    return null
  }
})

ipcMain.handle('tdl:save', (_e, data) => {
  try {
    fs.writeFileSync(stateFile, JSON.stringify(data, null, 1))
    return true
  } catch {
    return false
  }
})

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico')
  const win = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 880,
    minHeight: 560,
    backgroundColor: '#0a0f1f',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

Menu.setApplicationMenu(null)
app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
