import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  HeartPulse,
  Sparkles,
  FileText,
  TrendingDown,
  TrendingUp,
  ChevronRight,
  Download,
  Eye,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { assessmentService } from '../services/assessmentService';
import { AssessmentRecord, TrendDataPoint } from '../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { RiskBadge, Badge } from '../components/common/Badge';
import { TrendChart } from '../components/visual/TrendChart';
import { DemoModeBanner } from '../components/common/DemoModeBanner';
import { DisclaimerBanner } from '../components/common/DisclaimerBanner';
import { formatDate } from '../utils/formatters';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [trends, setTrends] = useState<TrendDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [historyData, trendData] = await Promise.all([
        assessmentService.getAssessmentHistory(),
        assessmentService.getTrendData(),
      ]);
      setAssessments(historyData);
      setTrends(trendData);
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
      setError('Unable to load clinical records from assessment service. Please check connectivity.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this assessment record from your history?')) {
      try {
        await assessmentService.deleteAssessment(id);
        setAssessments((prev) => prev.filter((a) => a.id !== id));
      } catch (err) {
        console.error('Failed to delete assessment:', err);
      }
    }
  };

  const latestDiabetes = assessments.find((a) => a.moduleId === 'diabetes');
  const latestHeart = assessments.find((a) => a.moduleId === 'heart_disease');

  // Compute empirical delta between recent assessments (avoiding fabricated claims)
  const diabetesAssessments = assessments.filter((a) => a.moduleId === 'diabetes');
  let diabetesDelta: { value: number; improving: boolean } | null = null;
  if (diabetesAssessments.length >= 2) {
    const diff = diabetesAssessments[0].riskScore - diabetesAssessments[1].riskScore;
    diabetesDelta = {
      value: Math.abs(diff) * 100,
      improving: diff <= 0,
    };
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Personal Health Dashboard
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 font-medium hidden sm:inline-block">
              Clinical Telemetry
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Welcome, <span className="font-semibold text-slate-800">{user?.fullName || 'Patient'}</span>. Track calibrated risk screening results and explainable factor drivers.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/assessments/diabetes">
            <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />}>
              Diabetes Screen
            </Button>
          </Link>
          <Link to="/assessments/heart">
            <Button size="sm" variant="outline" leftIcon={<HeartPulse className="w-3.5 h-3.5 text-sky-600" />}>
              Cardiovascular Screen
            </Button>
          </Link>
          <Link to="/reports">
            <Button size="sm" variant="ghost" leftIcon={<FileText className="w-3.5 h-3.5 text-slate-600" />}>
              Reports
            </Button>
          </Link>
        </div>
      </div>

      {/* Model Calibration Status Notice */}
      <DemoModeBanner />

      {/* Mandatory Non-Diagnostic Disclaimer */}
      <DisclaimerBanner compact />

      {/* Error State Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadData}
            className="font-semibold text-rose-700 hover:text-rose-900 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 rounded-xl bg-white border border-slate-200 p-5 animate-pulse space-y-3">
                <div className="h-4 bg-slate-100 rounded w-1/2" />
                <div className="h-8 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-1/3" />
              </div>
            ))}
          </div>
          <div className="h-72 rounded-xl bg-white border border-slate-200 p-6 animate-pulse" />
        </div>
      ) : (
        <>
          {/* 2. Key Biomarker & Risk Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Diabetes Card */}
            <Card className="bg-white hover:border-slate-300 transition-all border-slate-200 shadow-2xs">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 flex-wrap">
                    <Activity className="w-4 h-4 text-sky-600 shrink-0" />
                    Type 2 Diabetes
                    {latestDiabetes?.isDemonstrationData && (
                      <Badge variant="demo" size="sm">DEMO</Badge>
                    )}
                  </span>
                  {latestDiabetes && <RiskBadge level={latestDiabetes.riskLevel} />}
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono tracking-tight">
                  {latestDiabetes ? `${(latestDiabetes.riskScore * 100).toFixed(1)}%` : 'No Data'}
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  {latestDiabetes ? `Screened ${formatDate(latestDiabetes.createdAt)}` : 'No baseline completed'}
                </p>
                <div className="pt-1.5 border-t border-slate-100">
                  <Link
                    to="/assessments/diabetes"
                    className="text-xs font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-1"
                  >
                    {latestDiabetes ? 'Recalculate Risk' : 'Take Screening'} <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Heart Disease Card */}
            <Card className="bg-white hover:border-slate-300 transition-all border-slate-200 shadow-2xs">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 flex-wrap">
                    <HeartPulse className="w-4 h-4 text-sky-600 shrink-0" />
                    Cardiovascular
                    {latestHeart?.isDemonstrationData && (
                      <Badge variant="demo" size="sm">DEMO</Badge>
                    )}
                  </span>
                  {latestHeart && <RiskBadge level={latestHeart.riskLevel} />}
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono tracking-tight">
                  {latestHeart ? `${(latestHeart.riskScore * 100).toFixed(1)}%` : 'No Data'}
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  {latestHeart ? `Screened ${formatDate(latestHeart.createdAt)}` : 'No baseline completed'}
                </p>
                <div className="pt-1.5 border-t border-slate-100">
                  <Link
                    to="/assessments/heart"
                    className="text-xs font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-1"
                  >
                    {latestHeart ? 'Recalculate Risk' : 'Take Screening'} <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Total Assessments Recorded */}
            <Card className="bg-white hover:border-slate-300 transition-all border-slate-200 shadow-2xs">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">
                    Total Assessments
                  </span>
                  <span className="text-[10px] font-mono uppercase bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-medium">
                    Archive
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono tracking-tight">
                  {assessments.length}
                </div>
                <p className="text-[11px] text-slate-400">
                  {assessments.length > 0 ? 'Biometric sessions logged' : 'No evaluations yet'}
                </p>
                <div className="pt-1.5 border-t border-slate-100">
                  <Link
                    to="/history"
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                  >
                    View History <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Assessment Trajectory Status */}
            <Card className="bg-white hover:border-slate-300 transition-all border-slate-200 shadow-2xs">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                    {diabetesDelta ? (
                      diabetesDelta.improving ? (
                        <TrendingDown className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <TrendingUp className="w-4 h-4 text-amber-600" />
                      )
                    ) : (
                      <Calendar className="w-4 h-4 text-slate-400" />
                    )}
                    Trajectory Status
                  </span>
                  {diabetesDelta && (
                    <span
                      className={`text-[11px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                        diabetesDelta.improving
                          ? 'text-emerald-700 bg-emerald-50'
                          : 'text-amber-700 bg-amber-50'
                      }`}
                    >
                      {diabetesDelta.improving ? '-' : '+'}
                      {diabetesDelta.value.toFixed(1)}% Delta
                    </span>
                  )}
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  {diabetesDelta
                    ? diabetesDelta.improving
                      ? 'Improving'
                      : 'Elevating'
                    : assessments.length > 0
                    ? 'Baseline Set'
                    : 'Awaiting Screenings'}
                </div>
                <p className="text-[11px] text-slate-400">
                  {diabetesDelta
                    ? 'Empirical delta from recent metabolic evaluations'
                    : 'Requires periodic follow-up evaluations'}
                </p>
                <div className="pt-1.5 border-t border-slate-100">
                  <Link
                    to="/explanation"
                    className="text-xs font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-1"
                  >
                    View SHAP Drivers <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 3. Quick Action Launchpad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Link
              to="/assessments/diabetes"
              className="p-3.5 rounded-xl bg-white border border-slate-200/90 hover:border-slate-300 hover:shadow-2xs transition-all flex items-center gap-3 group"
            >
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900">Diabetes Screening</div>
                <div className="text-[11px] text-slate-500">Glycemic & BP markers</div>
              </div>
            </Link>

            <Link
              to="/assessments/heart"
              className="p-3.5 rounded-xl bg-white border border-slate-200/90 hover:border-slate-300 hover:shadow-2xs transition-all flex items-center gap-3 group"
            >
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                <HeartPulse className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900">Cardiovascular</div>
                <div className="text-[11px] text-slate-500">ECG, Lipids & Stress</div>
              </div>
            </Link>

            <Link
              to="/explanation"
              className="p-3.5 rounded-xl bg-white border border-slate-200/90 hover:border-slate-300 hover:shadow-2xs transition-all flex items-center gap-3 group"
            >
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900">AI Reasoning (SHAP)</div>
                <div className="text-[11px] text-slate-500">Additive factor breakdown</div>
              </div>
            </Link>

            <Link
              to="/reports"
              className="p-3.5 rounded-xl bg-white border border-slate-200/90 hover:border-slate-300 hover:shadow-2xs transition-all flex items-center gap-3 group"
            >
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900">Clinical Reports</div>
                <div className="text-[11px] text-slate-500">Standardized summaries</div>
              </div>
            </Link>
          </div>

          {/* 4. Longitudinal Trajectory Chart */}
          <Card className="bg-white border-slate-200 shadow-2xs">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Longitudinal Risk Trajectory
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Time-series tracking of calibrated risk estimates across clinical assessments.
                </CardDescription>
              </div>
              <span className="text-[11px] font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 self-start sm:self-center">
                Calibrated Probabilities
              </span>
            </CardHeader>
            <CardContent className="pt-4">
              <TrendChart data={trends} />
            </CardContent>
          </Card>

          {/* 5. Recent Assessments Table / Empty State */}
          <Card className="bg-white border-slate-200 shadow-2xs">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Recent Screenings</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Review latest biometric evaluations and primary risk factors.
                </CardDescription>
              </div>
              {assessments.length > 0 && (
                <Link to="/history">
                  <Button variant="ghost" size="sm" rightIcon={<ChevronRight className="w-3.5 h-3.5" />}>
                    View All History ({assessments.length})
                  </Button>
                </Link>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {assessments.length === 0 ? (
                <div className="p-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <Activity className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">No Screenings Recorded Yet</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                      Complete your first clinical risk assessment to generate calibrated predictions and personalized SHAP factor insights.
                    </p>
                  </div>
                  <div className="pt-2 flex items-center justify-center gap-3">
                    <Link to="/assessments/diabetes">
                      <Button size="sm" variant="primary">
                        Diabetes Screening
                      </Button>
                    </Link>
                    <Link to="/assessments/heart">
                      <Button size="sm" variant="outline">
                        Cardiovascular Screening
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-xs text-slate-600">
                    <thead className="bg-slate-50/80 text-slate-600 uppercase font-semibold border-b border-slate-100">
                      <tr>
                        <th className="px-5 py-3">Module</th>
                        <th className="px-5 py-3">Screening Date</th>
                        <th className="px-5 py-3">Calibrated Score</th>
                        <th className="px-5 py-3">Risk Level</th>
                        <th className="px-5 py-3">Primary Factor</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {assessments.slice(0, 5).map((record) => (
                        <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-3.5 font-medium text-slate-900 flex items-center gap-2 flex-wrap">
                            {record.moduleId === 'diabetes' ? (
                              <Activity className="w-4 h-4 text-sky-600 shrink-0" />
                            ) : (
                              <HeartPulse className="w-4 h-4 text-sky-600 shrink-0" />
                            )}
                            <span>{record.moduleName}</span>
                            {record.isDemonstrationData && (
                              <Badge variant="demo" size="sm">DEMO</Badge>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-slate-500 font-mono text-[11px]">
                            {formatDate(record.createdAt)}
                          </td>
                          <td className="px-5 py-3.5 font-mono font-bold text-slate-900 text-sm">
                            {(record.riskScore * 100).toFixed(1)}%
                          </td>
                          <td className="px-5 py-3.5">
                            <RiskBadge level={record.riskLevel} />
                          </td>
                          <td className="px-5 py-3.5 text-slate-600 max-w-[200px] truncate">
                            {record.topRiskFactor}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Link
                                to={
                                  record.moduleId === 'diabetes'
                                    ? '/assessments/diabetes'
                                    : '/assessments/heart'
                                }
                                className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-slate-100 rounded-md transition-colors"
                                title="Recalculate or inspect module"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Link>
                              <Link
                                to="/reports"
                                className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                                title="Clinical Reports"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </Link>
                              <button
                                onClick={(e) => handleDelete(record.id, e)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                                title="Delete record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
