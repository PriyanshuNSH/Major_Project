import React from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  options: SelectOption[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, helperText, error, options, className = '', id, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/[^a-z0-9]+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-xs font-semibold text-slate-700 tracking-tight">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <select
            id={selectId}
            ref={ref}
            aria-invalid={!!error}
            className={`w-full appearance-none rounded-lg border bg-white pl-3.5 pr-9 py-2 text-sm text-slate-900 transition-all shadow-2xs hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed cursor-pointer ${
              error ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-600' : 'border-slate-300'
            } ${className}`}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
        </div>
        {error ? (
          <p className="text-xs text-rose-600 font-medium" role="alert">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-slate-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
