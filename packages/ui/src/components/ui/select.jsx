import { cn } from '../../lib/utils.js';

export function Select({ className, children, ...props }) {
    return (
        <select
            className={cn('flex h-11 w-full rounded-2xl border border-border bg-panel px-4 py-3 text-sm text-foreground outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-400/20', className)}
            {...props}
        >
            {children}
        </select>
    );
}
