import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Activity, User as UserIcon, LogOut, Menu, X, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { DisclaimerBanner } from '../common/DisclaimerBanner';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-15">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white shadow-2xs group-hover:bg-sky-700 transition-colors">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm sm:text-base text-slate-900 tracking-tight leading-none">
                HealthSync <span className="text-sky-600">AI</span>
              </span>
              <span className="text-[10px] font-medium text-slate-400 tracking-wider uppercase mt-0.5">
                Smart Health Monitoring
              </span>
            </div>
          </Link>

          {/* Center Disclaimer Pill (Desktop) */}
          <div className="hidden lg:flex items-center">
            <DisclaimerBanner compact />
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 text-xs sm:text-sm font-medium">
            <Link
              to="/dashboard"
              className={`px-3 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                isActive('/dashboard')
                  ? 'bg-sky-50 text-sky-700 font-semibold border border-sky-100/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
              }`}
            >
              Dashboard
            </Link>
            <Link
              to="/assessments/diabetes"
              className={`px-3 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                isActive('/assessments/diabetes')
                  ? 'bg-sky-50 text-sky-700 font-semibold border border-sky-100/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
              }`}
            >
              Diabetes
            </Link>
            <Link
              to="/assessments/heart"
              className={`px-3 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                isActive('/assessments/heart')
                  ? 'bg-sky-50 text-sky-700 font-semibold border border-sky-100/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
              }`}
            >
              Cardiovascular
            </Link>
            <Link
              to="/explanation"
              className={`px-3 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                isActive('/explanation')
                  ? 'bg-sky-50 text-sky-700 font-semibold border border-sky-100/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
              }`}
            >
              AI Reasoning
            </Link>
            <Link
              to="/reports"
              className={`px-3 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                isActive('/reports')
                  ? 'bg-sky-50 text-sky-700 font-semibold border border-sky-100/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
              }`}
            >
              Reports
            </Link>
            <Link
              to="/about"
              className={`px-3 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                isActive('/about')
                  ? 'bg-sky-50 text-sky-700 font-semibold border border-sky-100/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
              }`}
            >
              About
            </Link>
          </nav>

          {/* User Auth Section */}
          <div className="hidden md:flex items-center gap-2">
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <Link
                  to="/profile"
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center">
                    {user?.fullName?.charAt(0) || 'D'}
                  </div>
                  <span className="text-xs font-semibold text-slate-700 max-w-[120px] truncate">
                    {user?.fullName || 'Demo User'}
                  </span>
                </Link>
                <button
                  onClick={async () => {
                    await logout();
                    navigate('/login');
                  }}
                  title="Sign Out"
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-2xs transition-colors"
                >
                  Register
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu trigger */}
          <div className="flex md:hidden items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-2 shadow-lg">
          <div className="space-y-1">
            <Link
              to="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isActive('/dashboard') ? 'bg-sky-50 text-sky-700 font-semibold' : 'text-slate-800 hover:bg-slate-50'
              }`}
            >
              Dashboard <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>
            <Link
              to="/assessments/diabetes"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isActive('/assessments/diabetes') ? 'bg-sky-50 text-sky-700 font-semibold' : 'text-slate-800 hover:bg-slate-50'
              }`}
            >
              Diabetes Screening <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>
            <Link
              to="/assessments/heart"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isActive('/assessments/heart') ? 'bg-sky-50 text-sky-700 font-semibold' : 'text-slate-800 hover:bg-slate-50'
              }`}
            >
              Cardiovascular Screening <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>
            <Link
              to="/history"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isActive('/history') ? 'bg-sky-50 text-sky-700 font-semibold' : 'text-slate-800 hover:bg-slate-50'
              }`}
            >
              History <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>
            <Link
              to="/explanation"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isActive('/explanation') ? 'bg-sky-50 text-sky-700 font-semibold' : 'text-slate-800 hover:bg-slate-50'
              }`}
            >
              AI Reasoning <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>
            <Link
              to="/reports"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isActive('/reports') ? 'bg-sky-50 text-sky-700 font-semibold' : 'text-slate-800 hover:bg-slate-50'
              }`}
            >
              Reports <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>
            <Link
              to="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isActive('/profile') ? 'bg-sky-50 text-sky-700 font-semibold' : 'text-slate-800 hover:bg-slate-50'
              }`}
            >
              Profile & Privacy <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>
            <Link
              to="/about"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isActive('/about') ? 'bg-sky-50 text-sky-700 font-semibold' : 'text-slate-800 hover:bg-slate-50'
              }`}
            >
              About & Disclaimer <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>
          </div>

          <div className="pt-3 border-t border-slate-100">
            {isAuthenticated ? (
              <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-800">{user?.fullName}</span>
                </div>
                <button
                  onClick={async () => {
                    await logout();
                    setMobileMenuOpen(false);
                    navigate('/login');
                  }}
                  className="text-xs text-rose-600 font-semibold"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center py-2 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
