import { useCallback, useEffect, useRef, useState } from 'react'
import ReactFlow, {
  Background, Controls, useNodesState, useEdgesState,
  Handle, Position, NodeProps, NodeChange
} from 'reactflow'
import 'reactflow/dist/style.css'
import { moveNode } from '../lib/treeOps'
import type { TreeData, TreeNode, TerminalMap } from '../types'

const NODE_W = 168
const NODE_H = 64
const ROOT_ID = '__root__'

type LayoutMap = Record<string, { x: number; y: number }>

interface MindNodeData {
  label: string
  summary: string
  sessions: { claude: string | null; codex: string | null; gemini: string | null; copilot: string | null; perplexity: string | null }
  hasTerminal: boolean
  isRoot?: boolean
  isDropTarget?: boolean
}

function buildGraph(treeData: TreeData, terminals: TerminalMap, dropTargetId: string | null, layout: LayoutMap) {
  const nodes: any[] = []
  const edges: any[] = []

  const totalWidth = Math.max(treeData.children.length - 1, 0) * 260
  const rootX = totalWidth / 2

  nodes.push({
    id: ROOT_ID,
    type: 'mindNode',
    position: layout[ROOT_ID] ?? { x: rootX, y: 0 },
    data: {
      label: treeData.name,
      summary: '',
      sessions: { claude: null, codex: null, gemini: null },
      hasTerminal: false,
      isRoot: true,
      isDropTarget: dropTargetId === ROOT_ID
    }
  })

  const walk = (node: TreeNode, parentId: string, x: number, y: number) => {
    nodes.push({
      id: node.id,
      type: 'mindNode',
      position: layout[node.id] ?? { x, y },
      data: {
        label: node.name,
        summary: node.summary,
        sessions: node.sessions,
        hasTerminal: node.id in terminals,
        isRoot: false,
        isDropTarget: dropTargetId === node.id
      }
    })
    edges.push({ id: `${parentId}-${node.id}`, source: parentId, target: node.id })
    node.children.forEach((child, i) => {
      const childX = x + (i - (node.children.length - 1) / 2) * 220
      walk(child, node.id, childX, y + 130)
    })
  }

  treeData.children.forEach((n, i) => {
    const x = i * 260
    walk(n, ROOT_ID, x, 130)
  })

  return { nodes, edges }
}

function MindNodeComponent({ data }: NodeProps<MindNodeData>) {
  const [showSummary, setShowSummary] = useState(false)

  return (
    <div
      className={[
        'mind-node',
        data.hasTerminal ? 'active' : '',
        data.isRoot ? 'root' : '',
        data.isDropTarget ? 'drop-target' : ''
      ].filter(Boolean).join(' ')}
      onClick={() => data.summary && setShowSummary(v => !v)}
    >
      <Handle type="target" position={Position.Top} />
      <div className="mind-node-title">{data.label}</div>
      <div className="mind-node-icons">
        {data.sessions.claude && <span className="tag claude">C</span>}
        {data.sessions.codex && <span className="tag codex">X</span>}
        {data.sessions.gemini && <span className="tag gemini">G</span>}
      </div>
      {showSummary && data.summary && (
        <div className="mind-node-summary">{data.summary}</div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

const nodeTypes = { mindNode: MindNodeComponent }

function findNode(tree: TreeData, id: string): TreeNode | null {
  const walk = (node: TreeNode): TreeNode | null => {
    if (node.id === id) return node
    for (const c of node.children) {
      const found = walk(c)
      if (found) return found
    }
    return null
  }
  for (const c of tree.children) {
    const found = walk(c)
    if (found) return found
  }
  return null
}

function overlaps(ax: number, ay: number, bx: number, by: number): boolean {
  return Math.abs(ax - bx) < NODE_W && Math.abs(ay - by) < NODE_H
}

interface MindMapProps {
  projectPath: string | null
  treeData: TreeData
  selectedNodeId: string | null
  terminals: TerminalMap
  onSelectNode: (id: string) => void
  onUpdateTree: (tree: TreeData) => void
  onShowContextMenu: (e: React.MouseEvent, ctx: any) => void
}

export default function MindMap({ projectPath, treeData, selectedNodeId, terminals, onSelectNode, onUpdateTree, onShowContextMenu }: MindMapProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const layoutRef = useRef<LayoutMap>({})
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // プロジェクトを開いたときに layout.json を読み込む
  useEffect(() => {
    if (!projectPath) {
      layoutRef.current = {}
      return
    }
    window.electronAPI.readLayout(projectPath).then((loaded) => {
      layoutRef.current = loaded ?? {}
      const { nodes: n, edges: e } = buildGraph(treeData, terminals, null, layoutRef.current)
      setNodes(n)
      setEdges(e)
    })
  }, [projectPath])

  // ツリー/ターミナル/ドロップターゲット変更時にグラフ再構築
  useEffect(() => {
    const { nodes: n, edges: e } = buildGraph(treeData, terminals, dropTargetId, layoutRef.current)
    setNodes(n)
    setEdges(e)
  }, [treeData, terminals, dropTargetId])

  // ノード位置変更をレイアウトに反映し、デバウンスして保存
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes)
    changes.forEach((change) => {
      if (change.type === 'position' && change.position && !change.dragging) {
        layoutRef.current = { ...layoutRef.current, [change.id]: change.position }
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(() => {
          if (projectPath) {
            window.electronAPI.writeLayout(projectPath, layoutRef.current)
          }
        }, 500)
      }
    })
  }, [projectPath])

  const onNodeClick = useCallback((_: React.MouseEvent, node: any) => {
    onSelectNode(node.id)
  }, [onSelectNode])

  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: any) => {
    e.preventDefault()
    if (node.id === ROOT_ID) {
      onShowContextMenu(e, { type: 'root-node', node: null, treeData })
    } else {
      const found = findNode(treeData, node.id)
      const fallback: TreeNode = found ?? { id: node.id, name: node.data?.label ?? '', expanded: false, summary: '', children: [], sessions: { claude: null, codex: null, gemini: null, copilot: null, perplexity: null }, urls: [] }
      onShowContextMenu(e, { type: 'node', node: fallback, treeData })
    }
  }, [treeData, onShowContextMenu])

  const onNodeDrag = useCallback((_: React.MouseEvent, draggedNode: any) => {
    const dragPos = draggedNode.position
    let found: string | null = null
    for (const n of nodes) {
      if (n.id === draggedNode.id) continue
      if (overlaps(dragPos.x, dragPos.y, n.position.x, n.position.y)) {
        found = n.id
        break
      }
    }
    setDropTargetId(found)
  }, [nodes])

  const onNodeDragStop = useCallback((_: React.MouseEvent, draggedNode: any) => {
    setDropTargetId(null)
    if (!dropTargetId) return
    if (draggedNode.id === ROOT_ID) return

    const updated = moveNode(treeData, draggedNode.id, dropTargetId)
    if (updated !== treeData) {
      onUpdateTree(updated)
    }
  }, [treeData, dropTargetId, onUpdateTree])

  return (
    <div className="mindmap-container">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background color="#3a3a5c" gap={20} />
        <Controls />
      </ReactFlow>
    </div>
  )
}
