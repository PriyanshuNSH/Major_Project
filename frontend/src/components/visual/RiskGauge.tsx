import React from 'react';
import { RiskLevel } from '../../types';
import { getRiskLevelStyles, formatPercentage } from '../../utils/formatters';

interface RiskGaugeProps {
  score: number; // 0.0 to 1.0
  riskLevel: RiskLevel;
  confidenceInterval?: [number, number];
  size?: 'sm' | 'md' | 'lg';
  showDescription?: boolean;
}

export const RiskGauge: React.FC<RiskGaugeProps> = ({
  score,
  riskLevel,
  confidenceInterval,
  size = 'md',
  showDescription = true,
}) => {
  // Safe clamping and validation against NaN/out-of-range
  const safeScore = Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : 0;

  const validLevels: RiskLevel[] = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'];
  const safeLevel: RiskLevel = validLevels.includes(riskLevel)
    ? riskLevel
    : safeScore < 0.20
    ? 'LOW'
    : safeScore < 0.50
    ? 'MODERATE'
    : safeScore < 0.75
    ? 'HIGH'
    : 'CRITICAL';

  const styles = getRiskLevelStyles(safeLevel);

  // SVG Semi-circle Arc parameters
  const radius = size === 'sm' ? 64 : size === 'lg' ? 104 : 84;
  const strokeWidth = size === 'sm' ? 10 : size === 'lg' ? 14 : 12;
  const circumference = Math.PI * radius; // half circle length
  const strokeDashoffset = circumference - safeScore * circumference;

  const width = radius * 2 + strokeWidth * 2 + 16;
  const height = radius + strokeWidth * 2 + 20;
  const cx = width / 2;
  const cy = radius + strokeWidth + 8;

  // Safe confidence interval validation
  const safeCI =
    confidenceInterval &&
    Number.isFinite(confidenceInterval[0]) &&
    Number.isFinite(confidenceInterval[1])
      ? [
          Math.max(0, Math.min(1, confidenceInterval[0])),
          Math.max(0, Math.min(1, confidenceInterval[1])),
        ]
      : null;

  return (
    <div
      className="flex flex-col items-center justify-center p-3 select-none"
      role="meter"
      aria-valuenow={Math.round(safeScore * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Calibrated risk probability: ${formatPercentage(safeScore)}, ${safeLevel} Risk`}
    >
      <div className="relative flex items-center justify-center" style={{ width, height }}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="overflow-visible"
        >
          <defs>
            {/* Multi-zone color gradient matching documented thresholds */}
            <linearGradient id="riskZoneGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#059669" />
              <stop offset="20%" stopColor="#059669" />
              <stop offset="20.1%" stopColor="#d97706" />
              <stop offset="50%" stopColor="#d97706" />
              <stop offset="50.1%" stopColor="#ea580c" />
              <stop offset="75%" stopColor="#ea580c" />
              <stop offset="75.1%" stopColor="#e11d48" />
              <stop offset="100%" stopColor="#e11d48" />
            </linearGradient>
          </defs>

          {/* Background Arc Track with subtle zone indicators */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Active Value Arc */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke={styles.colorHex}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Center Text Score & Badge */}
        <div className="absolute inset-x-0 bottom-4 flex flex-col items-center justify-center text-center">
          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
            {formatPercentage(safeScore)}
          </span>
          <span
            className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full mt-1 border"
            style={{
              backgroundColor: styles.badgeBg ? undefined : `${styles.colorHex}15`,
              color: styles.colorHex,
              borderColor: `${styles.colorHex}30`,
            }}
          >
            {safeLevel} RISK
          </span>
        </div>
      </div>

      {/* Threshold Scale Marks */}
      <div className="flex items-center justify-between w-full max-w-[200px] text-[10px] font-mono text-slate-400 mt-0.5 px-2">
        <span>0%</span>
        <span className="text-emerald-600">20%</span>
        <span className="text-amber-600">50%</span>
        <span className="text-orange-600">75%</span>
        <span className="text-rose-600">100%</span>
      </div>

      {/* Confidence Interval */}
      {safeCI && (
        <p className="text-xs text-slate-500 font-mono mt-2 bg-slate-100/80 px-2 py-0.5 rounded border border-slate-200/80">
          95% CI: [{formatPercentage(safeCI[0])} – {formatPercentage(safeCI[1])}]
        </p>
      )}

      {/* Clinical Status Description */}
      {showDescription && (
        <p className="text-xs text-slate-600 text-center max-w-sm mt-2 leading-relaxed">
          {styles.description}
        </p>
      )}
    </div>
  );
};
