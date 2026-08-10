'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.01em' }}>{children}</label>
}

export default function NewStrategyPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  async function handleSave() {
    if (!name.trim()) { setError('Strategy name is required.'); return }
    setSaving(true); setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Session expired.'); setSaving(false); return }

      const { data, error: insErr } = await supabase
        .from('automation_strategies')
        .insert({ user_id: user.id, name: name.trim(), description: description.trim() || null })
        .select('id')
        .single()
      if (insErr) throw insErr
      router.push(`/automation/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setSaving(false)
    }
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <div className="page-fixed-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 40px' }}>
        <Link href="/automation" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text-muted)', textDecoration: 'none' }}>
          <ArrowLeft size={15} />Cancel
        </Link>
        <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>New strategy</span>
        <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ fontSize: 14 }}>
          <Check size={14} strokeWidth={2.5} />{saving ? 'Saving…' : 'Save strategy'}
        </button>
      </div>

      <div className="m-pad" style={{ maxWidth: 680, margin: '0 auto', padding: '80px 40px 60px' }}>
        {error && <div style={{ padding: '12px 16px', borderRadius: 8, background: 'var(--loss-dim)', border: '1px solid rgba(192,57,43,0.2)', fontSize: 14, color: 'var(--loss)', marginBottom: 20 }}>{error}</div>}

        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Strategy details</p>
          <div>
            <Label>Name</Label>
            <input className="input" placeholder="e.g. compass-smc-choch-retest" value={name} onChange={e => setName(e.target.value)} style={{ fontSize: 15, fontWeight: 500 }} />
          </div>
          <div>
            <Label>Description</Label>
            <textarea className="input" rows={3} placeholder="What does this strategy trade, and on what signal?" value={description} onChange={e => setDescription(e.target.value)} style={{ lineHeight: 1.6, resize: 'none', fontSize: 14 }} />
          </div>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 16, lineHeight: 1.6 }}>
          A strategy is a container for versions. Risk rules, assets, mode and the webhook URL all live on a version — you&apos;ll add the first one next.
        </p>
      </div>
    </div>
  )
}
