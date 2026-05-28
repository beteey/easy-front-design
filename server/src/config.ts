/**
 * Server configuration — reads from environment variables.
 */

export interface Config {
  port: number
  aiProvider: 'anthropic' | 'openai'
  defaultModel: string
  openaiDefaultModel: string
}

export const config: Config = {
  port: parseInt(process.env['PORT'] ?? '3771', 10),
  aiProvider: (process.env['AI_PROVIDER'] as Config['aiProvider']) ?? 'anthropic',
  defaultModel: process.env['ANTHROPIC_MODEL'] ?? 'claude-sonnet-4-20250514',
  openaiDefaultModel: process.env['OPENAI_MODEL'] ?? 'gpt-4o',
}
