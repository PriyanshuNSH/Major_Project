import React from 'react';
import { ShapDriver } from '../../types';
import { Info, TrendingUp, ShieldCheck, Scale, AlertCircle } from 'lucide-react';

interface ShapWaterfallBarProps {
  drivers: ShapDriver[];
  baseExpectedRisk?: number;
}

export const ShapWaterfallBar: React.FC<ShapWaterfallBarProps> = ({
  drivers,
  baseExpectedRisk = 0.32,
}) => {
  const safeDrivers = Array.isArray(drivers) ? drivers : [];

  if (safeDrivers.length === 0) {
    return (
      <div className="w-full flex flex-col items-center justify-center p-8 bg-slate-50/80 rounded-xl border border-dashed border-slate-200 text-center">
        <AlertCircle className="w-6 h-6 text-slate-400 mb-2" />
        <h5 className="text-xs font-bold text-slate-700">No Feature Attributions Available</h5>
        <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
          Feature contribution values will be computed and rendered after input parameters are submitted for screening.
        </p>
      </div>
    );
  }

  // Find maximum absolute impact to scale bar widths dynamically
  const maxAbsImpact = Math.max(0.08, ...safeDrivers.map((d) => Math.abs(Number.isFinite(d.shapImpact) ? d.shapImpact : 0)));

  const riskElevators = safeDrivers.filter((d) => d.direction === 'RISK_ELEVATING');
  const protectiveFactors = safeDrivers.filter((d) => d.direction === 'PROTECTIVE');

  const totalPositive = riskElevators.reduce((acc, d) => acc + (d.shapImpact || 0), 0);
  const totalNegative = protectiveFactors.reduce((acc, d) => acc + (d.shapImpact || 0), 0);
  const netShift = totalPositive + totalNegative;

  return (
    <div
      className="w-full flex flex-col gap-5 bg-slate-50/70 p-5 sm:p-6 rounded-2xl border border-slate-200"
      role="region"
      aria-label="SHAP feature attribution breakdown"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-sky-600 shrink-0" />
            SHAP (SHapley Additive exPlanations) Attribution Breakdown
          </h4>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Quantifies the additive mathematical contribution of each biomarker relative to the cohort expected baseline.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-medium shrink-0">
          <span className="flex items-center gap-1 text-rose-700">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" /> Risk Elevating
          </span>
          <span className="flex items-center gap-1 text-teal-700">
            <span className="w-2.5 h-2.5 rounded-sm bg-teal-500 inline-block" /> Protective Factor
          </span>
        </div>
      </div>

      {/* Additive Math Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-white rounded-xl border border-slate-200/90 text-xs">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-slate-400 shrink-0" />
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Cohort Baseline (E[f(x)])</span>
            <span className="font-mono font-bold text-slate-700">{(baseExpectedRisk * 100).toFixed(1)}%</span>
          </div>
        </div>
        <div className="border-t sm:border-t-0 sm:border-l border-slate-100 pt-2 sm:pt-0 sm:pl-3">
          <span className="text-slate-400 text-[10px] uppercase font-bold block">Net Biometric Shift (Σ φᵢ)</span>
          <span className={`font-mono font-bold ${netShift >= 0 ? 'text-rose-600' : 'text-teal-600'}`}>
            {netShift >= 0 ? `+${(netShift * 100).toFixed(1)}%` : `${(netShift * 100).toFixed(1)}%`}
          </span>
        </div>
        <div className="border-t sm:border-t-0 sm:border-l border-slate-100 pt-2 sm:pt-0 sm:pl-3">
          <span className="text-slate-400 text-[10px] uppercase font-bold block">Attributed Features</span>
          <span className="font-semibold text-slate-800">
            {riskElevators.length} elevating, {protectiveFactors.length} protective
          </span>
        </div>
      </div>

      {/* Risk Elevating Drivers */}
      {riskElevators.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800 uppercase tracking-wide">
            <TrendingUp className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            Primary Risk Factors (Pushed Score Up)
          </div>
          <div className="space-y-3">
            {riskElevators.map((driver) => {
              const impact = Number.isFinite(driver.shapImpact) ? driver.shapImpact : 0;
              const widthPct = Math.min(100, Math.max(8, (Math.abs(impact) / maxAbsImpact) * 100));
              return (
                <div
                  key={driver.feature}
                  className="space-y-1 bg-white p-3 rounded-xl border border-rose-100 shadow-2xs"
                  role="meter"
                  aria-valuenow={Math.round(impact * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${driver.displayName}: elevated risk by ${(impact * 100).toFixed(1)} percent`}
                >
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="font-semibold text-slate-900">
                      {driver.displayName}{' '}
                      <span className="font-mono text-slate-500 font-normal">({driver.featureValue})</span>
                    </span>
                    <span className="font-mono font-bold text-rose-600">
                      +{(impact * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-rose-500 h-2 rounded-full transition-all duration-700"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal pt-0.5">{driver.clinicalContext}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Protective Buffers */}
      {protectiveFactors.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-slate-200">
          <div className="flex items-center gap-1.5 text-xs font-bold text-teal-800 uppercase tracking-wide">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            Protective Factors (Lowered Score)
          </div>
          <div className="space-y-3">
            {protectiveFactors.map((driver) => {
              const impact = Number.isFinite(driver.shapImpact) ? driver.shapImpact : 0;
              const widthPct = Math.min(100, Math.max(8, (Math.abs(impact) / maxAbsImpact) * 100));
              return (
                <div
                  key={driver.feature}
                  className="space-y-1 bg-white p-3 rounded-xl border border-teal-100 shadow-2xs"
                  role="meter"
                  aria-valuenow={Math.round(Math.abs(impact) * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${driver.displayName}: lowered risk by ${(Math.abs(impact) * 100).toFixed(1)} percent`}
                >
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="font-semibold text-slate-900">
                      {driver.displayName}{' '}
                      <span className="font-mono text-slate-500 font-normal">({driver.featureValue})</span>
                    </span>
                    <span className="font-mono font-bold text-teal-600">
                      {(impact * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
                    <div
                      className="bg-gradient-to-r from-emerald-400 to-teal-500 h-2 rounded-full transition-all duration-700"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal pt-0.5">{driver.clinicalContext}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
