import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';

// 11 Core Pages
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { DiabetesAssessmentPage } from './pages/DiabetesAssessmentPage';
import { HeartAssessmentPage } from './pages/HeartAssessmentPage';
import { HistoryPage } from './pages/HistoryPage';
import { ExplanationPage } from './pages/ExplanationPage';
import { ReportsPage } from './pages/ReportsPage';
import { ProfilePage } from './pages/ProfilePage';
import { AboutPage } from './pages/AboutPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            {/* 1. Landing Page */}
            <Route path="/" element={<LandingPage />} />

            {/* 2. Login Page */}
            <Route path="/login" element={<LoginPage />} />

            {/* 3. Register Page */}
            <Route path="/register" element={<RegisterPage />} />

            {/* 4. Dashboard */}
            <Route path="/dashboard" element={<DashboardPage />} />

            {/* 5. Diabetes Assessment */}
            <Route path="/assessments/diabetes" element={<DiabetesAssessmentPage />} />

            {/* 6. Heart Disease Assessment */}
            <Route path="/assessments/heart" element={<HeartAssessmentPage />} />

            {/* 7. Health History */}
            <Route path="/history" element={<HistoryPage />} />

            {/* 8. AI Explanation & SHAP */}
            <Route path="/explanation" element={<ExplanationPage />} />

            {/* 9. Clinical Reports */}
            <Route path="/reports" element={<ReportsPage />} />

            {/* 10. Profile & Privacy */}
            <Route path="/profile" element={<ProfilePage />} />

            {/* 11. About & Disclaimer */}
            <Route path="/about" element={<AboutPage />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
