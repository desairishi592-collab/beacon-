import 'server-only'
import { headers } from 'next/headers'

// The scheme+host this request actually arrived on, respecting a
// reverse proxy's forwarded headers when present (e.g. behind Vercel).
export async function getRequestOrigin(): Promise<string> {
  const headerList = await headers()
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host')
  const protocol = headerList.get('x-forwarded-proto') ?? 'http'
  return `${protocol}://${host}`
}
