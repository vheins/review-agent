import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils.js';

const badgeVariants = cva(
    'inline-flex items-center rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.2em]',
    {
        variants: {
            variant: {
                default: 'border-border bg-secondary text-foreground',
                success: 'border-emerald-400/20 bg-emerald-400/20 text-emerald-900 dark:text-emerald-100',
                warn: 'border-amber-400/20 bg-amber-300/20 text-amber-900 dark:text-amber-100',
                danger: 'border-rose-400/20 bg-rose-400/20 text-rose-900 dark:text-rose-100'
            }
        },
        defaultVariants: {
            variant: 'default'
        }
    }
);

export function Badge({ className, variant, ...props }) {
    return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
