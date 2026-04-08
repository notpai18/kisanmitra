/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import PageSkeleton from './components/PageSkeleton';
import RoleBasedRoute from './components/RoleBasedRoute';

import { CartProvider } from './contexts/CartContext';
import OnboardingModal from './components/OnboardingModal';

const Landing = React.lazy(() => import('./pages/Landing'));
const RoleSelection = React.lazy(() => import('./pages/RoleSelection'));
const Layout = React.lazy(() => import('./components/Layout'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Advisory = React.lazy(() => import('./pages/Advisory'));
const CropDoctor = React.lazy(() => import('./pages/CropDoctor'));
const Market = React.lazy(() => import('./pages/Market'));
const Insights = React.lazy(() => import('./pages/Insights'));
const Schemes = React.lazy(() => import('./pages/Schemes'));
const Profile = React.lazy(() => import('./pages/Profile'));

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <CartProvider>
          <OnboardingModal />
          <Router>
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/role-selection" element={<RoleSelection />} />

                <Route element={<Layout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/advisory" element={<RoleBasedRoute element={<Advisory />} allowedRoles={["farmer"]} />} />
                  <Route path="/crop-doctor" element={<RoleBasedRoute element={<CropDoctor />} allowedRoles={["farmer"]} />} />
                  <Route path="/market" element={<Market />} />
                  <Route path="/insights" element={<RoleBasedRoute element={<Insights />} allowedRoles={["buyer"]} />} />
                  <Route path="/schemes" element={<RoleBasedRoute element={<Schemes />} allowedRoles={["farmer"]} />} />
                  <Route path="/profile" element={<Profile />} />
                </Route>
              </Routes>
            </Suspense>
          </Router>
        </CartProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
