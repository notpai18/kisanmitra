export type FormatDateOptions = {
  showTime?: boolean;
};

export const toJSDate = (ts: any): Date | null => {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts === 'number') return new Date(ts);
  if (typeof ts === 'string') return new Date(ts);
  if (ts?.toDate) return ts.toDate();
  if (ts?.seconds) return new Date(ts.seconds * 1000);
  return new Date(ts);
};

export const formatDate = (ts: any, opts: FormatDateOptions = {}): string => {
  const date = toJSDate(ts);
  if (!date || Number.isNaN(date.getTime())) return 'N/A';

  const showTime = opts.showTime ?? true;
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(showTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
};

export const timeAgo = (ts: any): string => {
  const date = toJSDate(ts);
  if (!date || Number.isNaN(date.getTime())) return 'N/A';

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return formatDate(date, { showTime: true });
};
