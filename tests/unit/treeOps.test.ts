import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  toggleNode, renameNode, addChildNode, deleteNode,
  setSessionId, getNodePath, moveNode, isDescendant
} from '../../src/lib/treeOps'
import type { TreeData, TreeNode } from '../../src/types'

// uuid をモック — 予測可能な ID を生成
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid')
}))

// ---- テスト用データファクトリ ----

function makeNode(id: string, name: string, overrides: Partial<TreeNode> = {}): TreeNode {
  return {
    id, name, expanded: false, summary: '',
    children: [], sessions: { claude: null, codex: null, gemini: null, copilot: null, perplexity: null }, urls: [],
    ...overrides
  }
}

function makeTree(overrides: Partial<TreeData> = {}): TreeData {
  return { name: 'testProject', children: [], ...overrides }
}

// ============================================================
// toggleNode
// ============================================================
describe('toggleNode', () => {
  it('ルート直下ノードの expanded を反転する', () => {
    const node = makeNode('n1', 'A', { expanded: false })
    const tree = makeTree({ children: [node] })
    const result = toggleNode(tree, 'n1')
    expect(result.children[0].expanded).toBe(true)
  })

  it('再度呼ぶと元に戻る', () => {
    const node = makeNode('n1', 'A', { expanded: true })
    const tree = makeTree({ children: [node] })
    const result = toggleNode(tree, 'n1')
    expect(result.children[0].expanded).toBe(false)
  })

  it('孫ノードだけを反転し、他ノードは変化しない', () => {
    const grandchild = makeNode('gc1', 'GC', { expanded: false })
    const child = makeNode('c1', 'C', { expanded: true, children: [grandchild] })
    const tree = makeTree({ children: [child] })
    const result = toggleNode(tree, 'gc1')
    expect(result.children[0].expanded).toBe(true)          // child は不変
    expect(result.children[0].children[0].expanded).toBe(true) // 孫が反転
  })

  it('存在しない ID を渡してもツリーは変化しない', () => {
    const node = makeNode('n1', 'A', { expanded: false })
    const tree = makeTree({ children: [node] })
    const result = toggleNode(tree, 'NONEXISTENT')
    expect(result.children[0].expanded).toBe(false)
  })
})

// ============================================================
// renameNode
// ============================================================
describe('renameNode', () => {
  it('ノード名を変更する', () => {
    const node = makeNode('n1', 'OldName')
    const tree = makeTree({ children: [node] })
    const result = renameNode(tree, 'n1', 'NewName')
    expect(result.children[0].name).toBe('NewName')
  })

  it('名前以外のフィールドは変化しない', () => {
    const node = makeNode('n1', 'OldName', { expanded: true, summary: 'memo' })
    const tree = makeTree({ children: [node] })
    const result = renameNode(tree, 'n1', 'NewName')
    expect(result.children[0].expanded).toBe(true)
    expect(result.children[0].summary).toBe('memo')
  })

  it('孫ノードをリネームできる', () => {
    const gc = makeNode('gc1', 'OldGC')
    const child = makeNode('c1', 'C', { children: [gc] })
    const tree = makeTree({ children: [child] })
    const result = renameNode(tree, 'gc1', 'NewGC')
    expect(result.children[0].children[0].name).toBe('NewGC')
  })

  it('存在しない ID はツリーに影響しない', () => {
    const node = makeNode('n1', 'Original')
    const tree = makeTree({ children: [node] })
    const result = renameNode(tree, 'NONE', 'Changed')
    expect(result.children[0].name).toBe('Original')
  })
})

// ============================================================
// addChildNode
// ============================================================
describe('addChildNode', () => {
  beforeEach(() => {
    vi.mocked(vi.fn()).mockReturnValue('mock-uuid')
  })

  it('__root__ に追加するとルート直下に新ノードが追加される', () => {
    const tree = makeTree()
    const result = addChildNode(tree, '__root__', 'NewNode')
    expect(result.children).toHaveLength(1)
    expect(result.children[0].name).toBe('NewNode')
  })

  it('追加されたノードは正しい初期値を持つ', () => {
    const tree = makeTree()
    const result = addChildNode(tree, '__root__', 'Node')
    const added = result.children[0]
    expect(added.expanded).toBe(true)
    expect(added.summary).toBe('')
    expect(added.children).toEqual([])
    expect(added.sessions).toEqual({ claude: null, codex: null, gemini: null, copilot: null, perplexity: null })
    expect(added.urls).toEqual([])
  })

  it('既存ノードに子ノードを追加するとそのノードの children に入る', () => {
    const parent = makeNode('p1', 'Parent')
    const tree = makeTree({ children: [parent] })
    const result = addChildNode(tree, 'p1', 'Child')
    expect(result.children[0].children).toHaveLength(1)
    expect(result.children[0].children[0].name).toBe('Child')
  })

  it('子ノードを追加すると親ノードが expanded=true になる', () => {
    const parent = makeNode('p1', 'Parent', { expanded: false })
    const tree = makeTree({ children: [parent] })
    const result = addChildNode(tree, 'p1', 'Child')
    expect(result.children[0].expanded).toBe(true)
  })

  it('複数回追加しても既存ノードは保持される', () => {
    let tree = makeTree()
    tree = addChildNode(tree, '__root__', 'A')
    tree = addChildNode(tree, '__root__', 'B')
    expect(tree.children).toHaveLength(2)
    expect(tree.children[0].name).toBe('A')
    expect(tree.children[1].name).toBe('B')
  })
})

// ============================================================
// deleteNode
// ============================================================
describe('deleteNode', () => {
  it('ルート直下ノードを削除できる', () => {
    const n1 = makeNode('n1', 'A')
    const n2 = makeNode('n2', 'B')
    const tree = makeTree({ children: [n1, n2] })
    const result = deleteNode(tree, 'n1')
    expect(result.children).toHaveLength(1)
    expect(result.children[0].id).toBe('n2')
  })

  it('孫ノードを削除しても親は残る', () => {
    const gc = makeNode('gc1', 'GC')
    const child = makeNode('c1', 'C', { children: [gc] })
    const tree = makeTree({ children: [child] })
    const result = deleteNode(tree, 'gc1')
    expect(result.children[0].children).toHaveLength(0)
    expect(result.children[0].id).toBe('c1')
  })

  it('子ノードを持つノードを削除するとその配下も全て消える', () => {
    const gc = makeNode('gc1', 'GC')
    const child = makeNode('c1', 'C', { children: [gc] })
    const tree = makeTree({ children: [child] })
    const result = deleteNode(tree, 'c1')
    expect(result.children).toHaveLength(0)
  })

  it('存在しない ID を渡してもツリーは変化しない', () => {
    const node = makeNode('n1', 'A')
    const tree = makeTree({ children: [node] })
    const result = deleteNode(tree, 'NONE')
    expect(result.children).toHaveLength(1)
  })
})

// ============================================================
// setSessionId
// ============================================================
describe('setSessionId', () => {
  it('claude のセッション ID をセットできる', () => {
    const node = makeNode('n1', 'A')
    const tree = makeTree({ children: [node] })
    const result = setSessionId(tree, 'n1', 'claude', 'sess-abc')
    expect(result.children[0].sessions.claude).toBe('sess-abc')
  })

  it('claude だけが変わり codex/gemini は変化しない', () => {
    const node = makeNode('n1', 'A', { sessions: { claude: null, codex: 'c1', gemini: 'g1', copilot: null, perplexity: null } })
    const tree = makeTree({ children: [node] })
    const result = setSessionId(tree, 'n1', 'claude', 'new-sess')
    expect(result.children[0].sessions.codex).toBe('c1')
    expect(result.children[0].sessions.gemini).toBe('g1')
  })

  it('孫ノードにセッション ID をセットできる', () => {
    const gc = makeNode('gc1', 'GC')
    const child = makeNode('c1', 'C', { children: [gc] })
    const tree = makeTree({ children: [child] })
    const result = setSessionId(tree, 'gc1', 'gemini', 'g-sess')
    expect(result.children[0].children[0].sessions.gemini).toBe('g-sess')
  })

  it('copilot の URL をセットできる', () => {
    const node = makeNode('n1', 'A')
    const tree = makeTree({ children: [node] })
    const url = 'https://copilot.microsoft.com/chats/abc123'
    const result = setSessionId(tree, 'n1', 'copilot', url)
    expect(result.children[0].sessions.copilot).toBe(url)
  })

  it('perplexity の URL をセットできる', () => {
    const node = makeNode('n1', 'A')
    const tree = makeTree({ children: [node] })
    const url = 'https://www.perplexity.ai/s/xyz789'
    const result = setSessionId(tree, 'n1', 'perplexity', url)
    expect(result.children[0].sessions.perplexity).toBe(url)
  })

  it('copilot をセットしても他のセッションは変化しない', () => {
    const node = makeNode('n1', 'A', {
      sessions: { claude: 'c-sess', codex: null, gemini: null, copilot: null, perplexity: null }
    })
    const tree = makeTree({ children: [node] })
    const result = setSessionId(tree, 'n1', 'copilot', 'https://copilot.microsoft.com/chats/x')
    expect(result.children[0].sessions.claude).toBe('c-sess')
    expect(result.children[0].sessions.codex).toBeNull()
    expect(result.children[0].sessions.gemini).toBeNull()
    expect(result.children[0].sessions.perplexity).toBeNull()
  })
})

// ============================================================
// getNodePath
// ============================================================
describe('getNodePath', () => {
  it('ルート直下ノードのパスは [ノード名]', () => {
    const node = makeNode('n1', '認証方式')
    const tree = makeTree({ children: [node] })
    expect(getNodePath(tree, 'n1')).toEqual(['認証方式'])
  })

  it('深さ3の孫ノードのパスは [親名, 子名, 孫名]', () => {
    const gc = makeNode('gc1', '孫')
    const child = makeNode('c1', '子', { children: [gc] })
    const parent = makeNode('p1', '親', { children: [child] })
    const tree = makeTree({ children: [parent] })
    expect(getNodePath(tree, 'gc1')).toEqual(['親', '子', '孫'])
  })

  it('存在しない ID は空配列を返す', () => {
    const tree = makeTree({ children: [makeNode('n1', 'A')] })
    expect(getNodePath(tree, 'NONE')).toEqual([])
  })

  it('同名ノードが複数あっても ID で正しく区別する', () => {
    const node1 = makeNode('id-1', '重複名')
    const node2 = makeNode('id-2', '重複名')
    const tree = makeTree({ children: [node1, node2] })
    expect(getNodePath(tree, 'id-1')).toEqual(['重複名'])
    expect(getNodePath(tree, 'id-2')).toEqual(['重複名'])
    // どちらも長さ1 (別ノード)
    expect(getNodePath(tree, 'id-1')).not.toEqual(getNodePath(tree, 'NONE'))
  })

  it('同名の親と子があるとき、子のパスは [親名, 子名]', () => {
    const child = makeNode('c1', '設計')
    const parent = makeNode('p1', '設計', { children: [child] })
    const tree = makeTree({ children: [parent] })
    expect(getNodePath(tree, 'c1')).toEqual(['設計', '設計'])
    expect(getNodePath(tree, 'p1')).toEqual(['設計'])
  })
})

// ============================================================
// isDescendant
// ============================================================
describe('isDescendant', () => {
  it('同一ノードはtrueを返す', () => {
    const tree = makeTree({ children: [makeNode('n1', 'A')] })
    expect(isDescendant(tree, 'n1', 'n1')).toBe(true)
  })

  it('子孫ノードはtrueを返す', () => {
    const child = makeNode('c1', '子')
    const parent = makeNode('p1', '親', { children: [child] })
    const tree = makeTree({ children: [parent] })
    expect(isDescendant(tree, 'p1', 'c1')).toBe(true)
  })

  it('祖先ノードはfalseを返す', () => {
    const child = makeNode('c1', '子')
    const parent = makeNode('p1', '親', { children: [child] })
    const tree = makeTree({ children: [parent] })
    expect(isDescendant(tree, 'c1', 'p1')).toBe(false)
  })

  it('無関係ノードはfalseを返す', () => {
    const n1 = makeNode('n1', 'A')
    const n2 = makeNode('n2', 'B')
    const tree = makeTree({ children: [n1, n2] })
    expect(isDescendant(tree, 'n1', 'n2')).toBe(false)
  })
})

// ============================================================
// moveNode
// ============================================================
describe('moveNode', () => {
  let tree: TreeData

  beforeEach(() => {
    const c1 = makeNode('c1', '子1')
    const c2 = makeNode('c2', '子2')
    const p1 = makeNode('p1', '親1', { children: [c1] })
    const p2 = makeNode('p2', '親2', { children: [c2] })
    tree = makeTree({ children: [p1, p2] })
  })

  it('ノードを別の親の子に移動できる', () => {
    const updated = moveNode(tree, 'c1', 'p2')
    expect(updated.children.find(n => n.id === 'p1')?.children).toHaveLength(0)
    expect(updated.children.find(n => n.id === 'p2')?.children.map(n => n.id)).toContain('c1')
  })

  it('ノードをルート直下に移動できる', () => {
    const updated = moveNode(tree, 'c1', '__root__')
    expect(updated.children.map(n => n.id)).toContain('c1')
    expect(updated.children.find(n => n.id === 'p1')?.children).toHaveLength(0)
  })

  it('自分自身への移動は変更なし', () => {
    const updated = moveNode(tree, 'p1', 'p1')
    expect(updated).toBe(tree)
  })

  it('子孫への移動（循環）は変更なし', () => {
    const updated = moveNode(tree, 'p1', 'c1')
    expect(updated).toBe(tree)
  })

  it('移動後も他のノードは保持される', () => {
    const updated = moveNode(tree, 'c1', 'p2')
    expect(updated.children).toHaveLength(2)
    const p2 = updated.children.find(n => n.id === 'p2')
    expect(p2?.children.map(n => n.id)).toEqual(['c2', 'c1'])
  })

  it('存在しないnodeIdは変更なし', () => {
    const updated = moveNode(tree, 'nonexistent', 'p2')
    expect(updated).toBe(tree)
  })
})
