import { randomBytes } from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentSession } from '@/lib/current-user'
import { getQuickbooksAuthorizeUrl, QUICKBOOKS_OAUTH_STATE_COOKIE } from '@/lib/quickbooks/oauth'

export async function GET(request: NextRequest) {
  const session = await getCurrentSession()
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const state = randomBytes(32).toString('hex')
  const response = NextResponse.redirect(getQuickbooksAuthorizeUrl(state))
  response.cookies.set(QUICKBOOKS_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return response
}
