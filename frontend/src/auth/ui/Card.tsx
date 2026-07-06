// SHIM: replace with @intown design-system primitives at P01 merge
import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, className, ...rest }: CardProps) {
  return (
    <div
      className={
        'rounded-xl border border-border bg-surface p-6 text-text shadow-sm' +
        (className ? ` ${className}` : '')
      }
      {...rest}
    >
      {children}
    </div>
  );
}
