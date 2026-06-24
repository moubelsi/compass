'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

const PRESETS = [
  'A+ Setup', 'B Setup', 'FOMO', 'Revenge', 'Moved SL', 'Oversize',
  'Breakout', 'Pullback', 'Reversal', 'News', 'London', 'NY Session', 'Good execution', 'Bad timing',
]

export function TagInput({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState('')

  function add(raw: string) {
    const tag = raw.trim().toLowerCase()
    if (!tag || value.includes(tag)) { setInput(''); return }
    onChange([...value, tag])
    setInput('')
  }

  function remove(tag: string) { onChange(value.filter(t => t !== tag)) }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) { e.preventDefault(); add(input) }
    else if (e.key === 'Backspace' && !input && value.length) remove(value[value.length - 1])
  }

  const suggestions = PRESETS.filter(p => !value.includes(p.toLowerCase()) && (!input || p.toLowerCase().includes(input.toLowerCase()))).slice(0, 6)

  return (
    <div>
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
          {value.map(tag => (
            <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 500, padding: '3px 8px 3px 10px', borderRadius: 20, background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
              #{tag}
              <button type="button" onClick={() => remove(tag)} style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)', marginLeft: 1 }}>
                <X size={10} strokeWidth={2.5} />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        className="input"
        placeholder="Type a tag and press Enter…"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        style={{ fontSize: 13 }}
      />
      {suggestions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
          {suggestions.map(tag => (
            <button key={tag} type="button" onClick={() => add(tag)} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: 'transparent', color: 'var(--text-muted)', border: '1px dashed var(--border-default)', cursor: 'pointer', transition: 'all 0.1s' }}>
              + {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
