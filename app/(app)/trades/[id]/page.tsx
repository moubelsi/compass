'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Edit3, Trash2, ImageIcon, FileText, BarChart2, Star, Activity } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { use } from 'react'

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: color ?? 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}

export default function TradeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [trade, setTrade] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('trades')
        .select('*')
        .eq('id', id)
        .single()
      setTrade(data)
      setLoading(false)
    }
    load()
  }, [id])

  async function handleDelete() {
    if (!confirm('Delete this trade?')) return
    setDeleting(true)
    setDeleteError('')
    const { error } = await supabase.from('trades').delete().eq('id', id)
    if (error) {
      setDeleting(false)
      setDeleteError('Failed to delete trade. Please try again.')
      return
    }
    router.push('/trades')
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>Loading...</div>
  if (!trade) return <div style={{ padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>Trade not found</div>

  const up = Number(trade.pnl) >= 0
  const returnPct = trade.return_pct != null
    ? Number(trade.return_pct)
    : trade.entry_price && trade.pnl
      ? (Number(trade.pnl) / Number(trade.entry_price)) * 100
      : null

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      {/* Fixed nav bar */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 240,
        right: 0,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 40px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <Link href="/trades" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text-muted)', textDecoration: 'none' }}>
          <ArrowLeft size={15} />Trades
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href={`/trades/${id}/edit`} className="btn-secondary" style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
            <Edit3 size={14} />Edit trade
          </Link>
          <button className="btn-ghost" style={{ fontSize: 14, color: 'var(--loss)', display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleDelete} disabled={deleting}>
            <Trash2 size={14} />{deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      {/* Content — padded to clear the fixed nav */}
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 40px', paddingTop: 80 }}>
        {deleteError && (
          <div style={{ padding: '12px 16px', borderRadius: 8, background: 'var(--loss-dim)', border: '1px solid rgba(192,57,43,0.2)', fontSize: 14, color: 'var(--loss)', marginBottom: 20 }}>{deleteError}</div>
        )}
        {/* Hero */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          {/* Left */}
          <div className="card" style={{ padding: 28 }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <h1 style={{ fontSize: 32, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{trade.symbol?.toUpperCase()}</h1>
                <span style={{ fontSize: 12, fontWeight: 500, padding: '3px 8px', borderRadius: 5, background: trade.direction === 'LONG' ? 'var(--profit-dim)' : 'var(--loss-dim)', color: trade.direction === 'LONG' ? 'var(--profit)' : 'var(--loss)' }}>{trade.direction}</span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>{new Date(trade.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
              {[['Entry', trade.entry_price], ['Exit', trade.exit_price], ['Strategy', trade.strategy || '—']].map(([l, v], i) => (
                <div key={String(l)} style={{ padding: '14px 16px', textAlign: 'center', borderLeft: i > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <p className="label" style={{ marginBottom: 6 }}>{l}</p>
                  <p style={{ fontSize: 14, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>{v ?? '—'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right - P&L */}
          <div className="card" style={{ padding: 28, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', borderLeft: `4px solid ${up ? 'var(--profit)' : 'var(--loss)'}` }}>
            <p className="label" style={{ marginBottom: 8 }}>Total P&L</p>
            <p style={{ fontSize: 48, fontWeight: 700, color: up ? 'var(--profit)' : 'var(--loss)', letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums', marginBottom: 16 }}>
              {up ? '+' : ''}${Math.abs(Number(trade.pnl)).toFixed(2)}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              {returnPct != null && (
                <div>
                  <p className="label" style={{ marginBottom: 4 }}>Return</p>
                  <p style={{ fontSize: 18, fontWeight: 500, color: returnPct >= 0 ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>
                    {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(2)}%
                  </p>
                </div>
              )}
              {trade.rr != null && (
                <div>
                  <p className="label" style={{ marginBottom: 4 }}>R:R</p>
                  <p style={{ fontSize: 18, fontWeight: 500, color: Number(trade.rr) >= 0 ? 'var(--profit)' : 'var(--loss)', fontVariantNumeric: 'tabular-nums' }}>
                    {Number(trade.rr) > 0 ? '+' : ''}{Number(trade.rr).toFixed(1)}R
                  </p>
                </div>
              )}
              {trade.setup_score != null && (
                <div>
                  <p className="label" style={{ marginBottom: 6 }}>Quality</p>
                  <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                    {[1,2,3,4,5,6,7,8,9,10].map(i => (
                      <Star key={i} size={11} fill={i <= Number(trade.setup_score) ? '#B45309' : 'none'} style={{ color: i <= Number(trade.setup_score) ? '#B45309' : 'var(--border-strong)' }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Left: Setup details + Behaviour */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <BarChart2 size={15} style={{ color: 'var(--text-muted)' }} />
                <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Setup details</p>
              </div>
              {trade.strategy && <Row label="Strategy" value={trade.strategy} />}
              <Row label="Followed plan" value={trade.followed_plan ? 'Yes' : 'No'} />
              {trade.stop_loss != null && <Row label="Stop loss" value={String(trade.stop_loss)} color="var(--loss)" />}
              {trade.take_profit != null && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12 }}>
                  <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Take profit</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--profit)', fontVariantNumeric: 'tabular-nums' }}>{trade.take_profit}</span>
                </div>
              )}
            </div>

            {(trade.trade_type || trade.confidence != null) && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Activity size={15} style={{ color: 'var(--text-muted)' }} />
                  <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Behaviour</p>
                </div>
                {trade.trade_type && (
                  <Row
                    label="Trade type"
                    value={trade.trade_type.charAt(0).toUpperCase() + trade.trade_type.slice(1)}
                    color={trade.trade_type === 'planned' ? 'var(--profit)' : 'var(--loss)'}
                  />
                )}
                {trade.confidence != null && (
                  <Row
                    label="Confidence"
                    value={`${trade.confidence} / 10`}
                    color={
                      Number(trade.confidence) >= 7 ? 'var(--profit)' :
                      Number(trade.confidence) >= 4 ? '#B45309' :
                      'var(--loss)'
                    }
                  />
                )}
              </div>
            )}
          </div>

          {/* Notes + Screenshot */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {trade.notes && trade.notes !== 'EMPTY' && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <FileText size={15} style={{ color: 'var(--text-muted)' }} />
                  <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Notes</p>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)' }}>{trade.notes}</p>
              </div>
            )}

            {trade.screenshot_url && trade.screenshot_url !== 'EMPTY' && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <ImageIcon size={15} style={{ color: 'var(--text-muted)' }} />
                  <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Chart</p>
                </div>
                <img src={trade.screenshot_url} alt="Trade screenshot" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border-subtle)' }} />
              </div>
            )}
          </div>
        </div>
        <div style={{ height: 40 }} />
      </div>
    </div>
  )
}