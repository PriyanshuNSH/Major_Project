import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  History,
  Activity,
  HeartPulse,
  Search,
  Trash2,
  Eye,
  Download,
  AlertCircle,
  Plus,
  ChevronDown,
} from 'lucide-react';
import { assessmentService } from '../services/assessmentService';
import { AssessmentRecord, AssessmentResult } from '../types';
import { Card, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge, RiskBadge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { DisclaimerBanner } from '../components/common/DisclaimerBanner';
import { DemoModeBanner, PROTOTYPE_DEMO_DISCLAIMER } from '../components/common/DemoModeBanner';
import { RiskGauge } from '../components/visual/RiskGauge';
import { ShapWaterfallBar } from '../components/visual/ShapWaterfallBar';
import { formatDate } from '../utils/formatters';

export const HistoryPage: React.FC = () => {
  const [records, setRecords] = useState<AssessmentRecord[]>([]);
  const [selectedModule, setSelectedModule] = useState<string>('ALL');
  const [selectedRisk, setSelectedRisk] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal inspection
  const [activeModalRecord, setActiveModalRecord] = useState<AssessmentResult | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await assessmentService.getAssessmentHistory();
      setRecords(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this assessment record?')) {
      await assessmentService.deleteAssessment(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const handleViewDetails = async (id: string) => {
    const details = await assessmentService.getAssessmentById(id);
    if (details) {
      setActiveModalRecord(details);
      setIsModalOpen(true);
    }
  };

  const filteredRecords = records.filter((rec) => {
    if (selectedModule !== 'ALL' && rec.moduleId !== selectedModule) return false;
    if (selectedRisk !== 'ALL' && rec.riskLevel !== selectedRisk) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchesName = rec.moduleName.toLowerCase().includes(term);
      const matchesFactor = rec.topRiskFactor.toLowerCase().includes(term);
      if (!matchesName && !matchesFactor) return false;
    }
    return true;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center font-bold">
              <History className="w-5 h-5 text-slate-700" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Assessment History
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Audit-traceable longitudinal archive of clinical risk screenings.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {records.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="text-slate-600 hover:text-rose-600 hover:border-rose-300"
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => {
                if (window.confirm('Clear all assessment history and reset to an empty state?')) {
                  assessmentService.clearHistory();
                  setRecords([]);
                }
              }}
            >
              Reset Archive
            </Button>
          )}
          <Link to="/assessments/diabetes">
            <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />}>
              Diabetes Screen
            </Button>
          </Link>
          <Link to="/assessments/heart">
            <Button size="sm" variant="secondary" leftIcon={<Plus className="w-3.5 h-3.5" />}>
              Cardiovascular Screen
            </Button>
          </Link>
        </div>
      </div>

      <DemoModeBanner />
      <DisclaimerBanner compact />

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72 flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by biomarker or module..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 transition-all shadow-2xs hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex items-center w-full sm:w-auto">
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="w-full appearance-none pl-3.5 pr-8 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-700 transition-all shadow-2xs hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600 cursor-pointer"
            >
              <option value="ALL">All Modules</option>
              <option value="diabetes">Diabetes Only</option>
              <option value="heart_disease">Cardiovascular Only</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
          </div>

          <div className="relative flex items-center w-full sm:w-auto">
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="w-full appearance-none pl-3.5 pr-8 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-700 transition-all shadow-2xs hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600 cursor-pointer"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="LOW">Low Risk</option>
              <option value="MODERATE">Moderate Risk</option>
              <option value="HIGH">High Risk</option>
              <option value="CRITICAL">Critical Risk</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Records Table or Empty State */}
      <Card>
        <CardContent className="p-0">
          {filteredRecords.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5">Module</th>
                    <th className="px-6 py-3.5">Assessment Date</th>
                    <th className="px-6 py-3.5">Calibrated Probability</th>
                    <th className="px-6 py-3.5">Risk Tier</th>
                    <th className="px-6 py-3.5">Primary Factor</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map((record) => (
                    <tr
                      key={record.id}
                      onClick={() => handleViewDetails(record.id)}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 font-semibold text-slate-900 flex items-center gap-2">
                        {record.moduleId === 'diabetes' ? (
                          <Activity className="w-4 h-4 text-sky-600 shrink-0" />
                        ) : (
                          <HeartPulse className="w-4 h-4 text-teal-600 shrink-0" />
                        )}
                        <span>{record.moduleName}</span>
                        {record.isDemonstrationData && (
                          <Badge variant="demo" size="sm">DEMO</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500">{formatDate(record.createdAt)}</td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-900">
                        {(record.riskScore * 100).toFixed(1)}%
                      </td>
                      <td className="px-6 py-4">
                        <RiskBadge level={record.riskLevel} />
                      </td>
                      <td className="px-6 py-4 text-slate-700 max-w-[220px] truncate">
                        {record.topRiskFactor}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleViewDetails(record.id)}
                            className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                            title="Inspect SHAP Breakdown"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <Link
                            to="/reports"
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Download Clinical PDF"
                          >
                            <Download className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={(e) => handleDelete(record.id, e)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No Assessment Records Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                No screenings match your current filter criteria or no evaluations have been completed yet.
              </p>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <Link to="/assessments/diabetes">
                  <Button variant="primary" size="sm">
                    Perform Diabetes Screening
                  </Button>
                </Link>
                <Link to="/assessments/heart">
                  <Button variant="outline" size="sm">
                    Cardiovascular Screening
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-slate-600 border-slate-300"
                  onClick={() => {
                    assessmentService.loadDemoData();
                    loadHistory();
                  }}
                >
                  Load Demo Fixtures (Preview Only)
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Detailed Inspection View */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={activeModalRecord?.moduleName || 'Assessment Details'}
        maxWidth="xl"
      >
        {activeModalRecord && (
          <div className="space-y-6">
            {activeModalRecord.isDemonstrationData && (
              <DemoModeBanner message={activeModalRecord.demonstrationNotice || PROTOTYPE_DEMO_DISCLAIMER} />
            )}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="space-y-1">
                <span className="text-xs font-mono text-slate-400">ID: {activeModalRecord.id}</span>
                <div className="flex items-center gap-2">
                  <RiskBadge level={activeModalRecord.riskLevel} />
                  <span className="text-xs font-semibold text-slate-700">
                    Calibrated Score: {(activeModalRecord.riskScore * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
              <RiskGauge
                score={activeModalRecord.riskScore}
                riskLevel={activeModalRecord.riskLevel}
                confidenceInterval={activeModalRecord.confidenceInterval}
                size="sm"
              />
            </div>

            <div>
              <ShapWaterfallBar
                drivers={activeModalRecord.drivers}
                baseExpectedRisk={activeModalRecord.baseExpectedRisk}
              />
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Lifestyle & Clinical Recommendations
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-700">
                {activeModalRecord.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-600 mt-1.5 shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <span className="text-[11px] text-slate-500 font-mono">
                {formatDate(activeModalRecord.createdAt)}
              </span>
              <Link to="/reports" onClick={() => setIsModalOpen(false)}>
                <Button size="sm" variant="navy" leftIcon={<Download className="w-3.5 h-3.5" />}>
                  Download PDF Report
                </Button>
              </Link>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
