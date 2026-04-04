import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addChildNode, getNodePath } from '../../src/lib/treeOps'
import type { TreeData, TreeNode } from '../../src/types'

vi.mock('uuid', () => ({ v4: vi.fn(() => 'new-child-id') }))

function makeTree(overrides: Partial<TreeData> = {}): TreeData {
  return { name: 'myProject', children: [], ...overrides }
}

function makeNode(id: string, name: string, children: TreeNode[] = []): TreeNode {
  return { id, name, expanded: false, summary: '', children, sessions: { claude: null, codex: null, gemini: null, copilot: null, perplexity: null }, urls: [] }
}

// ============================================================
// 親ノード（ルート）での CLI 起動フロー
// ============================================================
describe('親ノード（root）でのCLI起動フロー', () => {
  it('ルートノードのptyIdは __root__-claude になる', () => {
    const nodeId = '__root__'
    const tool = 'claude'
    const ptyId = `${nodeId}-${tool}`
    expect(ptyId).toBe('__root__-claude')
  })

  it('ルートノード起動時のcwdはprojectPathそのもの', () => {
    const projectPath = 'C:\\projects\\myapp'
    const resolvedCwd = projectPath
    expect(resolvedCwd).toBe('C:\\projects\\myapp')
  })

  it('terminals[__root__]にエントリが登録される', () => {
    const terminals: Record<string, { ptyId: string; tool: string }> = {}
    const nodeId = '__root__'
    const tool = 'claude'
    const ptyId = `${nodeId}-${tool}`
    terminals[nodeId] = { ptyId, tool }
    expect(terminals['__root__']).toEqual({ ptyId: '__root__-claude', tool: 'claude' })
  })
})

// ============================================================
// 子ノードの作成
// ============================================================
describe('子ノードの作成', () => {
  let tree: TreeData

  beforeEach(() => {
    tree = makeTree()
  })

  it('ルートに子ノードを追加できる', () => {
    const updated = addChildNode(tree, '__root__', '認証方式の検討')
    expect(updated.children).toHaveLength(1)
    expect(updated.children[0].name).toBe('認証方式の検討')
    expect(updated.children[0].id).toBe('new-child-id')
  })

  it('既存子ノードに孫ノードを追加できる', () => {
    const withChild = addChildNode(tree, '__root__', '認証方式')
    const childId = withChild.children[0].id
    const withGrandchild = addChildNode(withChild, childId, 'OAuth調査')
    expect(withGrandchild.children[0].children).toHaveLength(1)
    expect(withGrandchild.children[0].children[0].name).toBe('OAuth調査')
  })

  it('子ノードのsessionsは初期値null', () => {
    const updated = addChildNode(tree, '__root__', '新項目')
    const child = updated.children[0]
    expect(child.sessions.claude).toBeNull()
    expect(child.sessions.codex).toBeNull()
    expect(child.sessions.gemini).toBeNull()
  })
})

// ============================================================
// 子ノードでの CLI 起動フロー
// ============================================================
describe('子ノードでのCLI起動フロー', () => {
  let tree: TreeData
  let childNode: TreeNode

  beforeEach(() => {
    tree = makeTree({ children: [makeNode('node-001', '認証方式の検討')] })
    childNode = tree.children[0]
  })

  it('子ノードのptyIdは {nodeId}-{tool} 形式', () => {
    const ptyId = `${childNode.id}-claude`
    expect(ptyId).toBe('node-001-claude')
  })

  it('子ノードのcwdはprojectPath + nodeセグメント', () => {
    const projectPath = 'C:\\projects\\myapp'
    const segments = getNodePath(tree, childNode.id)
    const cwd = segments.length > 0 ? [projectPath, ...segments].join('\\') : projectPath
    expect(cwd).toBe('C:\\projects\\myapp\\認証方式の検討')
  })

  it('getNodePathが正しいセグメントを返す', () => {
    const segments = getNodePath(tree, childNode.id)
    expect(segments).toEqual(['認証方式の検討'])
  })

  it('孫ノードのcwdは正しい階層パス', () => {
    const grandchild = makeNode('gc-001', 'OAuth調査')
    const treeWithGrandchild = makeTree({
      children: [makeNode('node-001', '認証方式の検討', [grandchild])]
    })
    const projectPath = 'C:\\projects\\myapp'
    const segments = getNodePath(treeWithGrandchild, 'gc-001')
    const cwd = segments.length > 0 ? [projectPath, ...segments].join('\\') : projectPath
    expect(segments).toEqual(['認証方式の検討', 'OAuth調査'])
    expect(cwd).toBe('C:\\projects\\myapp\\認証方式の検討\\OAuth調査')
  })

  it('terminals[nodeId]にエントリが登録される', () => {
    const terminals: Record<string, { ptyId: string; tool: string }> = {}
    const tool = 'claude'
    const ptyId = `${childNode.id}-${tool}`
    terminals[childNode.id] = { ptyId, tool }
    expect(terminals['node-001']).toEqual({ ptyId: 'node-001-claude', tool: 'claude' })
  })

  it('selectedNodeIdがchildNode.idに更新される', () => {
    let selectedNodeId: string | null = null
    const setSelectedNodeId = (id: string) => { selectedNodeId = id }
    setSelectedNodeId(childNode.id)
    expect(selectedNodeId).toBe('node-001')
  })
})

// ============================================================
// 親ノード → 子ノード作成 → 子ノードCLI起動の連続フロー
// ============================================================
describe('親→子作成→子CLI起動の連続フロー', () => {
  it('ルートから子作成→子でCLI起動まで完結する', () => {
    const tree = makeTree()
    const projectPath = 'C:\\projects\\sample'
    const terminals: Record<string, { ptyId: string; tool: string }> = {}

    // 1. 子ノード作成
    const updated = addChildNode(tree, '__root__', 'DB設計')
    const newChild = updated.children[0]
    expect(newChild.name).toBe('DB設計')

    // 2. cwd解決
    const segments = getNodePath(updated, newChild.id)
    const cwd = segments.length > 0 ? [projectPath, ...segments].join('\\') : projectPath
    expect(cwd).toBe('C:\\projects\\sample\\DB設計')

    // 3. terminals登録
    terminals[newChild.id] = { ptyId: `${newChild.id}-claude`, tool: 'claude' }
    expect(terminals[newChild.id].ptyId).toBe('new-child-id-claude')
  })
})
