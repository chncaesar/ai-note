import * as vscode from 'vscode';
import { TodoPanel } from './ui/todoPanel';
import { FileWatcher } from './services/fileWatcher';
import { StorageService } from './services/storageService';
import { TodoStatus } from './types/todo';
import { LLMService, LLMError } from './services/llmService';
import { SecretService } from './services/secretService';

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

	// 注册命令：语义扫描
	const semanticScanCommand = vscode.commands.registerCommand(
		'ai-note.semanticScan',
		async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showWarningMessage('No active editor');
				return;
			}

			const fileName = editor.document.fileName;
			if (!fileName.endsWith('.md') && !fileName.endsWith('.txt')) {
				vscode.window.showWarningMessage('Not a note file (.md or .txt)');
				return;
			}

			// 检查 API 密钥
			const hasKey = await SecretService.hasApiKey(context);
			if (!hasKey) {
				const configure = await vscode.window.showWarningMessage(
					'OpenAI API key not configured',
					'Configure Now'
				);
				if (configure === 'Configure Now') {
					await SecretService.promptForApiKey(context);
				}
				return;
			}

			// 显示进度
			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: 'Scanning for semantic todos...',
					cancellable: false
				},
				async (progress) => {
					try {
						progress.report({ increment: 30 });

						const content = editor.document.getText();
						const filePath = editor.document.uri.fsPath;

						const semanticTodos = await LLMService.semanticScan(
							context,
							filePath,
							content
						);

						progress.report({ increment: 50 });

						if (semanticTodos.length === 0) {
							vscode.window.showInformationMessage(
								'No implicit todos found in this document'
							);
							return;
						}

						// 合并待办事项
						const { added, skipped } = await StorageService.mergeSemanticTodos(
							context,
							filePath,
							semanticTodos
						);

						progress.report({ increment: 20 });

						// 刷新面板
						if (TodoPanel.currentPanel) {
							TodoPanel.currentPanel.refresh();
						}

						vscode.window.showInformationMessage(
							`Found ${semanticTodos.length} semantic todos: ${added} added, ${skipped} already exist`
						);
					} catch (error) {
						handleLLMError(error);
					}
				}
			);
		}
	);

	// 注册命令：配置 API 密钥
	const configureApiKeyCommand = vscode.commands.registerCommand(
		'ai-note.configureApiKey',
		async () => {
			await SecretService.promptForApiKey(context);
		}
	);

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
		semanticScanCommand,
		configureApiKeyCommand,
		onDidChangeActiveEditor
	);

	// 自动显示面板（可选）
	// TodoPanel.createOrShow(context.extensionUri, context);
}

/**
 * 处理 LLM 相关错误
 */
function handleLLMError(error: unknown): void {
	if (error instanceof LLMError) {
		switch (error.statusCode) {
			case 401:
				vscode.window.showErrorMessage(
					'Invalid API key. Please reconfigure.',
					'Configure'
				).then(result => {
					if (result === 'Configure') {
						vscode.commands.executeCommand('ai-note.configureApiKey');
					}
				});
				break;
			case 429:
				vscode.window.showErrorMessage(
					'Rate limit exceeded. Please try again later.'
				);
				break;
			case 408:
				vscode.window.showErrorMessage(
					'Request timeout. The document may be too large.'
				);
				break;
			default:
				vscode.window.showErrorMessage(`API Error: ${error.message}`);
		}
	} else {
		vscode.window.showErrorMessage(
			`Unexpected error: ${error instanceof Error ? error.message : 'Unknown'}`
		);
	}
}

export function deactivate() {
	if (fileWatcher) {
		fileWatcher.dispose();
	}
}
