import React from 'react';
import { RiskLevel } from '../../types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'outline' | 'demo' | 'low' | 'moderate' | 'high' | 'critical' | 'teal' | 'sky';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', size = 'sm', className = '' }) => {
  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 font-medium leading-none',
    md: 'text-xs px-2.5 py-1 font-semibold leading-none',
  };

  const variantStyles = {
    default: 'bg-slate-100 text-slate-700 border border-slate-200/80',
    outline: 'bg-transparent text-slate-600 border border-slate-300',
    sky: 'bg-sky-50 text-sky-800 border border-sky-200/90',
    teal: 'bg-teal-50 text-teal-800 border border-teal-200',
    demo: 'bg-amber-50 text-amber-900 border border-amber-300 font-mono tracking-wide',
    low: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    moderate: 'bg-amber-50 text-amber-800 border border-amber-200',
    high: 'bg-orange-50 text-orange-800 border border-orange-200',
    critical: 'bg-rose-50 text-rose-800 border border-rose-200',
  };

  return (
    <span className={`inline-flex items-center rounded-full ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  );
};

export const RiskBadge: React.FC<{ level: RiskLevel; className?: string }> = ({ level, className = '' }) => {
  const normalizedLevel = (level?.toUpperCase() || 'LOW') as RiskLevel;
  const variantMap: Record<RiskLevel, 'low' | 'moderate' | 'high' | 'critical'> = {
    LOW: 'low',
    MODERATE: 'moderate',
    HIGH: 'high',
    CRITICAL: 'critical',
  };
  return (
    <Badge variant={variantMap[normalizedLevel] || 'low'} size="md" className={className}>
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-85 shrink-0" />
      {normalizedLevel} RISK
    </Badge>
  );
};
