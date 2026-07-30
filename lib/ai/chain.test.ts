import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { groqJsonCompletion, openrouterJsonCompletion, geminiJsonCompletion } = vi.hoisted(() => ({
  groqJsonCompletion: vi.fn(),
  openrouterJsonCompletion: vi.fn(),
  geminiJsonCompletion: vi.fn(),
}))

vi.mock('@/lib/groq/client', () => ({ groqJsonCompletion }))
vi.mock('./openrouter', () => ({ openrouterJsonCompletion }))
vi.mock('./gemini', () => ({ geminiJsonCompletion }))

import { chainJsonCompletion } from './chain'

describe('chainJsonCompletion', () => {
  const originalEnv = { ...process.env }
  const params = { system: 's', user: 'u', schemaName: 'test', schema: {} }

  beforeEach(() => {
    groqJsonCompletion.mockReset()
    openrouterJsonCompletion.mockReset()
    geminiJsonCompletion.mockReset()
    delete process.env.GROQ_API_KEY
    delete process.env.OPENROUTER_API_KEY
    delete process.env.GEMINI_API_KEY
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('uses Groq when it is configured and succeeds', async () => {
    process.env.GROQ_API_KEY = 'key'
    groqJsonCompletion.mockResolvedValue({ ok: true })

    const result = await chainJsonCompletion(params)

    expect(result).toEqual({ ok: true })
    expect(openrouterJsonCompletion).not.toHaveBeenCalled()
    expect(geminiJsonCompletion).not.toHaveBeenCalled()
  })

  it('falls through to OpenRouter when Groq is configured but fails', async () => {
    process.env.GROQ_API_KEY = 'key'
    process.env.OPENROUTER_API_KEY = 'key'
    groqJsonCompletion.mockRejectedValue(new Error('groq down'))
    openrouterJsonCompletion.mockResolvedValue({ ok: true })

    const result = await chainJsonCompletion(params)

    expect(result).toEqual({ ok: true })
    expect(geminiJsonCompletion).not.toHaveBeenCalled()
  })

  it('skips providers whose API key is not set', async () => {
    process.env.GEMINI_API_KEY = 'key'
    geminiJsonCompletion.mockResolvedValue({ ok: true })

    const result = await chainJsonCompletion(params)

    expect(result).toEqual({ ok: true })
    expect(groqJsonCompletion).not.toHaveBeenCalled()
    expect(openrouterJsonCompletion).not.toHaveBeenCalled()
  })

  it('throws a combined error when every configured provider fails', async () => {
    process.env.GROQ_API_KEY = 'key'
    process.env.OPENROUTER_API_KEY = 'key'
    groqJsonCompletion.mockRejectedValue(new Error('groq down'))
    openrouterJsonCompletion.mockRejectedValue(new Error('openrouter down'))

    await expect(chainJsonCompletion(params)).rejects.toThrow(/groq down/)
    await expect(chainJsonCompletion(params)).rejects.toThrow(/openrouter down/)
  })

  it('throws a clear error when no provider is configured', async () => {
    await expect(chainJsonCompletion(params)).rejects.toThrow(/No AI provider is configured/)
  })
})
