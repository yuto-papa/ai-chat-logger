import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import pty from 'node-pty'
import * as fileOps from './fileOps'

let mainWindow: BrowserWindow | null = null
const ptyProcesses = new Map<string, pty.IPty>()
const ptyBuffers = new Map<string, string>()
const PTY_BUFFER_MAX = 100000  // 最大100KB バッファ

function setupMCPMemory(): void {
  const claudeConfigPath = path.join(os.homedir(), '.claude.json')
  let config: Record<string, unknown> = {}
  if (fs.existsSync(claudeConfigPath)) {
    try {
      config = JSON.parse(fs.readFileSync(claudeConfigPath, 'utf8'))
    } catch {
      config = {}
    }
  }
  if (!config.mcpServers) config.mcpServers = {}
  ;(config.mcpServers as Record<string, unknown>).memory = {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory']
  }
  try {
    fs.writeFileSync(claudeConfigPath, JSON.stringify(config, null, 2), 'utf8')
  } catch (e) {
    console.error('MCP config write failed:', e)
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#1e1e1e',
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    if (process.env.VSCODE_DEBUG) {
      mainWindow.webContents.openDevTools()
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  setupMCPMemory()
  createWindow()
})

app.on('window-all-closed', () => {
  ptyProcesses.forEach(p => p.kill())
  ptyProcesses.clear()
  app.quit()
})

ipcMain.handle('open-folder-dialog', async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

ipcMain.handle('read-dir', (_event, dirPath: string) => {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    return entries.map(e => ({
      name: e.name,
      path: path.join(dirPath, e.name),
      isDir: e.isDirectory()
    }))
  } catch {
    return []
  }
})

ipcMain.handle('read-tree', (_event, projectPath: string) => fileOps.readTree(projectPath))
ipcMain.handle('write-tree', (_event, projectPath: string, data: unknown) => fileOps.writeTree(projectPath, data as import('../src/types').TreeData))
ipcMain.handle('read-layout', (_event, projectPath: string) => fileOps.readLayout(projectPath))
ipcMain.handle('write-layout', (_event, projectPath: string, layout: unknown) => fileOps.writeLayout(projectPath, layout as Record<string, { x: number; y: number }>))
ipcMain.handle('create-project', (_event, parentPath: string, name: string) => fileOps.createProject(parentPath, name))
ipcMain.handle('show-in-explorer', (_event, filePath: string) => { shell.showItemInFolder(filePath) })
ipcMain.handle('open-external', (_event, url: string) => { shell.openExternal(url) })
ipcMain.handle('window-minimize',  () => { mainWindow?.minimize() })
ipcMain.handle('window-maximize',  () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.handle('window-close',     () => { mainWindow?.close() })
ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() ?? false)
ipcMain.handle('create-folder', (_event, parentPath: string, name: string) => fileOps.createFolder(parentPath, name))
ipcMain.handle('ensure-folder-path', (_event, projectPath: string, segments: string[]) => fileOps.ensureFolderPath(projectPath, segments))
ipcMain.handle('remove-folder-path', (_event, projectPath: string, segments: string[]) => fileOps.removeFolderPath(projectPath, segments))
ipcMain.handle('get-home-dir', () => os.homedir())
ipcMain.handle('read-recent-projects', () => fileOps.readRecentProjects())
ipcMain.handle('add-recent-project', (_event, projectPath: string, projectName: string) => fileOps.addRecentProject(projectPath, projectName))

ipcMain.handle('start-cli', async (_event, ptyId: string, command: string, cwd?: string) => {
  if (ptyProcesses.has(ptyId)) {
    ptyProcesses.get(ptyId)!.kill()
    ptyProcesses.delete(ptyId)
  }
  ptyBuffers.delete(ptyId)
  try {
    const cwdResolved = cwd && fs.existsSync(cwd) ? cwd : os.homedir()
    console.log(`[start-cli] ptyId=${ptyId} command="${command}" cwd="${cwdResolved}"`)
    const proc = pty.spawn('cmd.exe', ['/k', command || ''], {
      name: 'xterm-color',
      cols: 120,
      rows: 30,
      cwd: cwdResolved,
      env: { ...process.env as Record<string, string>, TERM: 'xterm-color' }
    })

    // 最初のデータが届くまで待つ（最大5秒）
    // これにより NodeTerminal マウント時には必ずバッファに初回出力が入っている
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        console.log(`[start-cli] timeout waiting for first output ptyId=${ptyId}`)
        resolve()
      }, 5000)

      proc.onData(data => {
        // バッファに蓄積（超過分は先頭を切り捨て）
        const current = (ptyBuffers.get(ptyId) ?? '') + data
        ptyBuffers.set(ptyId, current.length > PTY_BUFFER_MAX
          ? current.slice(current.length - PTY_BUFFER_MAX)
          : current)
        mainWindow?.webContents.send(`terminal-output-${ptyId}`, data)

        // 最初のデータで resolve（タイマーをキャンセル）
        clearTimeout(timeout)
        resolve()
      })
    })

    proc.onExit(({ exitCode }) => {
      console.log(`[pty exit] ptyId=${ptyId} exitCode=${exitCode}`)
      ptyProcesses.delete(ptyId)
      ptyBuffers.delete(ptyId)
      mainWindow?.webContents.send(`terminal-exit-${ptyId}`, exitCode)
    })

    ptyProcesses.set(ptyId, proc)
    return { success: true }
  } catch (e) {
    console.error(`[start-cli ERROR] ptyId=${ptyId}`, e)
    return { success: false, error: (e as Error).message }
  }
})

ipcMain.handle('get-terminal-buffer', (_event, ptyId: string) => {
  return ptyBuffers.get(ptyId) ?? ''
})

ipcMain.on('terminal-input', (_event, ptyId: string, data: string) => {
  ptyProcesses.get(ptyId)?.write(data)
})

ipcMain.handle('resize-terminal', (_event, ptyId: string, cols: number, rows: number) => {
  ptyProcesses.get(ptyId)?.resize(cols, rows)
})

ipcMain.handle('kill-terminal', (_event, ptyId: string) => {
  const proc = ptyProcesses.get(ptyId)
  if (proc) {
    proc.kill()
    ptyProcesses.delete(ptyId)
  }
})
