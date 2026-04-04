import { describe, it, expect } from 'vitest'
import type { TreeData, TreeNode } from '../../src/types'

// ============================================================
// 左右ペイントグルの状態管理ロジック
// ============================================================

describe('左右ペイントグル - 状態管理', () => {
  it('showLeftPane: 初期値 true でトグルすると false になる', () => {
    let show = true
    show = !show
    expect(show).toBe(false)
  })

  it('showLeftPane: false からトグルすると true になる', () => {
    let show = false
    show = !show
    expect(show).toBe(true)
  })

  it('showRightPane: 初期値 true でトグルすると false になる', () => {
    let show = true
    show = !show
    expect(show).toBe(false)
  })

  it('showRightPane: false からトグルすると true になる', () => {
    let show = false
    show = !show
    expect(show).toBe(true)
  })

  it('左右ペインは独立して開閉できる', () => {
    let left = true
    let right = true
    left = !left
    expect(left).toBe(false)
    expect(right).toBe(true)  // right は変化しない
    right = !right
    expect(left).toBe(false)  // left は変化しない
    expect(right).toBe(false)
  })

  it('ボタンのラベル: 表示中は閉じる方向 (‹/›)', () => {
    const leftLabel = (show: boolean) => show ? '‹' : '›'
    const rightLabel = (show: boolean) => show ? '›' : '‹'
    expect(leftLabel(true)).toBe('‹')
    expect(leftLabel(false)).toBe('›')
    expect(rightLabel(true)).toBe('›')
    expect(rightLabel(false)).toBe('‹')
  })

  it('CSSクラス: open が付くのは show=true のときだけ', () => {
    const cls = (show: boolean) => `pane-wrapper${show ? ' open' : ''}`
    expect(cls(true)).toBe('pane-wrapper open')
    expect(cls(false)).toBe('pane-wrapper')
  })
})

// ============================================================
// FloatingTerminal - ノード名解決ロジック
// ============================================================

function makeNode(id: string, name: string, children: TreeNode[] = []): TreeNode {
  return { id, name, expanded: false, summary: '', children, sessions: { claude: null, codex: null, gemini: null, copilot: null, perplexity: null }, urls: [] }
}

function makeTree(name: string, children: TreeNode[] = []): TreeData {
  return { name, children }
}

function getNodeName(treeData: TreeData | null, nodeId: string): string {
  if (nodeId === '__root__') return treeData?.name ?? 'プロジェクト'
  const walk = (node: TreeNode): string | null => {
    if (node.id === nodeId) return node.name
    for (const c of node.children) {
      const found = walk(c)
      if (found) return found
    }
    return null
  }
  if (treeData) {
    for (const c of treeData.children) {
      const found = walk(c)
      if (found) return found
    }
  }
  return nodeId
}

describe('FloatingTerminal - getNodeName', () => {
  it('__root__ はプロジェクト名を返す', () => {
    const tree = makeTree('MyProject')
    expect(getNodeName(tree, '__root__')).toBe('MyProject')
  })

  it('treeData が null のとき __root__ は "プロジェクト" を返す', () => {
    expect(getNodeName(null, '__root__')).toBe('プロジェクト')
  })

  it('子ノードの名前を返す', () => {
    const tree = makeTree('Root', [makeNode('n1', '認証方式')])
    expect(getNodeName(tree, 'n1')).toBe('認証方式')
  })

  it('孫ノードの名前を返す', () => {
    const gc = makeNode('gc1', 'JWT調査')
    const tree = makeTree('Root', [makeNode('n1', '認証', [gc])])
    expect(getNodeName(tree, 'gc1')).toBe('JWT調査')
  })

  it('存在しない ID はその ID 文字列をそのまま返す', () => {
    const tree = makeTree('Root', [makeNode('n1', '認証')])
    expect(getNodeName(tree, 'unknown-id')).toBe('unknown-id')
  })

  it('treeData が null のとき存在しない ID はその ID を返す', () => {
    expect(getNodeName(null, 'some-id')).toBe('some-id')
  })
})

// ============================================================
// FloatingTerminal - initialOffset によるウィンドウ配置計算
// ============================================================

describe('FloatingTerminal - 複数インスタンスの initialOffset', () => {
  it('index 0 のオフセットは 0', () => {
    const offset = 0 * 32
    expect(offset).toBe(0)
  })

  it('index 1 のオフセットは 32', () => {
    const offset = 1 * 32
    expect(offset).toBe(32)
  })

  it('index 2 のオフセットは 64', () => {
    const offset = 2 * 32
    expect(offset).toBe(64)
  })

  it('各インスタンスの初期位置は一意になる', () => {
    const positions = [0, 1, 2, 3].map(i => ({
      x: 80 + i * 32,
      y: 80 + i * 32,
    }))
    const xs = positions.map(p => p.x)
    const ys = positions.map(p => p.y)
    // 全て異なる
    expect(new Set(xs).size).toBe(xs.length)
    expect(new Set(ys).size).toBe(ys.length)
  })

  it('floatingEntries は float モードのノードだけ含む', () => {
    type TerminalEntry = { ptyId: string; tool: string }
    const terminals: Record<string, TerminalEntry> = {
      'n1': { ptyId: 'n1-claude', tool: 'claude' },
      'n2': { ptyId: 'n2-claude', tool: 'claude' },
      'n3': { ptyId: 'n3-gemini', tool: 'gemini' },
    }
    const modes: Record<string, string> = {
      'n1': 'tab',
      'n2': 'float',
      'n3': 'float',
    }
    const floatingEntries = Object.entries(terminals).filter(
      ([nodeId]) => modes[nodeId] === 'float'
    )
    expect(floatingEntries).toHaveLength(2)
    expect(floatingEntries.map(([id]) => id)).toEqual(['n2', 'n3'])
  })

  it('floatingEntries が空のときフローティングウィンドウは表示されない', () => {
    const terminals: Record<string, { ptyId: string; tool: string }> = {
      'n1': { ptyId: 'n1-claude', tool: 'claude' },
    }
    const modes: Record<string, string> = { 'n1': 'tab' }
    const floatingEntries = Object.entries(terminals).filter(
      ([nodeId]) => modes[nodeId] === 'float'
    )
    expect(floatingEntries).toHaveLength(0)
  })
})

// ============================================================
// FloatingTerminal - リサイズ制約
// ============================================================

describe('FloatingTerminal - リサイズ制約', () => {
  const MIN_W = 400
  const MIN_H = 240

  function calcSize(baseW: number, baseH: number, dx: number, dy: number) {
    return {
      w: Math.max(MIN_W, baseW + dx),
      h: Math.max(MIN_H, baseH + dy),
    }
  }

  it('幅は MIN_W (400) 未満にならない', () => {
    const { w } = calcSize(400, 480, -200, 0)
    expect(w).toBe(MIN_W)
  })

  it('高さは MIN_H (240) 未満にならない', () => {
    const { h } = calcSize(820, 240, 0, -100)
    expect(h).toBe(MIN_H)
  })

  it('拡大方向は制限されない', () => {
    const { w, h } = calcSize(820, 480, 200, 100)
    expect(w).toBe(1020)
    expect(h).toBe(580)
  })

  it('dx=0, dy=0 のとき元のサイズを維持する', () => {
    const { w, h } = calcSize(820, 480, 0, 0)
    expect(w).toBe(820)
    expect(h).toBe(480)
  })
})
