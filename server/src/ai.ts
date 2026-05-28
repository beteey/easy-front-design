/**
 * Anthropic Claude streaming integration.
 */

import Anthropic from '@anthropic-ai/sdk'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface StreamCallbacks {
  onChunk: (text: string) => void
  onDone: () => void
  onError: (err: Error) => void
}

export async function streamAIResponse(
  model: string,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
): Promise<void> {
  const client = new Anthropic()

  try {
    const stream = client.messages.stream({
      model,
      max_tokens: 4096,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        callbacks.onChunk(event.delta.text)
      }
    }

    callbacks.onDone()
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)))
  }
}
