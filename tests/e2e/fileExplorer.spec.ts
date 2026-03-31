import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { launchApp, makeTmpProject, removeTmpProject, mockOpenDialog } from './helpers'

// ============================================================
// ファイルエクスプローラー E2E テスト
// ============================================================

async function openProject(app: any, page: any, tmpDir: string) {
  await mockOpenDialog(app, tmpDir)
  await page.click('button:has-text("プロジェクトを開く")')
  await page.locator('.project-name').waitFor({ timeout: 5000 })
}

test.describe('ファイルエクスプローラー', () => {
  test('プロジェクトを開くと右ペインにフォルダツリーが表示される', async () => {
    const tmpDir = makeTmpProject('fe-basic')
    fs.mkdirSync(path.join(tmpDir, 'subFolder'))
    fs.writeFileSync(path.join(tmpDir, 'tree.json'), JSON.stringify({ name: 'FETest', children: [] }))
    const { app, page } = await launchApp()
    try {
      await openProject(app, page, tmpDir)
      await expect(page.locator('.file-explorer')).toBeVisible({ timeout: 5000 })
    } finally {
      await app.close()
      removeTmpProject(tmpDir)
    }
  })

  test('フォルダをクリックすると展開される', async () => {
    const tmpDir = makeTmpProject('fe-expand')
    fs.mkdirSync(path.join(tmpDir, 'parentFolder'))
    fs.mkdirSync(path.join(tmpDir, 'parentFolder', 'childFolder'))
    fs.writeFileSync(path.join(tmpDir, 'tree.json'), JSON.stringify({ name: 'FETest', children: [] }))
    const { app, page } = await launchApp()
    try {
      await openProject(app, page, tmpDir)
      // parentFolder をクリック
      await page.locator('.fe-entry:has-text("parentFolder")').click()
      // 子フォルダが表示される
      await expect(page.locator('.fe-entry:has-text("childFolder")')).toBeVisible({ timeout: 5000 })
    } finally {
      await app.close()
      removeTmpProject(tmpDir)
    }
  })

  test('展開済みフォルダを再クリックすると折りたたまれる', async () => {
    const tmpDir = makeTmpProject('fe-collapse')
    fs.mkdirSync(path.join(tmpDir, 'toggleFolder'))
    fs.mkdirSync(path.join(tmpDir, 'toggleFolder', 'inner'))
    fs.writeFileSync(path.join(tmpDir, 'tree.json'), JSON.stringify({ name: 'FETest', children: [] }))
    const { app, page } = await launchApp()
    try {
      await openProject(app, page, tmpDir)
      await page.locator('.fe-entry:has-text("toggleFolder")').click()
      await expect(page.locator('.fe-entry:has-text("inner")')).toBeVisible({ timeout: 3000 })
      // 再クリックで折りたたむ
      await page.locator('.fe-entry:has-text("toggleFolder")').click()
      await expect(page.locator('.fe-entry:has-text("inner")')).not.toBeVisible({ timeout: 3000 })
    } finally {
      await app.close()
      removeTmpProject(tmpDir)
    }
  })

  test('右クリック「新規フォルダを作成」でインライン入力が表示される', async () => {
    const tmpDir = makeTmpProject('fe-newfolder-input')
    fs.writeFileSync(path.join(tmpDir, 'tree.json'), JSON.stringify({ name: 'FETest', children: [] }))
    const { app, page } = await launchApp()
    try {
      await openProject(app, page, tmpDir)
      await page.locator('.file-explorer').click({ button: 'right' })
      await page.locator('.context-menu-item:has-text("新規フォルダを作成")').click()
      await expect(page.locator('.context-inline-input')).toBeVisible({ timeout: 3000 })
    } finally {
      await app.close()
      removeTmpProject(tmpDir)
    }
  })

  test('フォルダ名を入力して Enter するとフォルダが作成される', async () => {
    const tmpDir = makeTmpProject('fe-createfolder')
    fs.writeFileSync(path.join(tmpDir, 'tree.json'), JSON.stringify({ name: 'FETest', children: [] }))
    const { app, page } = await launchApp()
    try {
      await openProject(app, page, tmpDir)
      await page.locator('.file-explorer').click({ button: 'right' })
      await page.locator('.context-menu-item:has-text("新規フォルダを作成")').click()
      await page.locator('.context-inline-input').fill('MyNewFolder')
      await page.keyboard.press('Enter')
      // ファイルシステムに作成されている
      expect(fs.existsSync(path.join(tmpDir, 'MyNewFolder'))).toBe(true)
      // エクスプローラーに表示される
      await expect(page.locator('.fe-entry:has-text("MyNewFolder")')).toBeVisible({ timeout: 5000 })
    } finally {
      await app.close()
      removeTmpProject(tmpDir)
    }
  })

  test('右クリック「エクスプローラーで開く」が選択できる', async () => {
    const tmpDir = makeTmpProject('fe-show-explorer')
    fs.mkdirSync(path.join(tmpDir, 'openMe'))
    fs.writeFileSync(path.join(tmpDir, 'tree.json'), JSON.stringify({ name: 'FETest', children: [] }))
    const { app, page } = await launchApp()
    try {
      await openProject(app, page, tmpDir)
      await page.locator('.fe-entry:has-text("openMe")').click({ button: 'right' })
      // メニューアイテムが表示されることだけ確認（実際のExplorer起動はモック不要）
      await expect(page.locator('.context-menu-item:has-text("エクスプローラーで開く")')).toBeVisible({ timeout: 3000 })
    } finally {
      await app.close()
      removeTmpProject(tmpDir)
    }
  })
})
