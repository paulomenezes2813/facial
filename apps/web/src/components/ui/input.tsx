import * as React from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, hint, error, icon, id, ...props },
  ref,
) {
  const inputId = id ?? React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="flex items-center gap-2 text-sm font-medium text-slate-700">
          {icon}
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-err` : undefined}
        className={cn(
          'h-12 w-full rounded-xl border bg-white px-4 text-base text-slate-900 placeholder:text-slate-400',
          'focus:outline-none focus:ring-2 focus:ring-brand-500/40',
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/30'
            : 'border-slate-200 focus:border-brand-500',
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-err`} className="text-xs text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
});
