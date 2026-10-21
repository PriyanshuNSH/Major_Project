import React from 'react';
import { Sparkles } from 'lucide-react';

interface DemoModeBannerProps {
  className?: string;
  message?: string;
}

export const PROTOTYPE_DEMO_DISCLAIMER =
  'Prototype Demonstration Baseline (Epidemiological Reference Calibration) — Real model artifact binding in progress.';

export const DemoModeBanner: React.FC<DemoModeBannerProps> = ({
  className = '',
  message = PROTOTYPE_DEMO_DISCLAIMER,
}) => {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3.5 py-2.5 bg-sky-50/80 border border-sky-200/80 rounded-xl text-xs text-sky-900 ${className}`}>
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
        <span className="text-xs text-slate-700 leading-normal">
          <strong className="font-semibold text-slate-900 mr-1.5">Model Status:</strong>
          {message}
        </span>
      </div>
      <span className="text-[10px] font-mono uppercase bg-white border border-sky-200 px-2 py-0.5 rounded text-sky-700 self-start sm:self-center shrink-0">
        Calibration Baseline
      </span>
    </div>
  );
};
