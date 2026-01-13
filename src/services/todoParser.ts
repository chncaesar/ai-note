import * as vscode from 'vscode';
import { TodoItem, TodoStatus, TodoSource } from '../types/todo';

export class TodoParser {
	/**
	 * 从文件内容中解析待办事项
	 */
	static parseTodos(filePath: string, content: string): TodoItem[] {
		const todos: TodoItem[] = [];
		const lines = content.split('\n');

		lines.forEach((line, index) => {
			const todo = this.parseLine(filePath, line, index + 1, lines);
			if (todo) {
				todos.push(todo);
			}
		});

		return todos;
	}

	/**
	 * 解析单行内容
	 */
	private static parseLine(
		filePath: string,
		line: string,
		lineNumber: number,
		allLines: string[]
	): TodoItem | null {
		const trimmedLine = line.trim();

		// 匹配 Markdown 待办事项格式: - [ ] 或 - [x] 或 - [~]
		const markdownTodoRegex = /^[-*]\s+\[([ x~])\]\s+(.+)$/i;
		const markdownMatch = trimmedLine.match(markdownTodoRegex);
		if (markdownMatch) {
			const status = this.parseStatus(markdownMatch[1]);
			const content = markdownMatch[2].trim();
			const context = this.getContext(allLines, lineNumber - 1);
			return this.createTodoItem(filePath, content, status, lineNumber, context);
		}

		// 匹配 TODO: 格式
		const todoRegex = /TODO:\s*(.+)/i;
		const todoMatch = trimmedLine.match(todoRegex);
		if (todoMatch) {
			const content = todoMatch[1].trim();
			const context = this.getContext(allLines, lineNumber - 1);
			return this.createTodoItem(filePath, content, TodoStatus.Pending, lineNumber, context);
		}

		// 匹配 DONE: 格式
		const doneRegex = /DONE:\s*(.+)/i;
		const doneMatch = trimmedLine.match(doneRegex);
		if (doneMatch) {
			const content = doneMatch[1].trim();
			const context = this.getContext(allLines, lineNumber - 1);
			return this.createTodoItem(filePath, content, TodoStatus.Completed, lineNumber, context);
		}

		// 匹配 IN PROGRESS: 或 IN-PROGRESS: 格式
		const inProgressRegex = /IN[- ]?PROGRESS:\s*(.+)/i;
		const inProgressMatch = trimmedLine.match(inProgressRegex);
		if (inProgressMatch) {
			const content = inProgressMatch[1].trim();
			const context = this.getContext(allLines, lineNumber - 1);
			return this.createTodoItem(filePath, content, TodoStatus.InProgress, lineNumber, context);
		}

		return null;
	}

	/**
	 * 解析状态字符
	 */
	private static parseStatus(char: string): TodoStatus {
		switch (char.toLowerCase()) {
			case 'x':
				return TodoStatus.Completed;
			case '~':
				return TodoStatus.InProgress;
			case ' ':
			default:
				return TodoStatus.Pending;
		}
	}

	/**
	 * 获取上下文信息（前后各一行）
	 */
	private static getContext(allLines: string[], currentIndex: number): string {
		const contextLines: string[] = [];
		const start = Math.max(0, currentIndex - 1);
		const end = Math.min(allLines.length, currentIndex + 2);

		for (let i = start; i < end; i++) {
			if (i !== currentIndex) {
				const trimmed = allLines[i].trim();
				if (trimmed) {
					contextLines.push(trimmed);
				}
			}
		}

		return contextLines.join(' | ');
	}

	/**
	 * 创建待办事项对象
	 */
	private static createTodoItem(
		filePath: string,
		content: string,
		status: TodoStatus,
		lineNumber: number,
		context?: string
	): TodoItem {
		const now = Date.now();
		const id = `${filePath}:${lineNumber}:${now}`;

		return {
			id,
			content,
			status,
			filePath,
			lineNumber,
			createdAt: now,
			updatedAt: now,
			context,
			source: TodoSource.Regex
		};
	}

	/**
	 * 从文件 URI 解析待办事项
	 */
	static async parseFile(uri: vscode.Uri): Promise<TodoItem[]> {
		try {
			const document = await vscode.workspace.openTextDocument(uri);
			return this.parseTodos(uri.fsPath, document.getText());
		} catch (error) {
			console.error(`Failed to parse file ${uri.fsPath}:`, error);
			return [];
		}
	}
}

