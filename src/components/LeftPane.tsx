import { useState } from 'react'
import ProjectTree from './ProjectTree'
import TempTerminal from './TempTerminal'
import type { TreeData } from '../types'
import { useLang } from '../LangContext'

interface LeftPaneProps {
  projectPath: string | null
  treeData: TreeData | null
  selectedNodeId: string | null
  activeTerminalId: string | null
  onSelectNode: (id: string) => void
  onOpenProject: (path: string) => void
  onUpdateTree: (tree: TreeData) => void
  onShowContextMenu: (e: React.MouseEvent, ctx: any) => void
  onLaunchCLI: (nodeId: string, tool: string, sessionId?: string | null, cwd?: string) => void
}

export default function LeftPane({
  projectPath, treeData, selectedNodeId,
  onSelectNode, onOpenProject, onUpdateTree, onShowContextMenu
}: LeftPaneProps) {
  const t = useLang()
  const [tempOpen, setTempOpen] = useState(false)

  return (
    <div className="left-pane">
      <div className="left-pane-top">
        <ProjectTree
          projectPath={projectPath}
          treeData={treeData}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
          onOpenProject={onOpenProject}
          onUpdateTree={onUpdateTree}
          onShowContextMenu={onShowContextMenu}
        />
      </div>
      <div className={`left-pane-bottom ${tempOpen ? 'open' : 'closed'}`}>
        <div className="temp-terminal-header">
          <span>{t.temp_terminal_header}</span>
          <button
            className="btn-icon"
            onClick={() => setTempOpen(v => !v)}
            title={tempOpen ? t.tooltip_collapse : t.tooltip_expand}
          >
            {tempOpen ? '▼' : '▲'}
          </button>
        </div>
        {tempOpen && <TempTerminal />}
      </div>
    </div>
  )
}

