import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 sm:h-9 w-full rounded-pill border border-border-element bg-surface-card px-3 sm:px-4 py-2 text-sm sm:text-body text-ink-primary',
          'placeholder:text-ink-tertiary',
          'focus:outline-none focus:border-accent-main focus:ring-1 focus:ring-accent-main',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-subtle',
          'transition-colors',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
