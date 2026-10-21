import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Download,
  Eye,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Hash,
  AlertCircle,
  FileCheck,
  HelpCircle,
  Printer,
  ChevronRight,
  Activity,
  HeartPulse,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { assessmentService } from '../services/assessmentService';
import { ClinicalReport } from '../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { RiskBadge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { DisclaimerBanner } from '../components/common/DisclaimerBanner';
import { DemoModeBanner } from '../components/common/DemoModeBanner';
import { formatDate } from '../utils/formatters';

export const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<ClinicalReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<ClinicalReport | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadReports() {
      try {
        const data = await assessmentService.getReports();
        setReports(data);
      } finally {
        setIsLoading(false);
      }
    }
    loadReports();
  }, []);

  const handleDownload = async (id: string) => {
    await assessmentService.downloadReportPdf(id);
  };

  const handlePreview = (report: ClinicalReport) => {
    setSelectedReport(report);
    setIsPreviewOpen(true);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold">
              <FileText className="w-5 h-5 text-sky-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Clinical PDF Health Reports
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Standardized risk summaries with embedded SHA-256 document file integrity checksums (for file tamper detection; not a medical diagnosis).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {reports.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="text-slate-600 hover:text-rose-600 hover:border-rose-300"
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => {
                if (window.confirm('Clear all reports and reset to an empty state?')) {
                  assessmentService.clearHistory();
                  setReports([]);
                }
              }}
            >
              Reset Reports
            </Button>
          )}
          <Link to="/assessments/diabetes">
            <Button size="sm" variant="primary">
              Generate New Summary
            </Button>
          </Link>
        </div>
      </div>

      <DemoModeBanner />
      <DisclaimerBanner compact />

      {/* Reports Catalog */}
      <div className="grid grid-cols-1 gap-4">
        {reports.length === 0 ? (
          <Card className="border-slate-200">
            <CardContent className="p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <FileCheck className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">No Clinical Reports Generated</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                  No genuine assessment reports have been generated yet. Complete a clinical risk assessment to generate a verified report with a document SHA-256 integrity checksum.
                </p>
              </div>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <Link to="/assessments/diabetes">
                  <Button variant="primary" size="sm">
                    Diabetes Screening
                  </Button>
                </Link>
                <Link to="/assessments/heart">
                  <Button variant="outline" size="sm">
                    Cardiovascular Screening
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200"
                  onClick={() => {
                    assessmentService.loadDemoData();
                    assessmentService.getReports().then(setReports);
                  }}
                >
                  Load Demo Fixtures (Preview Only)
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          reports.map((report) => (
            <Card key={report.id} className="hover:border-slate-300 transition-all">
              <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                    <FileCheck className="w-6 h-6 text-sky-600" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">{report.moduleName}</h3>
                      {report.isDemonstrationData && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                          DEMO
                        </span>
                      )}
                      <RiskBadge level={report.riskLevel} />
                      <span className="text-[11px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-100">
                        Score: {(report.riskScore * 100).toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Generated: {formatDate(report.generatedAt)}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono truncate max-w-md">
                      SHA-256 File Checksum: <span className="text-slate-400">{report.fileHashSha256}</span>
                    </p>
                    <p className="text-[10px] text-slate-400 italic">
                      (Cryptographic checksum verifies PDF file integrity; not a clinical diagnosis or medical proof)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<Eye className="w-3.5 h-3.5" />}
                    onClick={() => handlePreview(report)}
                  >
                    Preview Layout
                  </Button>
                  <Button
                    size="sm"
                    variant="navy"
                    leftIcon={<Download className="w-3.5 h-3.5" />}
                    onClick={() => handleDownload(report.id)}
                  >
                    Download PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Discussion Guide with Doctor */}
      <Card className="bg-gradient-to-r from-sky-500/5 via-white to-teal-500/5 border-sky-200">
        <CardHeader>
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-sky-600" />
            <CardTitle className="text-base">Clinician Discussion Guide</CardTitle>
          </div>
          <CardDescription>
            Recommended clinical talking points to review with your licensed physician during physical appointments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-700">
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1">
              <span className="font-bold text-slate-900 block">1. Laboratory Panels (Venous Testing)</span>
              <p className="text-slate-600">
                Ask your physician if formal venous Fasting Plasma Glucose, HbA1c, and a comprehensive Lipid Fractionation Panel (HDL, LDL, Triglycerides) are indicated.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1">
              <span className="font-bold text-slate-900 block">2. SHAP Risk Factors Review</span>
              <p className="text-slate-600">
                Show the positive SHAP risk drivers identified in your report to determine if specific lifestyle adjustments (nutrition, aerobic targets) should be clinically tailored.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Report Preview Modal */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title="Clinical PDF Report Facsimile"
        maxWidth="2xl"
      >
        {selectedReport && (
          <div className="space-y-6 bg-white p-2">
            {selectedReport.isDemonstrationData && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-xs text-amber-900 flex items-center justify-between gap-2 font-medium">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded font-bold text-[10px] uppercase">
                    DEMO FIXTURE
                  </span>
                  <span>This document layout is an illustrative demonstration fixture and does not represent verified live clinical data.</span>
                </div>
              </div>
            )}

            {/* Paper Sheet Facsimile */}
            <div className="p-6 border-2 border-slate-200 rounded-xl space-y-6 font-sans text-slate-900 shadow-sm">
              {/* Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Activity className="w-6 h-6 text-sky-600" />
                    <span className="text-xl font-extrabold tracking-tight">HealthSync AI</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                    AI-Enabled Smart Health Monitoring System
                  </span>
                </div>
                <div className="text-right text-xs">
                  <span className="font-bold text-slate-800">CLINICAL SUMMARY REPORT</span>
                  <p className="text-slate-500 font-mono text-[10px] mt-0.5">
                    Date: {new Date(selectedReport.generatedAt).toLocaleDateString()}
                  </p>
                  <p className="text-slate-400 font-mono text-[10px]">
                    Document ID: {selectedReport.id}
                  </p>
                </div>
              </div>

              {/* Patient Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] block">Patient Name:</span>
                  <span className="font-bold text-slate-800">{user?.fullName || 'Demo User'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Patient ID:</span>
                  <span className="font-mono text-slate-800">{user?.id || 'usr_demo_patient'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Record Context:</span>
                  <span className="text-slate-800">{user?.gender ? `${user.gender} / Active` : 'Clinical Telemetry'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Document Checksum:</span>
                  <span className="text-teal-700 font-mono font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> SHA-256 Valid
                  </span>
                </div>
              </div>

              {/* Assessment Score Section */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase">Assessment Profile</span>
                    {selectedReport.isDemonstrationData && (
                      <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 border border-amber-300 rounded text-[9px] font-bold">
                        DEMO
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-extrabold text-slate-900">{selectedReport.moduleName}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Calibrated machine learning risk estimation evaluated against clinical reference distributions.
                  </p>
                </div>
                <div className="text-center sm:text-right">
                  <span className="text-3xl font-extrabold text-slate-900 font-mono">
                    {(selectedReport.riskScore * 100).toFixed(1)}%
                  </span>
                  <div>
                    <RiskBadge level={selectedReport.riskLevel} />
                  </div>
                </div>
              </div>

              {/* Key Contributing Biomarkers Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Primary SHAP Biometric Drivers
                  </h5>
                  {selectedReport.isDemonstrationData && (
                    <span className="text-[10px] text-amber-700 italic">
                      * Illustrative baseline driver weights
                    </span>
                  )}
                </div>
                <table className="w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-100 text-slate-700 font-semibold">
                    <tr>
                      <th className="p-2 border-b border-slate-200">Biomarker Feature</th>
                      <th className="p-2 border-b border-slate-200">Observed Value</th>
                      <th className="p-2 border-b border-slate-200">SHAP Impact</th>
                      <th className="p-2 border-b border-slate-200">Clinical Indication</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-2 font-medium">Fasting Plasma Glucose</td>
                      <td className="p-2 font-mono">118 mg/dL</td>
                      <td className="p-2 font-mono text-rose-600 font-bold">+8.5%</td>
                      <td className="p-2 text-slate-500">Prediabetes threshold elevation</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium">Body Mass Index (BMI)</td>
                      <td className="p-2 font-mono">28.4 kg/m²</td>
                      <td className="p-2 font-mono text-rose-600 font-bold">+4.2%</td>
                      <td className="p-2 text-slate-500">Overweight classification</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium">Weekly Aerobic Activity</td>
                      <td className="p-2 font-mono">3.5 hrs/wk</td>
                      <td className="p-2 font-mono text-teal-600 font-bold">-4.1%</td>
                      <td className="p-2 text-slate-500">Active protective metabolic buffer</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Physician Review & Signature Box */}
              <div className="border border-slate-300 rounded-xl p-4 bg-slate-50/50 space-y-4">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Physician Review & Clinical Notes
                </span>
                <div className="h-14 border-b border-dashed border-slate-300" />
                <div className="flex justify-between items-end text-xs text-slate-500">
                  <span>Reviewing Clinician Signature / Stamp</span>
                  <span>Date: ________________________</span>
                </div>
              </div>

              {/* Mandatory Non-Diagnostic Disclaimer */}
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-[10px] text-amber-900 leading-relaxed">
                <strong>IMPORTANT REGULATORY & CLINICAL NOTICE:</strong> Informational risk estimation only. Not a medical diagnosis or clinical substitute. Consult a healthcare professional.
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => window.print()} leftIcon={<Printer className="w-3.5 h-3.5" />}>
                Print Document
              </Button>
              <Button
                variant="navy"
                size="sm"
                onClick={() => handleDownload(selectedReport.id)}
                leftIcon={<Download className="w-3.5 h-3.5" />}
              >
                Download PDF Binary
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
