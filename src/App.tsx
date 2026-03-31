import { useState, useCallback, useRef, useEffect } from 'react'
import LeftPane from './components/LeftPane'
import MiddlePane from './components/MiddlePane'
import RightPane from './components/RightPane'
import ContextMenu from './components/ContextMenu'
import FloatingTerminal from './components/FloatingTerminal'
import { LangContext } from './LangContext'
import { translations } from './i18n'
import type { Lang } from './i18n'
import TitleBar from './components/TitleBar'
import type { TreeData, ContextMenuState, TerminalMap } from './types'

export type TerminalMode = 'tab' | 'float' | 'hidden'

export default function App() {
  const [lang, setLang] = useState<Lang>('en')
  const t = translations[lang]
  const [projectPath, setProjectPath] = useState<string | null>(null)
  const [treeData, setTreeData] = useState<TreeData | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [terminals, setTerminals] = useState<TerminalMap>({})
  const [terminalModes, setTerminalModes] = useState<Record<string, TerminalMode>>({})
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  const updateTree = useCallback(async (newTree: TreeData) => {
    setTreeData(newTree)
    if (projectPath) {
      await window.electronAPI.writeTree(projectPath, newTree)
    }
  }, [projectPath])

  const openProject = useCallback(async (folderPath: string) => {
    let tree = await window.electronAPI.readTree(folderPath)
    if (!tree) {
      const normalized = folderPath.replace(/[\\/]$/, '')
      const parts = normalized.split(/[\\/]/)
      const name = parts.pop() || 'project'
      const parentPath = parts.join('\\') || normalized
      const result = await window.electronAPI.createProject(parentPath, name)
      if (!result.success) return
      tree = await window.electronAPI.readTree(folderPath)
    }
    if (tree) {
      setProjectPath(folderPath)
      setTreeData(tree)
      window.electronAPI.addRecentProject(folderPath, tree.name)
    }
  }, [])

  const showContextMenu = useCallback((e: React.MouseEvent, context: ContextMenuState['context']) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, context })
  }, [])

  const hideContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  // ptyが自然終了したときターミナルを削除
  const removeTerminal = useCallback((nodeId: string) => {
    setTerminals(prev => {
      const next = { ...prev }
      delete next[nodeId]
      return next
    })
    setTerminalModes(prev => {
      const next = { ...prev }
      delete next[nodeId]
      return next
    })
    setActiveTerminalId(prev => {
      const entry = terminals[nodeId]
      if (entry && prev === entry.ptyId) {
        const remaining = Object.entries(terminals)
          .filter(([id, t]) => id !== nodeId && terminalModes[id] === 'tab')
        return remaining.length > 0 ? remaining[0][1].ptyId : null
      }
      return prev
    })
  }, [terminals, terminalModes])

  const launchCLI = useCallback(async (nodeId: string, tool: string, sessionId?: string | null, cwd?: string) => {
    const ptyId = `${nodeId}-${tool}`

    // 同じターミナルが既にある場合はモードをタブに戻してアクティブ化
    if (terminals[nodeId]?.ptyId === ptyId) {
      setTerminalModes(prev => ({ ...prev, [nodeId]: 'tab' }))
      setActiveTerminalId(ptyId)
      setSelectedNodeId(nodeId)
      return
    }

    let command: string
    switch (tool) {
      case 'claude':
        command = sessionId ? `claude --resume ${sessionId}` : 'claude'
        break
      case 'codex':
        command = 'codex'
        break
      case 'gemini':
        command = 'gemini'
        break
      default:
        command = tool
    }
    const resolvedCwd = cwd ?? projectPath ?? undefined
    await window.electronAPI.startCLI(ptyId, command, resolvedCwd)
    setTerminals(prev => ({ ...prev, [nodeId]: { ptyId, tool } }))
    setTerminalModes(prev => ({ ...prev, [nodeId]: 'tab' }))
    setActiveTerminalId(ptyId)
    setSelectedNodeId(nodeId)
  }, [projectPath, terminals])

  // ×: タブを非表示（ptyは継続）
  const hideTerminal = useCallback((nodeId: string) => {
    setTerminalModes(prev => ({ ...prev, [nodeId]: 'hidden' }))
    setActiveTerminalId(prev => {
      const entry = terminals[nodeId]
      if (entry && prev === entry.ptyId) {
        const remaining = Object.entries(terminals)
          .filter(([id, t]) => id !== nodeId && terminalModes[id] === 'tab')
        return remaining.length > 0 ? remaining[0][1].ptyId : null
      }
      return prev
    })
  }, [terminals, terminalModes])

  // ↗: フローティングに切り替え
  const floatTerminal = useCallback((nodeId: string) => {
    setTerminalModes(prev => ({ ...prev, [nodeId]: 'float' }))
  }, [])

  // タブに戻す
  const tabTerminal = useCallback((nodeId: string) => {
    const ptyId = terminals[nodeId]?.ptyId
    setTerminalModes(prev => ({ ...prev, [nodeId]: 'tab' }))
    if (ptyId) setActiveTerminalId(ptyId)
    setSelectedNodeId(nodeId)
  }, [terminals])

  const floatingEntries = Object.entries(terminals).filter(
    ([nodeId]) => terminalModes[nodeId] === 'float'
  ) as [string, { ptyId: string; tool: string }][]

  const [showRightPane, setShowRightPane] = useState(true)
  const [showLeftPane, setShowLeftPane] = useState(true)

  // 左右ペイン幅（ドラッグリサイズ）
  // 初期値：中央ペインに 1024px（120cols相当）を確保した上で残りを均等配分
  const MIDDLE_MIN = 1024   // 120cols × 8.4px + スクロールバー15px ≈ 1023px
  const CHROME = 4 + 4 + 18 + 18  // 左右ドラッグハンドル + トグルボタン
  const calcInitialPaneWidth = () =>
    Math.max(0, Math.min(480, Math.floor((window.innerWidth - MIDDLE_MIN - CHROME) / 2)))

  const [leftWidth, setLeftWidth] = useState(calcInitialPaneWidth)
  const [rightWidth, setRightWidth] = useState(calcInitialPaneWidth)
  const MIN_PANE = 0
  const MAX_PANE = 480

  const draggingLeft = useRef(false)
  const draggingRight = useRef(false)
  const dragStartX = useRef(0)
  const dragStartW = useRef(0)

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (draggingLeft.current) {
        const delta = e.clientX - dragStartX.current
        setLeftWidth(Math.min(MAX_PANE, Math.max(MIN_PANE, dragStartW.current + delta)))
      }
      if (draggingRight.current) {
        const delta = dragStartX.current - e.clientX
        setRightWidth(Math.min(MAX_PANE, Math.max(MIN_PANE, dragStartW.current + delta)))
      }
    }
    const onMouseUp = () => {
      draggingLeft.current = false
      draggingRight.current = false
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

  const onLeftDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    draggingLeft.current = true
    dragStartX.current = e.clientX
    dragStartW.current = leftWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [leftWidth])

  const onRightDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    draggingRight.current = true
    dragStartX.current = e.clientX
    dragStartW.current = rightWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [rightWidth])

  return (
    <LangContext.Provider value={t}>
    <TitleBar />
    <div className="app-layout" onClick={hideContextMenu}>
      {/* 言語トグル */}
      <button
        className="lang-toggle"
        onClick={e => { e.stopPropagation(); setLang(l => l === 'en' ? 'ja' : 'en') }}
        title="Switch language"
      >{t.lang_toggle}</button>
      {/* 左ペイン トグルボタン */}
      <button
        className="left-pane-toggle"
        onClick={e => { e.stopPropagation(); setShowLeftPane(v => !v) }}
        title={showLeftPane ? '左ペインを隠す' : '左ペインを表示'}
      >
        {showLeftPane ? '‹' : '›'}
      </button>

      <div
        className={`left-pane-wrapper${showLeftPane ? ' open' : ''}`}
        style={showLeftPane ? { width: leftWidth } : undefined}
      >
        <LeftPane
          projectPath={projectPath}
          treeData={treeData}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          onOpenProject={openProject}
          onUpdateTree={updateTree}
          onShowContextMenu={showContextMenu}
          activeTerminalId={activeTerminalId}
          onLaunchCLI={launchCLI}
        />
      </div>

      {/* 左ペイン境界ドラッグハンドル */}
      {showLeftPane && (
        <div className="pane-divider pane-divider-left" onMouseDown={onLeftDividerMouseDown} />
      )}

      <MiddlePane
        projectPath={projectPath}
        treeData={treeData}
        selectedNodeId={selectedNodeId}
        terminals={terminals}
        terminalModes={terminalModes}
        activeTerminalId={activeTerminalId}
        onSelectNode={setSelectedNodeId}
        onUpdateTree={updateTree}
        onShowContextMenu={showContextMenu}
        onLaunchCLI={launchCLI}
        onActivateTerminal={setActiveTerminalId}
        onHideTerminal={hideTerminal}
        onFloatTerminal={floatTerminal}
        onRemoveTerminal={removeTerminal}
      />

      {/* 右ペイン境界ドラッグハンドル */}
      {showRightPane && (
        <div className="pane-divider pane-divider-right" onMouseDown={onRightDividerMouseDown} />
      )}

      {/* 右ペイン トグルボタン */}
      <button
        className="right-pane-toggle"
        onClick={e => { e.stopPropagation(); setShowRightPane(v => !v) }}
        title={showRightPane ? '右ペインを隠す' : '右ペインを表示'}
      >
        {showRightPane ? '›' : '‹'}
      </button>

      <div
        className={`right-pane-wrapper${showRightPane ? ' open' : ''}`}
        style={showRightPane ? { width: rightWidth } : undefined}
      >
        <RightPane
          projectPath={projectPath}
          treeData={treeData}
          onOpenProject={openProject}
          onUpdateTree={updateTree}
          onShowContextMenu={showContextMenu}
          onLaunchCLI={launchCLI}
        />
      </div>

      {/* フローティングターミナル */}
      {floatingEntries.map(([nodeId, entry], i) => (
        <FloatingTerminal
          key={entry.ptyId}
          nodeId={nodeId}
          ptyId={entry.ptyId}
          tool={entry.tool}
          treeData={treeData}
          projectPath={projectPath}
          initialOffset={i * 32}
          onTabTerminal={tabTerminal}
          onHideTerminal={hideTerminal}
          onRemoveTerminal={removeTerminal}
        />
      ))}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          context={contextMenu.context}
          projectPath={projectPath}
          treeData={treeData}
          onOpenProject={openProject}
          onUpdateTree={updateTree}
          onLaunchCLI={launchCLI}
          onClose={hideContextMenu}
        />
      )}
    </div>
    </LangContext.Provider>
  )
}
