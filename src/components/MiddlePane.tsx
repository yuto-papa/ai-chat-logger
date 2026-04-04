import { useState, useRef, useCallback, useEffect } from 'react'
import MindMap from './MindMap'
import NodeTerminal from './NodeTerminal'
import type { TreeData, TreeNode, TerminalMap } from '../types'
import type { TerminalMode } from '../App'
import { useLang } from '../LangContext'

interface MiddlePaneProps {
  projectPath: string | null
  treeData: TreeData | null
  selectedNodeId: string | null
  terminals: TerminalMap
  terminalModes: Record<string, TerminalMode>
  activeTerminalId: string | null
  onSelectNode: (id: string) => void
  onUpdateTree: (tree: TreeData) => void
  onShowContextMenu: (e: React.MouseEvent, ctx: any) => void
  onLaunchCLI: (nodeId: string, tool: string, sessionId?: string | null, cwd?: string) => void
  onActivateTerminal: (id: string) => void
  onHideTerminal: (nodeId: string) => void
  onFloatTerminal: (nodeId: string) => void
  onRemoveTerminal: (nodeId: string) => void
}

const MIN_TOP_PX = 120
const MIN_BOTTOM_PX = 80
const DEFAULT_BOTTOM_PX = 260

const TOOL_LABELS: Record<string, string> = {
  claude: 'Claude',
  codex: 'Codex',
  gemini: 'Gemini',
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

export default function MiddlePane({
  projectPath, treeData, selectedNodeId, terminals, terminalModes,
  activeTerminalId,
  onSelectNode, onUpdateTree, onShowContextMenu,
  onLaunchCLI,
  onActivateTerminal, onHideTerminal, onFloatTerminal, onRemoveTerminal
}: MiddlePaneProps) {
  const t = useLang()
  const containerRef = useRef<HTMLDivElement>(null)
  const [bottomHeight, setBottomHeight] = useState(DEFAULT_BOTTOM_PX)
  const dragging = useRef(false)
  const startY = useRef(0)
  const startBottom = useRef(0)

  const [mountedPtyIds, setMountedPtyIds] = useState<Set<string>>(new Set())

  // リサイズオーバーレイ
  const [resizeOverlay, setResizeOverlay] = useState<{ cols: number; rows: number } | null>(null)
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTerminalResize = useCallback((cols: number, rows: number) => {
    setResizeOverlay({ cols, rows })
    if (overlayTimer.current) clearTimeout(overlayTimer.current)
    overlayTimer.current = setTimeout(() => setResizeOverlay(null), 1500)
  }, [])

  useEffect(() => {
    if (activeTerminalId) {
      setMountedPtyIds(prev => {
        if (prev.has(activeTerminalId)) return prev
        const next = new Set(prev)
        next.add(activeTerminalId)
        return next
      })
    }
  }, [activeTerminalId])

  const termEntries = Object.entries(terminals) as [string, { ptyId: string; tool: string }][]

  useEffect(() => {
    const activePtyIds = new Set(termEntries.map(([, e]) => e.ptyId))
    setMountedPtyIds(prev => {
      const next = new Set([...prev].filter(id => activePtyIds.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [terminals])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startY.current = e.clientY
    startBottom.current = bottomHeight
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [bottomHeight])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return
      const containerH = containerRef.current.offsetHeight
      const delta = startY.current - e.clientY
      const next = Math.min(
        containerH - MIN_TOP_PX,
        Math.max(MIN_BOTTOM_PX, startBottom.current + delta)
      )
      setBottomHeight(next)
    }
    const onMouseUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  // タブ表示すべきエントリ（float・hidden 以外）
  const tabEntries = termEntries.filter(([nodeId]) => terminalModes[nodeId] === 'tab')
  const hasTabTerminals = tabEntries.length > 0

  const handleTabClick = (nodeId: string, ptyId: string) => {
    onActivateTerminal(ptyId)
    onSelectNode(nodeId)
  }

  const handleTabHide = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    onHideTerminal(nodeId)
  }

  const handleTabFloat = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    onFloatTerminal(nodeId)
  }

  return (
    <div className="middle-pane" ref={containerRef}>
      <div className="middle-top" style={{ flex: 1, minHeight: MIN_TOP_PX }}>
        {treeData ? (
          <MindMap
            projectPath={projectPath}
            treeData={treeData}
            selectedNodeId={selectedNodeId}
            terminals={terminals}
            onSelectNode={onSelectNode}
            onUpdateTree={onUpdateTree}
            onShowContextMenu={onShowContextMenu}
          />
        ) : (
          <div className="middle-empty">
            <p>{t.middle_empty}</p>
          </div>
        )}
      </div>

      <div className="middle-divider" onMouseDown={onMouseDown}>
        <div className="middle-divider-handle" />
      </div>

      <div className="middle-bottom" style={{ height: bottomHeight, flex: 'none' }}>
        {/* リサイズオーバーレイ */}
        {resizeOverlay && (
          <div className="terminal-resize-overlay">
            {resizeOverlay.cols} × {resizeOverlay.rows}
          </div>
        )}
        {hasTabTerminals ? (
          <>
            <div className="terminal-tab-bar">
              {tabEntries.map(([nodeId, entry]) => {
                const isActive = entry.ptyId === activeTerminalId
                const nodeName = getNodeName(treeData, nodeId, t.project_fallback)
                const toolLabel = TOOL_LABELS[entry.tool] ?? entry.tool
                return (
                  <div
                    key={entry.ptyId}
                    className={`terminal-tab ${isActive ? 'active' : ''}`}
                    onClick={() => handleTabClick(nodeId, entry.ptyId)}
                  >
                    <span className={`terminal-tab-icon ${entry.tool}`}>{toolLabel[0]}</span>
                    <span className="terminal-tab-label">{nodeName}</span>
                    <button
                      className="terminal-tab-float"
                      onClick={(e) => handleTabFloat(e, nodeId)}
                      title={t.tooltip_float_window}
                    >↗</button>
                    <button
                      className="terminal-tab-close"
                      onClick={(e) => handleTabHide(e, nodeId)}
                      title={t.tooltip_hide_terminal}
                    >×</button>
                  </div>
                )
              })}
            </div>

            <div className="terminal-tab-content">
              {tabEntries.map(([nodeId, entry]) => {
                if (!mountedPtyIds.has(entry.ptyId)) return null
                const isActive = entry.ptyId === activeTerminalId
                return (
                  <div
                    key={entry.ptyId}
                    className="terminal-tab-panel"
                    style={{ display: isActive ? 'flex' : 'none' }}
                  >
                    <NodeTerminal
                      ptyId={entry.ptyId}
                      nodeId={nodeId}
                      projectPath={projectPath}
                      isActive={isActive}
                      onResize={handleTerminalResize}
                    />
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div className="terminal-empty">
            <p>{t.terminal_empty}</p>
          </div>
        )}
      </div>
    </div>
  )
}
