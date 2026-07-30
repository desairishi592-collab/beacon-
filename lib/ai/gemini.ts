import 'server-only'

const GEMINI_MODEL = 'gemini-2.0-flash'
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

type JsonSchema = {
  type?: string
  properties?: Record<string, JsonSchema>
  items?: JsonSchema
  required?: string[]
  enum?: unknown[]
  additionalProperties?: unknown
  [key: string]: unknown
}

// Gemini's responseSchema is an OpenAPI-3.0 subset — upper-cased type names,
// and no additionalProperties/const keywords — unlike the strict JSON Schema
// the other two providers accept. Converts on the way in so callers can
// share one schema definition across all three providers (see lib/ai/chain.ts).
function toGeminiSchema(schema: JsonSchema): Record<string, unknown> {
  const converted: Record<string, unknown> = {}
  if (schema.type) converted.type = schema.type.toUpperCase()
  if (schema.properties) {
    converted.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, value]) => [key, toGeminiSchema(value)])
    )
  }
  if (schema.items) converted.items = toGeminiSchema(schema.items)
  if (schema.required) converted.required = schema.required
  if (schema.enum) converted.enum = schema.enum
  return converted
}

// Calls Gemini's generateContent endpoint with structured JSON output and
// parses the result. Mirrors lib/groq/client.ts's contract so both can sit
// behind the same fallback chain — see lib/ai/chain.ts.
export async function geminiJsonCompletion<T>(params: {
  system: string
  user: string
  schemaName: string
  schema: Record<string, unknown>
}): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set.')

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: params.system }] },
      contents: [{ role: 'user', parts: [{ text: params.user }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: toGeminiSchema(params.schema),
      },
    }),
  })

  if (!res.ok) {
    throw new Error(`Gemini API request failed: ${res.status} ${await res.text()}`)
  }

  const body = await res.json()
  const candidate = body.candidates?.[0]
  if (candidate?.finishReason === 'SAFETY') {
    throw new Error('Gemini response was blocked by content filtering.')
  }

  const content = candidate?.content?.parts?.[0]?.text
  if (typeof content !== 'string') {
    throw new Error('Gemini response did not include content.')
  }

  return JSON.parse(content) as T
}
