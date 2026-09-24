import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import GuardedRoute from './components/GuardedRoute';
import DemoCriticalPage from './pages/DemoCriticalPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/dashboard"
          element={
            <GuardedRoute>
              <DashboardPage />
            </GuardedRoute>
          }
        />

        <Route
          path="/demo"
          element={
            <GuardedRoute>
              <DemoCriticalPage />
            </GuardedRoute>
          }
        />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
