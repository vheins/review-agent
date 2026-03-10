import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils.js';

const buttonVariants = cva(
    'inline-flex items-center justify-center rounded-lg text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/30 disabled:pointer-events-none disabled:opacity-50',
    {
        variants: {
            variant: {
                default: 'bg-foreground text-background hover:opacity-90',
                secondary: 'bg-secondary text-foreground hover:bg-secondary/80',
                ghost: 'text-foreground hover:bg-secondary',
                warning: 'bg-amber-500 text-white hover:bg-amber-600',
                danger: 'bg-rose-600 text-white hover:bg-rose-700',
                outline: 'border border-border bg-background text-foreground hover:bg-secondary'
            },
            size: {
                default: 'h-10 px-4 py-2',
                sm: 'h-8 px-3 py-2 text-xs',
                lg: 'h-11 px-5 py-3'
            }
        },
        defaultVariants: {
            variant: 'default',
            size: 'default'
        }
    }
);

export function Button({ className, variant, size, asChild = false, ...props }) {
    const Comp = asChild ? 'span' : 'button';

    return (
        <Comp
            className={cn(buttonVariants({ variant, size }), className)}
            {...props}
        />
    );
}
