import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

/** Draft → active. Parameters become immutable from here (design doc §3) —
 * further edits require creating a new version. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: version } = await supabase
    .from('automation_strategy_versions')
    .select('id, status')
    .eq('id', id)
    .single()

  if (!version) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (version.status !== 'draft') {
    return NextResponse.json({ error: 'Only a draft version can be activated.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('automation_strategy_versions')
    .update({ status: 'active', activated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
