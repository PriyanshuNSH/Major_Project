import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  unit?: string;
  leftIcon?: React.ReactNode;
  rightBadge?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, unit, leftIcon, rightBadge, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/[^a-z0-9]+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <div className="flex items-center justify-between">
            <label htmlFor={inputId} className="text-xs font-semibold text-slate-700 tracking-tight">
              {label}
            </label>
            {rightBadge && <div>{rightBadge}</div>}
          </div>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 text-slate-400 pointer-events-none flex items-center justify-center">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            aria-invalid={!!error}
            className={`w-full rounded-lg border bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-all shadow-2xs hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed ${
              leftIcon ? 'pl-9' : ''
            } ${unit ? 'pr-16' : ''} ${
              error ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-600' : 'border-slate-300'
            } ${className}`}
            {...props}
          />
          {unit && (
            <div className="absolute right-3 text-xs font-medium text-slate-500 pointer-events-none bg-slate-100/80 px-2 py-0.5 rounded border border-slate-200">
              {unit}
            </div>
          )}
        </div>
        {error ? (
          <p className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-0.5" role="alert">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-slate-500 leading-normal">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
