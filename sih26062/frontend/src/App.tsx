import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import GuardedRoute from './components/GuardedRoute';
import DemoCriticalPage from './pages/DemoCriticalPage';
import CargoTraceabilityPage from './pages/CargoTraceabilityPage';
import ForecastPage from './pages/ForecastPage';
import ForecastSummaryPage from './pages/ForecastSummaryPage';
import StowagePlanPage from './pages/StowagePlanPage';
import ManifestListPage from './pages/ManifestListPage';

import TopNav from './components/TopNav';

function Layout({ children }: { children: any }) {
  return (
    <div>
      <TopNav />
      {children}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/dashboard"
          element={
            <GuardedRoute>
              <Layout>
                <DashboardPage />
              </Layout>
            </GuardedRoute>
          }
        />

        <Route
          path="/demo"
          element={
            <GuardedRoute>
              <Layout>
                <DemoCriticalPage />
              </Layout>
            </GuardedRoute>
          }
        />

        <Route
          path="/forecast"
          element={
            <GuardedRoute>
              <Layout>
                <ForecastPage />
              </Layout>
            </GuardedRoute>
          }
        />

        <Route
          path="/forecast/summary"
          element={
            <GuardedRoute>
              <Layout>
                <ForecastSummaryPage />
              </Layout>
            </GuardedRoute>
          }
        />

        <Route
          path="/cargo/:cargoId"
          element={
            <GuardedRoute>
              <Layout>
                <CargoTraceabilityPage />
              </Layout>
            </GuardedRoute>
          }
        />

        <Route
          path="/manifests"
          element={
            <GuardedRoute>
              <Layout>
                <ManifestListPage />
              </Layout>
            </GuardedRoute>
          }
        />

        <Route
          path="/manifests/:manifestId/stowage"
          element={
            <GuardedRoute>
              <Layout>
                <StowagePlanPage />
              </Layout>
            </GuardedRoute>
          }
        />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
