export function formatCurrency(v: number, sign = false) {
  const f = `$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
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
