function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

export function formatCountdownDuration(ms: number): string {
  const totalSeconds = Math.max(Math.ceil(ms / 1000), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${pad2(hours)}h ${pad2(minutes)}m ${pad2(seconds)}s`;
}

export function formatLocalDateTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).format(date);
}

export function formatRateLimitWait(waitMs: number, nowMs = Date.now()): string {
  const retryAt = new Date(nowMs + waitMs);
  return `${formatCountdownDuration(waitMs)} (until ${formatLocalDateTime(retryAt)} local time)`;
}
