import React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  HeartPulse,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Lock,
  Cpu,
  Layers,
  HelpCircle,
  FileText,
  Sliders,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Card, CardContent } from '../components/common/Card';
import { DisclaimerBanner } from '../components/common/DisclaimerBanner';

export const LandingPage: React.FC = () => {
  return (
    <div className="flex flex-col w-full bg-slate-50 text-slate-900 overflow-hidden">
      {/* 1. Hero Section (Restrained Blue-and-White HealthTech Aesthetic) */}
      <section className="relative pt-12 pb-16 md:pt-16 md:pb-20 bg-gradient-to-b from-sky-50/70 via-white to-slate-50 border-b border-slate-200/90">
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] opacity-35 pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-5">
            {/* System Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-sky-200/80 text-sky-800 text-xs font-medium shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-sky-600 animate-pulse" />
              AI-Enabled Smart Health Monitoring System
            </div>

            {/* Hero Heading: Proportional, clean typography without awkward line breaks */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-950 leading-[1.18]">
              Calibrated Health Risk Screening with{' '}
              <span className="text-sky-600">Explainable AI</span>
            </h1>

            {/* Subheading: Balanced line length and restrained tone */}
            <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
              HealthSync AI translates physiological biomarkers into calibrated risk estimations and transparent SHAP factor breakdowns—helping identify chronic risk patterns before clinical symptoms emerge.
            </p>

            {/* Primary CTAs: Prominent, clear alignment */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/assessments/diabetes" className="w-full sm:w-auto">
                <Button
                  size="md"
                  variant="primary"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  className="w-full sm:w-auto px-5 py-2.5 shadow-xs"
                >
                  Diabetes Screening
                </Button>
              </Link>
              <Link to="/assessments/heart" className="w-full sm:w-auto">
                <Button
                  size="md"
                  variant="outline"
                  leftIcon={<HeartPulse className="w-4 h-4 text-sky-600" />}
                  className="w-full sm:w-auto px-5 py-2.5 bg-white border-slate-300 text-slate-800 hover:bg-slate-50 shadow-2xs"
                >
                  Cardiovascular Screening
                </Button>
              </Link>
              <Link to="/dashboard" className="w-full sm:w-auto">
                <Button
                  size="md"
                  variant="ghost"
                  className="w-full sm:w-auto text-slate-600 hover:text-slate-900"
                >
                  View Dashboard
                </Button>
              </Link>
            </div>

            {/* Non-diagnostic notice in Hero */}
            <div className="pt-2 max-w-2xl mx-auto">
              <DisclaimerBanner compact />
            </div>
          </div>

          {/* Interactive Feature Snapshot Preview */}
          <div className="mt-10 max-w-4xl mx-auto">
            <div className="rounded-2xl bg-white border border-slate-200/90 p-5 sm:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between border-b border-slate-100 pb-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center font-bold shadow-2xs">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Dual-Module Preventative Analytics</h2>
                    <p className="text-xs text-slate-500">CDC BRFSS & UCI Cleveland reference baselines</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-600">
                    Sub-60ms SHAP Reasoner
                  </span>
                  <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-600">
                    PostgreSQL RLS
                  </span>
                </div>
              </div>

              {/* Sample Calibrated Reference Indicators */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600 font-semibold flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-sky-600" />
                      Type 2 Diabetes
                    </span>
                    <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                      Moderate
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">38.5%</div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Evaluated from fasting glucose, BMI, and metabolic markers.
                  </p>
                  <div className="mt-3 pt-2 border-t border-slate-200/60">
                    <Link
                      to="/assessments/diabetes"
                      className="text-xs font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-1"
                    >
                      Screen Metabolic Risk <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600 font-semibold flex items-center gap-1.5">
                      <HeartPulse className="w-3.5 h-3.5 text-sky-600" />
                      Cardiovascular
                    </span>
                    <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                      Moderate
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">24.5%</div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Derived from lipid panels, resting BP, and ECG indicators.
                  </p>
                  <div className="mt-3 pt-2 border-t border-slate-200/60">
                    <Link
                      to="/assessments/heart"
                      className="text-xs font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-1"
                    >
                      Screen Cardiac Risk <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600 font-semibold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                      SHAP Explainability
                    </span>
                    <span className="text-[10px] uppercase font-bold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded">
                      Transparent
                    </span>
                  </div>
                  <div className="text-base font-bold text-slate-900 mt-2">Factor Decomposition</div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Separates positive risk elevators from protective lifestyle buffers.
                  </p>
                  <div className="mt-3 pt-2 border-t border-slate-200/60">
                    <Link
                      to="/explanation"
                      className="text-xs font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-1"
                    >
                      View Factor Logic <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Status Notice on Baseline Data */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500">
                <span>
                  Prototype Demonstration Baseline (Epidemiological Reference Calibration) — Real model artifact binding in progress.
                </span>
                <span className="font-mono text-slate-400">Non-Diagnostic Boundary</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Core Clinical Modules Section */}
      <section className="py-12 md:py-16 bg-white border-b border-slate-200/90">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
            <span className="text-xs font-bold text-sky-600 uppercase tracking-wider">
              Clinical Modules
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Calibrated Preventative Risk Screening
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Every model is strictly calibrated, transparently explained, and designed for early risk awareness.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Diabetes */}
            <Card className="hover:border-slate-300 hover:shadow-xs transition-all bg-white border-slate-200">
              <CardContent className="space-y-3.5 p-6 flex flex-col h-full justify-between">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shadow-2xs">
                    <Activity className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Type 2 Diabetes Screening</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Evaluates fasting glucose, blood pressure, BMI, age, and lifestyle activity against epidemiological benchmarks to estimate prediabetes and diabetes susceptibility.
                  </p>
                  <ul className="text-xs text-slate-500 space-y-1.5 pt-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" /> Fasting glucose & insulin response
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" /> Body Mass Index & hemodynamics
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" /> CDC BRFSS benchmark calibration
                    </li>
                  </ul>
                </div>
                <div className="pt-4 mt-auto">
                  <Link to="/assessments/diabetes" className="block">
                    <Button variant="outline" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />} className="w-full">
                      Start Diabetes Screening
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Cardiovascular */}
            <Card className="hover:border-slate-300 hover:shadow-xs transition-all bg-white border-slate-200">
              <CardContent className="space-y-3.5 p-6 flex flex-col h-full justify-between">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shadow-2xs">
                    <HeartPulse className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Cardiovascular Risk Screening</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Assesses coronary risk vulnerability based on resting arterial pressure, serum cholesterol, resting electrocardiographic metrics, and exertional stress tolerance.
                  </p>
                  <ul className="text-xs text-slate-500 space-y-1.5 pt-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" /> Lipid panels & resting blood pressure
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" /> Rest ECG & exertional angina markers
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" /> UCI Cleveland benchmark calibration
                    </li>
                  </ul>
                </div>
                <div className="pt-4 mt-auto">
                  <Link to="/assessments/heart" className="block">
                    <Button variant="outline" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />} className="w-full">
                      Start Heart Screening
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Explainable AI */}
            <Card className="hover:border-slate-300 hover:shadow-xs transition-all bg-white border-slate-200">
              <CardContent className="space-y-3.5 p-6 flex flex-col h-full justify-between">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shadow-2xs">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">SHAP Explainable AI</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    No black boxes. Using local Shapley value decompositions, HealthSync AI explains exactly which biomarker drivers elevated your score and which factors acted as protective buffers.
                  </p>
                  <ul className="text-xs text-slate-500 space-y-1.5 pt-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" /> Additive feature contribution breakdown
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" /> Separation of risk vs protective factors
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" /> Evidence-based lifestyle suggestions
                    </li>
                  </ul>
                </div>
                <div className="pt-4 mt-auto">
                  <Link to="/explanation" className="block">
                    <Button variant="outline" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />} className="w-full">
                      Explore SHAP Reasoner
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 3. Platform Trust & Architecture Section */}
      <section className="py-12 md:py-16 bg-slate-50 border-b border-slate-200/90">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center space-y-2 mb-10">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Privacy by Design
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Engineered for Healthcare Data Sovereignty
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Biometric records are sensitive. HealthSync AI enforces strict isolation at every application layer.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="p-5 rounded-xl bg-white border border-slate-200/90 space-y-2 shadow-2xs">
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <Lock className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Data Isolation Target</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Architected for database-level Row Level Security (RLS) isolation to ensure personal records remain strictly partitioned.
              </p>
            </div>
            <div className="p-5 rounded-xl bg-white border border-slate-200/90 space-y-2 shadow-2xs">
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Local Inference</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Biomarkers never leave the secure backend to unvetted third-party commercial AI APIs.
              </p>
            </div>
            <div className="p-5 rounded-xl bg-white border border-slate-200/90 space-y-2 shadow-2xs">
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Argon2id & JWT</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Modern cryptographic password hashing and rotating HttpOnly secure session cookies.
              </p>
            </div>
            <div className="p-5 rounded-xl bg-white border border-slate-200/90 space-y-2 shadow-2xs">
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">GDPR Compliance</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Automated personal data JSON export and Right to be Forgotten account purging.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Action Banner */}
      <section className="py-12 bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Ready to Evaluate Your Health Metrics?
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            Screen your cardiovascular and metabolic risk factors in under 3 minutes with full explainable AI clarity.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link to="/assessments/diabetes">
              <Button size="md" variant="primary" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Start Diabetes Screening
              </Button>
            </Link>
            <Link to="/assessments/heart">
              <Button size="md" variant="outline" className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700">
                Start Heart Screening
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button size="md" variant="ghost" className="text-slate-400 hover:text-white">
                Open Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
