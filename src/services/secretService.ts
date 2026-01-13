import * as vscode from 'vscode';

export class SecretService {
	private static readonly API_KEY_NAME = 'ai-note.openai-api-key';

	/**
	 * 获取存储的 API 密钥
	 */
	static async getApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
		return await context.secrets.get(this.API_KEY_NAME);
	}

	/**
	 * 安全存储 API 密钥
	 */
	static async setApiKey(
		context: vscode.ExtensionContext,
		apiKey: string
	): Promise<void> {
		await context.secrets.store(this.API_KEY_NAME, apiKey);
	}

	/**
	 * 删除存储的 API 密钥
	 */
	static async deleteApiKey(context: vscode.ExtensionContext): Promise<void> {
		await context.secrets.delete(this.API_KEY_NAME);
	}

	/**
	 * 检查是否已配置 API 密钥
	 */
	static async hasApiKey(context: vscode.ExtensionContext): Promise<boolean> {
		const key = await this.getApiKey(context);
		return !!key && key.length > 0;
	}

	/**
	 * 提示用户输入 API 密钥
	 */
	static async promptForApiKey(context: vscode.ExtensionContext): Promise<boolean> {
		const apiKey = await vscode.window.showInputBox({
			prompt: 'Enter your OpenAI API key',
			password: true,
			placeHolder: 'sk-...',
			validateInput: (value) => {
				if (!value) {
					return 'API key is required';
				}
				if (!value.startsWith('sk-')) {
					return 'Invalid API key format (should start with sk-)';
				}
				return null;
			}
		});

		if (apiKey) {
			await this.setApiKey(context, apiKey);
			vscode.window.showInformationMessage('OpenAI API key saved successfully');
			return true;
		}
		return false;
	}
}
