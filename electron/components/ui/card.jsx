import { cn } from '../../lib/utils.js';

export function Card({ className, ...props }) {
    return (
        <div
            className={cn('rounded-xl border border-border bg-card shadow-sm', className)}
            {...props}
        />
    );
}

export function CardHeader({ className, ...props }) {
    return <div className={cn('flex flex-col gap-2', className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
    return <h3 className={cn('text-xl font-bold tracking-tight text-foreground', className)} {...props} />;
}

export function CardDescription({ className, ...props }) {
    return <p className={cn('text-sm leading-6 text-muted-foreground', className)} {...props} />;
}

export function CardContent({ className, ...props }) {
    return <div className={cn('', className)} {...props} />;
}
