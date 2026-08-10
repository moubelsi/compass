import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

const ALL_MODES = ['off', 'paper', 'live']
/** 'live' arrives in Milestone 2 with a real execution adapter — until then
 * the pipeline has nowhere to route a live order, so block it here too. */
const AVAILABLE_MODES = ['off', 'paper']

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const mode = body?.mode
  if (typeof mode !== 'string' || !ALL_MODES.includes(mode)) {
    return NextResponse.json({ error: `mode must be one of: ${ALL_MODES.join(', ')}` }, { status: 400 })
  }
  if (!AVAILABLE_MODES.includes(mode)) {
    return NextResponse.json({ error: 'Live execution is not available yet — it lands in a later update.' }, { status: 400 })
  }

  const { data: version } = await supabase
    .from('automation_strategy_versions')
    .select('id')
    .eq('id', id)
    .single()
  if (!version) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { error } = await supabase.from('automation_strategy_versions').update({ mode }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, mode })
}
