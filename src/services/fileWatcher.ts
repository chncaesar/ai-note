import * as vscode from 'vscode';
import { TodoParser } from './todoParser';
import { StorageService } from './storageService';
import { TodoItem } from '../types/todo';

export class FileWatcher {
	private fileWatcher: vscode.FileSystemWatcher | undefined;
	private debounceTimer: NodeJS.Timeout | undefined;
	private readonly debounceDelay = 500; // 500ms 防抖

	constructor(
		private context: vscode.ExtensionContext,
		private onTodosUpdated: (todos: TodoItem[]) => void
	) {}

	/**
	 * 启动文件监听
	 */
	start(): void {
		// 监听所有 .md 和 .txt 文件的变化
		const pattern = new vscode.RelativePattern(
			vscode.workspace.workspaceFolders?.[0] || vscode.Uri.file(''),
			'**/*.{md,txt}'
		);

		this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

		// 监听文件创建和更改
		this.fileWatcher.onDidCreate(uri => this.handleFileChange(uri));
		this.fileWatcher.onDidChange(uri => this.handleFileChange(uri));
		this.fileWatcher.onDidDelete(uri => this.handleFileDelete(uri));

		// 监听当前打开的文档变化
		vscode.workspace.onDidChangeTextDocument(e => {
			if (this.isNoteFile(e.document.uri)) {
				this.handleFileChange(e.document.uri);
			}
		});

		// 监听文档打开事件
		vscode.workspace.onDidOpenTextDocument(doc => {
			if (this.isNoteFile(doc.uri)) {
				this.handleFileChange(doc.uri);
			}
		});

		// 初始扫描所有文件
		this.scanAllFiles();
	}

	/**
	 * 处理文件变化（带防抖）
	 */
	private handleFileChange(uri: vscode.Uri): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}

		this.debounceTimer = setTimeout(async () => {
			await this.parseAndUpdate(uri);
		}, this.debounceDelay);
	}

	/**
	 * 处理文件删除
	 */
	private async handleFileDelete(uri: vscode.Uri): Promise<void> {
		// 删除该文件的所有待办事项
		await StorageService.updateTodosByFile(this.context, uri.fsPath, []);
		this.notifyUpdate();
	}

	/**
	 * 解析文件并更新存储
	 */
	private async parseAndUpdate(uri: vscode.Uri): Promise<void> {
		try {
			const todos = await TodoParser.parseFile(uri);
			await StorageService.updateTodosByFile(this.context, uri.fsPath, todos);
			this.notifyUpdate();
		} catch (error) {
			console.error(`Failed to parse file ${uri.fsPath}:`, error);
		}
	}

	/**
	 * 扫描所有笔记文件
	 */
	private async scanAllFiles(): Promise<void> {
		if (!vscode.workspace.workspaceFolders) {
			return;
		}

		const pattern = new vscode.RelativePattern(
			vscode.workspace.workspaceFolders[0],
			'**/*.{md,txt}'
		);

		const files = await vscode.workspace.findFiles(pattern, null, 100);

		for (const file of files) {
			await this.parseAndUpdate(file);
		}
	}

	/**
	 * 检查是否是笔记文件
	 */
	private isNoteFile(uri: vscode.Uri): boolean {
		const ext = uri.path.split('.').pop()?.toLowerCase();
		return ext === 'md' || ext === 'txt';
	}

	/**
	 * 通知更新
	 */
	private notifyUpdate(): void {
		const todos = StorageService.getTodos(this.context);
		this.onTodosUpdated(todos);
	}

	/**
	 * 手动刷新当前文件
	 */
	async refreshCurrentFile(): Promise<void> {
		const editor = vscode.window.activeTextEditor;
		if (editor && this.isNoteFile(editor.document.uri)) {
			await this.parseAndUpdate(editor.document.uri);
		}
	}

	/**
	 * 停止监听
	 */
	dispose(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}
		this.fileWatcher?.dispose();
	}
}

