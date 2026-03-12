import { cn } from '../../lib/utils.js';

export function Textarea({ className, ...props }) {
    return (
        <textarea
            className={cn('flex min-h-[120px] w-full rounded-2xl border border-border bg-panel px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-sky-400/40 focus:ring-2 focus:ring-sky-400/20', className)}
            {...props}
        />
    );
}
