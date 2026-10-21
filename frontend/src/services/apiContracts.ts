import { DiabetesInput, HeartDiseaseInput, AssessmentResult, AssessmentRecord, ClinicalReport, User, TrendDataPoint } from '../types';

export interface IAuthService {
  login(email: string, password: string): Promise<User>;
  register(data: { email: string; password: string; fullName: string; dateOfBirth: string; gender: string }): Promise<User>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
}

export interface IAssessmentService {
  estimateDiabetesRisk(input: DiabetesInput, options?: { allowDemo?: boolean }): Promise<AssessmentResult>;
  estimateHeartDiseaseRisk(input: HeartDiseaseInput, options?: { allowDemo?: boolean }): Promise<AssessmentResult>;
  getAssessmentHistory(): Promise<AssessmentRecord[]>;
  getAssessmentById(id: string): Promise<AssessmentResult | null>;
  deleteAssessment(id: string): Promise<boolean>;
  getTrendData(): Promise<TrendDataPoint[]>;
}

export interface IReportService {
  getReports(): Promise<ClinicalReport[]>;
  generateReport(assessmentId: string): Promise<ClinicalReport>;
  downloadReportPdf(reportId: string): Promise<void>;
}
