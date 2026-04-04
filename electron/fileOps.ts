import fs from 'fs'
import path from 'path'
import os from 'os'
import type { TreeData } from '../src/types'

export const THINKTOOL_DIR = path.join(os.homedir(), '.thinktool')
export const RECENT_PATH = path.join(THINKTOOL_DIR, 'recent.json')
export const MAX_RECENT = 16

export interface RecentProject {
  path: string
  name: string
  openedAt: string
}

export interface OpResult {
  success: boolean
  error?: string
}

export interface FolderResult extends OpResult {
  folderPath?: string
}

export interface ProjectResult extends OpResult {
  projectPath?: string
}

interface AddRecentOptions {
  recentPath?: string
  thinktoolDir?: string
  maxRecent?: number
}

function safeSegments(segments: string[]): string[] {
  return segments.map(s => s.replace(/[\\/:*?"<>|]/g, '_'))
}

export function readRecentProjects(recentPath = RECENT_PATH): RecentProject[] {
  try {
    if (!fs.existsSync(recentPath)) return []
    return JSON.parse(fs.readFileSync(recentPath, 'utf8')) as RecentProject[]
  } catch {
    return []
  }
}

export function addRecentProject(
  projectPath: string,
  projectName: string,
  { recentPath = RECENT_PATH, thinktoolDir = THINKTOOL_DIR, maxRecent = MAX_RECENT }: AddRecentOptions = {}
): OpResult {
  try {
    fs.mkdirSync(thinktoolDir, { recursive: true })
    let list = readRecentProjects(recentPath)
    list = list.filter(item => item.path !== projectPath)
    list.unshift({ path: projectPath, name: projectName, openedAt: new Date().toISOString() })
    if (list.length > maxRecent) list = list.slice(0, maxRecent)
    fs.writeFileSync(recentPath, JSON.stringify(list, null, 2), 'utf8')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export function ensureFolderPath(projectPath: string, segments: string[]): FolderResult {
  try {
    const folderPath = path.join(projectPath, ...safeSegments(segments))
    fs.mkdirSync(folderPath, { recursive: true })
    return { success: true, folderPath }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export function removeFolderPath(projectPath: string, segments: string[]): OpResult {
  try {
    const folderPath = path.join(projectPath, ...safeSegments(segments))
    if (fs.existsSync(folderPath)) {
      fs.rmSync(folderPath, { recursive: true, force: true })
    }
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export function createProject(parentPath: string, name: string): ProjectResult {
  try {
    const safeName = name.replace(/[\\/:*?"<>|]/g, '_')
    const projectPath = path.join(parentPath, safeName)
    fs.mkdirSync(projectPath, { recursive: true })
    const treePath = path.join(projectPath, 'tree.json')
    if (!fs.existsSync(treePath)) {
      const tree: TreeData = { name: safeName, children: [] }
      fs.writeFileSync(treePath, JSON.stringify(tree, null, 2), 'utf8')
    }
    return { success: true, projectPath }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

function migrateNode(node: any): any {
  return {
    ...node,
    sessions: {
      claude: node.sessions?.claude ?? null,
      codex: node.sessions?.codex ?? null,
      gemini: node.sessions?.gemini ?? null,
      copilot: node.sessions?.copilot ?? null,
      perplexity: node.sessions?.perplexity ?? null,
    },
    children: Array.isArray(node.children) ? node.children.map(migrateNode) : [],
  }
}

function migrateTree(raw: any): TreeData {
  return {
    name: raw.name ?? '',
    sessions: {
      claude: raw.sessions?.claude ?? null,
      codex: raw.sessions?.codex ?? null,
      gemini: raw.sessions?.gemini ?? null,
      copilot: raw.sessions?.copilot ?? null,
      perplexity: raw.sessions?.perplexity ?? null,
    },
    children: Array.isArray(raw.children) ? raw.children.map(migrateNode) : [],
  }
}

export function readTree(projectPath: string): TreeData | null {
  const treePath = path.join(projectPath, 'tree.json')
  if (!fs.existsSync(treePath)) return null
  try {
    const raw = JSON.parse(fs.readFileSync(treePath, 'utf8'))
    return migrateTree(raw)
  } catch {
    return null
  }
}

export function writeTree(projectPath: string, data: TreeData): OpResult {
  try {
    const treePath = path.join(projectPath, 'tree.json')
    fs.writeFileSync(treePath, JSON.stringify(data, null, 2), 'utf8')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export function readLayout(projectPath: string): Record<string, { x: number; y: number }> {
  const layoutPath = path.join(projectPath, 'layout.json')
  if (!fs.existsSync(layoutPath)) return {}
  try {
    return JSON.parse(fs.readFileSync(layoutPath, 'utf8')) as Record<string, { x: number; y: number }>
  } catch {
    return {}
  }
}

export function writeLayout(projectPath: string, layout: Record<string, { x: number; y: number }>): OpResult {
  try {
    const layoutPath = path.join(projectPath, 'layout.json')
    fs.writeFileSync(layoutPath, JSON.stringify(layout, null, 2), 'utf8')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export function createFolder(parentPath: string, name: string): FolderResult {
  try {
    const safeName = name.replace(/[\\/:*?"<>|]/g, '_')
    const folderPath = path.join(parentPath, safeName)
    fs.mkdirSync(folderPath, { recursive: true })
    return { success: true, folderPath }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
