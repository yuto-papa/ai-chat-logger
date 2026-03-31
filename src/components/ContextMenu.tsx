import { useState, useRef, useEffect } from 'react'
import { addChildNode, deleteNode, getNodePath } from './ProjectTree'
import { setSessionId } from '../lib/treeOps'
import type { TreeData, TreeNode, ContextMenuContext } from '../types'
import { useLang } from '../LangContext'

interface ContextMenuProps {
  x: number
  y: number
  context: ContextMenuContext & { onRefreshDir?: () => void }
  projectPath: string | null
  treeData: TreeData | null
  onOpenProject: (path: string) => void
  onUpdateTree: (tree: TreeData) => void
  onLaunchCLI: (nodeId: string, tool: string, sessionId?: string | null, cwd?: string) => void
  onClose: () => void
}

type InlineMode = 'create-folder' | 'create-project' | 'add-node' | 'save-copilot-url' | 'save-perplexity-url' | null

export default function ContextMenu({
  x, y, context, treeData, projectPath,
  onOpenProject, onUpdateTree, onLaunchCLI, onClose
}: ContextMenuProps) {
  const t = useLang()
  const [inlineMode, setInlineMode] = useState<InlineMode>(null)
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inlineMode) setTimeout(() => inputRef.current?.focus(), 30)
  }, [inlineMode])

  const { type, node } = context
  const hasClaudeSession = node?.sessions?.claude
  const isDir = context.entry?.isDir

  const getCreateDir = (): string | null => {
    const entry = context.entry
    if (!entry) return null
    if (entry.isDir) return entry.path
    return entry.path.replace(/[\\/][^\\/]*$/, '') || null
  }

  const handleInlineSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = inputValue.trim()
    if (!name) return

    if (inlineMode === 'create-folder') {
      const parentPath = getCreateDir()
      if (parentPath) {
        const result = await window.electronAPI.createFolder(parentPath, name)
        if (result.success) context.onRefreshDir?.()
      }
    } else if (inlineMode === 'create-project') {
      const parentPath = getCreateDir()
      if (parentPath) {
        const result = await window.electronAPI.createProject(parentPath, name)
        if (result.success && result.projectPath) {
          onOpenProject(result.projectPath)
          context.onRefreshDir?.()
        }
      }
    } else if (inlineMode === 'add-node') {
      if (treeData) {
        const parentId = node?.id ?? '__root__'
        const updated = addChildNode(treeData, parentId, name)
        onUpdateTree(updated)
        if (projectPath) {
          const parentSegments = parentId === '__root__' ? [] : getNodePath(treeData, parentId)
          window.electronAPI.ensureFolderPath(projectPath, [...parentSegments, name])
        }
      }
    } else if (inlineMode === 'save-copilot-url') {
      if (treeData && node) {
        const updated = setSessionId(treeData, node.id, 'copilot', name || null)
        onUpdateTree(updated)
      }
    } else if (inlineMode === 'save-perplexity-url') {
      if (treeData && node) {
        const updated = setSessionId(treeData, node.id, 'perplexity', name || null)
        onUpdateTree(updated)
      }
    }
    onClose()
  }

  const startInline = (mode: InlineMode, placeholder = '', initialValue = '') => (e: React.MouseEvent) => {
    e.stopPropagation()
    setInputValue(initialValue)
    setInlineMode(mode)
  }

  const handleOpenProject = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const folder = await window.electronAPI.openFolderDialog()
    if (folder) onOpenProject(folder)
    onClose()
  }

  const handleOpenThisFolder = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (context.entry?.isDir) onOpenProject(context.entry.path)
    onClose()
  }

  const handleShowInExplorer = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (context.entry?.path) window.electronAPI.showInExplorer(context.entry.path)
    onClose()
  }

  const handleOpenCopilot = (e: React.MouseEvent) => {
    e.stopPropagation()
    const saved = context.node?.sessions?.copilot
    window.electronAPI.openExternal(saved ?? 'https://copilot.microsoft.com/')
    onClose()
  }

  const handleOpenPerplexity = (e: React.MouseEvent) => {
    e.stopPropagation()
    const saved = context.node?.sessions?.perplexity
    window.electronAPI.openExternal(saved ?? 'https://www.perplexity.ai/')
    onClose()
  }

  const getEntryDir = (): string | undefined => {
    const entry = context.entry
    if (!entry) return undefined
    if (entry.isDir) return entry.path
    return entry.path.replace(/[\\/][^\\/]*$/, '') || undefined
  }

  const handleLaunchFromExplorer = (tool: string) => async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!treeData || !context.entry) return
    const name = context.entry.name || context.entry.path.split(/[\\/]/).pop() || 'new'
    const updated = addChildNode(treeData, '__root__', name)
    const newNode = updated.children[updated.children.length - 1]
    onUpdateTree(updated)
    await onLaunchCLI(newNode.id, tool, null, getEntryDir())
    onClose()
  }

  const handleLaunchRoot = (tool: string) => async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!treeData) return
    // ルートノード自体を仮想ノードとして起動（cwd = projectPath）
    const rootVirtualId = '__root__'
    await onLaunchCLI(rootVirtualId, tool, null, projectPath ?? undefined)
    onClose()
  }

  const handleLaunch = (tool: string, sessionId?: string | null) => async (e: React.MouseEvent) => {
    e.stopPropagation()
    const n = context.node as TreeNode
    let cwd: string | undefined
    if (projectPath && treeData) {
      const segments = getNodePath(treeData, n.id)
      if (segments.length > 0) {
        cwd = [projectPath, ...segments].join('\\')
        await window.electronAPI.ensureFolderPath(projectPath, segments)
      }
    }
    await onLaunchCLI(n.id, tool, sessionId, cwd)
    onClose()
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!context.node || !treeData) return
    const confirmed = window.confirm(t.confirm_delete_node(context.node.name))
    if (confirmed) {
      if (projectPath) {
        const segments = getNodePath(treeData, context.node.id)
        if (segments.length > 0) window.electronAPI.removeFolderPath(projectPath, segments)
      }
      onUpdateTree(deleteNode(treeData, context.node.id))
    }
    onClose()
  }

  const placeholders: Record<NonNullable<InlineMode>, string> = {
    'create-folder': t.placeholder_folder_name,
    'create-project': t.placeholder_project_name,
    'add-node': t.placeholder_node_name,
    'save-copilot-url': t.placeholder_copilot_url,
    'save-perplexity-url': t.placeholder_perplexity_url,
  }

  const inlineBtnLabel = (inlineMode === 'save-copilot-url' || inlineMode === 'save-perplexity-url')
    ? t.btn_save : t.btn_create

  if (inlineMode) {
    return (
      <div
        className="context-menu"
        style={{ left: x, top: y }}
        onClick={e => e.stopPropagation()}
      >
        <form className="context-inline-form" onSubmit={handleInlineSubmit}>
          <input
            ref={inputRef}
            className="context-inline-input"
            placeholder={placeholders[inlineMode]}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') onClose() }}
          />
          <button type="submit" className="context-inline-btn">{inlineBtnLabel}</button>
        </form>
      </div>
    )
  }

  return (
    <div
      className="context-menu"
      style={{ left: x, top: y }}
      onClick={e => e.stopPropagation()}
    >
      {type === 'explorer-noproject' && (<>
        {isDir && <>
          <div className="context-menu-item" onClick={handleOpenThisFolder}>{t.open_this_folder_as_project}</div>
          <div className="context-menu-sep" />
        </>}
        {!isDir && <>
          <div className="context-menu-item" onClick={handleOpenProject}>{t.open_project_folder_dialog}</div>
          <div className="context-menu-sep" />
        </>}
        <div className="context-menu-item" onClick={startInline('create-folder')}>{t.create_new_folder}</div>
        <div className="context-menu-item" onClick={handleShowInExplorer}>{t.show_in_explorer}</div>
      </>)}

      {node && (<>
        {hasClaudeSession
          ? <>
            <div className="context-menu-item" onClick={handleLaunch('claude', node.sessions.claude)}>{t.claude_resume}</div>
            <div className="context-menu-item" onClick={handleLaunch('claude', null)}>{t.claude_new}</div>
          </>
          : <div className="context-menu-item" onClick={handleLaunch('claude', null)}>{t.claude_open}</div>
        }
        <div className="context-menu-item" onClick={handleLaunch('codex', null)}>{t.codex_open}</div>
        <div className="context-menu-item" onClick={handleLaunch('gemini', null)}>{t.gemini_open}</div>
        <div className="context-menu-sep" />
        {node.sessions.copilot
          ? <>
            <div className="context-menu-item" onClick={handleOpenCopilot}>{t.copilot_resume_thread}</div>
            <div className="context-menu-item" onClick={startInline('save-copilot-url', '', node.sessions.copilot ?? '')}>{t.copilot_change_url}</div>
          </>
          : <>
            <div className="context-menu-item" onClick={handleOpenCopilot}>{t.copilot_open_browser}</div>
            <div className="context-menu-item" onClick={startInline('save-copilot-url', 'https://copilot.microsoft.com/chats/...')}>{t.copilot_save_url}</div>
          </>
        }
        {node.sessions.perplexity
          ? <>
            <div className="context-menu-item" onClick={handleOpenPerplexity}>{t.perplexity_resume_thread}</div>
            <div className="context-menu-item" onClick={startInline('save-perplexity-url', '', node.sessions.perplexity ?? '')}>{t.perplexity_change_url}</div>
          </>
          : <>
            <div className="context-menu-item" onClick={handleOpenPerplexity}>{t.perplexity_open_browser}</div>
            <div className="context-menu-item" onClick={startInline('save-perplexity-url', 'https://www.perplexity.ai/s/...')}>{t.perplexity_save_url}</div>
          </>
        }
        <div className="context-menu-sep" />
        <div className="context-menu-item" onClick={startInline('add-node')}>{t.add_child_node}</div>
        <div className="context-menu-item danger" onClick={handleDelete}>{t.delete_node}</div>
      </>)}

      {type === 'explorer-project' && !node && (<>
        {isDir && <div className="context-menu-item" onClick={startInline('create-folder')}>{t.create_new_folder}</div>}
        {isDir && <div className="context-menu-sep" />}
        <div className="context-menu-item" onClick={handleLaunchFromExplorer('claude')}>{t.explorer_launch_claude}</div>
        <div className="context-menu-item" onClick={handleLaunchFromExplorer('codex')}>{t.explorer_launch_codex}</div>
        <div className="context-menu-item" onClick={handleLaunchFromExplorer('gemini')}>{t.explorer_launch_gemini}</div>
        <div className="context-menu-item" onClick={handleOpenCopilot}>{t.copilot_open_browser}</div>
        <div className="context-menu-item" onClick={handleOpenPerplexity}>{t.perplexity_open_browser}</div>
        <div className="context-menu-sep" />
        <div className="context-menu-item" onClick={startInline('add-node')}>{t.add_tree_item}</div>
        <div className="context-menu-item" onClick={handleShowInExplorer}>{t.show_in_explorer}</div>
      </>)}

      {type === 'root-node' && (<>
        <div className="context-menu-item" onClick={handleLaunchRoot('claude')}>{t.claude_open}</div>
        <div className="context-menu-item" onClick={handleLaunchRoot('codex')}>{t.codex_open}</div>
        <div className="context-menu-item" onClick={handleLaunchRoot('gemini')}>{t.gemini_open}</div>
        <div className="context-menu-item" onClick={handleOpenCopilot}>{t.copilot_open_browser}</div>
        <div className="context-menu-item" onClick={handleOpenPerplexity}>{t.perplexity_open_browser}</div>
        <div className="context-menu-separator" />
        <div className="context-menu-item" onClick={startInline('add-node')}>{t.add_child_node}</div>
      </>)}
    </div>
  )
}

