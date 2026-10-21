import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  RotateCcw,
  ArrowRight,
  Download,
  CheckCircle,
  Clock,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { assessmentService } from '../services/assessmentService';
import { DiabetesInput, AssessmentResult } from '../types';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/common/Card';
import { DisclaimerBanner } from '../components/common/DisclaimerBanner';
import { DemoModeBanner, PROTOTYPE_DEMO_DISCLAIMER } from '../components/common/DemoModeBanner';
import { Badge, RiskBadge } from '../components/common/Badge';
import { RiskGauge } from '../components/visual/RiskGauge';
import { ShapWaterfallBar } from '../components/visual/ShapWaterfallBar';
import { calculateBmi, getBmiCategory } from '../utils/formatters';

export const DiabetesAssessmentPage: React.FC = () => {
  // Input Form States (start blank by default for authentic assessment)
  const [glucose, setGlucose] = useState<number | ''>('');
  const [systolic, setSystolic] = useState<number | ''>('');
  const [diastolic, setDiastolic] = useState<number | ''>('');
  const [heightCm, setHeightCm] = useState<number | ''>('');
  const [weightKg, setWeightKg] = useState<number | ''>('');
  const [age, setAge] = useState<number | ''>('');
  const [physicalActivityHours, setPhysicalActivityHours] = useState<number | ''>('');
  const [familyHistory, setFamilyHistory] = useState<boolean>(false);
  const [insulin, setInsulin] = useState<number | ''>('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  const [modelUnavailableError, setModelUnavailableError] = useState<{
    title: string;
    detail: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [evaluationStep, setEvaluationStep] = useState<string>('');
  const [result, setResult] = useState<AssessmentResult | null>(null);

  // Computed BMI
  const hasValidAnthropometrics = typeof weightKg === 'number' && typeof heightCm === 'number' && weightKg > 0 && heightCm > 0;
  const computedBmi = hasValidAnthropometrics ? calculateBmi(weightKg, heightCm) : 0;
  const bmiCategory = computedBmi > 0 ? getBmiCategory(computedBmi) : null;

  const clearFieldError = (fieldName: string) => {
    if (fieldErrors[fieldName]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    }
    if (validationError) {
      setValidationError(null);
    }
  };

  const fillHealthySample = () => {
    if (isSubmitting) return;
    setGlucose(88);
    setSystolic(118);
    setDiastolic(76);
    setHeightCm(175);
    setWeightKg(68);
    setAge(32);
    setPhysicalActivityHours(4.5);
    setFamilyHistory(false);
    setInsulin(50);
    setFieldErrors({});
    setValidationError(null);
  };

  const fillElevatedSample = () => {
    if (isSubmitting) return;
    setGlucose(145);
    setSystolic(142);
    setDiastolic(92);
    setHeightCm(170);
    setWeightKg(94);
    setAge(52);
    setPhysicalActivityHours(0.5);
    setFamilyHistory(true);
    setInsulin(190);
    setFieldErrors({});
    setValidationError(null);
  };

  const validateAll = (): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (glucose === '' || isNaN(Number(glucose)) || Number(glucose) < 40 || Number(glucose) > 400) {
      errors.glucose = 'Fasting glucose is required (40 - 400 mg/dL).';
    }
    if (insulin !== '' && (isNaN(Number(insulin)) || Number(insulin) < 0 || Number(insulin) > 900)) {
      errors.insulin = 'Fasting serum insulin must be between 0 and 900 µU/mL.';
    }
    if (systolic === '' || isNaN(Number(systolic)) || Number(systolic) < 60 || Number(systolic) > 250) {
      errors.systolic = 'Systolic BP is required (60 - 250 mmHg).';
    }
    if (diastolic === '' || isNaN(Number(diastolic)) || Number(diastolic) < 40 || Number(diastolic) > 150) {
      errors.diastolic = 'Diastolic BP is required (40 - 150 mmHg).';
    }
    if (systolic !== '' && diastolic !== '' && Number(diastolic) >= Number(systolic)) {
      errors.diastolic = 'Diastolic BP must be strictly lower than systolic BP.';
    }
    if (age === '' || isNaN(Number(age)) || Number(age) < 18 || Number(age) > 120) {
      errors.age = 'Patient age is required (18 - 120 years).';
    }
    if (heightCm === '' || isNaN(Number(heightCm)) || Number(heightCm) < 100 || Number(heightCm) > 250) {
      errors.heightCm = 'Height is required (100 - 250 cm).';
    }
    if (weightKg === '' || isNaN(Number(weightKg)) || Number(weightKg) < 30 || Number(weightKg) > 250) {
      errors.weightKg = 'Weight is required (30 - 250 kg).';
    }
    if (computedBmi > 0 && (computedBmi < 10 || computedBmi > 65)) {
      errors.weightKg = 'Body Mass Index (BMI) must be between 10.0 and 65.0 kg/m².';
    }
    if (physicalActivityHours === '' || isNaN(Number(physicalActivityHours)) || Number(physicalActivityHours) < 0 || Number(physicalActivityHours) > 35) {
      errors.physicalActivityHours = 'Weekly physical activity is required (0 - 35 hrs/wk).';
    }

    return errors;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e?.preventDefault) e.preventDefault();
    executeAssessment(false);
  };

  const executeAssessment = async (allowDemo: boolean = false) => {
    if (isSubmitting) return;

    setValidationError(null);
    setModelUnavailableError(null);
    const errors = validateAll();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setValidationError(`Please resolve the ${Object.keys(errors).length} highlighted parameter errors before submission.`);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    setEvaluationStep('Step 1/3: Validating biological boundaries with FastAPI backend...');

    try {
      setTimeout(() => setEvaluationStep('Step 2/3: Dispatching biomarker payload to risk engine...'), 250);
      setTimeout(() => setEvaluationStep('Step 3/3: Evaluating ML pipeline & SHAP feature drivers...'), 550);

      const input: DiabetesInput = {
        glucose: Number(glucose),
        bloodPressureSystolic: Number(systolic),
        bloodPressureDiastolic: Number(diastolic),
        bmi: computedBmi,
        age: Number(age),
        physicalActivityHoursWeek: Number(physicalActivityHours),
        familyHistoryDiabetes: familyHistory,
        insulin: insulin !== '' ? Number(insulin) : undefined,
      };

      const assessmentResult = await assessmentService.estimateDiabetesRisk(input, { allowDemo });
      setResult(assessmentResult);
      setModelUnavailableError(null);
    } catch (err: any) {
      // Critical Healthcare Non-Negotiable: Never show successful prediction if model is unavailable
      setResult(null);
      if (err?.code === 'MODEL_UNAVAILABLE' || err?.status === 503) {
        setModelUnavailableError({
          title: err.title || 'Model Artifact Unavailable',
          detail: err.detail || 'The trained machine learning pipeline artifact for Type 2 Diabetes Risk Estimator is not present or loaded in the runtime registry. Live inference cannot be executed.',
        });
      } else {
        setValidationError(err?.message || 'Assessment execution failed. Please verify input values.');
      }
    } finally {
      setIsSubmitting(false);
      setEvaluationStep('');
    }
  };

  const handleRunDemoMode = () => {
    executeAssessment(true);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
              <Activity className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Type 2 Diabetes Risk Screening
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Calibrated epidemiological risk estimation based on glycemic, metabolic, and hemodynamic biomarkers.
          </p>
        </div>

        {/* Quick Sample Presets */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fillHealthySample}
            disabled={isSubmitting}
          >
            Fill Baseline
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fillElevatedSample}
            disabled={isSubmitting}
          >
            Fill High Risk
          </Button>
        </div>
      </div>

      {/* Mandatory Disclaimer & Model Baseline Notice */}
      <DisclaimerBanner />
      <DemoModeBanner />

      {/* Main Content: Form or Results */}
      {!result ? (
        <Card className="border-slate-200 shadow-md">
          <form onSubmit={handleSubmit} noValidate>
            <CardHeader className="bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Biometric & Lifestyle Input Profile</CardTitle>
                  <CardDescription>
                    All values are strictly validated against physiological biological ranges.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> ~2 min completion
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
              {modelUnavailableError && (
                <div className="p-4 bg-amber-50/80 border border-amber-300 rounded-xl space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                      <ShieldAlert className="w-4 h-4 text-amber-700" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                          {modelUnavailableError.title}
                        </h4>
                        <Badge variant="demo" size="sm">Backend HTTP 503</Badge>
                      </div>
                      <p className="text-xs text-amber-900 leading-relaxed">
                        {modelUnavailableError.detail}
                      </p>
                      <p className="text-[11px] text-amber-800/80 italic">
                        Real ML model artifact binding is in progress for this module.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-amber-200/80 flex flex-wrap items-center justify-between gap-2.5">
                    <span className="text-[11px] text-amber-900 font-medium">
                      Would you like to evaluate the form flow using epidemiological reference weights?
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-amber-300 text-amber-900 hover:bg-amber-100"
                        onClick={() => executeAssessment(false)}
                        disabled={isSubmitting}
                      >
                        Retry Model Probe
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-amber-800 hover:bg-amber-900 text-white font-medium shadow-xs"
                        onClick={handleRunDemoMode}
                        disabled={isSubmitting}
                      >
                        Run Prototype Demo Baseline
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {validationError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium flex items-center gap-2 animate-in fade-in duration-200">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Section 1: Glycemic & Metabolic Vitals */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 pb-1 border-b border-slate-100 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-500" /> 1. Glycemic & Metabolic Markers
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Fasting Plasma Glucose"
                    type="number"
                    step="1"
                    min="40"
                    max="400"
                    unit="mg/dL"
                    placeholder="e.g. 95"
                    value={glucose}
                    onChange={(e) => {
                      setGlucose(e.target.value === '' ? '' : Number(e.target.value));
                      clearFieldError('glucose');
                    }}
                    error={fieldErrors.glucose}
                    disabled={isSubmitting}
                    helperText="Normal fasting: 70–99 mg/dL; Prediabetes: 100–125; Diabetes: 126+"
                    required
                  />

                  <Input
                    label="Fasting Serum Insulin (Optional)"
                    type="number"
                    step="1"
                    min="0"
                    max="900"
                    unit="µU/mL"
                    placeholder="e.g. 12"
                    value={insulin}
                    onChange={(e) => {
                      setInsulin(e.target.value === '' ? '' : Number(e.target.value));
                      clearFieldError('insulin');
                    }}
                    error={fieldErrors.insulin}
                    disabled={isSubmitting}
                    helperText="Reference normal range: 2.6 – 24.9 µU/mL"
                  />
                </div>
              </div>

              {/* Section 2: Hemodynamics */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 pb-1 border-b border-slate-100 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-500" /> 2. Blood Pressure (Hemodynamics)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Systolic Blood Pressure"
                    type="number"
                    step="1"
                    min="60"
                    max="250"
                    unit="mmHg"
                    placeholder="e.g. 120"
                    value={systolic}
                    onChange={(e) => {
                      setSystolic(e.target.value === '' ? '' : Number(e.target.value));
                      clearFieldError('systolic');
                      clearFieldError('diastolic');
                    }}
                    error={fieldErrors.systolic}
                    disabled={isSubmitting}
                    helperText="Optimal: <120 mmHg; Stage 1 Hypertension: 130–139"
                    required
                  />

                  <Input
                    label="Diastolic Blood Pressure"
                    type="number"
                    step="1"
                    min="40"
                    max="150"
                    unit="mmHg"
                    placeholder="e.g. 80"
                    value={diastolic}
                    onChange={(e) => {
                      setDiastolic(e.target.value === '' ? '' : Number(e.target.value));
                      clearFieldError('diastolic');
                    }}
                    error={fieldErrors.diastolic}
                    disabled={isSubmitting}
                    helperText="Optimal: <80 mmHg; Must be lower than systolic"
                    required
                  />
                </div>
              </div>

              {/* Section 3: Anthropometrics */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 pb-1 border-b border-slate-100 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-500" /> 3. Anthropometrics & Demographics
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input
                    label="Chronological Age"
                    type="number"
                    min="18"
                    max="120"
                    unit="years"
                    placeholder="e.g. 45"
                    value={age}
                    onChange={(e) => {
                      setAge(e.target.value === '' ? '' : Number(e.target.value));
                      clearFieldError('age');
                    }}
                    error={fieldErrors.age}
                    disabled={isSubmitting}
                    required
                  />

                  <Input
                    label="Height"
                    type="number"
                    step="0.5"
                    min="100"
                    max="250"
                    unit="cm"
                    placeholder="e.g. 175"
                    value={heightCm}
                    onChange={(e) => {
                      setHeightCm(e.target.value === '' ? '' : Number(e.target.value));
                      clearFieldError('heightCm');
                    }}
                    error={fieldErrors.heightCm}
                    disabled={isSubmitting}
                    required
                  />

                  <Input
                    label="Weight"
                    type="number"
                    step="0.5"
                    min="30"
                    max="250"
                    unit="kg"
                    placeholder="e.g. 70"
                    value={weightKg}
                    onChange={(e) => {
                      setWeightKg(e.target.value === '' ? '' : Number(e.target.value));
                      clearFieldError('weightKg');
                    }}
                    error={fieldErrors.weightKg}
                    disabled={isSubmitting}
                    required
                  />
                </div>

                {/* Auto-Calculated BMI Banner */}
                <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500">Calculated Body Mass Index (BMI): </span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {computedBmi > 0 ? `${computedBmi} kg/m²` : '—'}
                    </span>
                  </div>
                  {bmiCategory ? (
                    <span className={`font-semibold ${bmiCategory.color}`}>
                      Classification: {bmiCategory.label}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">Enter height & weight to compute</span>
                  )}
                </div>
              </div>

              {/* Section 4: Lifestyle & Genetics */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 pb-1 border-b border-slate-100 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-500" /> 4. Lifestyle & Genetic History
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Weekly Aerobic Activity"
                    type="number"
                    step="0.5"
                    min="0"
                    max="35"
                    unit="hrs/wk"
                    placeholder="e.g. 2.5"
                    value={physicalActivityHours}
                    onChange={(e) => {
                      setPhysicalActivityHours(e.target.value === '' ? '' : Number(e.target.value));
                      clearFieldError('physicalActivityHours');
                    }}
                    error={fieldErrors.physicalActivityHours}
                    disabled={isSubmitting}
                    helperText="CDC recommendation: ≥2.5 hrs (150 mins) of moderate activity"
                    required
                  />

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-700 tracking-tight">Family History of Diabetes</label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button
                        type="button"
                        aria-pressed={familyHistory}
                        onClick={() => {
                          if (!isSubmitting) setFamilyHistory(true);
                        }}
                        disabled={isSubmitting}
                        className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 shadow-2xs ${
                          familyHistory
                            ? 'bg-sky-50 border-sky-500 text-sky-700'
                            : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        Yes (Parent / Sibling)
                      </button>
                      <button
                        type="button"
                        aria-pressed={!familyHistory}
                        onClick={() => {
                          if (!isSubmitting) setFamilyHistory(false);
                        }}
                        disabled={isSubmitting}
                        className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 shadow-2xs ${
                          !familyHistory
                            ? 'bg-sky-50 border-sky-500 text-sky-700'
                            : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        No Known History
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex-col sm:flex-row gap-3 justify-between bg-slate-50/70 p-6">
              <div className="text-xs text-slate-500">
                {isSubmitting ? (
                  <span className="font-semibold text-sky-700 animate-pulse">{evaluationStep}</span>
                ) : (
                  'Inference runs locally in-memory; zero third-party AI exposure.'
                )}
              </div>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isSubmitting}
                disabled={isSubmitting}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {isSubmitting ? evaluationStep : 'Calculate Risk Estimation'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      ) : (
        /* Results View */
        <div className="space-y-6 animate-fade-in">
          <Card className="border-sky-200/90 shadow-lg overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-sky-500/10 via-slate-50 to-white pb-6 border-b border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <RiskBadge level={result.riskLevel} />
                    <span className="text-xs font-mono text-slate-500">Model: {result.modelVersion}</span>
                  </div>
                  <CardTitle className="text-2xl mt-1">Screening Results & Calibrated Risk Score</CardTitle>
                  <CardDescription>
                    Evaluation generated on {new Date(result.createdAt).toLocaleString()}.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setResult(null)}
                    leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                  >
                    Retake Assessment
                  </Button>
                  <Link to="/reports">
                    <Button variant="navy" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />}>
                      Download PDF Report
                    </Button>
                  </Link>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
              {result.isDemonstrationData && (
                <DemoModeBanner message={result.demonstrationNotice || PROTOTYPE_DEMO_DISCLAIMER} />
              )}
              {/* Top Score Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center bg-white p-6 rounded-2xl border border-slate-200/80">
                <div className="flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-200 pb-4 md:pb-0 md:pr-4">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Calibrated Risk Metric
                  </span>
                  <RiskGauge
                    score={result.riskScore}
                    riskLevel={result.riskLevel}
                    confidenceInterval={result.confidenceInterval}
                    size="lg"
                  />
                </div>

                <div className="md:col-span-2 space-y-3">
                  <h4 className="text-sm font-bold text-slate-900">Clinical Interpretation & Risk Context</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Based on empirical models trained on CDC BRFSS cohorts, your physiological profile places your statistical vulnerability at{' '}
                    <strong className="text-slate-900 font-mono">{(result.riskScore * 100).toFixed(1)}%</strong>{' '}
                    (Categorized as <strong className="uppercase">{result.riskLevel} RISK</strong>). The baseline population incidence in benchmark reference data is approximately 32.0%.
                  </p>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                    <p className="font-semibold text-slate-800">What does this probability mean?</p>
                    <p>
                      In a monitored cohort of 1,000 individuals sharing your glycemic, blood pressure, and BMI parameters, approximately{' '}
                      <strong>{Math.round(result.riskScore * 1000)}</strong> showed prediabetes or type 2 diabetes indications on clinical lab review.
                    </p>
                  </div>
                </div>
              </div>

              {/* SHAP Explainability Breakdown */}
              <div>
                <ShapWaterfallBar drivers={result.drivers} baseExpectedRisk={result.baseExpectedRisk} />
              </div>

              {/* Evidence-Based Recommendations */}
              <div className="space-y-3 p-5 rounded-2xl bg-teal-50/50 border border-teal-200/80">
                <h4 className="text-sm font-bold text-teal-950 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-teal-600" /> Evidence-Based Preventative Recommendations
                </h4>
                <ul className="space-y-2 text-xs text-teal-900">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1.5 shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>

            <CardFooter className="justify-between bg-slate-50 p-5">
              <DisclaimerBanner compact />
              <Link to="/history">
                <Button variant="ghost" size="sm" rightIcon={<ChevronRight className="w-3.5 h-3.5" />}>
                  View Saved in History
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
};
