'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Edit3, Trash2, Plus, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { generateUrlToken, generateWebhookSecret } from '@/lib/automation/tokens'

interface Strategy {
  id: string
  name: string
  description: string | null
  created_at: string
}

interface Version {
  id: string
  version_label: string
  status: string
  mode: string
  created_at: string
}

function statusBadge(status: string) {
  if (status === 'active') return <span className="badge-profit">Active</span>
  if (status === 'paused') return <span className="badge-loss">Paused</span>
  if (status === 'archived') return <span className="badge-neutral">Archived</span>
  return <span className="badge-neutral">Draft</span>
}

function modeBadge(mode: string) {
  if (mode === 'live') return <span className="badge-loss">Live</span>
  if (mode === 'paper') return <span className="badge-profit">Paper</span>
  return <span className="badge-neutral">Off</span>
}

export default function StrategyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [strategy, setStrategy] = useState<Strategy | null>(null)
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [creatingVersion, setCreatingVersion] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  function load() {
    Promise.all([
      supabase.from('automation_strategies').select('*').eq('id', id).single(),
      supabase.from('automation_strategy_versions').select('id, version_label, status, mode, created_at').eq('strategy_id', id).order('created_at', { ascending: false }),
    ]).then(([s, v]) => {
      setStrategy(s.data)
      if (s.data) { setName(s.data.name); setDescription(s.data.description || '') }
      setVersions(v.data || [])
      setLoading(false)
    })
  }

  useEffect(load, [id])

  async function handleSaveEdit() {
    if (!name.trim()) return
    setSaving(true)
    const { error: updErr } = await supabase.from('automation_strategies').update({ name: name.trim(), description: description.trim() || null }).eq('id', id)
    setSaving(false)
    if (!updErr) { setEditing(false); load() }
  }

  async function handleDelete() {
    if (!confirm('Delete this strategy and all its versions? Trades already published stay in your Trade Log.')) return
    setDeleting(true)
    await supabase.from('automation_strategies').delete().eq('id', id)
    router.push('/automation')
  }

  async function handleNewVersion() {
    setCreatingVersion(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Session expired.'); setCreatingVersion(false); return }

    const label = `V${versions.length + 1}`
    const { data: version, error: vErr } = await supabase
      .from('automation_strategy_versions')
      .insert({ user_id: user.id, strategy_id: id, version_label: label, risk_per_trade_pct: 1 })
      .select('id')
      .single()
    if (vErr || !version) { setError(vErr?.message || 'Could not create version.'); setCreatingVersion(false); return }

    const { error: wErr } = await supabase.from('automation_webhooks').insert({
      user_id: user.id,
      strategy_version_id: version.id,
      url_token: generateUrlToken(),
      webhook_secret: generateWebhookSecret(),
    })
    if (wErr) { setError(wErr.message); setCreatingVersion(false); return }

    router.push(`/automation/${id}/versions/${version.id}`)
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div>
  if (!strategy) return <div style={{ padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>Strategy not found</div>

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <div className="page-fixed-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 40px' }}>
        <Link href="/automation" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text-muted)', textDecoration: 'none' }}>
          <ArrowLeft size={15} />Automation
        </Link>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => setEditing(e => !e)} style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Edit3 size={14} />{editing ? 'Cancel' : 'Edit'}
          </button>
          <button className="btn-ghost" onClick={handleDelete} disabled={deleting} style={{ fontSize: 14, color: 'var(--loss)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Trash2 size={14} />{deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      <div className="m-pad" style={{ maxWidth: 800, margin: '0 auto', padding: '80px 40px 60px' }}>
        {error && <div style={{ padding: '12px 16px', borderRadius: 8, background: 'var(--loss-dim)', border: '1px solid rgba(192,57,43,0.2)', fontSize: 14, color: 'var(--loss)', marginBottom: 20 }}>{error}</div>}

        {editing ? (
          <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>Name</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} style={{ fontSize: 15, fontWeight: 500 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>Description</label>
              <textarea className="input" rows={3} value={description} onChange={e => setDescription(e.target.value)} style={{ lineHeight: 1.6, resize: 'none', fontSize: 14 }} />
            </div>
            <button className="btn-primary" onClick={handleSaveEdit} disabled={saving} style={{ fontSize: 14, alignSelf: 'flex-start' }}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        ) : (
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: 10 }}>{strategy.name}</h1>
            {strategy.description && <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{strategy.description}</p>}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Versions</p>
          <button className="btn-primary" onClick={handleNewVersion} disabled={creatingVersion} style={{ fontSize: 13 }}>
            <Plus size={14} />{creatingVersion ? 'Creating…' : 'New version'}
          </button>
        </div>

        {versions.length === 0 ? (
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>No versions yet. Create one to configure risk rules and get a webhook URL.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {versions.map(v => (
              <Link key={v.id} href={`/automation/${id}/versions/${v.id}`} style={{ textDecoration: 'none' }}>
                <div className="card m-col" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.version_label}</span>
                    {statusBadge(v.status)}
                    {modeBadge(v.mode)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-disabled)' }}>{new Date(v.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    <ChevronRight size={15} style={{ color: 'var(--text-muted)' }} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
