import { RiskLevel } from '../types';

export const MANDATORY_MEDICAL_DISCLAIMER =
  'Informational risk estimation only. Not a medical diagnosis or clinical substitute. Consult a healthcare professional.';

export function formatPercentage(val: number): string {
  return `${(val * 100).toFixed(1)}%`;
}

export function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function calculateBmi(weightKg: number, heightCm: number): number {
  if (heightCm <= 0 || weightKg <= 0) return 0;
  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(1));
}

export function getBmiCategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: 'Underweight', color: 'text-amber-600' };
  if (bmi < 25) return { label: 'Normal Weight', color: 'text-emerald-600' };
  if (bmi < 30) return { label: 'Overweight', color: 'text-amber-600' };
  if (bmi < 35) return { label: 'Class I Obesity', color: 'text-orange-600' };
  return { label: 'Class II+ Obesity', color: 'text-rose-600' };
}

export function getRiskLevelStyles(level: RiskLevel): {
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  colorHex: string;
  description: string;
} {
  switch (level) {
    case 'LOW':
      return {
        badgeBg: 'bg-emerald-50',
        badgeText: 'text-emerald-700',
        badgeBorder: 'border-emerald-200',
        colorHex: '#059669',
        description: 'Biomarkers align within baseline low-risk ranges. Maintain healthy lifestyle routines.',
      };
    case 'MODERATE':
      return {
        badgeBg: 'bg-amber-50',
        badgeText: 'text-amber-700',
        badgeBorder: 'border-amber-200',
        colorHex: '#d97706',
        description: 'Borderline biomarker elevations observed. Preventative dietary and physical intervention advised.',
      };
    case 'HIGH':
      return {
        badgeBg: 'bg-orange-50',
        badgeText: 'text-orange-700',
        badgeBorder: 'border-orange-200',
        colorHex: '#ea580c',
        description: 'Statistically elevated vulnerability indicators. Recommend formal clinical consultation and lab panels.',
      };
    case 'CRITICAL':
      return {
        badgeBg: 'bg-rose-50',
        badgeText: 'text-rose-700',
        badgeBorder: 'border-rose-200',
        colorHex: '#e11d48',
        description: 'Substantial high-risk cluster identified. Prompt clinical evaluation strongly recommended.',
      };
  }
}
