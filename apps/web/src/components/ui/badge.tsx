import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-pill px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.04em] transition-colors',
  {
    variants: {
      variant: {
        default:
          'bg-accent-main text-ink-on-accent',
        secondary:
          'bg-surface-subtle text-ink-secondary border border-border-element',
        outline:
          'border border-accent-main text-accent-main bg-transparent',
        destructive:
          'bg-signal-error/10 text-signal-error border border-signal-error/20',
        success:
          'bg-signal-success/10 text-signal-success border border-signal-success/20',
        warning:
          'bg-signal-warning/10 text-signal-warning border border-signal-warning/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
