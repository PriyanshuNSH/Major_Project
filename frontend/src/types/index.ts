// HealthSync AI — Core TypeScript Contracts & Domain Interfaces

export type BiologicalSex = 'MALE' | 'FEMALE' | 'OTHER';
export type UserRole = 'patient' | 'clinician' | 'admin';
export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type ModuleType = 'diabetes' | 'heart_disease';

export interface User {
  id: string;
  email: string;
  fullName: string;
  dateOfBirth: string;
  gender: BiologicalSex;
  role: UserRole;
  createdAt: string;
}

export interface UserProfile {
  bloodGroup?: string;
  heightCm?: number;
  weightKg?: number;
  smokingStatus: 'NEVER' | 'FORMER' | 'CURRENT';
  alcoholConsumption: 'NONE' | 'MODERATE' | 'HEAVY';
  physicalActivityLevel: 'SEDENTARY' | 'MODERATE' | 'ACTIVE';
}

// Diabetes Assessment Input
export interface DiabetesInput {
  glucose: number; // 40-400 mg/dL
  bloodPressureSystolic: number; // 60-250 mmHg
  bloodPressureDiastolic: number; // 40-150 mmHg
  bmi: number; // 10-65 kg/m²
  age: number; // 18-120
  insulin?: number; // 0-900 µU/mL
  skinThickness?: number; // 0-99 mm
  pregnancies?: number; // 0-20
  physicalActivityHoursWeek: number; // 0-35
  familyHistoryDiabetes: boolean;
}

// Heart Disease Assessment Input
export interface HeartDiseaseInput {
  age: number; // 18-120
  sex: number; // 0 = Female, 1 = Male
  chestPainType: number; // 0: Typical Angina, 1: Atypical Angina, 2: Non-anginal, 3: Asymptomatic
  restingBp: number; // 60-260 mmHg
  serumCholesterol: number; // 100-600 mg/dL
  fastingBloodSugar: boolean; // true if > 120 mg/dL
  restingEcg: number; // 0: Normal, 1: ST-T wave abnormality, 2: Left ventricular hypertrophy
  maxHeartRate: number; // 60-220 bpm
  exerciseAngina: boolean; // true = Yes, false = No
  oldpeak: number; // 0.0 - 10.0 mm
  stSlope: number; // 0: Upsloping, 1: Flat, 2: Downsloping
}

export interface ShapDriver {
  feature: string;
  displayName: string;
  featureValue: string | number;
  shapImpact: number; // Positive = increases risk, Negative = protective
  direction: 'RISK_ELEVATING' | 'PROTECTIVE';
  clinicalContext: string;
}

export interface AssessmentResult {
  id: string;
  userId: string;
  moduleId: ModuleType;
  moduleName: string;
  modelVersion: string;
  riskScore: number; // 0.0 to 1.0 (calibrated probability)
  riskLevel: RiskLevel;
  confidenceInterval: [number, number];
  baseExpectedRisk: number;
  drivers: ShapDriver[];
  recommendations: string[];
  disclaimer: string;
  createdAt: string;
  isDemonstrationData: boolean;
  demonstrationNotice?: string;
  inputSnapshot: Record<string, any>;
}

export interface AssessmentRecord {
  id: string;
  userId: string;
  moduleId: ModuleType;
  moduleName: string;
  riskScore: number;
  riskLevel: RiskLevel;
  createdAt: string;
  topRiskFactor: string;
  isDemonstrationData: boolean;
}

export interface ClinicalReport {
  id: string;
  assessmentId: string;
  moduleName: string;
  generatedAt: string;
  riskScore: number;
  riskLevel: RiskLevel;
  fileHashSha256: string;
  fileName: string;
  fileSizeBytes: number;
  downloadUrl?: string;
  isDemonstrationData?: boolean;
}

export interface TrendDataPoint {
  date: string;
  diabetesScore?: number;
  heartScore?: number;
  glucose?: number;
  systolicBp?: number;
  cholesterol?: number;
}
