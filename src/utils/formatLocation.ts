/** Display as "District, State" (e.g. card / pin lines). Names stay in English. */
export function formatLocationLine(district?: string, state?: string): string {
  const d = (district ?? '').trim();
  const s = (state ?? '').trim();
  if (d && s) return `${d}, ${s}`;
  return d || s || '';
}
