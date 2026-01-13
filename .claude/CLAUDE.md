# AI Note Assistant

A VS Code extension that automatically collects and displays todos from markdown and text notes.

## Architecture

```
src/
├── extension.ts          # Entry point, command registration
├── types/todo.ts         # TodoItem, TodoStatus, TodoSource enums
├── services/
│   ├── fileWatcher.ts    # Monitors .md/.txt files (500ms debounce)
│   ├── todoParser.ts     # Regex-based todo extraction
│   ├── storageService.ts # VS Code GlobalState persistence
│   ├── llmService.ts     # OpenAI semantic detection
│   └── secretService.ts  # Secure API key storage
└── ui/todoPanel.ts       # Webview panel rendering
```

## Todo Detection

**Regex patterns** (automatic):
- `- [ ]`, `- [x]`, `- [~]` (markdown checkboxes)
- `TODO:`, `DONE:`, `IN-PROGRESS:`

**Semantic detection** (on-demand via OpenAI):
- Command: `AI: Scan for Semantic Todos`
- Finds implicit tasks without explicit markers

## Key Commands

| Command | Description |
|---------|-------------|
| `ai-note.showPanel` | Show todo panel |
| `ai-note.semanticScan` | Run AI analysis |
| `ai-note.configureApiKey` | Set OpenAI key |

## Development

```bash
npm install
npm run compile   # Build with webpack
npm run watch     # Watch mode
```

Press F5 in VS Code to launch Extension Development Host.

## Conventions

- UI text in Chinese (待开始, 进行中, 已完成)
- Storage key: `ai-note.todos`
- Todo ID format: `${filePath}:${lineNumber}:${timestamp}`
- Semantic ID: `${filePath}:semantic:${lineNumber}:${timestamp}:${index}`
