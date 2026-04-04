import { v4 as uuidv4 } from 'uuid'
import type { TreeData, TreeNode } from '../types'

export function toggleNode(tree: TreeData, nodeId: string): TreeData {
  const walk = (node: TreeNode): TreeNode => {
    if (node.id === nodeId) return { ...node, expanded: !node.expanded }
    return { ...node, children: node.children.map(walk) }
  }
  return { ...tree, children: tree.children.map(walk) }
}

export function renameNode(tree: TreeData, nodeId: string, name: string): TreeData {
  const walk = (node: TreeNode): TreeNode => {
    if (node.id === nodeId) return { ...node, name }
    return { ...node, children: node.children.map(walk) }
  }
  return { ...tree, children: tree.children.map(walk) }
}

export function addChildNode(tree: TreeData, parentId: string, name: string): TreeData {
  const newNode: TreeNode = {
    id: uuidv4(), name, expanded: true, summary: '',
    children: [], sessions: { claude: null, codex: null, gemini: null, copilot: null, perplexity: null }, urls: []
  }
  const walk = (node: TreeNode): TreeNode => {
    if (node.id === parentId) return { ...node, expanded: true, children: [...node.children, newNode] }
    return { ...node, children: node.children.map(walk) }
  }
  if (parentId === '__root__') {
    return { ...tree, children: [...tree.children, newNode] }
  }
  return { ...tree, children: tree.children.map(walk) }
}

export function deleteNode(tree: TreeData, nodeId: string): TreeData {
  const walk = (nodes: TreeNode[]): TreeNode[] =>
    nodes.filter(n => n.id !== nodeId).map(n => ({ ...n, children: walk(n.children) }))
  return { ...tree, children: walk(tree.children) }
}

export function setSessionId(tree: TreeData, nodeId: string, tool: string, sessionId: string | null): TreeData {
  if (nodeId === '__root__') {
    return {
      ...tree,
      sessions: {
        ...(tree.sessions ?? { claude: null, codex: null, gemini: null, copilot: null, perplexity: null }),
        [tool]: sessionId,
      },
    }
  }
  const walk = (node: TreeNode): TreeNode => {
    if (node.id === nodeId) return { ...node, sessions: { ...node.sessions, [tool]: sessionId } }
    return { ...node, children: node.children.map(walk) }
  }
  return { ...tree, children: tree.children.map(walk) }
}

/** nodeId が targetId の子孫（または同一）かどうか */
export function isDescendant(tree: TreeData, nodeId: string, targetId: string): boolean {
  if (nodeId === targetId) return true
  const walk = (node: TreeNode): boolean => {
    if (node.id === nodeId) {
      const checkDescendant = (n: TreeNode): boolean =>
        n.id === targetId || n.children.some(checkDescendant)
      return checkDescendant(node)
    }
    return node.children.some(walk)
  }
  return tree.children.some(walk)
}

/** nodeId を newParentId の子に移動する（循環防止チェック付き） */
export function moveNode(tree: TreeData, nodeId: string, newParentId: string): TreeData {
  // 同じ親への移動 or 自分自身への移動はスキップ
  if (nodeId === newParentId) return tree
  // newParentId が nodeId の子孫になる場合は循環するのでスキップ
  if (isDescendant(tree, nodeId, newParentId)) return tree

  // 移動対象ノードを取り出す
  let extracted: TreeNode | null = null
  const removeNode = (nodes: TreeNode[]): TreeNode[] =>
    nodes.filter(n => {
      if (n.id === nodeId) { extracted = n; return false }
      return true
    }).map(n => ({ ...n, children: removeNode(n.children) }))

  const treeWithout = { ...tree, children: removeNode(tree.children) }
  if (!extracted) return tree

  const node = extracted as TreeNode

  // newParentId が __root__ ならトップレベルに追加
  if (newParentId === '__root__') {
    return { ...treeWithout, children: [...treeWithout.children, node] }
  }

  // 対象の親ノードに追加
  const insertInto = (nodes: TreeNode[]): TreeNode[] =>
    nodes.map(n => {
      if (n.id === newParentId) return { ...n, expanded: true, children: [...n.children, node] }
      return { ...n, children: insertInto(n.children) }
    })

  return { ...treeWithout, children: insertInto(treeWithout.children) }
}

export function getNodePath(tree: TreeData, nodeId: string): string[] {
  const walk = (node: TreeNode, acc: string[]): string[] | null => {
    const path = [...acc, node.name]
    if (node.id === nodeId) return path
    for (const c of node.children) {
      const found = walk(c, path)
      if (found) return found
    }
    return null
  }
  for (const c of tree.children) {
    const found = walk(c, [])
    if (found) return found
  }
  return []
}
