import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import 'xterm/css/xterm.css'

const TEMP_PTY_ID = 'temp'

export default function TempTerminal() {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current || !containerRef.current) return
    startedRef.current = true

    const term = new XTerm({
      theme: {
        background: '#0d0d1a', foreground: '#cdd6f4', cursor: '#89b4fa',
        selectionBackground: '#3a3a5c'
      },
      fontFamily: '"Cascadia Code", "Consolas", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      scrollback: 1000,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(new WebLinksAddon())
    termRef.current = term
    fitAddonRef.current = fitAddon
    term.open(containerRef.current)
    fitAddon.fit()

    window.electronAPI.startCLI(TEMP_PTY_ID, '', undefined)

    const removeOutput = window.electronAPI.onOutputFrom(TEMP_PTY_ID, (data) => term.write(data))
    const removeExit = window.electronAPI.onExitFrom(TEMP_PTY_ID, () => {
      term.writeln('\r\n\x1b[33m[終了しました]\x1b[0m')
    })
    const inputDisposer = term.onData((data) => window.electronAPI.sendInputTo(TEMP_PTY_ID, data))
    const resizeDisposer = term.onResize(({ cols, rows }) => window.electronAPI.resizeTo(TEMP_PTY_ID, cols, rows))
    const handleResize = () => fitAddon.fit()
    window.addEventListener('resize', handleResize)

    return () => {
      removeOutput()
      removeExit()
      inputDisposer.dispose()
      resizeDisposer.dispose()
      window.removeEventListener('resize', handleResize)
      window.electronAPI.killTerminal(TEMP_PTY_ID)
      term.dispose()
    }
  }, [])

  return (
    <div className="temp-terminal-body">
      <div ref={containerRef} className="xterm-container" />
    </div>
  )
}
