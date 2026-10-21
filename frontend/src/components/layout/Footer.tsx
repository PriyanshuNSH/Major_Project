import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, ShieldCheck } from 'lucide-react';
import { MANDATORY_MEDICAL_DISCLAIMER } from '../../utils/formatters';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white text-slate-500 border-t border-slate-200/80 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand info */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-600 flex items-center justify-center font-bold text-white">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-slate-900 text-sm">HealthSync AI</span>
            </div>
            <p className="text-slate-500 leading-relaxed text-xs">
              AI-Enabled Smart Health Monitoring System. Engineering preventative healthcare analytics through explainable machine learning.
            </p>
            <div className="text-[11px] text-slate-400 font-mono">
              B.Tech CSE Major Project • v1.0.0-MVP
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-slate-900 font-semibold mb-3">Screening Modules</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/assessments/diabetes" className="hover:text-slate-900 transition-colors">
                  Diabetes Screening
                </Link>
              </li>
              <li>
                <Link to="/assessments/heart" className="hover:text-slate-900 transition-colors">
                  Cardiovascular Screening
                </Link>
              </li>
              <li>
                <Link to="/explanation" className="hover:text-slate-900 transition-colors">
                  SHAP Reasoning Engine
                </Link>
              </li>
              <li>
                <Link to="/reports" className="hover:text-slate-900 transition-colors">
                  Clinical PDF Reports
                </Link>
              </li>
            </ul>
          </div>

          {/* Platform & Governance */}
          <div>
            <h4 className="text-slate-900 font-semibold mb-3">Governance & Privacy</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/about" className="hover:text-slate-900 transition-colors">
                  About & Medical Scope
                </Link>
              </li>
              <li>
                <Link to="/profile" className="hover:text-slate-900 transition-colors">
                  GDPR Subject Rights
                </Link>
              </li>
              <li>
                <span className="inline-flex items-center gap-1 text-slate-700">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-600" /> PostgreSQL RLS Protected
                </span>
              </li>
            </ul>
          </div>

          {/* Clinical Disclaimer */}
          <div className="space-y-2">
            <h4 className="text-slate-900 font-semibold">Regulatory Statement</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
              {MANDATORY_MEDICAL_DISCLAIMER}
            </p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
          <p>© {new Date().getFullYear()} HealthSync AI. Academic Major Project.</p>
          <span>Evidence-based preventative health analytics</span>
        </div>
      </div>
    </footer>
  );
};
