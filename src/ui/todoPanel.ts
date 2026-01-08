import * as vscode from 'vscode';
import * as path from 'path';
import { TodoItem, TodoGroup, TodoStatus } from '../types/todo';
import { StorageService } from '../services/storageService';

export class TodoPanel {
	public static currentPanel: TodoPanel | undefined;
	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private readonly _context: vscode.ExtensionContext;
	private _disposables: vscode.Disposable[] = [];

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
		this._panel = panel;
		this._extensionUri = extensionUri;
		this._context = context;

		// 设置初始内容
		this._update();

		// 监听面板关闭
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// 监听来自 webview 的消息
		this._panel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'openFile':
						this.openFile(message.filePath, message.lineNumber);
						return;
					case 'updateStatus':
						this.updateTodoStatus(message.todoId, message.status);
						return;
					case 'refresh':
						this.refresh();
						return;
				}
			},
			null,
			this._disposables
		);
	}

	/**
	 * 创建或显示面板
	 */
	public static createOrShow(extensionUri: vscode.Uri, context: vscode.ExtensionContext): void {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		// 如果已经有面板，显示它
		if (TodoPanel.currentPanel) {
			TodoPanel.currentPanel._panel.reveal(column);
			return;
		}

		// 创建新面板
		const panel = vscode.window.createWebviewPanel(
			'todoPanel',
			'AI Note Assistant',
			column || vscode.ViewColumn.Two,
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
				retainContextWhenHidden: true
			}
		);

		TodoPanel.currentPanel = new TodoPanel(panel, extensionUri, context);
	}

	/**
	 * 更新面板内容
	 */
	public refresh(): void {
		this._update();
	}

	/**
	 * 更新面板内容
	 */
	private _update(): void {
		const groups = StorageService.getTodosByGroup(this._context);
		const currentFile = vscode.window.activeTextEditor?.document.uri.fsPath;
		const webview = this._panel.webview;

		this._panel.webview.html = this._getHtmlForWebview(webview, groups, currentFile);
	}

	/**
	 * 获取 HTML 内容
	 */
	private _getHtmlForWebview(
		webview: vscode.Webview,
		groups: TodoGroup[],
		currentFile: string | undefined
	): string {
		const currentFileGroup = groups.find(g => g.filePath === currentFile);
		const otherGroups = groups.filter(g => g.filePath !== currentFile);

		return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>AI Note Assistant</title>
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		
		body {
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			color: var(--vscode-foreground);
			background-color: var(--vscode-editor-background);
			padding: 10px;
		}

		.header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 15px;
			padding-bottom: 10px;
			border-bottom: 1px solid var(--vscode-panel-border);
		}

		.title {
			font-size: 16px;
			font-weight: 600;
		}

		.refresh-btn {
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			padding: 4px 12px;
			cursor: pointer;
			border-radius: 2px;
			font-size: 12px;
		}

		.refresh-btn:hover {
			background: var(--vscode-button-hoverBackground);
		}

		.group {
			margin-bottom: 20px;
		}

		.group-title {
			font-size: 14px;
			font-weight: 600;
			margin-bottom: 8px;
			color: var(--vscode-textLink-foreground);
			display: flex;
			align-items: center;
			gap: 6px;
		}

		.todo-list {
			list-style: none;
		}

		.todo-item {
			padding: 8px 12px;
			margin-bottom: 6px;
			background: var(--vscode-list-inactiveSelectionBackground);
			border-left: 3px solid;
			border-radius: 3px;
			cursor: pointer;
			transition: background 0.2s;
		}

		.todo-item:hover {
			background: var(--vscode-list-hoverBackground);
		}

		.todo-item.pending {
			border-left-color: #ffa500;
		}

		.todo-item.in-progress {
			border-left-color: #2196F3;
		}

		.todo-item.completed {
			border-left-color: #4CAF50;
			opacity: 0.7;
		}

		.todo-content {
			display: flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 4px;
		}

		.todo-status {
			font-size: 14px;
		}

		.todo-status.pending::before {
			content: "⭕ ";
		}

		.todo-status.in-progress::before {
			content: "⏳ ";
		}

		.todo-status.completed::before {
			content: "✓ ";
		}

		.todo-text {
			flex: 1;
		}

		.todo-text.completed {
			text-decoration: line-through;
		}

		.todo-meta {
			font-size: 11px;
			color: var(--vscode-descriptionForeground);
			margin-left: 22px;
		}

		.todo-actions {
			display: flex;
			gap: 4px;
			margin-top: 4px;
			margin-left: 22px;
		}

		.action-btn {
			background: transparent;
			border: 1px solid var(--vscode-button-border);
			color: var(--vscode-foreground);
			padding: 2px 6px;
			cursor: pointer;
			border-radius: 2px;
			font-size: 10px;
		}

		.action-btn:hover {
			background: var(--vscode-button-hoverBackground);
		}

		.empty {
			text-align: center;
			color: var(--vscode-descriptionForeground);
			padding: 20px;
		}

		.file-name {
			font-size: 11px;
			color: var(--vscode-descriptionForeground);
			margin-top: 2px;
		}
	</style>
</head>
<body>
	<div class="header">
		<div class="title">📝 AI Note Assistant</div>
		<button class="refresh-btn" onclick="refresh()">刷新</button>
	</div>

	${this._renderGroups(currentFileGroup, otherGroups, currentFile)}

	<script>
		const vscode = acquireVsCodeApi();

		function openFile(filePath, lineNumber) {
			vscode.postMessage({
				command: 'openFile',
				filePath: filePath,
				lineNumber: lineNumber
			});
		}

		function updateStatus(todoId, status) {
			vscode.postMessage({
				command: 'updateStatus',
				todoId: todoId,
				status: status
			});
		}

		function refresh() {
			vscode.postMessage({
				command: 'refresh'
			});
		}

		// 点击待办项跳转
		document.querySelectorAll('.todo-item').forEach(item => {
			item.addEventListener('click', function(e) {
				if (!e.target.classList.contains('action-btn')) {
					const filePath = this.dataset.filePath;
					const lineNumber = parseInt(this.dataset.lineNumber);
					openFile(filePath, lineNumber);
				}
			});
		});
	</script>
</body>
</html>`;
	}

	/**
	 * 渲染分组内容
	 */
	private _renderGroups(
		currentFileGroup: TodoGroup | undefined,
		otherGroups: TodoGroup[],
		currentFile: string | undefined
	): string {
		if (!currentFileGroup && otherGroups.length === 0) {
			return '<div class="empty">暂无待办事项</div>';
		}

		let html = '';

		// 当前文件的待办事项
		if (currentFileGroup && currentFileGroup.todos.length > 0) {
			html += `
				<div class="group">
					<div class="group-title">📝 当前笔记的待办事项</div>
					<ul class="todo-list">
						${currentFileGroup.todos.map(todo => this._renderTodo(todo, currentFile)).join('')}
					</ul>
				</div>
			`;
		}

		// 其他文件的待办事项
		if (otherGroups.length > 0) {
			html += `
				<div class="group">
					<div class="group-title">📚 其他笔记中的待办事项</div>
					${otherGroups.map(group => `
						<div style="margin-bottom: 12px;">
							<div class="file-name">${this._escapeHtml(group.fileName)}</div>
							<ul class="todo-list">
								${group.todos.map(todo => this._renderTodo(todo, currentFile)).join('')}
							</ul>
						</div>
					`).join('')}
				</div>
			`;
		}

		return html;
	}

	/**
	 * 渲染单个待办项
	 */
	private _renderTodo(todo: TodoItem, currentFile: string | undefined): string {
		const statusText = {
			[TodoStatus.Pending]: '待开始',
			[TodoStatus.InProgress]: '进行中',
			[TodoStatus.Completed]: '已完成'
		}[todo.status];

		const statusClass = todo.status === TodoStatus.InProgress ? 'in-progress' : todo.status;

		return `
			<li class="todo-item ${statusClass}" 
				data-file-path="${this._escapeHtml(todo.filePath)}"
				data-line-number="${todo.lineNumber}">
				<div class="todo-content">
					<span class="todo-status ${statusClass}">${statusText}</span>
					<span class="todo-text ${todo.status === TodoStatus.Completed ? 'completed' : ''}">
						${this._escapeHtml(todo.content)}
					</span>
				</div>
				${todo.filePath !== currentFile ? `
					<div class="todo-meta">行 ${todo.lineNumber}</div>
				` : ''}
				<div class="todo-actions">
					${todo.status !== TodoStatus.Pending ? `
						<button class="action-btn" onclick="updateStatus('${todo.id}', 'pending')">待开始</button>
					` : ''}
					${todo.status !== TodoStatus.InProgress ? `
						<button class="action-btn" onclick="updateStatus('${todo.id}', 'in-progress')">进行中</button>
					` : ''}
					${todo.status !== TodoStatus.Completed ? `
						<button class="action-btn" onclick="updateStatus('${todo.id}', 'completed')">完成</button>
					` : ''}
				</div>
			</li>
		`;
	}

	/**
	 * HTML 转义
	 */
	private _escapeHtml(text: string): string {
		const map: { [key: string]: string } = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#039;'
		};
		return text.replace(/[&<>"']/g, m => map[m]);
	}

	/**
	 * 打开文件并跳转到指定行
	 */
	private async openFile(filePath: string, lineNumber: number): Promise<void> {
		const uri = vscode.Uri.file(filePath);
		const document = await vscode.workspace.openTextDocument(uri);
		const editor = await vscode.window.showTextDocument(document);
		const position = new vscode.Position(lineNumber - 1, 0);
		editor.selection = new vscode.Selection(position, position);
		editor.revealRange(new vscode.Range(position, position));
	}

	/**
	 * 更新待办事项状态
	 */
	private async updateTodoStatus(todoId: string, status: string): Promise<void> {
		const todoStatus = status as TodoStatus;
		await StorageService.updateTodo(this._context, todoId, { status: todoStatus });
		this.refresh();
	}

	/**
	 * 清理资源
	 */
	public dispose(): void {
		TodoPanel.currentPanel = undefined;
		this._disposables.forEach(d => d.dispose());
	}
}

