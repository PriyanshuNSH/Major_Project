import React from 'react';
import {
  Activity,
  AlertTriangle,
  ShieldCheck,
  Cpu,
  BookOpen,
  CheckCircle2,
  FileText,
  Lock,
  Heart,
  Scale,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { DisclaimerBanner } from '../components/common/DisclaimerBanner';
import { MANDATORY_MEDICAL_DISCLAIMER } from '../utils/formatters';

export const AboutPage: React.FC = () => {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold">
            <Activity className="w-5 h-5 text-sky-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            About & Clinical Scope
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          AI-Enabled Smart Health Monitoring System (HealthSync AI) — Academic Background, Ethics & Non-Diagnostic Scope.
        </p>
      </div>

      {/* Prominent Clinical Disclaimer */}
      <DisclaimerBanner />

      {/* 1. Academic & Product Context */}
      <Card>
        <CardHeader className="bg-slate-50/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Project Provenance & Mission</CardTitle>
            <Badge variant="teal">B.Tech CSE Major Project</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
          <p>
            <strong>HealthSync AI</strong> originated as a B.Tech Computer Science & Engineering major project designed to solve a critical limitation in consumer healthcare tech: <em>the lack of transparency and clinical calibration in digital health prediction tools.</em>
          </p>
          <p>
            Rather than relying on uncalibrated heuristic scores or closed-source commercial APIs, HealthSync AI integrates verified epidemiological cohorts (such as the CDC BRFSS and UCI Cleveland datasets), in-memory scikit-learn models, exact SHAP game-theoretic explainability, and enterprise-grade database row isolation.
          </p>
        </CardContent>
      </Card>

      {/* 2. Non-Diagnostic Medical Boundary & SaMD Statement */}
      <Card className="border-amber-300 bg-amber-50/30">
        <CardHeader className="bg-amber-100/40 border-b border-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-700" />
            <CardTitle className="text-base text-amber-950">
              Software as a Medical Device (SaMD) Boundary
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-3 text-xs sm:text-sm text-amber-950 leading-relaxed">
          <p>
            Under international regulatory frameworks (including US FDA, EU MDR, and Indian CDSCO directives):
          </p>
          <ul className="list-disc pl-5 space-y-2 text-xs">
            <li>
              <strong>Informational Risk Screening Only:</strong> The software calculates statistical likelihoods of disease susceptibility; it does <strong>not</strong> make clinical diagnoses, detect acute coronary events, or prescribe pharmacotherapy.
            </li>
            <li>
              <strong>Not for Acute Triage:</strong> HealthSync AI must never be utilized in emergency medical situations (such as acute myocardial infarction, severe hypoglycemia, or diabetic ketoacidosis).
            </li>
            <li>
              <strong>Physician Primacy:</strong> All outputs, reports, and risk indicators are designed exclusively as conversation-starters and lifestyle decision-support tools for consultation with a licensed doctor.
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* 3. Ethical AI Directives */}
      <Card>
        <CardHeader className="bg-slate-50/50">
          <CardTitle className="text-base">Scientific & Ethical AI Commitments</CardTitle>
          <CardDescription>Strict boundaries governing our machine learning pipelines.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600" /> Zero Fabricated Metrics
              </span>
              <p className="text-slate-600 leading-relaxed">
                We never publish invented accuracy claims (e.g. "99.4% clinical precision"). Only verifiable evaluation metrics computed through reproducible cross-validation scripts are logged in model cards.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-teal-600" /> Probability Calibration
              </span>
              <p className="text-slate-600 leading-relaxed">
                Raw decision tree margins are calibrated using isotonic regression (`CalibratedClassifierCV`) so that a 35% prediction matches a 35% true empirical incidence in identical reference cohorts.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-teal-600" /> Sub-60ms Local Inference
              </span>
              <p className="text-slate-600 leading-relaxed">
                ML inference runs in-memory within the backend runtime. User biomarkers are never transmitted to third-party commercial AI APIs (OpenAI, Anthropic) or shared with advertisers.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-teal-600" /> Tripartite Data Separation
              </span>
              <p className="text-slate-600 leading-relaxed">
                Public research training cohorts (`ml/data/`), synthetic integration fixtures (`tests/`), and live patient databases are strictly segregated to eliminate cross-realm contamination.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. FAQ */}
      <Card>
        <CardHeader className="bg-slate-50/50">
          <CardTitle className="text-base">Frequently Asked Questions</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4 text-xs text-slate-700">
          <div className="space-y-1 pb-3 border-b border-slate-100">
            <h4 className="font-bold text-slate-900">What does my risk percentage represent?</h4>
            <p className="text-slate-600 leading-relaxed">
              It indicates the statistical probability that an individual with your physiological parameters would test positive for prediabetes, diabetes, or coronary arterial narrowing based on epidemiological validation cohorts.
            </p>
          </div>
          <div className="space-y-1 pb-3 border-b border-slate-100">
            <h4 className="font-bold text-slate-900">How does SHAP explainability help me?</h4>
            <p className="text-slate-600 leading-relaxed">
              Standard models only output a number. SHAP breaks down that number into the exact biological features that pushed it higher (e.g., fasting glucose, elevated BMI) and protective factors that lowered it (e.g., aerobic exercise volume).
            </p>
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-slate-900">Can I share my PDF report with my doctor?</h4>
            <p className="text-slate-600 leading-relaxed">
              Yes. The generated reports are formatted specifically for clinician review, including structured biomarker breakdowns, SHAP attribution summaries, and a dedicated physician signature block.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
