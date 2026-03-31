import { describe, it, expect } from 'vitest'
import type { TerminalMode } from '../../src/App'

// ============================================================
// terminalModes の状態遷移ロジック（App.tsx のインライン関数を純粋関数として抽出してテスト）
// ============================================================

type TerminalEntry = { ptyId: string; tool: string }
type TerminalMap = Record<string, TerminalEntry>
type ModeMap = Record<string, TerminalMode>

// --- launchCLI ロジック（同一ptyIdがあれば tab に戻してアクティブ化、なければ新規登録）---
function launchCLI(
  terminals: TerminalMap,
  modes: ModeMap,
  nodeId: string,
  tool: string
): { terminals: TerminalMap; modes: ModeMap; activeId: string } {
  const ptyId = `${nodeId}-${tool}`
  if (terminals[nodeId]?.ptyId === ptyId) {
    return {
      terminals,
      modes: { ...modes, [nodeId]: 'tab' },
      activeId: ptyId,
    }
  }
  return {
    terminals: { ...terminals, [nodeId]: { ptyId, tool } },
    modes: { ...modes, [nodeId]: 'tab' },
    activeId: ptyId,
  }
}

// --- hideTerminal: mode を hidden に ---
function hideTerminal(modes: ModeMap, nodeId: string): ModeMap {
  return { ...modes, [nodeId]: 'hidden' }
}

// --- floatTerminal: mode を float に ---
function floatTerminal(modes: ModeMap, nodeId: string): ModeMap {
  return { ...modes, [nodeId]: 'float' }
}

// --- tabTerminal: mode を tab に戻す ---
function tabTerminal(modes: ModeMap, nodeId: string): ModeMap {
  return { ...modes, [nodeId]: 'tab' }
}

// --- removeTerminal: terminals と modes からエントリを削除 ---
function removeTerminal(
  terminals: TerminalMap,
  modes: ModeMap,
  nodeId: string
): { terminals: TerminalMap; modes: ModeMap } {
  const nextT = { ...terminals }
  const nextM = { ...modes }
  delete nextT[nodeId]
  delete nextM[nodeId]
  return { terminals: nextT, modes: nextM }
}

// --- タブ表示すべきエントリのフィルタリング ---
function getTabEntries(terminals: TerminalMap, modes: ModeMap): [string, TerminalEntry][] {
  return Object.entries(terminals).filter(([nodeId]) => modes[nodeId] === 'tab') as [string, TerminalEntry][]
}

// --- フローティング表示すべきエントリのフィルタリング ---
function getFloatEntries(terminals: TerminalMap, modes: ModeMap): [string, TerminalEntry][] {
  return Object.entries(terminals).filter(([nodeId]) => modes[nodeId] === 'float') as [string, TerminalEntry][]
}

// ============================================================
describe('launchCLI - TerminalMode 初期化', () => {
  it('新規起動時は mode が tab になる', () => {
    const { modes } = launchCLI({}, {}, 'node-1', 'claude')
    expect(modes['node-1']).toBe('tab')
  })

  it('新規起動時は terminals にエントリが追加される', () => {
    const { terminals } = launchCLI({}, {}, 'node-1', 'claude')
    expect(terminals['node-1']).toEqual({ ptyId: 'node-1-claude', tool: 'claude' })
  })

  it('activeId は ptyId と一致する', () => {
    const { activeId } = launchCLI({}, {}, 'node-1', 'claude')
    expect(activeId).toBe('node-1-claude')
  })

  it('同じ ptyId を再起動すると mode が tab に戻る（hidden → tab）', () => {
    const terminals: TerminalMap = { 'node-1': { ptyId: 'node-1-claude', tool: 'claude' } }
    const modes: ModeMap = { 'node-1': 'hidden' }
    const { modes: next } = launchCLI(terminals, modes, 'node-1', 'claude')
    expect(next['node-1']).toBe('tab')
  })

  it('同じ ptyId を再起動すると mode が tab に戻る（float → tab）', () => {
    const terminals: TerminalMap = { 'node-1': { ptyId: 'node-1-claude', tool: 'claude' } }
    const modes: ModeMap = { 'node-1': 'float' }
    const { modes: next } = launchCLI(terminals, modes, 'node-1', 'claude')
    expect(next['node-1']).toBe('tab')
  })

  it('既存エントリ再起動時は terminals の内容は変わらない', () => {
    const terminals: TerminalMap = { 'node-1': { ptyId: 'node-1-claude', tool: 'claude' } }
    const modes: ModeMap = { 'node-1': 'hidden' }
    const { terminals: next } = launchCLI(terminals, modes, 'node-1', 'claude')
    expect(next).toBe(terminals)
  })
})

// ============================================================
describe('hideTerminal - タブを非表示（ptyは継続）', () => {
  it('mode が hidden になる', () => {
    const modes: ModeMap = { 'node-1': 'tab' }
    expect(hideTerminal(modes, 'node-1')['node-1']).toBe('hidden')
  })

  it('他ノードの mode は変化しない', () => {
    const modes: ModeMap = { 'node-1': 'tab', 'node-2': 'tab' }
    const next = hideTerminal(modes, 'node-1')
    expect(next['node-2']).toBe('tab')
  })

  it('float 状態のノードを hidden にできる', () => {
    const modes: ModeMap = { 'node-1': 'float' }
    expect(hideTerminal(modes, 'node-1')['node-1']).toBe('hidden')
  })
})

// ============================================================
describe('floatTerminal - フローティングに切り替え', () => {
  it('mode が float になる', () => {
    const modes: ModeMap = { 'node-1': 'tab' }
    expect(floatTerminal(modes, 'node-1')['node-1']).toBe('float')
  })

  it('他ノードの mode は変化しない', () => {
    const modes: ModeMap = { 'node-1': 'tab', 'node-2': 'tab' }
    const next = floatTerminal(modes, 'node-1')
    expect(next['node-2']).toBe('tab')
  })
})

// ============================================================
describe('tabTerminal - タブに戻す', () => {
  it('float → tab に切り替わる', () => {
    const modes: ModeMap = { 'node-1': 'float' }
    expect(tabTerminal(modes, 'node-1')['node-1']).toBe('tab')
  })

  it('hidden → tab に切り替わる', () => {
    const modes: ModeMap = { 'node-1': 'hidden' }
    expect(tabTerminal(modes, 'node-1')['node-1']).toBe('tab')
  })
})

// ============================================================
describe('removeTerminal - 完全削除', () => {
  it('terminals からエントリが削除される', () => {
    const terminals: TerminalMap = { 'node-1': { ptyId: 'node-1-claude', tool: 'claude' } }
    const modes: ModeMap = { 'node-1': 'tab' }
    const { terminals: next } = removeTerminal(terminals, modes, 'node-1')
    expect(next['node-1']).toBeUndefined()
  })

  it('modes からもエントリが削除される', () => {
    const terminals: TerminalMap = { 'node-1': { ptyId: 'node-1-claude', tool: 'claude' } }
    const modes: ModeMap = { 'node-1': 'float' }
    const { modes: next } = removeTerminal(terminals, modes, 'node-1')
    expect(next['node-1']).toBeUndefined()
  })

  it('他ノードは残る', () => {
    const terminals: TerminalMap = {
      'node-1': { ptyId: 'node-1-claude', tool: 'claude' },
      'node-2': { ptyId: 'node-2-claude', tool: 'claude' },
    }
    const modes: ModeMap = { 'node-1': 'tab', 'node-2': 'tab' }
    const { terminals: nextT, modes: nextM } = removeTerminal(terminals, modes, 'node-1')
    expect(nextT['node-2']).toBeDefined()
    expect(nextM['node-2']).toBe('tab')
  })
})

// ============================================================
describe('getTabEntries / getFloatEntries - 表示フィルタリング', () => {
  const terminals: TerminalMap = {
    'n1': { ptyId: 'n1-claude', tool: 'claude' },
    'n2': { ptyId: 'n2-claude', tool: 'claude' },
    'n3': { ptyId: 'n3-gemini', tool: 'gemini' },
  }
  const modes: ModeMap = {
    'n1': 'tab',
    'n2': 'float',
    'n3': 'hidden',
  }

  it('getTabEntries は tab のものだけ返す', () => {
    const entries = getTabEntries(terminals, modes)
    expect(entries.map(([id]) => id)).toEqual(['n1'])
  })

  it('getFloatEntries は float のものだけ返す', () => {
    const entries = getFloatEntries(terminals, modes)
    expect(entries.map(([id]) => id)).toEqual(['n2'])
  })

  it('全て hidden のとき tab エントリはゼロ', () => {
    const allHidden: ModeMap = { 'n1': 'hidden', 'n2': 'hidden', 'n3': 'hidden' }
    expect(getTabEntries(terminals, allHidden)).toHaveLength(0)
  })

  it('全て tab のとき float エントリはゼロ', () => {
    const allTab: ModeMap = { 'n1': 'tab', 'n2': 'tab', 'n3': 'tab' }
    expect(getFloatEntries(terminals, allTab)).toHaveLength(0)
  })
})

// ============================================================
describe('複合シナリオ - フローティングターミナルのライフサイクル', () => {
  it('起動 → フロート → タブに戻す → 非表示 の状態遷移', () => {
    let terminals: TerminalMap = {}
    let modes: ModeMap = {}

    // 1. 起動
    const launched = launchCLI(terminals, modes, 'n1', 'claude')
    terminals = launched.terminals
    modes = launched.modes
    expect(modes['n1']).toBe('tab')

    // 2. フロート
    modes = floatTerminal(modes, 'n1')
    expect(modes['n1']).toBe('float')
    expect(getTabEntries(terminals, modes)).toHaveLength(0)
    expect(getFloatEntries(terminals, modes)).toHaveLength(1)

    // 3. タブに戻す
    modes = tabTerminal(modes, 'n1')
    expect(modes['n1']).toBe('tab')
    expect(getTabEntries(terminals, modes)).toHaveLength(1)
    expect(getFloatEntries(terminals, modes)).toHaveLength(0)

    // 4. 非表示
    modes = hideTerminal(modes, 'n1')
    expect(modes['n1']).toBe('hidden')
    expect(getTabEntries(terminals, modes)).toHaveLength(0)
    expect(getFloatEntries(terminals, modes)).toHaveLength(0)
  })

  it('非表示から再起動すると tab に戻る', () => {
    const terminals: TerminalMap = { 'n1': { ptyId: 'n1-claude', tool: 'claude' } }
    let modes: ModeMap = { 'n1': 'hidden' }

    // 再起動（同一pty）
    const { modes: next, activeId } = launchCLI(terminals, modes, 'n1', 'claude')
    modes = next
    expect(modes['n1']).toBe('tab')
    expect(activeId).toBe('n1-claude')
  })

  it('複数ノードの混在状態を正しく管理できる', () => {
    let terminals: TerminalMap = {}
    let modes: ModeMap = {}

    const r1 = launchCLI(terminals, modes, 'n1', 'claude')
    terminals = r1.terminals
    modes = r1.modes
    const r2 = launchCLI(terminals, modes, 'n2', 'claude')
    terminals = r2.terminals
    modes = r2.modes
    const r3 = launchCLI(terminals, modes, 'n3', 'gemini')
    terminals = r3.terminals
    modes = r3.modes

    modes = floatTerminal(modes, 'n2')
    modes = hideTerminal(modes, 'n3')

    expect(getTabEntries(terminals, modes).map(([id]) => id)).toEqual(['n1'])
    expect(getFloatEntries(terminals, modes).map(([id]) => id)).toEqual(['n2'])
  })
})
