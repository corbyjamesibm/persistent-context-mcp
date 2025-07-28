/**
 * Main React Application Component
 * Implements IBM Carbon Design System with context management interface
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Content, Theme } from '@carbon/react';
import { Header } from './components/Header/Header';
import { Sidebar } from './components/Sidebar/Sidebar';
import { HomePage } from './pages/HomePage';
import { ContextsPage } from './pages/ContextsPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { GraphPage } from './pages/GraphPage';
import { AnalyticsPage } from './pages/AnalyticsPage';

function App() {
  return (
    <Theme theme="white">
      <div className="app">
        <Header />
        <div className="app-content">
          <Sidebar />
          <Content className="main-content">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/contexts" element={<ContextsPage />} />
              <Route path="/templates" element={<TemplatesPage />} />
              <Route path="/graph" element={<GraphPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
            </Routes>
          </Content>
        </div>
      </div>
    </Theme>
  );
}

export default App;