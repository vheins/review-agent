export function formatDuration(seconds) {
    if (!seconds) return '0m';
    const totalSeconds = Math.round(Number(seconds));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function formatRelativeTime(value) {
    if (!value) return 'Unknown';
    const diffMs = new Date(value).getTime() - Date.now();
    const diffMinutes = Math.round(diffMs / 60000);
    if (Math.abs(diffMinutes) < 60) return `${Math.abs(diffMinutes)}m ${diffMinutes < 0 ? 'ago' : 'from now'}`;
    const diffHours = Math.round(diffMinutes / 60);
    if (Math.abs(diffHours) < 24) return `${Math.abs(diffHours)}h ${diffHours < 0 ? 'ago' : 'from now'}`;
    const diffDays = Math.round(diffHours / 24);
    return `${Math.abs(diffDays)}d ${diffDays < 0 ? 'ago' : 'from now'}`;
}

export function toneForStatus(value) {
    if (['approved', 'success', 'passed', 'available', 'connected'].includes(String(value).toLowerCase())) return 'success';
    if (['critical', 'error', 'failed', 'blocking', 'disconnected'].includes(String(value).toLowerCase())) return 'danger';
    if (['warn', 'warning', 'queued', 'unavailable', 'changes_requested'].includes(String(value).toLowerCase())) return 'warn';
    if (['info', 'pending', 'in_progress', 'running'].includes(String(value).toLowerCase())) return 'info';
    return 'default';
}

export function variantForPRStatus(status) {
    switch (String(status).toLowerCase()) {
        case 'open': return 'success';
        case 'merged': return 'purple';
        case 'closed': return 'default';
        case 'rejected': return 'danger';
        default: return 'default';
    }
}

export function statusDotClass(running) {
    return running ? 'bg-emerald-400 shadow-[0_0_0_6px_rgba(52,211,153,0.16)]' : 'bg-slate-400';
}

export function resolveTheme(mode) {
    if (mode === 'dark' || mode === 'light') return mode;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getStoredThemeMode() {
    const stored = window.localStorage.getItem('agentic-bunshin-theme');
    return ['system', 'dark', 'light'].includes(stored) ? stored : 'system';
}
