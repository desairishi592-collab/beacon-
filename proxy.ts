import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'
import { DEV_AUTH_BYPASS, getDevSession } from '@/lib/dev-auth'

const AUTH_PATHS = ['/login']
const ONBOARDING_PATH = '/onboarding'
const DASHBOARD_PREFIX = '/dashboard'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // TEMPORARY DEV-ONLY: skip real Supabase auth entirely. See lib/dev-auth.ts.
  // Remove this branch before shipping.
  if (DEV_AUTH_BYPASS) {
    return devBypassProxy(request, pathname)
  }

  const { supabaseResponse, user, supabase } = await updateSession(request)

  const needsAuth = pathname.startsWith(DASHBOARD_PREFIX) || pathname === ONBOARDING_PATH

  if (!user) {
    if (needsAuth) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // User is authenticated — check onboarding status for gated routes.
  if (needsAuth || AUTH_PATHS.includes(pathname)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    const hasProfile = Boolean(profile)

    if (!hasProfile && pathname.startsWith(DASHBOARD_PREFIX)) {
      const url = request.nextUrl.clone()
      url.pathname = ONBOARDING_PATH
      return NextResponse.redirect(url)
    }

    if (hasProfile && pathname === ONBOARDING_PATH) {
      const url = request.nextUrl.clone()
      url.pathname = DASHBOARD_PREFIX
      return NextResponse.redirect(url)
    }

    if (AUTH_PATHS.includes(pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = hasProfile ? DASHBOARD_PREFIX : ONBOARDING_PATH
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

// TEMPORARY DEV-ONLY: mirrors the auth/onboarding gating above, but always
// treats the request as the fixed dev-bypass user instead of checking a
// real session. Remove alongside lib/dev-auth.ts.
async function devBypassProxy(request: NextRequest, pathname: string) {
  const needsAuth = pathname.startsWith(DASHBOARD_PREFIX) || pathname === ONBOARDING_PATH
  if (!needsAuth && !AUTH_PATHS.includes(pathname)) {
    return NextResponse.next()
  }

  const { userId, db } = await getDevSession()
  const { data: profile } = await db.from('profiles').select('id').eq('id', userId).maybeSingle()
  const hasProfile = Boolean(profile)

  if (!hasProfile && pathname.startsWith(DASHBOARD_PREFIX)) {
    const url = request.nextUrl.clone()
    url.pathname = ONBOARDING_PATH
    return NextResponse.redirect(url)
  }

  if (hasProfile && pathname === ONBOARDING_PATH) {
    const url = request.nextUrl.clone()
    url.pathname = DASHBOARD_PREFIX
    return NextResponse.redirect(url)
  }

  if (AUTH_PATHS.includes(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = hasProfile ? DASHBOARD_PREFIX : ONBOARDING_PATH
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - image/font file extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
