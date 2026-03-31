import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import os from 'os'

export async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: [path.join(__dirname, '../../dist-electron/main.js')],
    env: { ...process.env, NODE_ENV: 'test' }
  })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  return { app, page }
}

export function makeTmpProject(name = 'e2e-test-project'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`))
  return dir
}

export function removeTmpProject(dir: string) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
}

/** Electron の dialog.showOpenDialog をモックして特定パスを返す */
export async function mockOpenDialog(app: ElectronApplication, returnPath: string) {
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] })
  }, returnPath)
}
