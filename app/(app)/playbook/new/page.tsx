'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Plus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TagInput } from '@/components/ui/TagInput'

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.01em' }}>{children}</label>
}

export default function NewSetupPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rules, setRules] = useState<string[]>([''])
  const [tags, setTags] = useState<string[]>([])
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const addRule    = () => setRules(r => [...r, ''])
  const updRule    = (i: number, v: string) => setRules(r => r.map((x, j) => j === i ? v : x))
  const removeRule = (i: number) => setRules(r => r.filter((_, j) => j !== i))

  async function handleSave() {
    if (!name.trim()) { setError('Setup name is required.'); return }
    setSaving(true); setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Session expired.'); setSaving(false); return }

      let screenshot_url: string | null = null
      if (screenshot) {
        const ext = screenshot.name.split('.').pop() ?? 'png'
        const path = `setups/${user.id}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('screenshots').upload(path, screenshot)
        if (!upErr) screenshot_url = supabase.storage.from('screenshots').getPublicUrl(path).data.publicUrl
      }

      const { error: insErr } = await supabase.from('setups').insert({
        user_id: user.id,
        name: name.trim(),
        description: description.trim() || null,
        rules: rules.filter(r => r.trim()),
        tags,
        screenshot_url,
      })
      if (insErr) throw insErr
      router.push('/playbook')
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
      setSaving(false)
    }
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <div className="page-fixed-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 40px' }}>
        <Link href="/playbook" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text-muted)', textDecoration: 'none' }}>
          <ArrowLeft size={15} />Cancel
        </Link>
        <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>New setup</span>
        <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ fontSize: 14 }}>
          <Check size={14} strokeWidth={2.5} />{saving ? 'Saving…' : 'Save setup'}
        </button>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '80px 40px 60px' }}>
        {error && <div style={{ padding: '12px 16px', borderRadius: 8, background: 'var(--loss-dim)', border: '1px solid rgba(192,57,43,0.2)', fontSize: 14, color: 'var(--loss)', marginBottom: 20 }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Setup details</p>
            <div>
              <Label>Name</Label>
              <input className="input" placeholder="e.g. London Breakout, MTF Hidden OB…" value={name} onChange={e => setName(e.target.value)} style={{ fontSize: 15, fontWeight: 500 }} />
            </div>
            <div>
              <Label>Description</Label>
              <textarea className="input" rows={3} placeholder="When does this setup occur? What's the market context?" value={description} onChange={e => setDescription(e.target.value)} style={{ lineHeight: 1.6, resize: 'none', fontSize: 14 }} />
            </div>
            <div>
              <Label>Tags</Label>
              <TagInput value={tags} onChange={setTags} />
            </div>
          </div>

          <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Entry rules</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -8, marginBottom: 4 }}>Conditions that must be met before you take this trade</p>

            {rules.map((rule, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 14, height: 14, borderRadius: 4, border: '1.5px solid var(--border-default)', flexShrink: 0 }} />
                <input
                  className="input"
                  placeholder={`Rule ${i + 1}…`}
                  value={rule}
                  onChange={e => updRule(i, e.target.value)}
                  style={{ fontSize: 14, flex: 1 }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRule() } }}
                />
                {rules.length > 1 && (
                  <button type="button" onClick={() => removeRule(i)} style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 4 }}>
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}

            <button type="button" onClick={addRule} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', background: 'none', border: '1px dashed var(--border-default)', borderRadius: 6, padding: '8px 12px', cursor: 'pointer', alignSelf: 'flex-start', marginTop: 4 }}>
              <Plus size={13} />Add rule
            </button>
          </div>

          <div className="card" style={{ padding: 24 }}>
            <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>Screenshot</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>An example chart showing this setup</p>
            {screenshot && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{screenshot.name}</p>}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setScreenshot(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary" style={{ fontSize: 13, width: '100%', justifyContent: 'center' }}>
              {screenshot ? 'Change screenshot' : 'Upload screenshot'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
