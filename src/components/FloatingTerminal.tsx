import { useRef, useState, useEffect, useCallback } from 'react'
import NodeTerminal from './NodeTerminal'
import type { TreeData, TreeNode } from '../types'
import { useLang } from '../LangContext'


interface FloatingTerminalProps {
  nodeId: string
  ptyId: string
  tool: string
  treeData: TreeData | null
  projectPath: string | null
  initialOffset?: number
  onTabTerminal: (nodeId: string) => void
  onHideTerminal: (nodeId: string) => void
  onRemoveTerminal: (nodeId: string) => void
}

function getNodeName(treeData: TreeData | null, nodeId: string, fallback: string): string {
  if (nodeId === '__root__') return treeData?.name ?? fallback
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

const TOOL_LABELS: Record<string, string> = {
  claude: 'Claude',
  codex: 'Codex',
  gemini: 'Gemini',
}

export default function FloatingTerminal({
  nodeId, ptyId, tool, treeData, projectPath,
  initialOffset = 0,
  onTabTerminal, onHideTerminal, onRemoveTerminal
}: FloatingTerminalProps) {
  const t = useLang()
  const offset = initialOffset
  const [pos, setPos] = useState({ x: 80 + offset, y: 80 + offset })
  const [size, setSize] = useState({ w: 820, h: 480 })
  const dragging = useRef(false)
  const resizing = useRef(false)
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const resizeStart = useRef({ mx: 0, my: 0, w: 0, h: 0 })

  const nodeName = getNodeName(treeData, nodeId, t.project_fallback)
  const toolLabel = TOOL_LABELS[tool] ?? tool

  // リサイズオーバーレイ
  const [resizeOverlay, setResizeOverlay] = useState<{ cols: number; rows: number } | null>(null)
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleTerminalResize = useCallback((cols: number, rows: number) => {
    setResizeOverlay({ cols, rows })
    if (overlayTimer.current) clearTimeout(overlayTimer.current)
    overlayTimer.current = setTimeout(() => setResizeOverlay(null), 1500)
  }, [])

  const onHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    dragging.current = true
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'grabbing'
  }, [pos])

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    resizing.current = true
    resizeStart.current = { mx: e.clientX, my: e.clientY, w: size.w, h: size.h }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'nwse-resize'
  }, [size])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (dragging.current) {
        const dx = e.clientX - dragStart.current.mx
        const dy = e.clientY - dragStart.current.my
        setPos({ x: dragStart.current.px + dx, y: dragStart.current.py + dy })
      }
      if (resizing.current) {
        const dx = e.clientX - resizeStart.current.mx
        const dy = e.clientY - resizeStart.current.my
        setSize({
          w: Math.max(400, resizeStart.current.w + dx),
          h: Math.max(240, resizeStart.current.h + dy),
        })
      }
    }
    const onMouseUp = () => {
      dragging.current = false
      resizing.current = false
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  return (
    <div
      className="floating-terminal"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
    >
      <div className="floating-terminal-header" onMouseDown={onHeaderMouseDown}>
        <span className={`terminal-tab-icon ${tool}`}>{toolLabel[0]}</span>
        <span className="floating-terminal-title">{nodeName} — {toolLabel}</span>
        <div className="floating-terminal-actions">
          <button
            className="float-btn tab-btn"
            title={t.tooltip_back_to_tab}
            onClick={() => onTabTerminal(nodeId)}
          >⬇</button>
          <button
            className="float-btn hide-btn"
            title={t.tooltip_hide}
            onClick={() => onHideTerminal(nodeId)}
          >×</button>
        </div>
      </div>
      <div className="floating-terminal-body" onClick={(e) => {
        // xterm にフォーカスを当てる（入力できない問題の対策）
        const xtermEl = (e.currentTarget as HTMLElement).querySelector('.xterm-helper-textarea') as HTMLElement | null
        xtermEl?.focus()
      }}>
        {resizeOverlay && (
          <div className="terminal-resize-overlay">
            {resizeOverlay.cols} × {resizeOverlay.rows}
          </div>
        )}
        <NodeTerminal
          ptyId={ptyId}
          nodeId={nodeId}
          projectPath={projectPath}
          isActive={true}
          onResize={handleTerminalResize}
        />
      </div>
      <div className="floating-resize-handle" onMouseDown={onResizeMouseDown} />
    </div>
  )
}
