import FileExplorer from './FileExplorer'
import type { TreeData } from '../types'
import { useLang } from '../LangContext'

interface RightPaneProps {
  projectPath: string | null
  treeData: TreeData | null
  onOpenProject: (path: string) => void
  onUpdateTree: (tree: TreeData) => void
  onShowContextMenu: (e: React.MouseEvent, ctx: any) => void
  onLaunchCLI: (nodeId: string, tool: string, sessionId?: string | null, cwd?: string) => void
}

export default function RightPane({ projectPath, treeData, onOpenProject, onUpdateTree, onShowContextMenu, onLaunchCLI }: RightPaneProps) {
  const t = useLang()
  return (
    <div className="right-pane">
      <div className="right-pane-header">
        <span>{treeData ? treeData.name : t.explorer_header}</span>
      </div>
      <FileExplorer
        projectPath={projectPath}
        treeData={treeData}
        onOpenProject={onOpenProject}
        onUpdateTree={onUpdateTree}
        onShowContextMenu={onShowContextMenu}
        onLaunchCLI={onLaunchCLI}
      />
    </div>
  )
}

