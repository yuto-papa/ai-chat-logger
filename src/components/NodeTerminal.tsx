import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import 'xterm/css/xterm.css'

interface NodeTerminalProps {
  ptyId: string
  nodeId: string
  projectPath: string | null
  isActive: boolean
  onResize?: (cols: number, rows: number) => void
}

export default function NodeTerminal({ ptyId, isActive, onResize }: NodeTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  // onResize を ref で保持して closure の古い参照を回避
  const onResizeRef = useRef(onResize)
  onResizeRef.current = onResize

  // ptyId が変わったときに xterm を初期化・リスナーを登録する
  useEffect(() => {
    if (!containerRef.current) return
    let aborted = false

    // xterm インスタンスはコンポーネントの生存中 1 回だけ作成
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
      containerRef.current.addEventListener('wheel', (e) => {
        if (!e.ctrlKey) return
        e.preventDefault()
        const current = term.options.fontSize ?? 14
        const next = e.deltaY < 0
          ? Math.min(current + 1, 32)
          : Math.max(current - 1, 8)
        term.options.fontSize = next
        fitAddon.fit()
      }, { passive: false })

      termRef.current = term
      fitAddonRef.current = fitAddon
      term.open(containerRef.current)
    }

    const term = termRef.current
    const fitAddon = fitAddonRef.current!

    // Strict Mode 対策: cleanup 毎にリスナーを再登録する
    // (currentPtyId ガードを使わない)
    term.clear()

    console.log(`[NodeTerminal] attaching ptyId=${ptyId}`)

    // ライブ出力リスナー（バッファ再生完了まではスキップ）
    let replayDone = false
    const removeOutput = window.electronAPI.onOutputFrom(ptyId, (data) => {
      if (!replayDone) return
      term.write(data)
    })
    const removeExit = window.electronAPI.onExitFrom(ptyId, () => {
      term.writeln('\r\n\x1b[33m[セッションが終了しました]\x1b[0m')
    })
    const inputDisposer = term.onData((data) => window.electronAPI.sendInputTo(ptyId, data))
    const resizeDisposer = term.onResize(({ cols, rows }) => {
      window.electronAPI.resizeTo(ptyId, cols, rows)
      onResizeRef.current?.(cols, rows)
    })

    // ウィンドウリサイズ
    const handleResize = () => { fitAddon.fit() }
    window.addEventListener('resize', handleResize)

    // ペインドラッグによるコンテナサイズ変化を検知
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
    })
    if (containerRef.current) resizeObserver.observe(containerRef.current)

    // 初期 fit → pty リサイズ → バッファ再生
    const fitTimerId = setTimeout(() => {
      if (aborted) return
      fitAddon.fit()

      // fit 後の実際のサイズで pty を明示的にリサイズ
      const { cols, rows } = term
      console.log(`[NodeTerminal] fit result: ${cols}x${rows}`)
      window.electronAPI.resizeTo(ptyId, cols, rows)

      // pty リサイズ反映を待ってからバッファ再生
      setTimeout(() => {
        if (aborted) return
        window.electronAPI.getTerminalBuffer(ptyId).then((buffered) => {
          if (aborted) return
          console.log(`[NodeTerminal] buffer replay ptyId=${ptyId} length=${buffered?.length ?? 0}`)
          if (buffered) {
            term.write(buffered)
          }
          replayDone = true
          term.scrollToBottom()
          term.focus()
        })
      }, 100)
    }, 80)

    return () => {
      aborted = true
      clearTimeout(fitTimerId)
      removeOutput()
      removeExit()
      inputDisposer.dispose()
      resizeDisposer.dispose()
      window.removeEventListener('resize', handleResize)
      resizeObserver.disconnect()
    }
  }, [ptyId])

  // タブがアクティブになったとき寸法を再計算してフォーカス
  useEffect(() => {
    if (isActive && fitAddonRef.current && termRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit()
        termRef.current?.scrollToBottom()
        termRef.current?.focus()
      }, 80)
    }
  }, [isActive])

  return (
    <div className="node-terminal-wrapper">
      <div className="node-terminal-header">
        <span className="node-terminal-label">ターミナル</span>
        <span className="node-terminal-pty">{ptyId}</span>
      </div>
      <div
        ref={containerRef}
        className="xterm-container"
        onClick={() => termRef.current?.focus()}
      />
    </div>
  )
}
