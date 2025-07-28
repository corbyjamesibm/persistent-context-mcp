/**
 * Main React Application Component
 * Implements IBM Carbon Design System with context management interface
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/Layout/MainLayout';
import { HomePage } from './pages/HomePage';
import { ContextsPage } from './pages/ContextsPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { GraphPage } from './pages/GraphPage';
import { AnalyticsPage } from './pages/AnalyticsPage';

function App() {
  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/contexts/*" element={<ContextsPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/graph" element={<GraphPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
      </Routes>
    </MainLayout>
  );
}

export default App;