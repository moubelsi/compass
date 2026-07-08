import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

const PROTECTED = ['/dashboard', '/trades', '/analytics', '/coach', '/settings']
const PUBLIC    = ['/login', '/signup']

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname

  const isProtected = PROTECTED.some(p => path === p || path.startsWith(p + '/'))
  const isPublic    = PUBLIC.some(p => path === p || path.startsWith(p + '/'))

  if (!isProtected && !isPublic) return NextResponse.next()

  const supabase = await createSupabaseServer()

  const { data: { user } } = await supabase.auth.getUser()

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }

  if (isPublic && user) {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico).*)'],
}
