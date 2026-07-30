import 'server-only'

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
// OpenRouter proxies to the underlying provider's API — this model supports
// OpenAI-compatible strict json_schema response formatting.
const OPENROUTER_MODEL = 'openai/gpt-4o-mini'

// Calls OpenRouter's chat completions endpoint (OpenAI-compatible) with
// strict JSON-schema-constrained decoding and parses the result. Mirrors
// lib/groq/client.ts's contract so both can sit behind the same fallback
// chain — see lib/ai/chain.ts.
export async function openrouterJsonCompletion<T>(params: {
  system: string
  user: string
  schemaName: string
  schema: Record<string, unknown>
}): Promise<T> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set.')

  const res = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.user },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: params.schemaName, strict: true, schema: params.schema },
      },
    }),
  })

  if (!res.ok) {
    throw new Error(`OpenRouter API request failed: ${res.status} ${await res.text()}`)
  }

  const body = await res.json()
  const choice = body.choices?.[0]
  if (choice?.finish_reason === 'content_filter') {
    throw new Error('OpenRouter response was blocked by content filtering.')
  }

  const content = choice?.message?.content
  if (typeof content !== 'string') {
    throw new Error('OpenRouter response did not include message content.')
  }

  return JSON.parse(content) as T
}
