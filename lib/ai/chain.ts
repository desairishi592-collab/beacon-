import 'server-only'
import { groqJsonCompletion } from '@/lib/groq/client'
import { openrouterJsonCompletion } from './openrouter'
import { geminiJsonCompletion } from './gemini'

export type JsonCompletionParams = {
  system: string
  user: string
  schemaName: string
  schema: Record<string, unknown>
}

type Provider = {
  name: string
  envKey: string
  run: <T>(params: JsonCompletionParams) => Promise<T>
}

// Tried in order — Groq first since it's the fastest/cheapest and the only
// one every deployment of this app has historically configured.
const PROVIDERS: Provider[] = [
  { name: 'Groq', envKey: 'GROQ_API_KEY', run: groqJsonCompletion },
  { name: 'OpenRouter', envKey: 'OPENROUTER_API_KEY', run: openrouterJsonCompletion },
  { name: 'Gemini', envKey: 'GEMINI_API_KEY', run: geminiJsonCompletion },
]

// Calls each configured AI provider in turn until one succeeds, so a
// transient outage or rate limit on one provider doesn't block risk-flag
// recommendations. A provider whose API key isn't set is skipped rather
// than attempted-and-failed, since most deployments only configure Groq.
export async function chainJsonCompletion<T>(params: JsonCompletionParams): Promise<T> {
  const errors: string[] = []

  for (const provider of PROVIDERS) {
    if (!process.env[provider.envKey]) continue
    try {
      return await provider.run<T>(params)
    } catch (error) {
      errors.push(`${provider.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  throw new Error(
    errors.length > 0
      ? `All configured AI providers failed:\n${errors.join('\n')}`
      : 'No AI provider is configured (set GROQ_API_KEY, OPENROUTER_API_KEY, or GEMINI_API_KEY).'
  )
}
