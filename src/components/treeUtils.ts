export function moveNode(tree: import('../types').TreeData, nodeId: string, newParentId: string): import('../types').TreeData {
  let movedNode: import('../types').TreeNode | null = null

  const removeNode = (nodes: import('../types').TreeNode[]): import('../types').TreeNode[] =>
    nodes.reduce<import('../types').TreeNode[]>((acc, n) => {
      if (n.id === nodeId) {
        movedNode = { ...n }
        return acc
      }
      return [...acc, { ...n, children: removeNode(n.children) }]
    }, [])

  const addToParent = (nodes: import('../types').TreeNode[]): import('../types').TreeNode[] =>
    nodes.map(n => {
      if (n.id === newParentId) {
        return { ...n, expanded: true, children: [...n.children, movedNode!] }
      }
      return { ...n, children: addToParent(n.children) }
    })

  const withoutNode = { ...tree, children: removeNode(tree.children) }
  if (!movedNode) return tree
  if (newParentId === '__root__') {
    return { ...withoutNode, children: [...withoutNode.children, movedNode!] }
  }
  return { ...withoutNode, children: addToParent(withoutNode.children) }
}
