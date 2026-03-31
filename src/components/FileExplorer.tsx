import { useState, useEffect } from 'react'
import type { TreeData, DirEntry } from '../types'

interface FileEntryProps {
  entry: DirEntry
  depth: number
  projectPath: string | null
  treeData: TreeData | null
  onOpenProject: (path: string) => void
  onUpdateTree: (tree: TreeData) => void
  onShowContextMenu: (e: React.MouseEvent, ctx: any) => void
  onLaunchCLI: (nodeId: string, tool: string, sessionId?: string | null, cwd?: string) => void
  onRefreshParent?: () => void
}

function FileEntryItem({
  entry, depth, projectPath, treeData,
  onOpenProject, onUpdateTree, onShowContextMenu, onLaunchCLI, onRefreshParent
}: FileEntryProps) {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<DirEntry[]>([])
  const [loading, setLoading] = useState(false)

  const loadChildren = async (): Promise<DirEntry[]> => {
    const result = await window.electronAPI.readDir(entry.path)
    setChildren(result)
    return result
  }

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!entry.isDir) return
    if (loading) return

    if (!expanded) {
      setLoading(true)
      await loadChildren()
      setLoading(false)
      setExpanded(true)
    } else {
      setExpanded(false)
    }
  }

  const refresh = async () => {
    if (expanded) await loadChildren()
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onShowContextMenu(e, {
      type: treeData ? 'explorer-project' : 'explorer-noproject',
      entry,
      treeData,
      node: null,
      onRefreshDir: entry.isDir ? refresh : onRefreshParent
    })
  }

  return (
    <div>
      <div
        className="file-entry"
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <span className="file-icon">
          {entry.isDir
            ? loading ? '⌛' : expanded ? '📂' : '📁'
            : '📄'}
        </span>
        <span className="file-name">{entry.name}</span>
      </div>
      {expanded && children.map(child => (
        <FileEntryItem
          key={child.path}
          entry={child}
          depth={depth + 1}
          projectPath={projectPath}
          treeData={treeData}
          onOpenProject={onOpenProject}
          onUpdateTree={onUpdateTree}
          onShowContextMenu={onShowContextMenu}
          onLaunchCLI={onLaunchCLI}
          onRefreshParent={refresh}
        />
      ))}
    </div>
  )
}

interface FileExplorerProps {
  projectPath: string | null
  treeData: TreeData | null
  onOpenProject: (path: string) => void
  onUpdateTree: (tree: TreeData) => void
  onShowContextMenu: (e: React.MouseEvent, ctx: any) => void
  onLaunchCLI: (nodeId: string, tool: string, sessionId?: string | null, cwd?: string) => void
}

export default function FileExplorer({
  projectPath, treeData, onOpenProject, onUpdateTree, onShowContextMenu, onLaunchCLI
}: FileExplorerProps) {
  const [rootPath, setRootPath] = useState<string | null>(null)
  const [rootEntries, setRootEntries] = useState<DirEntry[]>([])

  const refresh = async (base: string) => {
    const entries = await window.electronAPI.readDir(base)
    setRootEntries(entries)
  }

  useEffect(() => {
    const init = async () => {
      const base = projectPath ?? await window.electronAPI.getHomeDir()
      setRootPath(base)
      await refresh(base)
    }
    init()
  }, [projectPath])

  const handleRootContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    onShowContextMenu(e, {
      type: treeData ? 'explorer-project' : 'explorer-noproject',
      entry: rootPath ? { path: rootPath, isDir: true, name: '' } : null,
      treeData,
      node: null,
      onRefreshDir: rootPath ? () => refresh(rootPath) : undefined
    })
  }

  return (
    <div className="file-explorer" onContextMenu={handleRootContextMenu}>
      {rootEntries.length === 0 && (
        <div className="file-explorer-empty">
          <p className="hint">右クリックでフォルダ操作</p>
        </div>
      )}
      {rootEntries.map(entry => (
        <FileEntryItem
          key={entry.path}
          entry={entry}
          depth={0}
          projectPath={projectPath}
          treeData={treeData}
          onOpenProject={onOpenProject}
          onUpdateTree={onUpdateTree}
          onShowContextMenu={onShowContextMenu}
          onLaunchCLI={onLaunchCLI}
          onRefreshParent={rootPath ? () => refresh(rootPath) : undefined}
        />
      ))}
    </div>
  )
}

