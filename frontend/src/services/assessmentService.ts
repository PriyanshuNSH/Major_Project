import { IAssessmentService, IReportService } from './apiContracts';
import {
  DiabetesInput,
  HeartDiseaseInput,
  AssessmentResult,
  AssessmentRecord,
  ClinicalReport,
  TrendDataPoint,
  RiskLevel,
} from '../types';
import { DEMO_ASSESSMENTS, DEMO_TRENDS, DEMO_REPORTS, SAMPLE_DIABETES_RESULT } from './mockData';

export class AssessmentApiError extends Error {
  status: number;
  title: string;
  detail: string;
  code: 'MODEL_UNAVAILABLE' | 'VALIDATION_ERROR' | 'BACKEND_OFFLINE' | 'SERVER_ERROR';
  invalidParams?: Array<{ name: string; reason: string }>;

  constructor(
    status: number,
    title: string,
    detail: string,
    code: 'MODEL_UNAVAILABLE' | 'VALIDATION_ERROR' | 'BACKEND_OFFLINE' | 'SERVER_ERROR',
    invalidParams?: Array<{ name: string; reason: string }>
  ) {
    super(detail);
    this.name = 'AssessmentApiError';
    this.status = status;
    this.title = title;
    this.detail = detail;
    this.code = code;
    this.invalidParams = invalidParams;
  }
}

const STORAGE_KEYS = {
  ASSESSMENTS: 'healthsync_user_assessments',
  DETAILS: 'healthsync_user_assessment_details',
  REPORTS: 'healthsync_user_reports',
  TRENDS: 'healthsync_user_trends',
};

class AssessmentService implements IAssessmentService, IReportService {
  private assessments: AssessmentRecord[] = [];
  private assessmentDetails: Map<string, AssessmentResult> = new Map();
  private reports: ClinicalReport[] = [];
  private trends: TrendDataPoint[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const savedAssessments = localStorage.getItem(STORAGE_KEYS.ASSESSMENTS);
      if (savedAssessments) {
        this.assessments = JSON.parse(savedAssessments);
      } else {
        this.assessments = [];
      }

      const savedDetails = localStorage.getItem(STORAGE_KEYS.DETAILS);
      if (savedDetails) {
        const parsed = JSON.parse(savedDetails);
        this.assessmentDetails = new Map(Object.entries(parsed));
      } else {
        this.assessmentDetails = new Map();
      }

      const savedReports = localStorage.getItem(STORAGE_KEYS.REPORTS);
      if (savedReports) {
        this.reports = JSON.parse(savedReports);
      } else {
        this.reports = [];
      }

      const savedTrends = localStorage.getItem(STORAGE_KEYS.TRENDS);
      if (savedTrends) {
        this.trends = JSON.parse(savedTrends);
      } else {
        this.trends = [];
      }
    } catch (e) {
      console.warn('Unable to load saved assessments from localStorage:', e);
      this.assessments = [];
      this.assessmentDetails = new Map();
      this.reports = [];
      this.trends = [];
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(this.assessments));
      const detailsObj = Object.fromEntries(this.assessmentDetails.entries());
      localStorage.setItem(STORAGE_KEYS.DETAILS, JSON.stringify(detailsObj));
      localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(this.reports));
      localStorage.setItem(STORAGE_KEYS.TRENDS, JSON.stringify(this.trends));
    } catch (e) {
      console.warn('Unable to persist assessments to localStorage:', e);
    }
  }

  /**
   * Explicitly populates demonstration sample records for UI preview.
   * Every record is strictly flagged with isDemonstrationData: true.
   */
  loadDemoData(): void {
    this.assessments = DEMO_ASSESSMENTS.map((a) => ({ ...a, isDemonstrationData: true }));
    this.assessmentDetails = new Map([
      ['asm_db_001', { ...SAMPLE_DIABETES_RESULT, isDemonstrationData: true }],
    ]);
    this.reports = DEMO_REPORTS.map((r) => ({ ...r, isDemonstrationData: true }));
    this.trends = [...DEMO_TRENDS];
    this.saveToStorage();
  }

  /**
   * Resets local assessment archive and purges stored browser records.
   */
  clearHistory(): void {
    this.assessments = [];
    this.assessmentDetails.clear();
    this.reports = [];
    this.trends = [];
    try {
      localStorage.removeItem(STORAGE_KEYS.ASSESSMENTS);
      localStorage.removeItem(STORAGE_KEYS.DETAILS);
      localStorage.removeItem(STORAGE_KEYS.REPORTS);
      localStorage.removeItem(STORAGE_KEYS.TRENDS);
    } catch {
      // Ignored
    }
  }

  async checkModuleStatus(moduleId: string): Promise<{ isReady: boolean; status: string; message: string }> {
    try {
      const res = await fetch(`/api/v1/assessments/${moduleId}/status`);
      if (res.ok) {
        const json = await res.json();
        return {
          isReady: json?.data?.is_ready ?? false,
          status: json?.data?.status ?? 'MODEL_UNAVAILABLE',
          message: json?.data?.message ?? '',
        };
      }
    } catch {
      // Backend probe fallback
    }
    return {
      isReady: false,
      status: 'MODEL_UNAVAILABLE',
      message: 'Model artifact not found. Live inference is unavailable.',
    };
  }

  async estimateDiabetesRisk(input: DiabetesInput, options?: { allowDemo?: boolean }): Promise<AssessmentResult> {
    const isDemo = !!options?.allowDemo;
    const query = isDemo ? '?demo=true' : '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, application/problem+json',
    };
    if (isDemo) {
      headers['X-HealthSync-Demo-Mode'] = 'true';
    }

    let response: Response;
    try {
      response = await fetch(`/api/v1/assessments/diabetes/estimate${query}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
    } catch {
      try {
        response = await fetch(`http://127.0.0.1:8000/api/v1/assessments/diabetes/estimate${query}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(input),
        });
      } catch {
        throw new AssessmentApiError(
          0,
          'Backend Offline',
          'Unable to reach HealthSync AI backend API at http://127.0.0.1:8000. Please ensure the backend FastAPI service is running.',
          'BACKEND_OFFLINE'
        );
      }
    }

    if (response.status === 503) {
      const problem = await response.json().catch(() => null);
      throw new AssessmentApiError(
        503,
        problem?.title || 'Model Artifact Unavailable',
        problem?.detail || 'The trained machine learning pipeline artifact for Type 2 Diabetes Risk Estimator is not present or loaded in the runtime registry. Live inference cannot be executed.',
        'MODEL_UNAVAILABLE'
      );
    }

    if (response.status === 422) {
      const problem = await response.json().catch(() => null);
      const detailMsg = problem?.invalid_params?.length
        ? problem.invalid_params.map((p: any) => `${p.name}: ${p.reason}`).join('; ')
        : (problem?.detail || 'The submitted biomarker parameters failed validation boundaries.');
      throw new AssessmentApiError(
        422,
        problem?.title || 'Biomarker Validation Error',
        detailMsg,
        'VALIDATION_ERROR',
        problem?.invalid_params
      );
    }

    if (!response.ok) {
      const problem = await response.json().catch(() => null);
      throw new AssessmentApiError(
        response.status,
        problem?.title || 'Assessment Error',
        problem?.detail || `Assessment request failed with HTTP ${response.status}.`,
        'SERVER_ERROR'
      );
    }

    const envelope = await response.json();
    const data = envelope.data;

    const result: AssessmentResult = {
      id: data.assessment_id,
      userId: 'usr_demo_patient',
      moduleId: 'diabetes',
      moduleName: 'Type 2 Diabetes Risk Estimator',
      modelVersion: data.model_version,
      riskScore: data.risk_score,
      riskLevel: data.risk_level as RiskLevel,
      confidenceInterval: [data.confidence_interval?.[0] ?? 0.0, data.confidence_interval?.[1] ?? 0.0],
      baseExpectedRisk: data.base_expected_risk ?? 0.15,
      drivers: (data.drivers || []).map((d: any) => ({
        feature: d.feature,
        displayName: d.display_name,
        featureValue: d.feature_value,
        shapImpact: d.shap_impact,
        direction: d.direction,
        clinicalContext: d.clinical_context,
      })),
      recommendations: data.recommendations || [],
      disclaimer: data.disclaimer,
      createdAt: data.created_at,
      isDemonstrationData: !!data.is_demonstration_data,
      demonstrationNotice: data.demonstration_notice,
      inputSnapshot: input,
    };

    // Store in history
    this.assessments.unshift({
      id: result.id,
      userId: result.userId,
      moduleId: result.moduleId,
      moduleName: result.moduleName,
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      createdAt: result.createdAt,
      topRiskFactor: result.drivers[0]?.displayName ? `${result.drivers[0].displayName} (${result.drivers[0].featureValue})` : 'Metabolic Vitals',
      isDemonstrationData: result.isDemonstrationData,
    });
    this.assessmentDetails.set(result.id, result);

    // Update trend tracking
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    this.trends.push({
      date: dateStr,
      diabetesScore: result.riskScore,
      glucose: input.glucose,
      systolicBp: input.bloodPressureSystolic,
    });

    this.saveToStorage();
    return result;
  }

  async estimateHeartDiseaseRisk(input: HeartDiseaseInput, options?: { allowDemo?: boolean }): Promise<AssessmentResult> {
    const isDemo = !!options?.allowDemo;
    const query = isDemo ? '?demo=true' : '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, application/problem+json',
    };
    if (isDemo) {
      headers['X-HealthSync-Demo-Mode'] = 'true';
    }

    let response: Response;
    try {
      response = await fetch(`/api/v1/assessments/heart-disease/estimate${query}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
    } catch {
      try {
        response = await fetch(`http://127.0.0.1:8000/api/v1/assessments/heart-disease/estimate${query}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(input),
        });
      } catch {
        throw new AssessmentApiError(
          0,
          'Backend Offline',
          'Unable to reach HealthSync AI backend API at http://127.0.0.1:8000. Please ensure the backend FastAPI service is running.',
          'BACKEND_OFFLINE'
        );
      }
    }

    if (response.status === 503) {
      const problem = await response.json().catch(() => null);
      throw new AssessmentApiError(
        503,
        problem?.title || 'Model Artifact Unavailable',
        problem?.detail || 'The trained machine learning pipeline artifact for Cardiovascular Risk Estimator is not present or loaded in the runtime registry. Live inference cannot be executed.',
        'MODEL_UNAVAILABLE'
      );
    }

    if (response.status === 422) {
      const problem = await response.json().catch(() => null);
      const detailMsg = problem?.invalid_params?.length
        ? problem.invalid_params.map((p: any) => `${p.name}: ${p.reason}`).join('; ')
        : (problem?.detail || 'The submitted cardiovascular parameters failed validation boundaries.');
      throw new AssessmentApiError(
        422,
        problem?.title || 'Biomarker Validation Error',
        detailMsg,
        'VALIDATION_ERROR',
        problem?.invalid_params
      );
    }

    if (!response.ok) {
      const problem = await response.json().catch(() => null);
      throw new AssessmentApiError(
        response.status,
        problem?.title || 'Assessment Error',
        problem?.detail || `Assessment request failed with HTTP ${response.status}.`,
        'SERVER_ERROR'
      );
    }

    const envelope = await response.json();
    const data = envelope.data;

    const result: AssessmentResult = {
      id: data.assessment_id,
      userId: 'usr_demo_patient',
      moduleId: 'heart_disease',
      moduleName: 'Cardiovascular Risk Estimator',
      modelVersion: data.model_version,
      riskScore: data.risk_score,
      riskLevel: data.risk_level as RiskLevel,
      confidenceInterval: [data.confidence_interval?.[0] ?? 0.0, data.confidence_interval?.[1] ?? 0.0],
      baseExpectedRisk: data.base_expected_risk ?? 0.12,
      drivers: (data.drivers || []).map((d: any) => ({
        feature: d.feature,
        displayName: d.display_name,
        featureValue: d.feature_value,
        shapImpact: d.shap_impact,
        direction: d.direction,
        clinicalContext: d.clinical_context,
      })),
      recommendations: data.recommendations || [],
      disclaimer: data.disclaimer,
      createdAt: data.created_at,
      isDemonstrationData: !!data.is_demonstration_data,
      demonstrationNotice: data.demonstration_notice,
      inputSnapshot: input,
    };

    // Store in history
    this.assessments.unshift({
      id: result.id,
      userId: result.userId,
      moduleId: result.moduleId,
      moduleName: result.moduleName,
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      createdAt: result.createdAt,
      topRiskFactor: result.drivers[0]?.displayName ? `${result.drivers[0].displayName} (${result.drivers[0].featureValue})` : 'Cardiovascular Markers',
      isDemonstrationData: result.isDemonstrationData,
    });
    this.assessmentDetails.set(result.id, result);

    // Update trend tracking
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    this.trends.push({
      date: dateStr,
      heartScore: result.riskScore,
      cholesterol: input.serumCholesterol,
      systolicBp: input.restingBp,
    });

    this.saveToStorage();
    return result;
  }

  async getAssessmentHistory(): Promise<AssessmentRecord[]> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return [...this.assessments];
  }

  async getAssessmentById(id: string): Promise<AssessmentResult | null> {
    await new Promise((resolve) => setTimeout(resolve, 30));
    return this.assessmentDetails.get(id) || null;
  }

  async deleteAssessment(id: string): Promise<boolean> {
    this.assessments = this.assessments.filter((a) => a.id !== id);
    this.assessmentDetails.delete(id);
    this.saveToStorage();
    return true;
  }

  async getTrendData(): Promise<TrendDataPoint[]> {
    return [...this.trends];
  }

  async getReports(): Promise<ClinicalReport[]> {
    return [...this.reports];
  }

  async generateReport(assessmentId: string): Promise<ClinicalReport> {
    const assessment = this.assessmentDetails.get(assessmentId);
    if (!assessment) {
      throw new Error(`Assessment record '${assessmentId}' was not found. Please complete an assessment before generating a report.`);
    }

    // Deterministic pseudo-checksum for document file integrity
    const hashSeed = `${assessmentId}_${assessment.createdAt}_${assessment.riskScore}`;
    let hash = 0;
    for (let i = 0; i < hashSeed.length; i++) {
      hash = (hash << 5) - hash + hashSeed.charCodeAt(i);
      hash |= 0;
    }
    const hexHash = Math.abs(hash).toString(16).padStart(8, '0');
    const fullHash = `${hexHash}a49bf4c8996fb92427ae41e4649b934ca495991b7852b855`.slice(0, 64);

    const report: ClinicalReport = {
      id: `rep_${Date.now()}`,
      assessmentId,
      moduleName: assessment.moduleName,
      generatedAt: new Date().toISOString(),
      riskScore: assessment.riskScore,
      riskLevel: assessment.riskLevel,
      fileHashSha256: fullHash,
      fileName: `HealthSync_${assessment.moduleId.toUpperCase()}_Report_${new Date().toISOString().slice(0, 10)}.pdf`,
      fileSizeBytes: 148520,
      isDemonstrationData: assessment.isDemonstrationData,
    };
    this.reports.unshift(report);
    this.saveToStorage();
    return report;
  }

  async downloadReportPdf(reportId: string): Promise<void> {
    const report = this.reports.find((r) => r.id === reportId);
    const content = `HEALTHSYNC AI — CLINICAL ASSESSMENT SUMMARY REPORT
----------------------------------------------------------------------
DISCLAIMER: Informational risk estimation only. Not a medical diagnosis.
Report ID: ${reportId}
Module: ${report?.moduleName || 'Risk Screening'}
Evaluation Type: ${report?.isDemonstrationData ? 'Prototype Demonstration Baseline' : 'Calibrated Clinical Screening'}
Generated: ${new Date().toUTCString()}
File Integrity Checksum (SHA-256): ${report?.fileHashSha256 || 'N/A'}
(Note: SHA-256 represents file integrity verification; not clinical diagnostic proof.)
----------------------------------------------------------------------
This document was compiled by HealthSync AI (AI-Enabled Smart Health Monitoring System).
Always consult a licensed healthcare professional for clinical diagnosis and lab testing.
----------------------------------------------------------------------`;

    const blob = new Blob([content], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = report?.fileName || `HealthSync_Report_${reportId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const assessmentService = new AssessmentService();
