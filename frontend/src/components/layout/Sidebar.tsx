import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  HeartPulse,
  History,
  Sparkles,
  FileText,
  UserCheck,
  HelpCircle,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/assessments/diabetes', label: 'Diabetes Screening', icon: Activity },
    { to: '/assessments/heart', label: 'Cardiovascular', icon: HeartPulse },
    { to: '/history', label: 'History Archive', icon: History },
    { to: '/explanation', label: 'AI Reasoning (SHAP)', icon: Sparkles },
    { to: '/reports', label: 'Clinical Reports', icon: FileText },
    { to: '/profile', label: 'Profile & Privacy', icon: UserCheck },
    { to: '/about', label: 'About & Disclaimer', icon: HelpCircle },
  ];

  const renderNavGroup = (items: typeof navItems) => (
    <nav className="space-y-0.5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `group flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-sky-50 text-sky-700 font-semibold border border-sky-100/90 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-sky-600' : 'text-slate-400 group-hover:text-slate-600'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <aside className="w-60 bg-white shrink-0 flex flex-col justify-between border-r border-slate-200/80 min-h-[calc(100vh-3.75rem)]">
      {/* Navigation Sections */}
      <div className="p-3.5 space-y-5">
        <div>
          <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase px-3 block mb-1.5">
            Screening
          </span>
          {renderNavGroup(navItems.slice(0, 3))}
        </div>

        <div>
          <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase px-3 block mb-1.5">
            Intelligence & Records
          </span>
          {renderNavGroup(navItems.slice(3, 6))}
        </div>

        <div>
          <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase px-3 block mb-1.5">
            Settings & Governance
          </span>
          {renderNavGroup(navItems.slice(6))}
        </div>
      </div>

      {/* User Footer Profile */}
      <div className="p-3 border-t border-slate-100">
        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-[11px] shrink-0">
              {user?.fullName?.charAt(0) || 'D'}
            </div>
            <div className="min-w-0 flex flex-col">
              <span className="text-xs font-semibold text-slate-800 truncate">
                {user?.fullName || 'Demo User'}
              </span>
              <span className="text-[10px] text-slate-400 truncate">
                {user?.email || 'demo@healthsync.ai'}
              </span>
            </div>
          </div>
          <button
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
            title="Sign Out"
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
