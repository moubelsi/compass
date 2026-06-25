'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, BookMarked } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Setup {
  id: string
  name: string
  description: string | null
  rules: string[]
  tags: string[]
  created_at: string
}

export default function PlaybookPage() {
  const [setups, setSetups] = useState<Setup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('setups').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setSetups(data || []); setLoading(false) })
  }, [])

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <div style={{ padding: '40px 48px 28px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: 4 }}>Playbook</h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>{setups.length} setup{setups.length !== 1 ? 's' : ''} · your documented edge</p>
          </div>
          <Link href="/playbook/new" className="btn-primary" style={{ fontSize: 14, padding: '10px 20px' }}>
            <Plus size={14} />New setup
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 48px' }}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div>
        ) : setups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <BookMarked size={24} style={{ color: 'var(--text-muted)' }} />
            </div>
            <p style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>No setups yet</p>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, maxWidth: 380, margin: '0 auto 24px' }}>
              Document your setups with entry rules, conditions and notes. Check it before every trade.
            </p>
            <Link href="/playbook/new" className="btn-primary" style={{ fontSize: 14 }}>Create your first setup</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {setups.map(setup => (
              <Link key={setup.id} href={`/playbook/${setup.id}`} style={{ textDecoration: 'none' }}>
                <div className="card" style={{ padding: '22px 24px', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s', height: '100%' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = '' }}
                >
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{setup.name}</h3>
                  {setup.description && (
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 12, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                      {setup.description}
                    </p>
                  )}
                  {setup.rules?.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      {setup.rules.slice(0, 4).map((rule, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 5 }}>
                          <div style={{ width: 14, height: 14, borderRadius: 4, border: '1.5px solid var(--border-default)', flexShrink: 0, marginTop: 1 }} />
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{rule}</span>
                        </div>
                      ))}
                      {setup.rules.length > 4 && (
                        <p style={{ fontSize: 11, color: 'var(--text-disabled)', marginLeft: 22 }}>+{setup.rules.length - 4} more rules</p>
                      )}
                    </div>
                  )}
                  {setup.tags?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {setup.tags.map(tag => (
                        <span key={tag} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
