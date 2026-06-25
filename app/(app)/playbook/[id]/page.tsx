'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Edit3, Trash2, CheckSquare, Square } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { use } from 'react'

export default function SetupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [setup, setSetup] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    supabase.from('setups').select('*').eq('id', id).single()
      .then(({ data }) => { setSetup(data); setLoading(false) })
  }, [id])

  async function handleDelete() {
    if (!confirm('Delete this setup?')) return
    setDeleting(true)
    await supabase.from('setups').delete().eq('id', id)
    router.push('/playbook')
  }

  const allChecked = setup?.rules?.length > 0 && setup.rules.every((_: any, i: number) => checked[i])

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div>
  if (!setup)  return <div style={{ padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>Setup not found</div>

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <div className="page-fixed-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 40px' }}>
        <Link href="/playbook" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text-muted)', textDecoration: 'none' }}>
          <ArrowLeft size={15} />Playbook
        </Link>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href={`/playbook/${id}/edit`} className="btn-secondary" style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
            <Edit3 size={14} />Edit
          </Link>
          <button className="btn-ghost" onClick={handleDelete} disabled={deleting} style={{ fontSize: 14, color: 'var(--loss)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Trash2 size={14} />{deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '80px 40px 60px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: 10 }}>{setup.name}</h1>
          {setup.tags?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {setup.tags.map((tag: string) => (
                <span key={tag} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>#{tag}</span>
              ))}
            </div>
          )}
        </div>

        {setup.description && (
          <div className="card" style={{ padding: 22, marginBottom: 20 }}>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{setup.description}</p>
          </div>
        )}

        {/* Checklist */}
        {setup.rules?.length > 0 && (
          <div className="card" style={{ padding: 24, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Pre-trade checklist</p>
              {allChecked && (
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--profit)', background: 'var(--profit-dim)', padding: '3px 10px', borderRadius: 20 }}>✓ All clear</span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {setup.rules.map((rule: string, i: number) => (
                <button key={i} type="button" onClick={() => setChecked(c => ({ ...c, [i]: !c[i] }))}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: checked[i] ? 'var(--profit-dim)' : 'var(--bg-elevated)', border: 'none', cursor: 'pointer', padding: '8px 10px', borderRadius: 8, textAlign: 'left', transition: 'background 0.1s' } as any}>
                  {checked[i]
                    ? <CheckSquare size={17} style={{ color: 'var(--profit)', flexShrink: 0, marginTop: 1 }} />
                    : <Square size={17} style={{ color: 'var(--border-strong)', flexShrink: 0, marginTop: 1 }} />
                  }
                  <span style={{ fontSize: 14, color: checked[i] ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: checked[i] ? 'line-through' : 'none', lineHeight: 1.5 }}>
                    {rule}
                  </span>
                </button>
              ))}
            </div>
            {setup.rules.length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{Object.values(checked).filter(Boolean).length} / {setup.rules.length} checked</span>
                <button type="button" onClick={() => setChecked({})} style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Reset</button>
              </div>
            )}
          </div>
        )}

        {/* Screenshot */}
        {setup.screenshot_url && (
          <div className="card" style={{ overflow: 'hidden', padding: 0, marginBottom: 20 }}>
            <img src={setup.screenshot_url} alt="Setup example" style={{ width: '100%', display: 'block' }} />
          </div>
        )}

        <p style={{ fontSize: 12, color: 'var(--text-disabled)', textAlign: 'right' }}>
          Added {new Date(setup.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>
    </div>
  )
}
