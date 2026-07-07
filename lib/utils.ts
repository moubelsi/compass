/** Returns 'YYYY-MM-DD' in the user's LOCAL timezone — never use toISOString() for dates */
export function localDateStr(d: Date = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatCurrency(v: number, sign = false, symbol = '$') {
  const f = `${symbol}${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  return sign ? (v >= 0 ? `+${f}` : `-${f}`) : f
}

export function formatR(v: number) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}R`
}

export function getPnlColor(v: number) {
  if (v > 0) return 'var(--profit)'
  if (v < 0) return 'var(--loss)'
  return 'var(--text-secondary)'
}

/** True when an optional text field holds real content — 'EMPTY' is a legacy DB sentinel for no content */
export function hasContent(v?: string | null): v is string {
  return !!v && v !== 'EMPTY'
}
