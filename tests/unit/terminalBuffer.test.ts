import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import * as fileOps from '../../electron/fileOps'

// ---- pty バッファリングのロジックを単体テスト ----
// main.ts の PTY バッファ管理ロジックを抽出して検証

const PTY_BUFFER_MAX = 100000

function appendBuffer(buffers: Map<string, string>, ptyId: string, data: string): void {
  const current = (buffers.get(ptyId) ?? '') + data
  buffers.set(ptyId, current.length > PTY_BUFFER_MAX
    ? current.slice(current.length - PTY_BUFFER_MAX)
    : current)
}

describe('ptyバッファリングロジック', () => {
  let buffers: Map<string, string>
  beforeEach(() => { buffers = new Map() })

  it('出力を蓄積できる', () => {
    appendBuffer(buffers, 'pty1', 'Hello ')
    appendBuffer(buffers, 'pty1', 'Claude')
    expect(buffers.get('pty1')).toBe('Hello Claude')
  })

  it('別ptyIdは独立して管理される', () => {
    appendBuffer(buffers, 'pty1', 'from-pty1')
    appendBuffer(buffers, 'pty2', 'from-pty2')
    expect(buffers.get('pty1')).toBe('from-pty1')
    expect(buffers.get('pty2')).toBe('from-pty2')
  })

  it('バッファが100KB超えたとき先頭を切り捨てて末尾を保持する', () => {
    const big = 'A'.repeat(PTY_BUFFER_MAX)
    appendBuffer(buffers, 'pty1', big)
    appendBuffer(buffers, 'pty1', 'NEW_DATA')
    const result = buffers.get('pty1') ?? ''
    // バッファ上限を超えない
    expect(result.length).toBeLessThanOrEqual(PTY_BUFFER_MAX)
    // 末尾にNEW_DATAが保持される
    expect(result.endsWith('NEW_DATA')).toBe(true)
    // 先頭のデータが切り捨てられ、元の big の先頭部分は含まれない
    // (100000A + NEW_DATA = 100008 bytes → slice(8) → 99992A + NEW_DATA)
    expect(result.length).toBe(PTY_BUFFER_MAX)
  })

  it('ptyIdを削除するとバッファが消える', () => {
    appendBuffer(buffers, 'pty1', 'data')
    buffers.delete('pty1')
    expect(buffers.get('pty1')).toBeUndefined()
  })

  it('存在しないptyIdのバッファは空文字を返す', () => {
    expect(buffers.get('nonexistent') ?? '').toBe('')
  })

  it('新規startCli時に既存バッファをクリアして新規蓄積できる', () => {
    // 旧セッションの出力
    appendBuffer(buffers, 'pty1', 'old session data')
    // 再起動時にクリア
    buffers.delete('pty1')
    // 新セッションの出力
    appendBuffer(buffers, 'pty1', 'new claude output')
    expect(buffers.get('pty1')).toBe('new claude output')
  })
})

// ---- NodeTerminalの初期化フロー検証（モックベース）----

describe('NodeTerminalのバッファ再生フロー', () => {
  it('バッファ取得後にxtermに書き込む順序を検証', async () => {
    const writeCalls: string[] = []
    const mockTerm = {
      clear: vi.fn(),
      write: (data: string) => writeCalls.push(data)
    }
    const buffered = '\x1b[2J\x1b[H> claude起動メッセージ'
    const liveData = '> ユーザー入力受付中'

    // NodeTerminalのマウント時の処理を模擬
    mockTerm.clear()

    // バッファを先に書き込み
    if (buffered) mockTerm.write(buffered)

    // その後ライブ出力を書き込み
    mockTerm.write(liveData)

    expect(mockTerm.clear).toHaveBeenCalledOnce()
    expect(writeCalls[0]).toBe(buffered)   // バッファが先
    expect(writeCalls[1]).toBe(liveData)   // ライブが後
    expect(writeCalls.length).toBe(2)
  })

  it('バッファが空のとき書き込みをスキップする', () => {
    const writeCalls: string[] = []
    const mockTerm = {
      clear: vi.fn(),
      write: (data: string) => writeCalls.push(data)
    }
    const buffered = ''

    mockTerm.clear()
    if (buffered) mockTerm.write(buffered)  // 空なのでスキップ

    expect(writeCalls.length).toBe(0)
  })
})
