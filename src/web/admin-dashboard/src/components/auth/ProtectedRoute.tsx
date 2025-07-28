import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermissions?: string[];
  fallbackPath?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermissions = [],
  fallbackPath = '/login',
}) => {
  const { user, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner size="lg" description="Authenticating..." withOverlay />;
  }

  if (!isAuthenticated || !user) {
    // Redirect to login page with return url
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  // Check if user has required permissions
  if (requiredPermissions.length > 0) {
    const hasPermissions = requiredPermissions.every(permission =>
      user.permissions?.includes(permission)
    );

    if (!hasPermissions) {
      return (
        <div className="access-denied">
          <div className="access-denied-content">
            <h2>Access Denied</h2>
            <p>You don't have the required permissions to view this page.</p>
            <p>Required permissions: {requiredPermissions.join(', ')}</p>
          </div>
          
          <style jsx>{`
            .access-denied {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              padding: var(--cds-spacing-06);
              background: var(--cds-layer-01);
            }

            .access-denied-content {
              text-align: center;
              max-width: 400px;
            }

            .access-denied-content h2 {
              color: var(--cds-text-primary);
              margin-bottom: var(--cds-spacing-04);
              font-size: 1.5rem;
              font-weight: 600;
            }

            .access-denied-content p {
              color: var(--cds-text-secondary);
              margin-bottom: var(--cds-spacing-03);
              line-height: 1.5;
            }

            .access-denied-content p:last-child {
              font-size: 0.875rem;
              font-style: italic;
            }
          `}</style>
        </div>
      );
    }
  }

  return <>{children}</>;
};