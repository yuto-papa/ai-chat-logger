import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ============================================================
// calcInitialPaneWidth — 中央ペイン 1024px 確保の初期幅計算
// ============================================================

const MIDDLE_MIN = 1024
const CHROME = 4 + 4 + 18 + 18  // 44px

function calcInitialPaneWidth(windowInnerWidth: number): number {
  return Math.max(0, Math.min(480, Math.floor((windowInnerWidth - MIDDLE_MIN - CHROME) / 2)))
}

describe('calcInitialPaneWidth', () => {
  it('1920px 画面: 残り幅を均等配分する', () => {
    // (1920 - 1024 - 44) / 2 = 426
    expect(calcInitialPaneWidth(1920)).toBe(426)
  })

  it('1280px 画面: 正の値を返す', () => {
    // (1280 - 1024 - 44) / 2 = 106
    expect(calcInitialPaneWidth(1280)).toBe(106)
  })

  it('幅が MIDDLE_MIN + CHROME ちょうどのとき 0 を返す', () => {
    expect(calcInitialPaneWidth(MIDDLE_MIN + CHROME)).toBe(0)
  })

  it('幅が MIDDLE_MIN + CHROME より小さいとき 0 にクランプ', () => {
    expect(calcInitialPaneWidth(800)).toBe(0)
  })

  it('極端に広い画面でも 480 を超えない', () => {
    // (3840 - 1024 - 44) / 2 = 1386 → clamp to 480
    expect(calcInitialPaneWidth(3840)).toBe(480)
  })

  it('2492px ちょうどで 480 になる境界値', () => {
    // (2492 - 1024 - 44) / 2 = 712 → clamp to 480
    expect(calcInitialPaneWidth(2492)).toBe(480)
  })

  it('負の幅は返さない', () => {
    expect(calcInitialPaneWidth(0)).toBe(0)
    expect(calcInitialPaneWidth(-500)).toBe(0)
  })
})

// ============================================================
// ドラッグリサイズのクランプ計算
// ============================================================

const MIN_PANE = 0
const MAX_PANE = 480

function calcLeftWidth(startW: number, delta: number): number {
  return Math.min(MAX_PANE, Math.max(MIN_PANE, startW + delta))
}

// 右ペインはドラッグ方向が逆（startX - clientX）
function calcRightWidth(startW: number, startX: number, clientX: number): number {
  const delta = startX - clientX
  return Math.min(MAX_PANE, Math.max(MIN_PANE, startW + delta))
}

describe('左ペイン ドラッグリサイズ クランプ', () => {
  it('正方向に動かすと幅が増える', () => {
    expect(calcLeftWidth(200, 50)).toBe(250)
  })

  it('負方向に動かすと幅が減る', () => {
    expect(calcLeftWidth(200, -80)).toBe(120)
  })

  it('MIN_PANE (0) より小さくならない', () => {
    expect(calcLeftWidth(50, -200)).toBe(0)
  })

  it('MAX_PANE (480) より大きくならない', () => {
    expect(calcLeftWidth(400, 200)).toBe(480)
  })

  it('delta=0 のとき元の幅を維持', () => {
    expect(calcLeftWidth(300, 0)).toBe(300)
  })

  it('境界値: startW=0 + delta=0 → 0', () => {
    expect(calcLeftWidth(0, 0)).toBe(0)
  })

  it('境界値: startW=480 + delta=0 → 480', () => {
    expect(calcLeftWidth(480, 0)).toBe(480)
  })
})

describe('右ペイン ドラッグリサイズ クランプ（方向逆転）', () => {
  it('左に動かす（clientX < startX）と幅が増える', () => {
    // startX=800, clientX=750 → delta=50 → 200+50=250
    expect(calcRightWidth(200, 800, 750)).toBe(250)
  })

  it('右に動かす（clientX > startX）と幅が減る', () => {
    // startX=800, clientX=880 → delta=-80 → 200-80=120
    expect(calcRightWidth(200, 800, 880)).toBe(120)
  })

  it('MIN_PANE より小さくならない', () => {
    expect(calcRightWidth(50, 800, 1200)).toBe(0)
  })

  it('MAX_PANE より大きくならない', () => {
    expect(calcRightWidth(400, 800, 400)).toBe(480)
  })

  it('左ペインと方向が逆であることを確認', () => {
    const delta = 100
    const leftResult = calcLeftWidth(200, delta)    // 右移動で増加
    const rightResult = calcRightWidth(200, 800, 800 - delta) // 左移動で増加
    expect(leftResult).toBe(rightResult)  // 同量動かせば同じ結果
  })
})

// ============================================================
// リサイズオーバーレイのタイマー・デバウンス動作
// ============================================================

describe('リサイズオーバーレイ タイマー管理', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('コールバック呼び出しでオーバーレイ値がセットされる', () => {
    let overlay: { cols: number; rows: number } | null = null
    let timer: ReturnType<typeof setTimeout> | null = null

    function handleResize(cols: number, rows: number) {
      overlay = { cols, rows }
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { overlay = null }, 1500)
    }

    handleResize(120, 30)
    expect(overlay).toEqual({ cols: 120, rows: 30 })
  })

  it('1500ms 後にオーバーレイが null になる', () => {
    let overlay: { cols: number; rows: number } | null = null
    let timer: ReturnType<typeof setTimeout> | null = null

    function handleResize(cols: number, rows: number) {
      overlay = { cols, rows }
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { overlay = null }, 1500)
    }

    handleResize(120, 30)
    expect(overlay).not.toBeNull()
    vi.advanceTimersByTime(1500)
    expect(overlay).toBeNull()
  })

  it('1499ms では消えない', () => {
    let overlay: { cols: number; rows: number } | null = null
    let timer: ReturnType<typeof setTimeout> | null = null

    function handleResize(cols: number, rows: number) {
      overlay = { cols, rows }
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { overlay = null }, 1500)
    }

    handleResize(120, 30)
    vi.advanceTimersByTime(1499)
    expect(overlay).not.toBeNull()
  })

  it('連続して呼んでもタイマーは1つだけ（デバウンス）', () => {
    let overlay: { cols: number; rows: number } | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let callCount = 0

    function handleResize(cols: number, rows: number) {
      overlay = { cols, rows }
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { overlay = null; callCount++ }, 1500)
    }

    handleResize(120, 30)
    vi.advanceTimersByTime(500)
    handleResize(118, 28)   // 2回目（タイマーリセット）
    vi.advanceTimersByTime(500)
    handleResize(116, 26)   // 3回目（タイマーリセット）

    expect(overlay).toEqual({ cols: 116, rows: 26 })
    vi.advanceTimersByTime(1500)
    expect(overlay).toBeNull()
    expect(callCount).toBe(1)   // タイマー発火は1回のみ
  })

  it('最後の値がオーバーレイに反映される', () => {
    let overlay: { cols: number; rows: number } | null = null
    let timer: ReturnType<typeof setTimeout> | null = null

    function handleResize(cols: number, rows: number) {
      overlay = { cols, rows }
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { overlay = null }, 1500)
    }

    handleResize(120, 30)
    handleResize(100, 25)
    expect(overlay).toEqual({ cols: 100, rows: 25 })
  })
})
