const PAGE_SIZE = 1000
const MAX_PAGES = 100

/**
 * Supabase/PostgREST caps every select at 1000 rows. This helper pages
 * through .range() windows until a short page arrives, so callers get the
 * complete result set. `build` must create a FRESH query per call —
 * PostgREST builders cannot be re-executed.
 *
 *   const rows = await fetchAllRows((from, to) =>
 *     supabase.from('trades').select('*').order('trade_date').range(from, to))
 */
export async function fetchAllRows<T = any>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const all: T[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await build(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const rows = data ?? []
    all.push(...rows)
    if (rows.length < PAGE_SIZE) break
  }
  return all
}
