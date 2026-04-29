import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  error?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, label, error, id, checked, ...props },
  ref,
) {
  const inputId = id ?? React.useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="flex cursor-pointer items-start gap-3">
        <span className="relative flex h-5 w-5 flex-none items-center justify-center">
          <input
            ref={ref}
            id={inputId}
            type="checkbox"
            checked={checked}
            className="peer absolute h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 bg-white checked:border-brand-500 checked:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            {...props}
          />
          <Check className="pointer-events-none relative h-3.5 w-3.5 stroke-[3] text-white opacity-0 peer-checked:opacity-100" />
        </span>
        {label && <span className="text-sm text-slate-700">{label}</span>}
      </label>
      {error && <p className="ml-8 text-xs text-red-600">{error}</p>}
    </div>
  );
});
