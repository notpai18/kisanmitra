/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { NotificationProvider } from './contexts/NotificationContext';
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
const GroupListings = React.lazy(() => import('./pages/GroupListings'));
const VillageAgent = React.lazy(() => import('./pages/VillageAgent'));
const InputStore = React.lazy(() => import('./pages/InputStore'));
const CorporateContracts = React.lazy(() => import('./pages/CorporateContracts'));
const DeveloperAdmin = React.lazy(() => import('./pages/DeveloperAdmin'));
const DigitalKhata = React.lazy(() => import('./pages/DigitalKhata'));
const LoadBoard = React.lazy(() => import('./pages/LoadBoard'));
const TransporterDashboard = React.lazy(() => import('./pages/TransporterDashboard'));
const StorageHub = React.lazy(() => import('./pages/StorageHub'));
const WarehouseDashboard = React.lazy(() => import('./pages/WarehouseDashboard'));
const DigitalVault = React.lazy(() => import('./pages/DigitalVault'));

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <NotificationProvider>
          <CartProvider>
          <OnboardingModal />
          <Router>
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/role-selection" element={<RoleSelection />} />
                <Route path="/developer" element={<DeveloperAdmin />} />

                <Route element={<Layout />}>
                  <Route path="/dashboard" element={<RoleBasedRoute element={<Dashboard />} allowedRoles={["farmer", "buyer", "village_agent"]} />} />
                  <Route path="/transporter-dashboard" element={<RoleBasedRoute element={<TransporterDashboard />} allowedRoles={["transporter"]} />} />
                  <Route path="/load-board" element={<RoleBasedRoute element={<LoadBoard />} allowedRoles={["transporter"]} />} />
                  <Route path="/storage-hub" element={<RoleBasedRoute element={<StorageHub />} allowedRoles={["farmer", "village_agent"]} />} />
                  <Route path="/warehouse-dashboard" element={<RoleBasedRoute element={<WarehouseDashboard />} allowedRoles={["warehouse_owner"]} />} />
                  <Route path="/vault" element={<RoleBasedRoute element={<DigitalVault />} allowedRoles={["farmer", "village_agent"]} />} />
                  <Route path="/advisory" element={<RoleBasedRoute element={<Advisory />} allowedRoles={["farmer", "village_agent"]} />} />
                  <Route path="/crop-doctor" element={<RoleBasedRoute element={<CropDoctor />} allowedRoles={["farmer", "village_agent"]} />} />
                  <Route path="/market" element={<Market />} />
                  <Route path="/insights" element={<RoleBasedRoute element={<Insights />} allowedRoles={["buyer", "village_agent"]} />} />
                  <Route path="/schemes" element={<RoleBasedRoute element={<Schemes />} allowedRoles={["farmer", "village_agent"]} />} />
                  <Route path="/group-listings" element={<RoleBasedRoute element={<GroupListings />} allowedRoles={["farmer", "seller", "village_agent"]} />} />
                  <Route path="/corporate-contracts" element={<RoleBasedRoute element={<CorporateContracts />} allowedRoles={["buyer", "village_agent"]} />} />
                  <Route path="/khata" element={<DigitalKhata />} />
                  <Route path="/input-store" element={<InputStore />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/agent/farmers" element={<RoleBasedRoute element={<VillageAgent />} allowedRoles={["village_agent"]} />} />
                </Route>
              </Routes>
            </Suspense>
          </Router>
        </CartProvider>
        </NotificationProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
