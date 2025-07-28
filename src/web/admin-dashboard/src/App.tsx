import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Context Providers
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { WebSocketProvider } from './contexts/WebSocketContext';

// Layouts
import { DashboardLayout } from './components/layout/DashboardLayout';
import { LoginLayout } from './components/layout/LoginLayout';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { SystemHealthPage } from './pages/SystemHealthPage';
import { ContextManagementPage } from './pages/ContextManagementPage';
import { LoginPage } from './pages/LoginPage';

// Route Protection Component
import { ProtectedRoute } from './components/auth/ProtectedRoute';

// Styles
import './styles/index.scss';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
    mutations: {
      retry: 1,
    },
  },
});

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <WebSocketProvider>
              <Router>
                <div className="app">
                  <Routes>
                    {/* Public Routes */}
                    <Route
                      path="/login"
                      element={
                        <LoginLayout>
                          <LoginPage />
                        </LoginLayout>
                      }
                    />

                    {/* Protected Routes */}
                    <Route
                      path="/"
                      element={
                        <ProtectedRoute>
                          <DashboardLayout>
                            <DashboardPage />
                          </DashboardLayout>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/system/health"
                      element={
                        <ProtectedRoute>
                          <DashboardLayout>
                            <SystemHealthPage />
                          </DashboardLayout>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/system/performance"
                      element={
                        <ProtectedRoute>
                          <DashboardLayout>
                            <div className="coming-soon">
                              <h2>Performance Monitoring</h2>
                              <p>Coming soon...</p>
                            </div>
                          </DashboardLayout>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/contexts"
                      element={
                        <ProtectedRoute>
                          <DashboardLayout>
                            <ContextManagementPage />
                          </DashboardLayout>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/data/migration"
                      element={
                        <ProtectedRoute>
                          <DashboardLayout>
                            <div className="coming-soon">
                              <h2>Data Migration</h2>
                              <p>Coming soon...</p>
                            </div>
                          </DashboardLayout>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/users"
                      element={
                        <ProtectedRoute>
                          <DashboardLayout>
                            <div className="coming-soon">
                              <h2>User Management</h2>
                              <p>Coming soon...</p>
                            </div>
                          </DashboardLayout>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/collaboration"
                      element={
                        <ProtectedRoute>
                          <DashboardLayout>
                            <div className="coming-soon">
                              <h2>Collaboration</h2>
                              <p>Coming soon...</p>
                            </div>
                          </DashboardLayout>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/settings"
                      element={
                        <ProtectedRoute>
                          <DashboardLayout>
                            <div className="coming-soon">
                              <h2>Settings</h2>
                              <p>Coming soon...</p>
                            </div>
                          </DashboardLayout>
                        </ProtectedRoute>
                      }
                    />

                    {/* Catch all route - redirect to dashboard */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </div>
              </Router>
            </WebSocketProvider>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
      
      {/* React Query Devtools - only shows in development */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
};

export default App;