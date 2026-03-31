# ThinkTool 仕様書

**バージョン**: 0.2.0  
**最終更新**: 2026-03-27  
**技術スタック**: Electron 28 + React 18 + TypeScript + xterm.js + React Flow + Vite 5

---

## 1. 概要

ThinkTool は、複数の AI CLI（Claude / Codex / Gemini）および Web 系 AI（Copilot / Perplexity）を使った  
調査・検討セッションを**マインドマップ形式**で管理する Electron デスクトップアプリです。

- 検討テーマをノードとして階層管理し、各ノードで AI との会話を開始できる
- ノードとプロジェクトフォルダ構造を自動同期する
- CLI の会話履歴は CLI 側（`~/.claude/projects/` など）に蓄積される
- Web 系 AI（Copilot / Perplexity）はスレッド URL をノードに紐付けて管理
- UI 言語は英語 / 日本語を切り替え可能

---

## 2. 画面レイアウト

```
┌──[TitleBar]──────────────────────────────────────────────────────┐
├──────────────┬────────────────────────────┬──────────────────────┤
│  左ペイン    │      中央ペイン            │  右ペイン            │
│  ProjectTree │   MindMap（上半分）        │  FileExplorer        │
│              │   NodeTerminal（下半分）   │                      │
│  ─────────── │                            │                      │
│  一時ターミ  │                            │                      │
│  ナル（下）  │                            │                      │
└──────────────┴────────────────────────────┴──────────────────────┘
```

- 左右ペインはアコーディオンボタン（`‹` / `›`）で表示・非表示を切り替え可能
- 左右ペインの幅はペイン境界をドラッグして変更可能（0〜480px）
- 中央ペインの上下比率はマップとターミナルの境界をドラッグして変更可能

---

## 3. カスタムタイトルバー (TitleBar)

OS ネイティブのタイトルバーを非表示にし、React コンポーネントで独自実装。

| 要素 | 説明 |
|---|---|
| ドラッグ領域 | `-webkit-app-region: drag` を適用。ウィンドウ移動が可能 |
| 最小化ボタン | `window.electronAPI.windowMinimize()` を呼び出す |
| 最大化 / 元に戻すボタン | `window.electronAPI.windowMaximize()` を呼び出す。最大化状態を反映してアイコンを切り替え |
| 閉じるボタン | `window.electronAPI.windowClose()` を呼び出す。ホバーで赤背景に変化 |

---

## 4. 左ペイン (LeftPane)

### 4.1 上部：プロジェクトツリー (ProjectTree)

#### プロジェクト未選択状態

| 要素 | 動作 |
|---|---|
| 「Open Project」ボタン | フォルダ選択ダイアログ → `openProject()` |
| 「New Project」ボタン | フォルダ選択ダイアログ → `createProject()` → `openProject()` |
| 最近のプロジェクト一覧 | `~/.thinktool/recent.json` から最大 16 件表示。クリックで直接開く |

#### プロジェクト選択後状態

| 要素 | 動作 |
|---|---|
| プロジェクト名ヘッダー | `tree.json` の `name` フィールドを表示 |
| 「＋」ボタン | ルートへのノード追加フォームをトグル表示 |
| ノードリスト | 階層インデント付きで `tree.json` の children を表示 |
| ノードクリック | そのノードを選択状態にする（中央ペインと連動） |
| ノードダブルクリック | インライン名前変更モードに入る |
| ▶/▼ アイコンクリック | ノードの展開・折りたたみを切り替える |
| ノード右クリック | コンテキストメニュー（type: `node`）を表示 |
| セッションアイコン | `C`（Claude）/ `X`（Codex）/ `G`（Gemini）をノード右端に表示 |

### 4.2 下部：一時ターミナル (TempTerminal)

| 要素 | 動作 |
|---|---|
| ▲/▼ トグルボタン | 一時ターミナルの表示・非表示を切り替える |
| ターミナル本体 | 汎用シェル（`cmd.exe`）を起動。任意コマンド実行可能 |
| 会話保存 | **保存しない**（一時的な確認用途） |
| ptyId | `"temp"` 固定（プロジェクトと無関係） |

---

## 5. 中央ペイン (MiddlePane)

### 5.1 上部：マインドマップ (MindMap)

プロジェクト未選択時は「Open a project to display the mind map」を表示。

#### ノード表示

| 要素 | 内容 |
|---|---|
| ルートノード | プロジェクト名（特別スタイル、`id = '__root__'`）|
| 子ノード以下 | `tree.json` の children を React Flow ノードとして配置 |
| セッションタグ | `C` / `X` / `G` をノード内に表示 |
| ターミナル起動中 | ノードに `active` スタイルを付与 |
| 概要表示 | `summary` が設定されたノードをクリックすると概要をトグル表示 |

#### レイアウト保存

- ノードの位置は `layout.json` に保存（プロジェクトルートに自動作成）
- ドラッグでノード移動 → 即時 `layout.json` に書き込み
- 次回起動時に `layout.json` から位置を復元

#### 操作

| 操作 | 動作 |
|---|---|
| ノードクリック | そのノードを選択（左ペインと連動） |
| ノード右クリック | コンテキストメニュー（type: `node` または `root-node`）を表示 |
| ノードドラッグ | 親子関係を変更（`moveNode()` を呼び出す） |

### 5.2 下部：ノードターミナル (NodeTerminal)

| 状態 | 表示 |
|---|---|
| ターミナル未起動 | 「Right-click a node to launch a CLI」のヒント表示 |
| ターミナル起動中 | xterm.js ターミナル（選択中ノードに紐付いた ptyId を表示） |

#### タブ管理

- 複数のノードターミナルをタブ切り替えで表示
- 各タブに `↗`（フローティング化）と `×`（非表示）ボタン
- `×` はターミナルを非表示にするだけ（pty は継続）
- `↗` でフローティングウィンドウに切り替え

#### xterm.js 設定

| 項目 | 値 |
|---|---|
| テーマ | Catppuccin Mocha ベースのダークテーマ |
| フォント | Cascadia Code / Consolas |
| フォントサイズ | 14px |
| 初期サイズ | 120 cols × 30 rows（固定） |
| レンダラー | **WebGL**（`xterm-addon-webgl` を使用。ボックス描画文字の隙間を解消） |
| スクロールバック | 5000 行 |
| コピー | テキスト選択で自動コピー |
| ペースト | Ctrl+Shift+V でクリップボードからペースト |

#### ターミナルモード

| モード | 説明 |
|---|---|
| `tab` | 中央ペイン下部のタブとして表示（デフォルト） |
| `float` | フローティングウィンドウとして表示（`↗` で切り替え） |
| `hidden` | 非表示（`×` で非表示。pty は継続） |

### 5.3 フローティングターミナル (FloatingTerminal)

- メインウィンドウ内の `position: fixed` パネルとして実装
- ドラッグで位置変更（ヘッダーをドラッグ）
- 右下のハンドルをドラッグしてリサイズ
- リサイズ中は現在のサイズ（cols × rows）をオーバーレイ表示
- 「⬇」ボタンでタブに戻す、「×」ボタンで非表示

---

## 6. 右ペイン (RightPane / FileExplorer)

### 6.1 ヘッダー

プロジェクト選択中はプロジェクト名、未選択時は「Explorer」を表示。

### 6.2 ファイルエクスプローラー (FileExplorer)

| 状態 | ルートパス |
|---|---|
| プロジェクト未選択 | ホームディレクトリ（`os.homedir()`） |
| プロジェクト選択中 | プロジェクトのルートフォルダ |

#### フォルダ操作

| 操作 | 動作 |
|---|---|
| フォルダクリック | 展開（子エントリを非同期ロード）。再クリックで折りたたむ |
| ローディング中 | ⌛ アイコンを表示 |

#### 右クリックメニュー（プロジェクト未選択: `explorer-noproject`）

| メニュー項目 | 対象 | 動作 |
|---|---|---|
| Open as project | フォルダ | `openProject()` |
| Open project (select folder) | ファイル | ダイアログでフォルダ選択 |
| New folder | 全て | インライン入力 → `createFolder()` → リスト更新 |
| Show in Explorer | 全て | `shell.showItemInFolder()` |

#### 右クリックメニュー（プロジェクト選択中: `explorer-project`）

| メニュー項目 | 動作 |
|---|---|
| New folder（フォルダ上） | インライン入力 → `createFolder()` |
| Open with Claude | そのフォルダ（またはファイルの親フォルダ）を cwd として Claude 起動 |
| Open with Codex | 同上（Codex） |
| Open with Gemini | 同上（Gemini） |
| Open Copilot in browser | Copilot を外部ブラウザで開く |
| Open Perplexity in browser | Perplexity を外部ブラウザで開く |
| Add to tree | インライン入力 → ルートノードに子ノードを追加 |
| Show in Explorer | `shell.showItemInFolder()` |

---

## 7. コンテキストメニュー (ContextMenu)

### 7.1 表示タイプ一覧

| type | 表示場所 |
|---|---|
| `node` | 左ペインのノード / マインドマップのノード |
| `root-node` | マインドマップのルートノード |
| `explorer-noproject` | 右ペイン（プロジェクト未選択） |
| `explorer-project` | 右ペイン（プロジェクト選択中） |

### 7.2 `node` タイプのメニュー

| メニュー項目 | 条件 | 動作 |
|---|---|---|
| Resume with Claude | Claude セッションあり | `launchCLI(nodeId, 'claude', sessionId)` |
| New session with Claude | Claude セッションあり | `launchCLI(nodeId, 'claude', null)` |
| Open with Claude | Claude セッションなし | `launchCLI(nodeId, 'claude', null)` |
| Open with Codex | 常時 | `launchCLI(nodeId, 'codex', null)` |
| Open with Gemini | 常時 | `launchCLI(nodeId, 'gemini', null)` |
| Resume Copilot thread | Copilot URL あり | 保存済み URL を外部ブラウザで開く |
| Change Copilot URL | Copilot URL あり | インライン入力で URL 変更 |
| Open Copilot in browser | Copilot URL なし | `https://copilot.microsoft.com/` を外部ブラウザで開く |
| Save Copilot URL | Copilot URL なし | インライン入力で URL を保存 |
| Resume Perplexity thread | Perplexity URL あり | 保存済み URL を外部ブラウザで開く |
| Change Perplexity URL | Perplexity URL あり | インライン入力で URL 変更 |
| Open Perplexity in browser | Perplexity URL なし | `https://www.perplexity.ai/` を外部ブラウザで開く |
| Save Perplexity URL | Perplexity URL なし | インライン入力で URL を保存 |
| Add child node | 常時 | インライン入力 → `addChildNode()` + サブフォルダ作成 |
| Delete node | 常時 | 確認ダイアログ → `deleteNode()` + フォルダ削除 |

### 7.3 `root-node` タイプのメニュー

| メニュー項目 | 動作 |
|---|---|
| Open with Claude | `cwd = projectPath` として Claude 起動 |
| Open with Codex | 同上（Codex） |
| Open with Gemini | 同上（Gemini） |
| Open Copilot in browser | `https://copilot.microsoft.com/` を外部ブラウザで開く |
| Open Perplexity in browser | `https://www.perplexity.ai/` を外部ブラウザで開く |
| Add child node | インライン入力 → ルートの子ノードに追加 |

### 7.4 インライン入力フォーム

コンテキストメニュー内でテキスト入力が必要な操作は、  
メニュー内にフォームをインライン表示する。

- Enter: 確定・実行
- Escape: キャンセル・メニューを閉じる

---

## 8. 国際化 (i18n)

| 項目 | 内容 |
|---|---|
| 実装 | `src/i18n.ts` の静的辞書 + `LangContext` / `useLang()` フック |
| 対応言語 | 英語（`en`）、日本語（`ja`） |
| 切り替え | タイトルバー右の `JA` / `EN` ボタンをクリック |
| デフォルト | 英語 |

---

## 9. データ構造

### 9.1 NodeSessions

```typescript
interface NodeSessions {
  claude: string | null      // Claude セッション ID（--resume 用）
  codex: string | null       // Codex セッション ID
  gemini: string | null      // Gemini セッション ID
  copilot: string | null     // Copilot スレッド URL
  perplexity: string | null  // Perplexity スレッド URL
}
```

### 9.2 TreeNode

```typescript
interface TreeNode {
  id: string          // UUID
  name: string        // ノード名（対応フォルダ名と同一）
  expanded: boolean   // マインドマップ・ツリーの展開状態
  summary: string     // 概要テキスト（マインドマップでクリック表示）
  children: TreeNode[]
  sessions: NodeSessions
  urls: string[]      // 参考 URL（将来の拡張用）
}
```

### 9.3 TreeData

```typescript
interface TreeData {
  name: string        // プロジェクト名（ルートフォルダ名）
  children: TreeNode[]
}
```

### 9.4 TerminalMode / TerminalMap

```typescript
type TerminalMode = 'tab' | 'float' | 'hidden'

type TerminalMap = Record<string, {
  ptyId: string   // "{nodeId}-{tool}" 形式
  tool: string    // "claude" | "codex" | "gemini"
}>
```

---

## 10. ファイルシステム構成

### 10.1 プロジェクトフォルダ

```
<projectRoot>/
├── tree.json         ← ノードツリー（TreeData 形式）
├── layout.json       ← マインドマップのノード位置（自動保存）
├── <ノード名>/       ← ノード追加時に自動作成
│   ├── <子ノード名>/
│   └── ...
└── ...
```

- ノード追加 → 対応サブフォルダを自動作成
- ノード削除 → 対応サブフォルダを再帰削除（確認ダイアログあり）
- ノード名変更 → **フォルダ名の変更は現時点で未実装**（既知の不整合）

### 10.2 ユーザー設定フォルダ

```
~/.thinktool/
└── recent.json     ← 最近開いたプロジェクト履歴（最大 16 件）
```

### 10.3 Claude 会話履歴

Claude CLI が起動した `cwd` をもとに以下に自動保存（ThinkTool 管理外）:

```
~/.claude/projects/<cwd-encoded>/
└── <session-id>.jsonl
```

---

## 11. Electron IPC API

### 11.1 ファイル操作系

| チャンネル名 | 引数 | 戻り値 | 説明 |
|---|---|---|---|
| `open-folder-dialog` | なし | `string \| null` | フォルダ選択ダイアログ |
| `read-dir` | `dirPath: string` | `DirEntry[]` | ディレクトリ内容一覧 |
| `read-tree` | `projectPath: string` | `TreeData \| null` | tree.json 読み込み |
| `write-tree` | `projectPath, data` | `{success}` | tree.json 書き込み |
| `read-layout` | `projectPath: string` | `Record<string, {x,y}>` | layout.json 読み込み |
| `write-layout` | `projectPath, layout` | `{success}` | layout.json 書き込み |
| `create-project` | `parentPath, name` | `{success, projectPath}` | プロジェクトフォルダ作成 + tree.json 初期化 |
| `create-folder` | `parentPath, name` | `{success, folderPath}` | フォルダ作成 |
| `ensure-folder-path` | `projectPath, segments[]` | `{success, folderPath}` | ネストフォルダを再帰作成 |
| `remove-folder-path` | `projectPath, segments[]` | `{success}` | フォルダを再帰削除 |
| `show-in-explorer` | `filePath: string` | `void` | OS ファイルエクスプローラーで開く |
| `open-external` | `url: string` | `void` | 外部ブラウザで URL を開く |
| `get-home-dir` | なし | `string` | ホームディレクトリパス |
| `read-recent-projects` | なし | `RecentProject[]` | 最近のプロジェクト一覧 |
| `add-recent-project` | `path, name` | `{success}` | 最近のプロジェクトに追加 |

### 11.2 ウィンドウ操作系

| チャンネル名 | 戻り値 | 説明 |
|---|---|---|
| `window-minimize` | `void` | ウィンドウを最小化 |
| `window-maximize` | `void` | ウィンドウを最大化 / 元に戻す（トグル） |
| `window-close` | `void` | ウィンドウを閉じる |
| `window-is-maximized` | `boolean` | 最大化状態を返す |

### 11.3 ターミナル系

| チャンネル名 | 引数 | 戻り値 | 説明 |
|---|---|---|---|
| `start-cli` | `ptyId, command, cwd?` | `{success}` | node-pty でシェル起動（最初の出力を待ってから返る） |
| `terminal-input` (ipcMain.on) | `ptyId, data` | なし | キー入力を pty に送信 |
| `resize-terminal` | `ptyId, cols, rows` | `void` | ターミナルサイズ変更 |
| `kill-terminal` | `ptyId` | `void` | pty プロセス終了 |
| `get-terminal-buffer` | `ptyId` | `string` | pty の出力バッファを取得（最大 100KB） |
| `terminal-output-{ptyId}` (push) | `data: string` | — | pty 出力をレンダラーに送信 |
| `terminal-exit-{ptyId}` (push) | `exitCode: number` | — | pty 終了をレンダラーに通知 |

### 11.4 CLI 起動仕様

| 項目 | 詳細 |
|---|---|
| シェル | `cmd.exe /k <command>` |
| cwd | 指定ノードの対応フォルダ（未指定時はホームディレクトリ） |
| ptyId 形式 | `{nodeId}-{tool}`（例: `abc123-claude`） |
| セッション再開 | `claude --resume <sessionId>` コマンドで起動 |
| 初回出力待ち | 最初のデータが届くまで最大 5 秒待機してから `success: true` を返す |

---

## 12. セキュリティ設定

| 項目 | 値 |
|---|---|
| contextIsolation | `true` |
| nodeIntegration | `false` |
| API 公開 | preload.js の `contextBridge.exposeInMainWorld` 経由のみ |

---

## 13. 純粋関数ライブラリ (src/lib/treeOps.ts)

| 関数 | 説明 |
|---|---|
| `toggleNode(tree, nodeId)` | 指定ノードの expanded を反転 |
| `renameNode(tree, nodeId, name)` | 指定ノードの名前を変更 |
| `addChildNode(tree, parentId, name)` | 指定親ノードへの子ノード追加（`__root__` でルートへ追加） |
| `deleteNode(tree, nodeId)` | 指定ノードとその配下を全削除 |
| `setSessionId(tree, nodeId, tool, sessionId)` | 指定ノードのセッション ID / URL をセット |
| `getNodePath(tree, nodeId)` | ルートから指定ノードまでの名前配列を返す（フォルダパス計算用） |
| `isDescendant(tree, nodeId, targetId)` | `targetId` が `nodeId` の子孫（または同一）か判定 |
| `moveNode(tree, nodeId, newParentId)` | ノードを別の親に移動（循環防止チェック付き） |

---

## 14. テスト構成

```
tests/
├── unit/treeOps.test.ts     # treeOps.ts の純粋関数テスト（Vitest）
├── ipc/fileOps.test.ts      # fileOps.ts のファイル操作テスト（Vitest + 実 FS）
└── e2e/
    ├── helpers.ts           # Electron 起動・ダイアログモック共通ヘルパー
    ├── project.spec.ts      # プロジェクト操作（Playwright）
    ├── mindmap.spec.ts      # マインドマップ操作（Playwright）
    └── fileExplorer.spec.ts # ファイルエクスプローラー（Playwright）
```

| コマンド | 内容 |
|---|---|
| `npm test` | unit + ipc テスト（高速・CI 向け） |
| `npm run test:coverage` | カバレッジレポート付き実行 |
| `npm run test:e2e` | E2E テスト（ビルド後に Electron 起動） |
| `npm run test:e2e:ui` | Playwright UI モード（デバッグ向け） |

---

## 15. 既知の制限・未実装事項

| 項目 | 状態 | 備考 |
|---|---|---|
| ノードリネーム時のフォルダ名変更 | **未実装** | tree.json の name は更新されるがディスク上のフォルダ名は変わらない |
| Claude セッション終了後の sessionId 自動保存 | **未実装** | 起動時のみ ptyId を管理し、セッション ID の逆引きは手動 |
| Codex / Gemini のセッション再開 | **未実装** | Claude のみ `--resume` に対応 |
| pty プロセスの多重起動防止 | **部分実装** | 同じ nodeId で別ツールを起動すると古い pty が残留する |
| パストラバーサル対策 | **未実装** | `safeSegments()` が `..` を除去していない |
| エクスポート機能（Markdown/PDF） | **未実装** | Phase 2 対応予定 |
| マルチ LLM 比較ビュー | **未実装** | Phase 3 対応予定 |
| ターミナルがメインウィンドウ外に出せない | **仕様** | `position: fixed` 実装のため Electron の別ウィンドウ不使用 |
