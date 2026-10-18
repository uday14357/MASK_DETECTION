import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AppLayout from './layouts/AppLayout';

// Pages
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import LiveDetectionPage from './pages/LiveDetectionPage';
import ImageAnalysisPage from './pages/ImageAnalysisPage';
import CamerasPage from './pages/CamerasPage';
import EventsPage from './pages/EventsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import HealthPage from './pages/HealthPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Homepage with Live Camera Preview */}
          <Route path="/" element={<LandingPage />} />

          {/* Application Studio & Dashboard Routes */}
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/live-detection" element={<LiveDetectionPage />} />
            <Route path="/image-analysis" element={<ImageAnalysisPage />} />
            <Route path="/cameras" element={<CamerasPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/health" element={<HealthPage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
