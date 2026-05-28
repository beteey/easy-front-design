/**
 * OpenAI streaming integration.
 */

import OpenAI from 'openai'
import type { ChatMessage, StreamCallbacks } from './ai.js'

export async function streamOpenAIResponse(
  model: string,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
): Promise<void> {
  const client = new OpenAI()

  try {
    const stream = await client.chat.completions.create({
      model,
      max_tokens: 4096,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    })

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content
      if (delta) {
        callbacks.onChunk(delta)
      }
    }

    callbacks.onDone()
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)))
  }
}
