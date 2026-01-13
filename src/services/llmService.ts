import * as vscode from 'vscode';
import { TodoItem, TodoStatus, TodoSource } from '../types/todo';
import { SecretService } from './secretService';

export interface SemanticTodoResult {
	content: string;
	lineNumber: number;
	confidence: 'high' | 'medium' | 'low';
	reasoning?: string;
}

export interface LLMResponse {
	todos: SemanticTodoResult[];
	tokensUsed: number;
}

/**
 * LLM 相关错误
 */
export class LLMError extends Error {
	constructor(
		message: string,
		public statusCode: number,
		public details?: unknown
	) {
		super(message);
		this.name = 'LLMError';
	}
}

export class LLMService {
	private static readonly API_URL = 'https://api.openai.com/v1/chat/completions';
	private static readonly DEFAULT_MODEL = 'gpt-4o-mini';
	private static readonly MAX_TOKENS = 2000;
	private static readonly TEMPERATURE = 0.3;
	private static readonly TIMEOUT_MS = 30000;

	/**
	 * 对文件内容进行语义扫描
	 */
	static async semanticScan(
		context: vscode.ExtensionContext,
		filePath: string,
		content: string
	): Promise<TodoItem[]> {
		const apiKey = await SecretService.getApiKey(context);
		if (!apiKey) {
			throw new LLMError('OpenAI API key not configured', 401);
		}

		const prompt = this.buildPrompt(content);
		const response = await this.callOpenAI(apiKey, prompt);

		return this.parseResponse(response, filePath);
	}

	/**
	 * 构建用于待办事项提取的提示词
	 */
	private static buildPrompt(content: string): string {
		return `You are a task extraction assistant. Analyze the following document and identify implicit tasks or action items that do NOT have explicit markers like "- [ ]", "TODO:", "DONE:", or "IN PROGRESS:".

Look for:
1. Sentences expressing intent to do something ("I need to...", "Should...", "Must...", "Have to...")
2. Questions that imply action needed ("How to fix...", "What about...", "Need to figure out...")
3. Future plans mentioned in context ("Will...", "Going to...", "Plan to...")
4. Implicit commitments or deadlines ("By Friday...", "Before the meeting...")
5. Problems mentioned that need addressing ("Bug in...", "Issue with...", "Problem:")
6. Follow-up items implied in discussions ("Check with...", "Verify that...", "Make sure...")

Return ONLY tasks that are NOT already marked with explicit todo syntax.

Document:
"""
${content}
"""

Respond in JSON format:
{
  "todos": [
    {
      "content": "The task description (clear, actionable)",
      "lineNumber": <line number in original document, 1-indexed>,
      "confidence": "high" | "medium" | "low",
      "reasoning": "Brief explanation of why this is a task"
    }
  ]
}

Confidence levels:
- high: Explicit future action with clear verb ("need to", "must", "will", "have to")
- medium: Implied action from context or question
- low: Possible task inferred from problem description

If no implicit tasks found, return: {"todos": []}`;
	}

	/**
	 * 调用 OpenAI API
	 */
	private static async callOpenAI(
		apiKey: string,
		prompt: string
	): Promise<LLMResponse> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

		try {
			const response = await fetch(this.API_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${apiKey}`
				},
				body: JSON.stringify({
					model: this.DEFAULT_MODEL,
					messages: [
						{
							role: 'system',
							content: 'You are a precise task extraction assistant. Only output valid JSON.'
						},
						{
							role: 'user',
							content: prompt
						}
					],
					max_tokens: this.MAX_TOKENS,
					temperature: this.TEMPERATURE,
					response_format: { type: 'json_object' }
				}),
				signal: controller.signal
			});

			clearTimeout(timeout);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new LLMError(
					`API request failed: ${response.status}`,
					response.status,
					errorData
				);
			}

			const data = await response.json() as {
				choices?: { message?: { content?: string } }[];
				usage?: { total_tokens?: number };
			};
			const content = data.choices?.[0]?.message?.content;

			if (!content) {
				throw new LLMError('Empty response from API', 500);
			}

			const parsed = JSON.parse(content);
			return {
				todos: parsed.todos || [],
				tokensUsed: data.usage?.total_tokens || 0
			};
		} catch (error) {
			clearTimeout(timeout);
			if (error instanceof LLMError) {
				throw error;
			}
			if (error instanceof Error && error.name === 'AbortError') {
				throw new LLMError('Request timeout', 408);
			}
			throw new LLMError(
				`Network error: ${error instanceof Error ? error.message : 'Unknown'}`,
				0
			);
		}
	}

	/**
	 * 将 LLM 响应解析为 TodoItem 数组
	 */
	private static parseResponse(
		response: LLMResponse,
		filePath: string
	): TodoItem[] {
		const now = Date.now();

		return response.todos.map((result, index) => ({
			id: `${filePath}:semantic:${result.lineNumber}:${now}:${index}`,
			content: result.content,
			status: TodoStatus.Pending,
			filePath,
			lineNumber: result.lineNumber,
			createdAt: now,
			updatedAt: now,
			source: TodoSource.Semantic,
			confidence: result.confidence,
			context: result.reasoning
		}));
	}

	/**
	 * 验证 API 密钥是否有效
	 */
	static async validateApiKey(apiKey: string): Promise<boolean> {
		try {
			const response = await fetch(this.API_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${apiKey}`
				},
				body: JSON.stringify({
					model: 'gpt-4o-mini',
					messages: [{ role: 'user', content: 'test' }],
					max_tokens: 1
				})
			});
			return response.ok;
		} catch {
			return false;
		}
	}
}
