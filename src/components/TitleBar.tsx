import { useState, useEffect } from 'react'

export default function TitleBar() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    window.electronAPI.windowIsMaximized().then(setMaximized)
  }, [])

  const handleMaximize = async () => {
    await window.electronAPI.windowMaximize()
    const m = await window.electronAPI.windowIsMaximized()
    setMaximized(m)
  }

  return (
    <div className="title-bar">
      <div className="title-bar-drag" />
      <div className="title-bar-controls">
        <button
          className="title-bar-btn btn-minimize"
          onClick={() => window.electronAPI.windowMinimize()}
          title="Minimize"
        >
          <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor"/></svg>
        </button>
        <button
          className="title-bar-btn btn-maximize"
          onClick={handleMaximize}
          title={maximized ? 'Restore' : 'Maximize'}
        >
          {maximized
            ? <svg width="10" height="10" viewBox="0 0 10 10"><path d="M3 0v3H0v7h7V7h3V0H3zm4 9H1V4h2V7h4V9zm2-3H6V1h3v5z" fill="currentColor"/></svg>
            : <svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor"/></svg>
          }
        </button>
        <button
          className="title-bar-btn btn-close"
          onClick={() => window.electronAPI.windowClose()}
          title="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10"><line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2"/><line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2"/></svg>
        </button>
      </div>
    </div>
  )
}
