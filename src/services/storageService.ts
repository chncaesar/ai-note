import * as vscode from 'vscode';
import { TodoItem, TodoGroup } from '../types/todo';

export class StorageService {
	private static readonly STORAGE_KEY = 'ai-note.todos';

	/**
	 * 保存所有待办事项
	 */
	static async saveTodos(context: vscode.ExtensionContext, todos: TodoItem[]): Promise<void> {
		await context.globalState.update(this.STORAGE_KEY, todos);
	}

	/**
	 * 获取所有待办事项
	 */
	static getTodos(context: vscode.ExtensionContext): TodoItem[] {
		return context.globalState.get<TodoItem[]>(this.STORAGE_KEY, []);
	}

	/**
	 * 更新单个待办事项
	 */
	static async updateTodo(
		context: vscode.ExtensionContext,
		todoId: string,
		updates: Partial<TodoItem>
	): Promise<boolean> {
		const todos = this.getTodos(context);
		const index = todos.findIndex(t => t.id === todoId);

		if (index === -1) {
			return false;
		}

		todos[index] = {
			...todos[index],
			...updates,
			updatedAt: Date.now()
		};

		await this.saveTodos(context, todos);
		return true;
	}

	/**
	 * 删除待办事项
	 */
	static async deleteTodo(context: vscode.ExtensionContext, todoId: string): Promise<boolean> {
		const todos = this.getTodos(context);
		const filtered = todos.filter(t => t.id !== todoId);

		if (filtered.length === todos.length) {
			return false;
		}

		await this.saveTodos(context, filtered);
		return true;
	}

	/**
	 * 按文件路径更新待办事项（替换该文件的所有待办事项）
	 */
	static async updateTodosByFile(
		context: vscode.ExtensionContext,
		filePath: string,
		newTodos: TodoItem[]
	): Promise<void> {
		const todos = this.getTodos(context);
		const filtered = todos.filter(t => t.filePath !== filePath);
		const updated = [...filtered, ...newTodos];

		await this.saveTodos(context, updated);
	}

	/**
	 * 获取按文件分组的待办事项
	 */
	static getTodosByGroup(context: vscode.ExtensionContext): TodoGroup[] {
		const todos = this.getTodos(context);
		const groups = new Map<string, TodoItem[]>();

		todos.forEach(todo => {
			if (!groups.has(todo.filePath)) {
				groups.set(todo.filePath, []);
			}
			groups.get(todo.filePath)!.push(todo);
		});

		return Array.from(groups.entries()).map(([filePath, todos]) => ({
			filePath,
			fileName: this.getFileName(filePath),
			todos: todos.sort((a, b) => a.lineNumber - b.lineNumber)
		}));
	}

	/**
	 * 获取当前文件的待办事项
	 */
	static getTodosForFile(context: vscode.ExtensionContext, filePath: string): TodoItem[] {
		const todos = this.getTodos(context);
		return todos.filter(t => t.filePath === filePath);
	}

	/**
	 * 从文件路径提取文件名
	 */
	private static getFileName(filePath: string): string {
		const parts = filePath.split(/[/\\]/);
		return parts[parts.length - 1] || filePath;
	}

	/**
	 * 清除所有待办事项
	 */
	static async clearAll(context: vscode.ExtensionContext): Promise<void> {
		await context.globalState.update(this.STORAGE_KEY, []);
	}
}

