export type Lang = 'en' | 'ja'

const en = {
  // --- placeholders ---
  placeholder_folder_name: 'Folder name',
  placeholder_project_name: 'Project name',
  placeholder_node_name: 'Node name',
  placeholder_copilot_url: 'https://copilot.microsoft.com/chats/...',
  placeholder_perplexity_url: 'https://www.perplexity.ai/s/...',

  // --- buttons ---
  btn_save: 'Save',
  btn_create: 'Create',

  // --- ContextMenu: explorer (no project) ---
  open_this_folder_as_project: 'Open as project',
  open_project_folder_dialog: 'Open project (select folder)',
  create_new_folder: 'New folder',
  show_in_explorer: 'Show in Explorer',

  // --- ContextMenu: node ---
  claude_resume: 'Resume with Claude',
  claude_new: 'New session with Claude',
  claude_open: 'Open with Claude',
  codex_open: 'Open with Codex',
  gemini_open: 'Open with Gemini',
  copilot_resume_thread: 'Resume Copilot thread',
  copilot_change_url: 'Change Copilot URL',
  copilot_open_browser: 'Open Copilot in browser',
  copilot_save_url: 'Save Copilot URL',
  perplexity_resume_thread: 'Resume Perplexity thread',
  perplexity_change_url: 'Change Perplexity URL',
  perplexity_open_browser: 'Open Perplexity in browser',
  perplexity_save_url: 'Save Perplexity URL',
  add_child_node: 'Add child node',
  delete_node: 'Delete node',
  add_tree_item: 'Add to tree',

  // --- ContextMenu: explorer (project) ---
  explorer_launch_claude: 'Open with Claude',
  explorer_launch_codex: 'Open with Codex',
  explorer_launch_gemini: 'Open with Gemini',

  // --- ContextMenu: confirm ---
  confirm_delete_node: (name: string) =>
    `Delete "${name}"?\n(The corresponding folder will also be deleted.)`,

  // --- LeftPane ---
  temp_terminal_header: 'Temp Terminal',
  tooltip_collapse: 'Collapse',
  tooltip_expand: 'Expand',
  left_pane_hide: 'Hide left pane',
  left_pane_show: 'Show left pane',

  // --- MiddlePane ---
  project_fallback: 'Project',
  middle_empty: 'Open a project to display the mind map',
  tooltip_float_window: 'Pop out to floating window',
  tooltip_hide_terminal: 'Hide (pty continues)',
  terminal_empty: 'Right-click a node to launch a CLI',

  // --- RightPane ---
  explorer_header: 'Explorer',
  right_pane_hide: 'Hide right pane',
  right_pane_show: 'Show right pane',

  // --- FloatingTerminal ---
  tooltip_back_to_tab: 'Back to tab',
  tooltip_hide: 'Hide',

  // --- Lang toggle ---
  lang_toggle: 'JA',
}

const ja: typeof en = {
  placeholder_folder_name: 'フォルダ名',
  placeholder_project_name: 'プロジェクト名',
  placeholder_node_name: 'ノード名',
  placeholder_copilot_url: 'https://copilot.microsoft.com/chats/...',
  placeholder_perplexity_url: 'https://www.perplexity.ai/s/...',

  btn_save: '保存',
  btn_create: '作成',

  open_this_folder_as_project: 'このフォルダをプロジェクトとして開く',
  open_project_folder_dialog: 'プロジェクトを開く（フォルダ選択）',
  create_new_folder: '新規フォルダを作成',
  show_in_explorer: 'エクスプローラーで開く',

  claude_resume: 'Claude で再開',
  claude_new: 'Claude で新規開始',
  claude_open: 'Claude で開く',
  codex_open: 'Codex で開く',
  gemini_open: 'Gemini で開く',
  copilot_resume_thread: 'Copilot スレッドを再開',
  copilot_change_url: 'Copilot URL を変更',
  copilot_open_browser: 'Copilot をブラウザで開く',
  copilot_save_url: 'Copilot URL を記録',
  perplexity_resume_thread: 'Perplexity スレッドを再開',
  perplexity_change_url: 'Perplexity URL を変更',
  perplexity_open_browser: 'Perplexity をブラウザで開く',
  perplexity_save_url: 'Perplexity URL を記録',
  add_child_node: '子ノードを追加',
  delete_node: 'ノードを削除',
  add_tree_item: 'ツリーに項目を追加',

  explorer_launch_claude: 'Claude で開く',
  explorer_launch_codex: 'Codex で開く',
  explorer_launch_gemini: 'Gemini で開く',

  confirm_delete_node: (name: string) =>
    `「${name}」を削除しますか？\n（対応するフォルダも削除されます）`,

  temp_terminal_header: '一時ターミナル',
  tooltip_collapse: '折りたたむ',
  tooltip_expand: '開く',
  left_pane_hide: '左ペインを隠す',
  left_pane_show: '左ペインを表示',

  project_fallback: 'プロジェクト',
  middle_empty: 'プロジェクトを開くとマインドマップが表示されます',
  tooltip_float_window: 'フローティングウィンドウに切り替え',
  tooltip_hide_terminal: '非表示（ptyは継続）',
  terminal_empty: 'ノードを右クリックしてCLIを起動してください',

  explorer_header: 'エクスプローラー',
  right_pane_hide: '右ペインを隠す',
  right_pane_show: '右ペインを表示',

  tooltip_back_to_tab: 'タブに戻す',
  tooltip_hide: '非表示',

  lang_toggle: 'EN',
}

export const translations = { en, ja }
export type T = typeof en
