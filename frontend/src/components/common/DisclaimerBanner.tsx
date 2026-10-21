import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface DisclaimerBannerProps {
  compact?: boolean;
  className?: string;
}

export const MANDATORY_MEDICAL_DISCLAIMER =
  'Informational risk estimation only. Not a medical diagnosis or clinical substitute. Consult a healthcare professional.';

export const DisclaimerBanner: React.FC<DisclaimerBannerProps> = ({ compact = false, className = '' }) => {
  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100/90 border border-slate-200/90 rounded-full text-xs text-slate-600 ${className}`}>
        <ShieldAlert className="w-3.5 h-3.5 text-sky-600 shrink-0" />
        <span className="font-medium text-[11px] leading-tight">
          {MANDATORY_MEDICAL_DISCLAIMER}
        </span>
      </div>
    );
  }

  return (
    <div className={`p-3.5 bg-slate-50/90 border border-slate-200 rounded-xl text-slate-600 flex items-start gap-3 shadow-2xs ${className}`}>
      <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-sky-600 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
        <ShieldAlert className="w-4 h-4 text-sky-600" />
      </div>
      <div className="flex-1 text-xs leading-relaxed">
        <span className="font-semibold text-slate-900 block mb-0.5">Important Clinical Notice</span>
        <span className="text-slate-600">
          {MANDATORY_MEDICAL_DISCLAIMER}
        </span>
      </div>
    </div>
  );
};
