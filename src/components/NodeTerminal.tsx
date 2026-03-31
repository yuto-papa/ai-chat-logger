import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { WebglAddon } from 'xterm-addon-webgl'
import 'xterm/css/xterm.css'

interface NodeTerminalProps {
  ptyId: string
  nodeId: string
  projectPath: string | null
  isActive: boolean
  onResize?: (cols: number, rows: number) => void
}

const MIN_COLS = 120

function enforceMinCols(term: XTerm) {
  if (term.cols < MIN_COLS) {
    term.resize(MIN_COLS, term.rows)
  }
}

export default function NodeTerminal({ ptyId, isActive, onResize }: NodeTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const currentPtyId = useRef<string | null>(null)

  // ptyId が変わったときに xterm を初期化・リスナーを登録する
  useEffect(() => {
    if (!containerRef.current) return

    if (!termRef.current) {
      const term = new XTerm({
        theme: {
          background: '#0d0d1a', foreground: '#cdd6f4', cursor: '#89b4fa',
          selectionBackground: '#3a3a5c',
          black: '#45475a', red: '#f38ba8', green: '#a6e3a1',
          yellow: '#f9e2af', blue: '#89b4fa', magenta: '#cba6f7',
          cyan: '#89dceb', white: '#bac2de'
        },
        fontFamily: '"Cascadia Code", "Consolas", monospace',
        fontSize: 14,
        lineHeight: 1.0,
        letterSpacing: 0,
        cursorBlink: true,
        scrollback: 5000,
        copyOnSelect: true,
        customGlyphs: true
      })

      term.attachCustomKeyEventHandler((e) => {
        if (e.type === 'keydown' && e.ctrlKey && e.shiftKey && e.key === 'V') {
          navigator.clipboard.readText().then((text) => {
            if (text) window.electronAPI.sendInputTo(ptyId, text)
          })
          return false
        }
        return true
      })

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.loadAddon(new WebLinksAddon())

      // Ctrl+ホイールでフォントサイズ変更（8〜32pt）
      containerRef.current?.addEventListener('wheel', (e) => {
        if (!e.ctrlKey) return
        e.preventDefault()
        const current = term.options.fontSize ?? 14
        const next = e.deltaY < 0
          ? Math.min(current + 1, 32)
          : Math.max(current - 1, 8)
        term.options.fontSize = next
        fitAddon.fit()
        enforceMinCols(term)
      }, { passive: false })
      termRef.current = term
      fitAddonRef.current = fitAddon
      term.open(containerRef.current)

      // WebGL レンダラーを有効化（Canvas より高品質・罫線隙間なし）
      try {
        const webgl = new WebglAddon()
        webgl.onContextLoss(() => webgl.dispose())
        term.loadAddon(webgl)
      } catch {
        // WebGL 非対応環境は Canvas レンダラーにフォールバック
      }

      // open 直後は 120×30 に固定してから fit で追従
      setTimeout(() => {
        term.resize(120, 30)
        fitAddon.fit()
        enforceMinCols(term)
      }, 0)
    }

    const term = termRef.current
    const fitAddon = fitAddonRef.current!
    const cleanups: (() => void)[] = []

    if (currentPtyId.current !== ptyId) {
      currentPtyId.current = ptyId
      term.clear()

      console.log(`[NodeTerminal] attaching ptyId=${ptyId}`)

      // バッファ再生（マウント前に溜まった出力）
      window.electronAPI.getTerminalBuffer(ptyId).then((buffered) => {
        console.log(`[NodeTerminal] buffer replay ptyId=${ptyId} length=${buffered?.length ?? 0}`)
        if (buffered) {
          term.write(buffered)
          // バッファ書き込み後にスクロールを最下部へ
          term.scrollToBottom()
        }
      })

      const removeOutput = window.electronAPI.onOutputFrom(ptyId, (data) => {
        term.write(data)
        term.scrollToBottom()
      })
      const removeExit = window.electronAPI.onExitFrom(ptyId, () => {
        term.writeln('\r\n\x1b[33m[セッションが終了しました]\x1b[0m')
      })
      const inputDisposer = term.onData((data) => window.electronAPI.sendInputTo(ptyId, data))
      const resizeDisposer = term.onResize(({ cols, rows }) => {
        window.electronAPI.resizeTo(ptyId, cols, rows)
        onResize?.(cols, rows)
      })

      // ウィンドウリサイズ
      const handleResize = () => { fitAddon.fit(); enforceMinCols(term) }
      window.addEventListener('resize', handleResize)

      // ペインドラッグによるコンテナサイズ変化を検知
      const resizeObserver = new ResizeObserver(() => {
        fitAddon.fit()
        enforceMinCols(term)
      })
      if (containerRef.current) resizeObserver.observe(containerRef.current)

      cleanups.push(
        removeOutput,
        removeExit,
        () => inputDisposer.dispose(),
        () => resizeDisposer.dispose(),
        () => window.removeEventListener('resize', handleResize),
        () => resizeObserver.disconnect()
      )
    }

    return () => cleanups.forEach(fn => fn())
  }, [ptyId])

  // タブがアクティブになったとき寸法を再計算
  useEffect(() => {
    if (isActive && fitAddonRef.current && termRef.current) {
      requestAnimationFrame(() => {
        fitAddonRef.current?.fit()
        enforceMinCols(termRef.current!)
        termRef.current?.scrollToBottom()
      })
    }
  }, [isActive])

  return (
    <div className="node-terminal-wrapper">
      <div className="node-terminal-header">
        <span className="node-terminal-label">ターミナル</span>
        <span className="node-terminal-pty">{ptyId}</span>
      </div>
      <div ref={containerRef} className="xterm-container" />
    </div>
  )
}
