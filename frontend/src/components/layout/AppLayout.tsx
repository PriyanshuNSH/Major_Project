import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';

export const AppLayout: React.FC = () => {
  const location = useLocation();

  // Pages that don't need the persistent left sidebar
  const isFullWidthPage =
    location.pathname === '/' ||
    location.pathname === '/login' ||
    location.pathname === '/register';

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-900 font-sans antialiased">
      <Navbar />

      <div className="flex-1 flex w-full">
        {!isFullWidthPage && (
          <div className="hidden md:block">
            <Sidebar />
          </div>
        )}
        <main className="flex-1 flex flex-col w-full overflow-x-hidden min-h-[calc(100vh-3.75rem)]">
          <Outlet />
        </main>
      </div>

      <Footer />
    </div>
  );
};
