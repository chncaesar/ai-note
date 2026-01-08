import * as vscode from 'vscode';
import { TodoPanel } from './ui/todoPanel';
import { FileWatcher } from './services/fileWatcher';
import { StorageService } from './services/storageService';
import { TodoStatus } from './types/todo';

let fileWatcher: FileWatcher | undefined;

export function activate(context: vscode.ExtensionContext) {
	console.log('AI Note extension is now active!');

	// 创建文件监听器
	fileWatcher = new FileWatcher(context, () => {
		// 当待办事项更新时，刷新面板
		if (TodoPanel.currentPanel) {
			TodoPanel.currentPanel.refresh();
		}
	});
	fileWatcher.start();

	// 注册命令：显示待办事项面板
	const showPanelCommand = vscode.commands.registerCommand('ai-note.showPanel', () => {
		TodoPanel.createOrShow(context.extensionUri, context);
	});

	// 注册命令：刷新当前文件
	const refreshCommand = vscode.commands.registerCommand('ai-note.refresh', async () => {
		if (fileWatcher) {
			await fileWatcher.refreshCurrentFile();
		}
		if (TodoPanel.currentPanel) {
			TodoPanel.currentPanel.refresh();
		}
		vscode.window.showInformationMessage('已刷新待办事项');
	});

	// 注册命令：更新待办事项状态
	const updateStatusCommand = vscode.commands.registerCommand(
		'ai-note.updateTodoStatus',
		async (todoId: string, status: string) => {
			const todoStatus = status as TodoStatus;
			await StorageService.updateTodo(context, todoId, { status: todoStatus });
			if (TodoPanel.currentPanel) {
				TodoPanel.currentPanel.refresh();
			}
		}
	);

	// 注册命令：清除所有待办事项
	const clearCommand = vscode.commands.registerCommand('ai-note.clearAll', async () => {
		const result = await vscode.window.showWarningMessage(
			'确定要清除所有待办事项吗？',
			'确定',
			'取消'
		);
		if (result === '确定') {
			await StorageService.clearAll(context);
			if (TodoPanel.currentPanel) {
				TodoPanel.currentPanel.refresh();
			}
			vscode.window.showInformationMessage('已清除所有待办事项');
		}
	});

	// 监听活动编辑器变化，自动显示面板
	const onDidChangeActiveEditor = vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor && (editor.document.fileName.endsWith('.md') || editor.document.fileName.endsWith('.txt'))) {
			// 延迟显示，避免频繁切换
			setTimeout(() => {
				if (TodoPanel.currentPanel) {
					TodoPanel.currentPanel.refresh();
				}
			}, 300);
		}
	});

	// 将所有命令添加到订阅
	context.subscriptions.push(
		showPanelCommand,
		refreshCommand,
		updateStatusCommand,
		clearCommand,
		onDidChangeActiveEditor
	);

	// 自动显示面板（可选）
	// TodoPanel.createOrShow(context.extensionUri, context);
}

export function deactivate() {
	if (fileWatcher) {
		fileWatcher.dispose();
	}
}
