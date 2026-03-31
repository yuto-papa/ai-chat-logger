import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { launchApp, makeTmpProject, removeTmpProject, mockOpenDialog } from './helpers'

// ============================================================
// プロジェクト操作 E2E テスト
// ============================================================

test.describe('プロジェクト操作', () => {
  test('アプリ起動時に「プロジェクトなし」画面が表示される', async () => {
    const { app, page } = await launchApp()
    try {
      await expect(page.locator('.project-empty-title')).toBeVisible()
      await expect(page.locator('text=プロジェクトなし')).toBeVisible()
    } finally {
      await app.close()
    }
  })

  test('「プロジェクトを開く」でフォルダを選択するとプロジェクト名が表示される', async () => {
    const tmpDir = makeTmpProject('open-project')
    const { app, page } = await launchApp()
    try {
      await mockOpenDialog(app, tmpDir)
      await page.click('button:has-text("プロジェクトを開く")')
      // プロジェクト名 = フォルダ名（basename）
      const folderName = path.basename(tmpDir)
      await expect(page.locator('.project-name')).toHaveText(folderName, { timeout: 5000 })
    } finally {
      await app.close()
      removeTmpProject(tmpDir)
    }
  })

  test('プロジェクトを開くと tree.json が作成される', async () => {
    const tmpDir = makeTmpProject('tree-create')
    const { app, page } = await launchApp()
    try {
      await mockOpenDialog(app, tmpDir)
      await page.click('button:has-text("プロジェクトを開く")')
      await page.locator('.project-name').waitFor({ timeout: 5000 })
      expect(fs.existsSync(path.join(tmpDir, 'tree.json'))).toBe(true)
    } finally {
      await app.close()
      removeTmpProject(tmpDir)
    }
  })

  test('同じプロジェクトを2回開いても最近リストに重複しない', async () => {
    const tmpDir = makeTmpProject('dedup')
    // tree.json を先に作っておく
    fs.writeFileSync(path.join(tmpDir, 'tree.json'), JSON.stringify({ name: 'dedup', children: [] }))
    const { app, page } = await launchApp()
    try {
      await mockOpenDialog(app, tmpDir)
      await page.click('button:has-text("プロジェクトを開く")')
      await page.locator('.project-name').waitFor({ timeout: 5000 })
      // アプリを再起動して最近のリストを確認
      await app.close()

      const { app: app2, page: page2 } = await launchApp()
      await expect(page2.locator('.recent-project-item')).toHaveCount(1, { timeout: 5000 })
      await app2.close()
    } finally {
      removeTmpProject(tmpDir)
    }
  })

  test('最近のプロジェクト一覧をクリックするとそのプロジェクトが開く', async () => {
    const tmpDir = makeTmpProject('recent-click')
    fs.writeFileSync(path.join(tmpDir, 'tree.json'), JSON.stringify({ name: 'recentProject', children: [] }))
    const { app, page } = await launchApp()
    try {
      await mockOpenDialog(app, tmpDir)
      await page.click('button:has-text("プロジェクトを開く")')
      await page.locator('.project-name').waitFor({ timeout: 5000 })
      await app.close()

      // 再起動して最近のリストからクリック
      const { app: app2, page: page2 } = await launchApp()
      await page2.locator('.recent-project-item').first().click()
      await expect(page2.locator('.project-name')).toHaveText('recentProject', { timeout: 5000 })
      await app2.close()
    } finally {
      removeTmpProject(tmpDir)
    }
  })
})
