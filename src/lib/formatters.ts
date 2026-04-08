export function formatRupee(amount: number | string): string {
  const n = Number(amount);
  if (Number.isNaN(n)) return '₹0';
  return '₹' + n.toLocaleString('en-IN');
}

export function formatDateHi(date: string | Date | number): string {
  return new Date(date).toLocaleDateString('hi-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
