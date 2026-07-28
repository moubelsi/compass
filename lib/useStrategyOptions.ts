import { useEffect, useState } from 'react'
import { supabase } from './supabase'

/** Generic fallback strategies — kept alongside Playbook setups so the dropdown is never empty for new users. */
export const DEFAULT_STRATEGIES = ['London Breakout', 'Trend Continuation', 'Reversal', 'Range Break', 'Support Bounce', 'Asian Session Break', 'News Fade', 'MTF Hidden OB', 'Other']

/** Strategy dropdown options: the user's own Playbook setup names first, then the generic defaults (deduped). */
export function useStrategyOptions(): string[] {
  const [setupNames, setSetupNames] = useState<string[]>([])

  useEffect(() => {
    supabase.from('setups').select('name').order('created_at', { ascending: true })
      .then(({ data }) => setSetupNames((data || []).map(s => s.name).filter(Boolean)))
  }, [])

  const seen = new Set<string>()
  const merged: string[] = []
  for (const name of [...setupNames, ...DEFAULT_STRATEGIES]) {
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(name)
  }
  return merged
}
