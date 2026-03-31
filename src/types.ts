export interface NodeSessions {
  claude: string | null
  codex: string | null
  gemini: string | null
  copilot: string | null
  perplexity: string | null
}

export interface TreeNode {
  id: string
  name: string
  expanded: boolean
  summary: string
  children: TreeNode[]
  sessions: NodeSessions
  urls: string[]
}

export interface TreeData {
  name: string
  children: TreeNode[]
}

export interface TerminalEntry {
  ptyId: string
  tool: string
}

export type TerminalMap = Record<string, TerminalEntry>

export interface ContextMenuContext {
  type: string
  node?: TreeNode | null
  treeData?: TreeData | null
  entry?: { path: string; isDir: boolean; name?: string } | null
  onRefreshDir?: () => void
}

export interface ContextMenuState {
  x: number
  y: number
  context: ContextMenuContext
}

export interface DirEntry {
  name: string
  path: string
  isDir: boolean
}

declare global {
  interface Window {
    electronAPI: {
      showInExplorer: (filePath: string) => Promise<void>
      openExternal: (url: string) => Promise<void>
      windowMinimize: () => Promise<void>
      windowMaximize: () => Promise<void>
      windowClose: () => Promise<void>
      windowIsMaximized: () => Promise<boolean>
      createFolder: (parentPath: string, name: string) => Promise<{ success: boolean; folderPath?: string; error?: string }>
      ensureFolderPath: (projectPath: string, segments: string[]) => Promise<{ success: boolean; folderPath?: string; error?: string }>
      removeFolderPath: (projectPath: string, segments: string[]) => Promise<{ success: boolean; error?: string }>
      getHomeDir: () => Promise<string>
      openFolderDialog: () => Promise<string | null>
      readDir: (dirPath: string) => Promise<DirEntry[]>
      readTree: (projectPath: string) => Promise<TreeData | null>
      writeTree: (projectPath: string, data: TreeData) => Promise<{ success: boolean; error?: string }>
      createProject: (parentPath: string, name: string) => Promise<{ success: boolean; projectPath?: string; error?: string }>
      startCLI: (ptyId: string, command: string, cwd?: string) => Promise<{ success: boolean; error?: string }>
      sendInputTo: (ptyId: string, data: string) => void
      resizeTo: (ptyId: string, cols: number, rows: number) => Promise<void>
      killTerminal: (ptyId: string) => Promise<void>
      getTerminalBuffer: (ptyId: string) => Promise<string>
      readRecentProjects: () => Promise<{ path: string; name: string; openedAt: string }[]>
      addRecentProject: (projectPath: string, projectName: string) => Promise<{ success: boolean }>
      onOutputFrom: (ptyId: string, callback: (data: string) => void) => () => void
      onExitFrom: (ptyId: string, callback: (exitCode: number) => void) => () => void
    }
  }
}
