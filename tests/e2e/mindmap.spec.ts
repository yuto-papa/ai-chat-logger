import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { launchApp, makeTmpProject, removeTmpProject, mockOpenDialog } from './helpers'

// ============================================================
// マインドマップ操作 E2E テスト
// ============================================================

async function openProject(app: any, page: any, tmpDir: string) {
  await mockOpenDialog(app, tmpDir)
  await page.click('button:has-text("プロジェクトを開く")')
  await page.locator('.project-name').waitFor({ timeout: 5000 })
}

test.describe('マインドマップ操作', () => {
  test('プロジェクトを開くとマインドマップにルートノードが表示される', async () => {
    const tmpDir = makeTmpProject('mm-root')
    fs.writeFileSync(path.join(tmpDir, 'tree.json'), JSON.stringify({ name: 'RootTest', children: [] }))
    const { app, page } = await launchApp()
    try {
      await openProject(app, page, tmpDir)
      // ルートノードは react-flow ノードとして描画される
      await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 5000 })
      await expect(page.locator('.react-flow__node').first()).toContainText('RootTest')
    } finally {
      await app.close()
      removeTmpProject(tmpDir)
    }
  })

  test('ルートノードを右クリックすると「子ノードを追加」メニューが表示される', async () => {
    const tmpDir = makeTmpProject('mm-rightclick')
    fs.writeFileSync(path.join(tmpDir, 'tree.json'), JSON.stringify({ name: 'TestProj', children: [] }))
    const { app, page } = await launchApp()
    try {
      await openProject(app, page, tmpDir)
      const rootNode = page.locator('.react-flow__node').first()
      await rootNode.click({ button: 'right' })
      await expect(page.locator('.context-menu-item:has-text("子ノードを追加")')).toBeVisible({ timeout: 3000 })
    } finally {
      await app.close()
      removeTmpProject(tmpDir)
    }
  })

  test('子ノードを追加するとマインドマップに新ノードが表示される', async () => {
    const tmpDir = makeTmpProject('mm-addnode')
    fs.writeFileSync(path.join(tmpDir, 'tree.json'), JSON.stringify({ name: 'TestProj', children: [] }))
    const { app, page } = await launchApp()
    try {
      await openProject(app, page, tmpDir)
      // ルートノード右クリック → 子ノードを追加
      await page.locator('.react-flow__node').first().click({ button: 'right' })
      await page.locator('.context-menu-item:has-text("子ノードを追加")').click()
      await page.locator('.context-inline-input').fill('認証方式')
      await page.keyboard.press('Enter')
      // 新ノードがマインドマップに表示される
      await expect(page.locator('.react-flow__node:has-text("認証方式")')).toBeVisible({ timeout: 5000 })
    } finally {
      await app.close()
      removeTmpProject(tmpDir)
    }
  })

  test('子ノードを追加するとプロジェクトフォルダにサブフォルダが作成される', async () => {
    const tmpDir = makeTmpProject('mm-folder-sync')
    fs.writeFileSync(path.join(tmpDir, 'tree.json'), JSON.stringify({ name: 'TestProj', children: [] }))
    const { app, page } = await launchApp()
    try {
      await openProject(app, page, tmpDir)
      await page.locator('.react-flow__node').first().click({ button: 'right' })
      await page.locator('.context-menu-item:has-text("子ノードを追加")').click()
      await page.locator('.context-inline-input').fill('DB設計')
      await page.keyboard.press('Enter')
      await page.locator('.react-flow__node:has-text("DB設計")').waitFor({ timeout: 5000 })
      // フォルダが作成されている
      expect(fs.existsSync(path.join(tmpDir, 'DB設計'))).toBe(true)
    } finally {
      await app.close()
      removeTmpProject(tmpDir)
    }
  })

  test('孫ノード追加でネストフォルダが作成される', async () => {
    const tmpDir = makeTmpProject('mm-nested')
    fs.writeFileSync(path.join(tmpDir, 'tree.json'), JSON.stringify({
      name: 'TestProj',
      children: [{ id: 'c1', name: '認証', expanded: true, summary: '', children: [], sessions: { claude: null, codex: null, gemini: null }, urls: [] }]
    }))
    const { app, page } = await launchApp()
    try {
      await openProject(app, page, tmpDir)
      // 「認証」ノード右クリック → 子ノードを追加
      await page.locator('.react-flow__node:has-text("認証")').click({ button: 'right' })
      await page.locator('.context-menu-item:has-text("子ノードを追加")').click()
      await page.locator('.context-inline-input').fill('JWT調査')
      await page.keyboard.press('Enter')
      await page.locator('.react-flow__node:has-text("JWT調査")').waitFor({ timeout: 5000 })
      // 認証/JWT調査 フォルダが作成されている
      expect(fs.existsSync(path.join(tmpDir, '認証', 'JWT調査'))).toBe(true)
    } finally {
      await app.close()
      removeTmpProject(tmpDir)
    }
  })

  test('ノードを削除すると対応フォルダも削除される', async () => {
    const tmpDir = makeTmpProject('mm-delete')
    fs.mkdirSync(path.join(tmpDir, '削除対象'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'tree.json'), JSON.stringify({
      name: 'TestProj',
      children: [{ id: 'd1', name: '削除対象', expanded: false, summary: '', children: [], sessions: { claude: null, codex: null, gemini: null }, urls: [] }]
    }))
    const { app, page } = await launchApp()
    try {
      await openProject(app, page, tmpDir)
      await page.locator('.react-flow__node:has-text("削除対象")').click({ button: 'right' })
      await page.locator('.context-menu-item:has-text("ノードを削除")').click()
      // confirm ダイアログを承認
      page.on('dialog', d => d.accept())
      await expect(page.locator('.react-flow__node:has-text("削除対象")')).not.toBeVisible({ timeout: 5000 })
      expect(fs.existsSync(path.join(tmpDir, '削除対象'))).toBe(false)
    } finally {
      await app.close()
      removeTmpProject(tmpDir)
    }
  })
})
