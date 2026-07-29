import 'server-only'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
// Supports response_format strict:true (constrained decoding — output is
// guaranteed to match the given schema exactly), unlike Groq's best-effort
// json_object mode.
const GROQ_MODEL = 'openai/gpt-oss-20b'

// Calls Groq's chat completions endpoint with strict JSON-schema-constrained
// decoding and parses the result. `schema` must set additionalProperties:
// false and require every property, per Groq's strict-mode rules.
export async function groqJsonCompletion<T>(params: {
  system: string
  user: string
  schemaName: string
  schema: Record<string, unknown>
}): Promise<T> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY is not set.')

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_MODEL,
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
    throw new Error(`Groq API request failed: ${res.status} ${await res.text()}`)
  }

  const body = await res.json()
  const choice = body.choices?.[0]
  if (choice?.finish_reason === 'content_filter') {
    throw new Error('Groq response was blocked by content filtering.')
  }

  const content = choice?.message?.content
  if (typeof content !== 'string') {
    throw new Error('Groq response did not include message content.')
  }

  return JSON.parse(content) as T
}
