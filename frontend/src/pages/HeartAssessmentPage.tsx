import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  HeartPulse,
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
import { HeartDiseaseInput, AssessmentResult } from '../types';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/common/Card';
import { DisclaimerBanner } from '../components/common/DisclaimerBanner';
import { DemoModeBanner, PROTOTYPE_DEMO_DISCLAIMER } from '../components/common/DemoModeBanner';
import { Badge, RiskBadge } from '../components/common/Badge';
import { RiskGauge } from '../components/visual/RiskGauge';
import { ShapWaterfallBar } from '../components/visual/ShapWaterfallBar';

export const HeartAssessmentPage: React.FC = () => {
  // Input Form States (start blank by default for authentic assessment)
  const [age, setAge] = useState<number | ''>('');
  const [sex, setSex] = useState<number>(1); // 1 = Male, 0 = Female
  const [chestPainType, setChestPainType] = useState<number>(0);
  const [restingBp, setRestingBp] = useState<number | ''>('');
  const [serumCholesterol, setSerumCholesterol] = useState<number | ''>('');
  const [fastingBloodSugar, setFastingBloodSugar] = useState<boolean>(false);
  const [restingEcg, setRestingEcg] = useState<number>(0);
  const [maxHeartRate, setMaxHeartRate] = useState<number | ''>('');
  const [exerciseAngina, setExerciseAngina] = useState<boolean>(false);
  const [oldpeak, setOldpeak] = useState<number | ''>('');
  const [stSlope, setStSlope] = useState<number>(1);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  const [modelUnavailableError, setModelUnavailableError] = useState<{
    title: string;
    detail: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [evaluationStep, setEvaluationStep] = useState<string>('');
  const [result, setResult] = useState<AssessmentResult | null>(null);

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
    setAge(35);
    setSex(1);
    setChestPainType(2); // Non-anginal
    setRestingBp(115);
    setSerumCholesterol(180);
    setFastingBloodSugar(false);
    setRestingEcg(0);
    setMaxHeartRate(170);
    setExerciseAngina(false);
    setOldpeak(0.2);
    setStSlope(0); // Upsloping
    setFieldErrors({});
    setValidationError(null);
  };

  const fillElevatedSample = () => {
    if (isSubmitting) return;
    setAge(62);
    setSex(1);
    setChestPainType(0); // Typical angina
    setRestingBp(155);
    setSerumCholesterol(285);
    setFastingBloodSugar(true);
    setRestingEcg(1);
    setMaxHeartRate(115);
    setExerciseAngina(true);
    setOldpeak(2.8);
    setStSlope(1); // Flat
    setFieldErrors({});
    setValidationError(null);
  };

  const validateAll = (): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (age === '' || isNaN(Number(age)) || Number(age) < 18 || Number(age) > 120) {
      errors.age = 'Patient age is required (18 - 120 years).';
    }
    if (restingBp === '' || isNaN(Number(restingBp)) || Number(restingBp) < 60 || Number(restingBp) > 260) {
      errors.restingBp = 'Resting blood pressure is required (60 - 260 mmHg).';
    }
    if (serumCholesterol === '' || isNaN(Number(serumCholesterol)) || Number(serumCholesterol) < 100 || Number(serumCholesterol) > 600) {
      errors.serumCholesterol = 'Serum cholesterol is required (100 - 600 mg/dL).';
    }
    if (maxHeartRate === '' || isNaN(Number(maxHeartRate)) || Number(maxHeartRate) < 60 || Number(maxHeartRate) > 220) {
      errors.maxHeartRate = 'Maximum heart rate achieved is required (60 - 220 bpm).';
    }
    if (oldpeak === '' || isNaN(Number(oldpeak)) || Number(oldpeak) < 0.0 || Number(oldpeak) > 10.0) {
      errors.oldpeak = 'ST depression (Oldpeak) is required (0.0 - 10.0 mm).';
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
    setEvaluationStep('Step 1/3: Validating cardiovascular parameters with FastAPI backend...');

    try {
      setTimeout(() => setEvaluationStep('Step 2/3: Dispatching cardiovascular biomarkers to risk engine...'), 250);
      setTimeout(() => setEvaluationStep('Step 3/3: Evaluating ML pipeline & SHAP feature drivers...'), 550);

      const input: HeartDiseaseInput = {
        age: Number(age),
        sex,
        chestPainType,
        restingBp: Number(restingBp),
        serumCholesterol: Number(serumCholesterol),
        fastingBloodSugar,
        restingEcg,
        maxHeartRate: Number(maxHeartRate),
        exerciseAngina,
        oldpeak: Number(oldpeak),
        stSlope,
      };

      const assessmentResult = await assessmentService.estimateHeartDiseaseRisk(input, { allowDemo });
      setResult(assessmentResult);
      setModelUnavailableError(null);
    } catch (err: any) {
      // Critical Healthcare Non-Negotiable: Never show successful prediction if model is unavailable
      setResult(null);
      if (err?.code === 'MODEL_UNAVAILABLE' || err?.status === 503) {
        setModelUnavailableError({
          title: err.title || 'Model Artifact Unavailable',
          detail: err.detail || 'The trained machine learning pipeline artifact for Cardiovascular Risk Estimator is not present or loaded in the runtime registry. Live inference cannot be executed.',
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
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
              <HeartPulse className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Cardiovascular Risk Screening
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Calibrated probabilistic screening for coronary artery vulnerability based on clinical cardiovascular markers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={fillHealthySample} disabled={isSubmitting}>
            Fill Baseline
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={fillElevatedSample} disabled={isSubmitting}>
            Fill High Risk
          </Button>
        </div>
      </div>

      <DisclaimerBanner />
      <DemoModeBanner />

      {!result ? (
        <Card className="border-slate-200 shadow-md">
          <form onSubmit={handleSubmit} noValidate>
            <CardHeader className="bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Clinical Cardiovascular Markers</CardTitle>
                  <CardDescription>
                    Derived from UCI Cleveland & Statlog cardiovascular diagnostic benchmarks.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> ~3 min completion
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
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Section 1: Demographics & Symptoms */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 pb-1 border-b border-slate-100 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal-500" /> 1. Patient Profile & Symptom Presentation
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input
                    label="Patient Age"
                    type="number"
                    min="18"
                    max="120"
                    unit="years"
                    placeholder="e.g. 52"
                    value={age}
                    onChange={(e) => {
                      setAge(e.target.value === '' ? '' : Number(e.target.value));
                      clearFieldError('age');
                    }}
                    error={fieldErrors.age}
                    disabled={isSubmitting}
                    required
                  />

                  <Select
                    label="Biological Sex"
                    value={sex}
                    onChange={(e) => setSex(Number(e.target.value))}
                    disabled={isSubmitting}
                    options={[
                      { value: 1, label: 'Male' },
                      { value: 0, label: 'Female' },
                    ]}
                  />

                  <Select
                    label="Chest Pain Profile"
                    value={chestPainType}
                    onChange={(e) => setChestPainType(Number(e.target.value))}
                    disabled={isSubmitting}
                    options={[
                      { value: 0, label: 'Typical Angina' },
                      { value: 1, label: 'Atypical Angina' },
                      { value: 2, label: 'Non-Anginal Discomfort' },
                      { value: 3, label: 'Asymptomatic' },
                    ]}
                  />
                </div>
              </div>

              {/* Section 2: Hemodynamics & Lipids */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 pb-1 border-b border-slate-100 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal-500" /> 2. Hemodynamics & Lipid Panel
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input
                    label="Resting Blood Pressure"
                    type="number"
                    step="1"
                    min="60"
                    max="260"
                    unit="mmHg"
                    placeholder="e.g. 128"
                    value={restingBp}
                    onChange={(e) => {
                      setRestingBp(e.target.value === '' ? '' : Number(e.target.value));
                      clearFieldError('restingBp');
                    }}
                    error={fieldErrors.restingBp}
                    disabled={isSubmitting}
                    helperText="Optimal: <120 mmHg"
                    required
                  />

                  <Input
                    label="Serum Cholesterol"
                    type="number"
                    step="1"
                    min="100"
                    max="600"
                    unit="mg/dL"
                    placeholder="e.g. 210"
                    value={serumCholesterol}
                    onChange={(e) => {
                      setSerumCholesterol(e.target.value === '' ? '' : Number(e.target.value));
                      clearFieldError('serumCholesterol');
                    }}
                    error={fieldErrors.serumCholesterol}
                    disabled={isSubmitting}
                    helperText="Desirable: <200 mg/dL; High: ≥240"
                    required
                  />

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-700 tracking-tight">Fasting Blood Sugar &gt; 120 mg/dL</label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button
                        type="button"
                        aria-pressed={fastingBloodSugar}
                        disabled={isSubmitting}
                        onClick={() => setFastingBloodSugar(true)}
                        className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 shadow-2xs ${fastingBloodSugar
                          ? 'bg-teal-50 border-teal-500 text-teal-800'
                          : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400'
                          } ${isSubmitting ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        Yes (&gt; 120)
                      </button>
                      <button
                        type="button"
                        aria-pressed={!fastingBloodSugar}
                        disabled={isSubmitting}
                        onClick={() => setFastingBloodSugar(false)}
                        className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 shadow-2xs ${!fastingBloodSugar
                          ? 'bg-teal-50 border-teal-500 text-teal-800'
                          : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400'
                          } ${isSubmitting ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        No (&le; 120)
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Electrocardiography & Stress Tolerance */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 pb-1 border-b border-slate-100 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal-500" /> 3. Electrocardiography & Exercise Stress
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Select
                    label="Resting ECG Results"
                    value={restingEcg}
                    onChange={(e) => setRestingEcg(Number(e.target.value))}
                    disabled={isSubmitting}
                    options={[
                      { value: 0, label: 'Normal' },
                      { value: 1, label: 'ST-T Wave Abnormality' },
                      { value: 2, label: 'Left Ventricular Hypertrophy' },
                    ]}
                  />

                  <Input
                    label="Max Heart Rate Achieved"
                    type="number"
                    step="1"
                    min="60"
                    max="220"
                    unit="bpm"
                    placeholder="e.g. 150"
                    value={maxHeartRate}
                    onChange={(e) => {
                      setMaxHeartRate(e.target.value === '' ? '' : Number(e.target.value));
                      clearFieldError('maxHeartRate');
                    }}
                    error={fieldErrors.maxHeartRate}
                    disabled={isSubmitting}
                    required
                  />

                  <Input
                    label="ST Depression (Oldpeak)"
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    unit="mm"
                    placeholder="e.g. 1.0"
                    value={oldpeak}
                    onChange={(e) => {
                      setOldpeak(e.target.value === '' ? '' : Number(e.target.value));
                      clearFieldError('oldpeak');
                    }}
                    error={fieldErrors.oldpeak}
                    disabled={isSubmitting}
                    helperText="Exercise-induced ST depression"
                    required
                  />

                  <Select
                    label="Slope of Peak ST"
                    value={stSlope}
                    onChange={(e) => setStSlope(Number(e.target.value))}
                    disabled={isSubmitting}
                    options={[
                      { value: 0, label: 'Upsloping' },
                      { value: 1, label: 'Flat' },
                      { value: 2, label: 'Downsloping' },
                    ]}
                  />
                </div>

                <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-xs font-medium text-slate-700">Exercise-Induced Angina (Chest pain during physical exertion)?</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-pressed={exerciseAngina}
                      disabled={isSubmitting}
                      onClick={() => setExerciseAngina(true)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 shadow-2xs ${exerciseAngina
                        ? 'bg-rose-50 border-rose-400 text-rose-800'
                        : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400'
                        } ${isSubmitting ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      Yes, Angina Provoked
                    </button>
                    <button
                      type="button"
                      aria-pressed={!exerciseAngina}
                      disabled={isSubmitting}
                      onClick={() => setExerciseAngina(false)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 shadow-2xs ${!exerciseAngina
                        ? 'bg-teal-50 border-teal-500 text-teal-800'
                        : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400'
                        } ${isSubmitting ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      No Angina
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>

            <CardFooter className="justify-between bg-slate-50/70 p-6">
              <div className="text-xs text-slate-500">
                Inference runs locally in-memory; zero external cloud data transfer.
              </div>
              <Button
                type="submit"
                variant="secondary"
                size="lg"
                isLoading={isSubmitting}
                disabled={isSubmitting}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {isSubmitting ? evaluationStep : 'Run Cardiovascular Assessment'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      ) : (
        /* Results View */
        <div className="space-y-6 animate-fade-in">
          <Card className="border-teal-200/90 shadow-lg overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-teal-500/10 via-slate-50 to-white pb-6 border-b border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <RiskBadge level={result.riskLevel} />
                    <span className="text-xs font-mono text-slate-500">Model: {result.modelVersion}</span>
                  </div>
                  <CardTitle className="text-2xl mt-1">Cardiovascular Assessment & Risk Probability</CardTitle>
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
              {/* Score Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center bg-white p-6 rounded-2xl border border-slate-200/80">
                <div className="flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-200 pb-4 md:pb-0 md:pr-4">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Coronary Risk Likelihood
                  </span>
                  <RiskGauge
                    score={result.riskScore}
                    riskLevel={result.riskLevel}
                    confidenceInterval={result.confidenceInterval}
                    size="lg"
                  />
                </div>

                <div className="md:col-span-2 space-y-3">
                  <h4 className="text-sm font-bold text-slate-900">Cardiovascular Risk Stratification</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Based on calibrated models trained on UCI Cleveland clinical cohorts, your physiological profile yields an estimated coronary risk probability of{' '}
                    <strong className="text-slate-900 font-mono">{(result.riskScore * 100).toFixed(1)}%</strong>{' '}
                    (Categorized as <strong className="uppercase">{result.riskLevel} RISK</strong>). The baseline expected population incidence in the reference cohort is ~28.0%.
                  </p>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                    <p className="font-semibold text-slate-800">Cardiologist Discussion Point:</p>
                    <p>
                      Present this standardized assessment along with your lipid panel and resting ECG telemetry during your next medical checkup.
                    </p>
                  </div>
                </div>
              </div>

              {/* SHAP Breakdown */}
              <div>
                <ShapWaterfallBar drivers={result.drivers} baseExpectedRisk={result.baseExpectedRisk} />
              </div>

              {/* Recommendations */}
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
                  View in History
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
};
