const path = require('node:path')
const { app, BrowserWindow, Menu, shell } = require('electron')

const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL || 'http://127.0.0.1:5173'
const DEV_ICON_PATH = path.join(__dirname, '..', 'public', 'app-icons', 'icon.png')
const DEV_WINDOWS_ICON_PATH = path.join(__dirname, '..', 'public', 'app-icons', 'icon.ico')

function openSettings(focusedWindow) {
  const targetWindow = focusedWindow || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
  if (!targetWindow || targetWindow.isDestroyed()) {
    return
  }
  targetWindow.webContents.send('app:open-settings')
}

function buildMenu() {
  const isMac = process.platform === 'darwin'
  const settingsItem = {
    label: isMac ? 'Settings…' : 'Settings',
    accelerator: 'CmdOrCtrl+,',
    click: (_menuItem, focusedWindow) => openSettings(focusedWindow),
  }

  const template = isMac
    ? [
        {
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            settingsItem,
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        },
        { role: 'editMenu' },
        { role: 'viewMenu' },
        { role: 'windowMenu' },
      ]
    : [
        {
          label: 'File',
          submenu: [settingsItem, { type: 'separator' }, { role: 'quit' }],
        },
        { role: 'editMenu' },
        { role: 'viewMenu' },
      ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow() {
  const isMac = process.platform === 'darwin'
  const isWindows = process.platform === 'win32'
  const packagedWindowsIconPath = path.join(process.resourcesPath, 'icon.ico')
  const windowIcon = isWindows ? (app.isPackaged ? packagedWindowsIconPath : DEV_WINDOWS_ICON_PATH) : DEV_ICON_PATH

  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    autoHideMenuBar: true,
    backgroundColor: '#00000000',
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    titleBarOverlay: isWindows
      ? {
          color: '#00000000',
          symbolColor: '#d7efe1',
          height: 40,
        }
      : false,
    ...(isMac
      ? {
          transparent: true,
          vibrancy: 'sidebar',
          visualEffectState: 'active',
          trafficLightPosition: { x: 14, y: 14 },
        }
      : {}),
    ...(!isMac ? { icon: windowIcon } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  const toggleDevTools = () => {
    if (win.webContents.isDevToolsOpened()) {
      win.webContents.closeDevTools()
    } else {
      win.webContents.openDevTools({ mode: 'detach' })
    }
  }

  win.webContents.on('before-input-event', (_event, input) => {
    const openByF12 = input.type === 'keyDown' && input.key === 'F12'
    const openByShortcut =
      input.type === 'keyDown' &&
      input.key.toLowerCase() === 'i' &&
      input.control &&
      input.shift
    if (openByF12 || openByShortcut) {
      toggleDevTools()
    }
  })

  if (!app.isPackaged) {
    void win.loadURL(DEV_SERVER_URL)
    win.webContents.openDevTools({ mode: 'detach' })
    return
  }

  void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

app.whenReady().then(() => {
  buildMenu()

  if (process.platform === 'darwin' && !app.isPackaged && app.dock) {
    app.dock.setIcon(DEV_ICON_PATH)
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
