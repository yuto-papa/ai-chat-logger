import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import * as fileOps from '../../electron/fileOps'

// ---- テンポラリディレクトリのヘルパー ----

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'thinktool-test-'))
}

function removeTmpDir(dir: string) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
}

// ============================================================
// ensureFolderPath
// ============================================================
describe('ensureFolderPath', () => {
  let tmpDir: string
  beforeEach(() => { tmpDir = makeTmpDir() })
  afterEach(() => { removeTmpDir(tmpDir) })

  it('存在しないネストパスを作成する', () => {
    const result = fileOps.ensureFolderPath(tmpDir, ['認証方式', 'JWT調査'])
    expect(result.success).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, '認証方式', 'JWT調査'))).toBe(true)
  })

  it('既存フォルダを指定してもエラーにならない', () => {
    fileOps.ensureFolderPath(tmpDir, ['already'])
    const result = fileOps.ensureFolderPath(tmpDir, ['already'])
    expect(result.success).toBe(true)
  })

  it('ファイル名に使えない文字は _ に置換される', () => {
    const result = fileOps.ensureFolderPath(tmpDir, ['bad:name*here'])
    expect(result.success).toBe(true)
    const created = path.join(tmpDir, 'bad_name_here')
    expect(fs.existsSync(created)).toBe(true)
  })

  it('単一セグメントでも動作する', () => {
    const result = fileOps.ensureFolderPath(tmpDir, ['single'])
    expect(result.success).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'single'))).toBe(true)
  })
})

// ============================================================
// removeFolderPath
// ============================================================
describe('removeFolderPath', () => {
  let tmpDir: string
  beforeEach(() => { tmpDir = makeTmpDir() })
  afterEach(() => { removeTmpDir(tmpDir) })

  it('フォルダとその中身を再帰削除する', () => {
    const target = path.join(tmpDir, 'parent', 'child')
    fs.mkdirSync(target, { recursive: true })
    fs.writeFileSync(path.join(target, 'file.txt'), 'data')
    const result = fileOps.removeFolderPath(tmpDir, ['parent'])
    expect(result.success).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'parent'))).toBe(false)
  })

  it('存在しないパスでもエラーにならない', () => {
    const result = fileOps.removeFolderPath(tmpDir, ['nonexistent'])
    expect(result.success).toBe(true)
  })

  it('削除後、兄弟フォルダは残る', () => {
    fs.mkdirSync(path.join(tmpDir, 'keep'), { recursive: true })
    fs.mkdirSync(path.join(tmpDir, 'delete'), { recursive: true })
    fileOps.removeFolderPath(tmpDir, ['delete'])
    expect(fs.existsSync(path.join(tmpDir, 'keep'))).toBe(true)
  })
})

// ============================================================
// addRecentProject / readRecentProjects
// ============================================================
describe('addRecentProject / readRecentProjects', () => {
  let tmpDir: string
  let recentPath: string

  beforeEach(() => {
    tmpDir = makeTmpDir()
    recentPath = path.join(tmpDir, 'recent.json')
  })
  afterEach(() => { removeTmpDir(tmpDir) })

  const opts = () => ({ recentPath, thinktoolDir: tmpDir, maxRecent: 16 })

  it('新規追加するとリストの先頭に入る', () => {
    fileOps.addRecentProject('/proj/A', 'A', opts())
    const list = fileOps.readRecentProjects(recentPath)
    expect(list[0].path).toBe('/proj/A')
    expect(list[0].name).toBe('A')
  })

  it('同じパスを再追加すると重複せず先頭に移動する', () => {
    fileOps.addRecentProject('/proj/A', 'A', opts())
    fileOps.addRecentProject('/proj/B', 'B', opts())
    fileOps.addRecentProject('/proj/A', 'A', opts())
    const list = fileOps.readRecentProjects(recentPath)
    expect(list).toHaveLength(2)
    expect(list[0].path).toBe('/proj/A')
  })

  it('17件追加すると16件に切り詰められる', () => {
    for (let i = 0; i < 17; i++) {
      fileOps.addRecentProject(`/proj/${i}`, `Project${i}`, opts())
    }
    const list = fileOps.readRecentProjects(recentPath)
    expect(list).toHaveLength(16)
  })

  it('openedAt が ISO 8601 形式で記録される', () => {
    fileOps.addRecentProject('/proj/X', 'X', opts())
    const list = fileOps.readRecentProjects(recentPath)
    expect(() => new Date(list[0].openedAt)).not.toThrow()
    expect(new Date(list[0].openedAt).toISOString()).toBe(list[0].openedAt)
  })

  it('ファイルが存在しないとき readRecentProjects は空配列を返す', () => {
    const result = fileOps.readRecentProjects(path.join(tmpDir, 'nosuchfile.json'))
    expect(result).toEqual([])
  })

  it('不正 JSON でも readRecentProjects はクラッシュせず空配列を返す', () => {
    fs.writeFileSync(recentPath, 'NOT_JSON', 'utf8')
    const result = fileOps.readRecentProjects(recentPath)
    expect(result).toEqual([])
  })
})

// ============================================================
// createProject
// ============================================================
describe('createProject', () => {
  let tmpDir: string
  beforeEach(() => { tmpDir = makeTmpDir() })
  afterEach(() => { removeTmpDir(tmpDir) })

  it('新規フォルダを作成し tree.json を初期化する', () => {
    const result = fileOps.createProject(tmpDir, 'MyProject')
    expect(result.success).toBe(true)
    const treePath = path.join(result.projectPath, 'tree.json')
    expect(fs.existsSync(treePath)).toBe(true)
    const tree = JSON.parse(fs.readFileSync(treePath, 'utf8'))
    expect(tree.name).toBe('MyProject')
    expect(tree.children).toEqual([])
  })

  it('既存フォルダを指定しても tree.json が上書きされない', () => {
    fileOps.createProject(tmpDir, 'Existing')
    const projectPath = path.join(tmpDir, 'Existing')
    const treePath = path.join(projectPath, 'tree.json')
    const original = fs.readFileSync(treePath, 'utf8')
    // 手動で書き換え
    fs.writeFileSync(treePath, JSON.stringify({ name: 'Existing', children: [{ id: 'x' }] }, null, 2))
    fileOps.createProject(tmpDir, 'Existing')
    const current = fs.readFileSync(treePath, 'utf8')
    expect(current).not.toBe(original) // 上書きされていない (= 変更後の内容が保持)
    expect(JSON.parse(current).children).toHaveLength(1)
  })

  it('プロジェクト名に禁止文字が含まれる場合 _ に置換される', () => {
    const result = fileOps.createProject(tmpDir, 'bad:name')
    expect(result.success).toBe(true)
    expect(result.projectPath).toContain('bad_name')
  })
})

// ============================================================
// readTree / writeTree
// ============================================================
describe('readTree / writeTree', () => {
  let tmpDir: string
  beforeEach(() => { tmpDir = makeTmpDir() })
  afterEach(() => { removeTmpDir(tmpDir) })

  it('writeTree で書き込んだデータを readTree で読み返せる', () => {
    const data = { name: 'Test', children: [{ id: 'n1', name: 'Node1', expanded: false, summary: '', children: [], sessions: { claude: null, codex: null, gemini: null }, urls: [] }] }
    fileOps.writeTree(tmpDir, data)
    const read = fileOps.readTree(tmpDir)
    expect(read).toEqual(data)
  })

  it('tree.json が存在しないとき readTree は null を返す', () => {
    const result = fileOps.readTree(tmpDir)
    expect(result).toBeNull()
  })

  it('tree.json が不正 JSON のとき readTree は null を返す', () => {
    fs.writeFileSync(path.join(tmpDir, 'tree.json'), 'INVALID', 'utf8')
    const result = fileOps.readTree(tmpDir)
    expect(result).toBeNull()
  })
})

// ============================================================
// readLayout / writeLayout
// ============================================================
describe('readLayout / writeLayout', () => {
  let tmpDir: string
  beforeEach(() => { tmpDir = makeTmpDir() })
  afterEach(() => { removeTmpDir(tmpDir) })

  it('writeLayout で書き込んだデータを readLayout で読み返せる', () => {
    const layout = { 'node-1': { x: 100, y: 200 }, 'node-2': { x: 300, y: 400 } }
    fileOps.writeLayout(tmpDir, layout)
    const result = fileOps.readLayout(tmpDir)
    expect(result).toEqual(layout)
  })

  it('layout.json が存在しないとき readLayout は空オブジェクトを返す', () => {
    const result = fileOps.readLayout(tmpDir)
    expect(result).toEqual({})
  })

  it('layout.json が不正 JSON のとき readLayout は空オブジェクトを返す', () => {
    const layoutPath = path.join(tmpDir, 'layout.json')
    fs.writeFileSync(layoutPath, 'INVALID_JSON', 'utf8')
    const result = fileOps.readLayout(tmpDir)
    expect(result).toEqual({})
  })

  it('空のレイアウトを書き込んで読み返せる', () => {
    fileOps.writeLayout(tmpDir, {})
    const result = fileOps.readLayout(tmpDir)
    expect(result).toEqual({})
  })

  it('上書き保存すると最新の値が反映される', () => {
    fileOps.writeLayout(tmpDir, { 'node-1': { x: 10, y: 20 } })
    fileOps.writeLayout(tmpDir, { 'node-1': { x: 999, y: 888 } })
    const result = fileOps.readLayout(tmpDir)
    expect(result['node-1']).toEqual({ x: 999, y: 888 })
  })
})
// ============================================================
// createFolder
// ============================================================
describe('createFolder', () => {
  let tmpDir: string
  beforeEach(() => { tmpDir = makeTmpDir() })
  afterEach(() => { removeTmpDir(tmpDir) })

  it('指定された名前のフォルダを作成する', () => {
    const result = fileOps.createFolder(tmpDir, 'newFolder')
    expect(result.success).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'newFolder'))).toBe(true)
  })

  it('既存フォルダでもエラーにならない', () => {
    fileOps.createFolder(tmpDir, 'exists')
    const result = fileOps.createFolder(tmpDir, 'exists')
    expect(result.success).toBe(true)
  })
})
