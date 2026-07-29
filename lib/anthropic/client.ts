import 'server-only'
import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (!client) {
    // Reads ANTHROPIC_API_KEY from the environment.
    client = new Anthropic()
  }
  return client
}
