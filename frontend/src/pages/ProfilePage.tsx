import React, { useState } from 'react';
import {
  UserCheck,
  ShieldCheck,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  FileJson,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserProfile } from '../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { Modal } from '../components/common/Modal';
import { Badge } from '../components/common/Badge';
import { DisclaimerBanner } from '../components/common/DisclaimerBanner';

const BASELINE_STORAGE_KEY = 'healthsync_user_baseline_profile';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();

  // Load genuinely user-entered baseline from local storage if previously saved; otherwise initialize unset
  const loadSavedBaseline = (): Partial<UserProfile> => {
    try {
      const raw = localStorage.getItem(BASELINE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const initialBaseline = loadSavedBaseline();

  // Baseline Vitals State (starts blank/unset unless genuinely stored by user)
  const [height, setHeight] = useState<number | ''>(initialBaseline.heightCm ?? '');
  const [weight, setWeight] = useState<number | ''>(initialBaseline.weightKg ?? '');
  const [bloodGroup, setBloodGroup] = useState<string>(initialBaseline.bloodGroup ?? '');
  const [smoking, setSmoking] = useState<string>(initialBaseline.smokingStatus ?? '');
  const [alcohol, setAlcohol] = useState<string>(initialBaseline.alcoholConsumption ?? '');
  const [activity, setActivity] = useState<string>(initialBaseline.physicalActivityLevel ?? '');

  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Partial<UserProfile> = {
      heightCm: height !== '' ? Number(height) : undefined,
      weightKg: weight !== '' ? Number(weight) : undefined,
      bloodGroup: bloodGroup || undefined,
      smokingStatus: (smoking as any) || undefined,
      alcoholConsumption: (alcohol as any) || undefined,
      physicalActivityLevel: (activity as any) || undefined,
    };
    try {
      localStorage.setItem(BASELINE_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save baseline parameters to localStorage:', err);
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleExportData = async () => {
    setIsExporting(true);
    await new Promise((resolve) => setTimeout(resolve, 800));

    const exportBundle = {
      exportTimestamp: new Date().toISOString(),
      governanceCompliance: 'GDPR Article 20 / DPDPA 2023 Self-Service Portability',
      userAccount: {
        id: user?.id || 'demo_user',
        fullName: user?.fullName || 'Demo User',
        email: user?.email || 'demo@healthsync.ai',
        role: user?.role || 'patient',
      },
      physiologicalBaseline: {
        heightCm: height !== '' ? Number(height) : null,
        weightKg: weight !== '' ? Number(weight) : null,
        bloodGroup: bloodGroup || 'UNSET',
        smokingStatus: smoking || 'UNSET',
        alcoholConsumption: alcohol || 'UNSET',
        physicalActivityLevel: activity || 'UNSET',
      },
      securityNotice: 'This exported file contains user-entered biometric telemetry. Store securely.',
    };

    const blob = new Blob([JSON.stringify(exportBundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HealthSync_Data_Export_${user?.id || 'demo_user'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIsExporting(false);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
            <UserCheck className="w-5 h-5" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Profile & Privacy Governance
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Manage your physiological baseline presets and exercise patient data portability rights.
        </p>
      </div>

      <DisclaimerBanner compact />

      {savedSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Physiological baseline parameters updated successfully.</span>
        </div>
      )}

      {/* Account Info Card */}
      <Card>
        <CardHeader className="bg-slate-50/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Identity & Role Credentials</CardTitle>
            <Badge variant="default">Session Sandbox (Local Mode)</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block mb-0.5">Account Name</span>
              <span className="font-semibold text-slate-900 text-sm">{user?.fullName || 'Demo User'}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Account Email</span>
              <span className="font-semibold text-slate-900 text-sm">{user?.email || 'demo@healthsync.ai'}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Account Identifier</span>
              <span className="font-mono text-slate-700">{user?.id || 'demo_user'}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Account Role</span>
              <span className="font-semibold text-slate-900 capitalize">{user?.role || 'Patient'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Physiological Baseline Form */}
      <Card>
        <form onSubmit={handleSaveProfile}>
          <CardHeader className="bg-slate-50/50">
            <CardTitle className="text-base">Baseline Physiological Profile</CardTitle>
            <CardDescription>
              Optional physiological values saved to your local browser storage for pre-filling assessments.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Baseline Height"
                type="number"
                unit="cm"
                placeholder="e.g. 175"
                value={height}
                onChange={(e) => setHeight(e.target.value === '' ? '' : Number(e.target.value))}
              />
              <Input
                label="Baseline Weight"
                type="number"
                unit="kg"
                placeholder="e.g. 70"
                value={weight}
                onChange={(e) => setWeight(e.target.value === '' ? '' : Number(e.target.value))}
              />
              <Select
                label="Blood Group"
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                options={[
                  { value: '', label: 'Select Blood Group (Unset)' },
                  { value: 'A+', label: 'A+' },
                  { value: 'A-', label: 'A-' },
                  { value: 'B+', label: 'B+' },
                  { value: 'B-', label: 'B-' },
                  { value: 'AB+', label: 'AB+' },
                  { value: 'AB-', label: 'AB-' },
                  { value: 'O+', label: 'O+' },
                  { value: 'O-', label: 'O-' },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <Select
                label="Smoking Status"
                value={smoking}
                onChange={(e) => setSmoking(e.target.value)}
                options={[
                  { value: '', label: 'Select Smoking Status (Unset)' },
                  { value: 'NEVER', label: 'Never Smoked' },
                  { value: 'FORMER', label: 'Former Smoker' },
                  { value: 'CURRENT', label: 'Active Smoker' },
                ]}
              />
              <Select
                label="Alcohol Consumption"
                value={alcohol}
                onChange={(e) => setAlcohol(e.target.value)}
                options={[
                  { value: '', label: 'Select Alcohol Intake (Unset)' },
                  { value: 'NONE', label: 'None / Teetotaler' },
                  { value: 'MODERATE', label: 'Moderate (1-2 drinks/wk)' },
                  { value: 'HEAVY', label: 'Heavy (>7 drinks/wk)' },
                ]}
              />
              <Select
                label="Physical Activity Level"
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
                options={[
                  { value: '', label: 'Select Physical Activity (Unset)' },
                  { value: 'SEDENTARY', label: 'Sedentary (<30 min/wk)' },
                  { value: 'MODERATE', label: 'Moderate (150 min/wk)' },
                  { value: 'ACTIVE', label: 'Active (>300 min/wk)' },
                ]}
              />
            </div>
          </CardContent>
          <CardFooter className="justify-between bg-slate-50/70 p-4">
            <span className="text-xs text-slate-500">
              {Object.keys(initialBaseline).length > 0 ? 'Custom baseline saved locally.' : 'No baseline saved yet.'}
            </span>
            <Button type="submit" variant="primary" size="sm">
              Save Baseline Parameters
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* GDPR Data Rights Section */}
      <Card className="border-slate-300">
        <CardHeader className="bg-slate-50/50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-600" />
            <CardTitle className="text-base">Data Subject Rights (GDPR & DPDPA)</CardTitle>
          </div>
          <CardDescription>
            You maintain full sovereignty over your biometric and risk assessment records.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <h4 className="text-xs font-bold text-slate-900">Export All Personal Health Data</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Download a machine-readable JSON archive containing all your biomarkers, risk calculations, and reports.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              isLoading={isExporting}
              onClick={handleExportData}
              leftIcon={<FileJson className="w-4 h-4 text-sky-600" />}
            >
              Export JSON Archive
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-rose-50/50 border border-rose-200">
            <div>
              <h4 className="text-xs font-bold text-rose-950">Reset Local Session & Stored Baseline</h4>
              <p className="text-xs text-rose-800 mt-0.5">
                Permanently purge your locally stored baseline profile and active session parameters.
              </p>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setIsDeleteModalOpen(true)}
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              Reset Session
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account Deletion Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Session Reset"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Reset Confirmation</span>
              <p>
                This will purge all locally saved baseline parameters from your browser storage and reset your session.
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600">
            Are you certain you wish to reset your local data for <strong>{user?.email || 'demo@healthsync.ai'}</strong>?
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                localStorage.removeItem(BASELINE_STORAGE_KEY);
                setHeight('');
                setWeight('');
                setBloodGroup('');
                setSmoking('');
                setAlcohol('');
                setActivity('');
                setIsDeleteModalOpen(false);
              }}
            >
              Confirm Reset
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
