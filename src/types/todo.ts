export enum TodoStatus {
	Pending = 'pending',
	InProgress = 'in-progress',
	Completed = 'completed'
}

export enum TodoSource {
	Regex = 'regex',
	Semantic = 'semantic'
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
	source?: TodoSource; // 来源：正则匹配或语义分析
	confidence?: 'high' | 'medium' | 'low'; // 语义分析置信度
}

export interface TodoGroup {
	filePath: string;
	fileName: string;
	todos: TodoItem[];
}

