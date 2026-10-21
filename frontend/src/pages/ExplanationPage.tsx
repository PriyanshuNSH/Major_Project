import React, { useState } from 'react';
import {
  Sparkles,
  Scale,
  Cpu,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { DisclaimerBanner } from '../components/common/DisclaimerBanner';
import { DemoModeBanner } from '../components/common/DemoModeBanner';
import { ShapWaterfallBar } from '../components/visual/ShapWaterfallBar';
import { RiskGauge } from '../components/visual/RiskGauge';
import { ShapDriver } from '../types';

export const ExplanationPage: React.FC = () => {
  // Interactive Simulator States
  const [simGlucose, setSimGlucose] = useState<number>(125);
  const [simBmi, setSimBmi] = useState<number>(29.5);
  const [simSystolic, setSimSystolic] = useState<number>(135);
  const [simActivity, setSimActivity] = useState<number>(2.0);

  // Dynamic calculation for educational simulator
  const baseRisk = 0.32;
  const glucoseImpact = Number(((simGlucose - 100) * 0.0028).toFixed(4));
  const bmiImpact = Number(((simBmi - 24.5) * 0.012).toFixed(4));
  const bpImpact = Number(((simSystolic - 120) * 0.002).toFixed(4));
  const activityImpact = Number(((1.5 - simActivity) * 0.025).toFixed(4));

  const totalCalculated = Math.max(
    0.05,
    Math.min(0.95, Number((baseRisk + glucoseImpact + bmiImpact + bpImpact + activityImpact).toFixed(3)))
  );

  const simDrivers: ShapDriver[] = [
    {
      feature: 'glucose',
      displayName: 'Fasting Blood Glucose',
      featureValue: `${simGlucose} mg/dL`,
      shapImpact: glucoseImpact,
      direction: glucoseImpact > 0 ? 'RISK_ELEVATING' : 'PROTECTIVE',
      clinicalContext:
        simGlucose > 100
          ? `Elevates risk (+${(glucoseImpact * 100).toFixed(1)}%) due to fasting hyperglycemia threshold.`
          : `Protective buffer (${(glucoseImpact * 100).toFixed(1)}%) with optimal fasting glycemic control.`,
    },
    {
      feature: 'bmi',
      displayName: 'Body Mass Index (BMI)',
      featureValue: `${simBmi} kg/m²`,
      shapImpact: bmiImpact,
      direction: bmiImpact > 0 ? 'RISK_ELEVATING' : 'PROTECTIVE',
      clinicalContext:
        simBmi > 25
          ? `Adds (+${(bmiImpact * 100).toFixed(1)}%) metabolic resistance risk.`
          : `Protective factor (${(bmiImpact * 100).toFixed(1)}%) maintaining lean metabolic mass.`,
    },
    {
      feature: 'blood_pressure',
      displayName: 'Systolic Blood Pressure',
      featureValue: `${simSystolic} mmHg`,
      shapImpact: bpImpact,
      direction: bpImpact > 0 ? 'RISK_ELEVATING' : 'PROTECTIVE',
      clinicalContext:
        simSystolic > 120
          ? `Elevated arterial resistance (+${(bpImpact * 100).toFixed(1)}%).`
          : `Optimal resting systolic hemodynamics (${(bpImpact * 100).toFixed(1)}%).`,
    },
    {
      feature: 'physical_activity',
      displayName: 'Weekly Aerobic Exercise',
      featureValue: `${simActivity} hrs/wk`,
      shapImpact: activityImpact,
      direction: activityImpact > 0 ? 'RISK_ELEVATING' : 'PROTECTIVE',
      clinicalContext:
        simActivity < 2.5
          ? `Reduced exercise volume elevates score by +${(activityImpact * 100).toFixed(1)}%.`
          : `Sufficient aerobic conditioning acts as a protective buffer (${(activityImpact * 100).toFixed(1)}%).`,
    },
  ];

  const simRiskLevel =
    totalCalculated < 0.2
      ? 'LOW'
      : totalCalculated < 0.5
      ? 'MODERATE'
      : totalCalculated < 0.75
      ? 'HIGH'
      : 'CRITICAL';

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="space-y-2 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Sparkles className="w-5 h-5" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Explainable AI (XAI) & SHAP Reasoning
          </h1>
          <Badge variant="teal">Interpretability Hub</Badge>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 max-w-3xl leading-relaxed">
          In healthcare, a percentage without an explanation is clinically unusable. HealthSync AI employs **SHapley Additive exPlanations (SHAP)** to break down predictions into transparent, positive and negative biological drivers.
        </p>
      </div>

      <DemoModeBanner />
      <DisclaimerBanner compact />

      {/* 1. XAI Core Concept Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-sky-200/80 bg-white">
          <CardContent className="p-5 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Cooperative Game Theory</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Originated by Nobel laureate Lloyd Shapley, Shapley values determine the unique, fair additive contribution of each biomarker feature collaborating to produce the final risk probability.
            </p>
          </CardContent>
        </Card>

        <Card className="border-teal-200/80 bg-white">
          <CardContent className="p-5 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Additive Local Efficiency</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-mono">
              f(x) = E[f(z)] + &sum; &phi;<sub>i</sub>
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              Every score begins at the reference cohort baseline (e.g. 32.0%) and is pushed strictly up or down by the patient's individual biomarker values.
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-200/80 bg-white">
          <CardContent className="p-5 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Actionable Protective Factors</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Unlike typical regression outputs, SHAP highlights your protective buffers (e.g., active exercise, optimal HDL), giving patients evidence-based lifestyle levers to actively lower their risk scores.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 2. Interactive Educational SHAP Simulator */}
      <Card className="border-slate-300 shadow-md">
        <CardHeader className="bg-slate-50/70 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-sky-600" />
                <CardTitle className="text-lg">Interactive SHAP Perturbation Simulator</CardTitle>
              </div>
              <CardDescription>
                Adjust the biomarker sliders below to watch how additive SHAP drivers dynamically push the calculated risk score in real time.
              </CardDescription>
            </div>
            <Badge variant="demo">Interactive Educational Demonstration</Badge>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-8">
          {/* Sliders Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-5 bg-slate-50 rounded-2xl border border-slate-200">
            {/* Slider 1: Glucose */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                <span>Fasting Glucose</span>
                <span className="font-mono text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                  {simGlucose} mg/dL
                </span>
              </div>
              <input
                type="range"
                min="70"
                max="200"
                step="1"
                value={simGlucose}
                onChange={(e) => setSimGlucose(Number(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>70 (Normal)</span>
                <span>126 (Diabetic)</span>
                <span>200</span>
              </div>
            </div>

            {/* Slider 2: BMI */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                <span>Body Mass Index (BMI)</span>
                <span className="font-mono text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                  {simBmi} kg/m²
                </span>
              </div>
              <input
                type="range"
                min="18.5"
                max="45.0"
                step="0.5"
                value={simBmi}
                onChange={(e) => setSimBmi(Number(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>18.5 (Lean)</span>
                <span>25 (Overweight)</span>
                <span>45 (Obese)</span>
              </div>
            </div>

            {/* Slider 3: Blood Pressure */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                <span>Systolic Blood Pressure</span>
                <span className="font-mono text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                  {simSystolic} mmHg
                </span>
              </div>
              <input
                type="range"
                min="90"
                max="180"
                step="1"
                value={simSystolic}
                onChange={(e) => setSimSystolic(Number(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>90 (Optimal)</span>
                <span>130 (Hypertensive)</span>
                <span>180</span>
              </div>
            </div>

            {/* Slider 4: Physical Activity */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                <span>Weekly Aerobic Exercise</span>
                <span className="font-mono text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                  {simActivity} hrs/wk
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={simActivity}
                onChange={(e) => setSimActivity(Number(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>0 (Sedentary)</span>
                <span>2.5 (CDC Target)</span>
                <span>10</span>
              </div>
            </div>
          </div>

          {/* Real-time Dynamic Gauge & Waterfall */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Simulated Output Probability
              </span>
              <RiskGauge score={totalCalculated} riskLevel={simRiskLevel} size="md" />
              <p className="text-xs text-slate-500 text-center mt-3">
                Baseline Reference Population Risk: <strong>32.0%</strong>
              </p>
            </div>

            <div className="lg:col-span-2">
              <ShapWaterfallBar drivers={simDrivers} baseExpectedRisk={baseRisk} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Model Architecture Cards */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-4">
          Transparent Clinical Model Cards
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1 */}
          <Card>
            <CardHeader className="border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Type 2 Diabetes Risk Model</CardTitle>
                <Badge variant="outline">v1.0.0-calibrated</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-3 text-xs text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-800">Algorithm</span>
                <span className="font-mono">HistGradientBoostingClassifier</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-800">Calibration Method</span>
                <span className="font-mono">CalibratedClassifierCV (Isotonic)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-800">Explainability Engine</span>
                <span className="font-mono">shap.TreeExplainer (Exact)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-800">Primary Benchmark Dataset</span>
                <span>CDC BRFSS Health Indicators (253k records)</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="font-semibold text-slate-800">Expected Background Risk</span>
                <span className="font-mono">32.04%</span>
              </div>
            </CardContent>
          </Card>

          {/* Card 2 */}
          <Card>
            <CardHeader className="border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Cardiovascular Risk Model</CardTitle>
                <Badge variant="outline">v1.0.0-calibrated</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-3 text-xs text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-800">Algorithm</span>
                <span className="font-mono">RandomForestClassifier (Ensemble)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-800">Calibration Method</span>
                <span className="font-mono">CalibratedClassifierCV (Platt Scaling)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-800">Explainability Engine</span>
                <span className="font-mono">shap.TreeExplainer (Sub-60ms)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-800">Primary Benchmark Dataset</span>
                <span>UCI Cleveland & Statlog Combined (920 records)</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="font-semibold text-slate-800">Expected Background Risk</span>
                <span className="font-mono">28.15%</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
