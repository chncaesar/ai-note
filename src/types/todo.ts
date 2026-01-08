export enum TodoStatus {
	Pending = 'pending',
	InProgress = 'in-progress',
	Completed = 'completed'
}

export interface TodoItem {
	id: string;
	content: string;
	status: TodoStatus;
	filePath: string;
	lineNumber: number;
	createdAt: number;
	updatedAt: number;
	context?: string; // 前后文信息
}

export interface TodoGroup {
	filePath: string;
	fileName: string;
	todos: TodoItem[];
}

