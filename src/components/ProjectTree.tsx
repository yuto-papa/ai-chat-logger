import { useState, useEffect } from 'react'
import type { TreeData, TreeNode } from '../types'
export { toggleNode, renameNode, addChildNode, deleteNode, setSessionId, getNodePath } from '../lib/treeOps'
import { toggleNode, renameNode, addChildNode, getNodePath } from '../lib/treeOps'

interface TreeNodeProps {
  node: TreeNode
  depth: number
  selectedNodeId: string | null
  onSelectNode: (id: string) => void
  onUpdateTree: (tree: TreeData) => void
  treeData: TreeData
  onShowContextMenu: (e: React.MouseEvent, ctx: any) => void
}

function TreeNodeItem({ node, depth, selectedNodeId, onSelectNode, onUpdateTree, treeData, onShowContextMenu }: TreeNodeProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(node.name)

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    onUpdateTree(toggleNode(treeData, node.id))
  }

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault()
    if (editValue.trim()) {
      onUpdateTree(renameNode(treeData, node.id, editValue.trim()))
    }
    setEditing(false)
  }

  return (
    <div className="tree-node-wrapper">
      <div
        className={`tree-node ${selectedNodeId === node.id ? 'selected' : ''}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onSelectNode(node.id)}
        onContextMenu={(e) => onShowContextMenu(e, { type: 'node', node, treeData })}
      >
        <span className="tree-expand" onClick={toggle}>
          {node.children.length > 0 ? (node.expanded ? '▼' : '▶') : '\u3000'}
        </span>
        {editing ? (
          <form onSubmit={handleRename} onClick={e => e.stopPropagation()}>
            <input
              className="tree-rename-input"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleRename}
              autoFocus
            />
          </form>
        ) : (
          <span className="tree-label" onDoubleClick={() => setEditing(true)}>{node.name}</span>
        )}
        <span className="tree-icons">
          {node.sessions.claude && <span title="Claude">C</span>}
          {node.sessions.codex && <span title="Codex">X</span>}
          {node.sessions.gemini && <span title="Gemini">G</span>}
        </span>
      </div>
      {node.expanded && node.children.map(child => (
        <TreeNodeItem
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
          onUpdateTree={onUpdateTree}
          treeData={treeData}
          onShowContextMenu={onShowContextMenu}
        />
      ))}
    </div>
  )
}

interface ProjectTreeProps {
  projectPath: string | null
  treeData: TreeData | null
  selectedNodeId: string | null
  onSelectNode: (id: string) => void
  onOpenProject: (path: string) => void
  onUpdateTree: (tree: TreeData) => void
  onShowContextMenu: (e: React.MouseEvent, ctx: any) => void
}

export default function ProjectTree({
  projectPath, treeData, selectedNodeId, onSelectNode,
  onOpenProject, onUpdateTree, onShowContextMenu
}: ProjectTreeProps) {
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [recentProjects, setRecentProjects] = useState<{ path: string; name: string; openedAt: string }[]>([])

  useEffect(() => {
    if (!treeData) {
      window.electronAPI.readRecentProjects().then(setRecentProjects)
    }
  }, [treeData])

  const handleOpenProject = async () => {
    const folder = await window.electronAPI.openFolderDialog()
    if (folder) onOpenProject(folder)
  }

  const handleCreateProject = async () => {
    const folder = await window.electronAPI.openFolderDialog()
    if (!folder) return
    const result = await window.electronAPI.createProject(folder, folder.split(/[\\/]/).pop() || 'project')
    if (result.success && result.projectPath) onOpenProject(result.projectPath)
  }

  const handleAddRoot = (e: React.FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (name && treeData) {
      onUpdateTree(addChildNode(treeData, '__root__', name))
      if (projectPath) window.electronAPI.ensureFolderPath(projectPath, [name])
      setNewName('')
      setCreating(false)
    }
  }

  if (!treeData) {
    return (
      <div className="project-empty">
        <p className="project-empty-title">プロジェクトなし</p>
        <button className="btn btn-primary" onClick={handleOpenProject}>プロジェクトを開く</button>
        <button className="btn btn-secondary" onClick={handleCreateProject}>新規プロジェクト</button>
        {recentProjects.length > 0 && (
          <div className="recent-projects">
            <p className="recent-projects-title">最近のプロジェクト</p>
            <ul className="recent-projects-list">
              {recentProjects.map(item => (
                <li
                  key={item.path}
                  className="recent-project-item"
                  onClick={() => onOpenProject(item.path)}
                  title={item.path}
                >
                  <span className="recent-project-name">{item.name}</span>
                  <span className="recent-project-path">{item.path}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="project-tree">
      <div className="project-tree-header">
        <span className="project-name">{treeData.name}</span>
        <button className="btn-icon" title="新規ノード追加" onClick={() => setCreating(v => !v)}>＋</button>
      </div>
      {creating && (
        <form className="tree-new-form" onSubmit={handleAddRoot}>
          <input
            className="form-input"
            placeholder="ノード名"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            autoFocus
          />
        </form>
      )}
      <div className="tree-list">
        {treeData.children.map(node => (
          <TreeNodeItem
            key={node.id}
            node={node}
            depth={0}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
            onUpdateTree={onUpdateTree}
            treeData={treeData}
            onShowContextMenu={onShowContextMenu}
          />
        ))}
      </div>
    </div>
  )
}
