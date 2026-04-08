import React from 'react';
import Navbar from './Navbar';
import { Sidebar, BottomBar } from './Navigation';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Layout() {
  const { user, userData, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-light">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-forest-900"></div>
      </div>
    );
  }

  if (!user && !userData) {
    return <Navigate to="/" replace />;
  }

  if (user && !userData) {
    return <Navigate to="/role-selection" replace />;
  }

  return (
    <div className="min-h-screen bg-bg-light flex flex-col">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
      <BottomBar />
    </div>
  );
}
