import React, { useState, useEffect } from 'react';
import {
  Form,
  Stack,
  TextInput,
  PasswordInput,
  Button,
  InlineNotification,
  Link,
} from '@carbon/react';
import { Login, UserAvatar } from '@carbon/icons-react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  const { login, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    }
  };

  if (isLoading) {
    return <LoadingSpinner size="lg" description="Logging in..." withOverlay />;
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-icon">
            <UserAvatar size={48} />
          </div>
          <h1 className="login-title">Context Store Admin</h1>
          <p className="login-subtitle">Sign in to access the dashboard</p>
        </div>

        {error && (
          <InlineNotification
            kind="error"
            title="Authentication Error"
            subtitle={error}
            hideCloseButton
            lowContrast
          />
        )}

        <Form onSubmit={handleSubmit} className="login-form">
          <Stack gap={5}>
            <TextInput
              id="email"
              labelText="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              autoComplete="email"
              required
              disabled={isLoading}
            />

            <PasswordInput
              id="password"
              labelText="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              disabled={isLoading}
            />

            <Button
              type="submit"
              kind="primary"
              renderIcon={Login}
              disabled={isLoading || !email || !password}
              size="lg"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </Stack>
        </Form>

        <div className="login-footer">
          <p className="help-text">
            Need help? Contact your system administrator.
          </p>
          <div className="login-links">
            <Link href="#" disabled>
              Forgot password?
            </Link>
            <span className="link-separator">•</span>
            <Link href="#" disabled>
              Request access
            </Link>
          </div>
        </div>
      </div>

      <div className="login-background">
        <div className="background-pattern"></div>
      </div>

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          padding: var(--cds-spacing-06);
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .login-card {
          width: 100%;
          max-width: 400px;
          padding: var(--cds-spacing-08);
          background: var(--cds-layer-01);
          border-radius: 8px;
          box-shadow: 0 12px 48px rgba(0, 0, 0, 0.15);
          border: 1px solid var(--cds-border-subtle-01);
          position: relative;
          z-index: 1;
        }

        .login-header {
          text-align: center;
          margin-bottom: var(--cds-spacing-08);
        }

        .login-icon {
          display: flex;
          justify-content: center;
          margin-bottom: var(--cds-spacing-04);
          color: var(--cds-icon-primary);
        }

        .login-title {
          font-size: 1.75rem;
          font-weight: 600;
          margin: 0 0 var(--cds-spacing-02) 0;
          color: var(--cds-text-primary);
        }

        .login-subtitle {
          color: var(--cds-text-secondary);
          margin: 0;
          font-size: 1rem;
        }

        .login-form {
          margin-bottom: var(--cds-spacing-06);
        }

        .login-footer {
          text-align: center;
          border-top: 1px solid var(--cds-border-subtle-01);
          padding-top: var(--cds-spacing-05);
        }

        .help-text {
          color: var(--cds-text-secondary);
          font-size: 0.875rem;
          margin: 0 0 var(--cds-spacing-04) 0;
        }

        .login-links {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: var(--cds-spacing-03);
          font-size: 0.875rem;
        }

        .link-separator {
          color: var(--cds-text-secondary);
        }

        .login-background {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          overflow: hidden;
        }

        .background-pattern {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: 
            radial-gradient(circle at 25% 25%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 75% 75%, rgba(255, 255, 255, 0.05) 0%, transparent 50%);
          background-size: 400px 400px;
          animation: float 20s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px) translateX(0px);
          }
          33% {
            transform: translateY(-30px) translateX(10px);
          }
          66% {
            transform: translateY(20px) translateX(-10px);
          }
        }

        @media (max-width: 768px) {
          .login-page {
            padding: var(--cds-spacing-04);
          }

          .login-card {
            padding: var(--cds-spacing-06);
          }

          .login-title {
            font-size: 1.5rem;
          }

          .login-links {
            flex-direction: column;
            gap: var(--cds-spacing-02);
          }

          .link-separator {
            display: none;
          }
        }

        /* Dark theme adjustments */
        [data-carbon-theme="g90"] .login-card,
        [data-carbon-theme="g100"] .login-card {
          box-shadow: 0 12px 48px rgba(0, 0, 0, 0.3);
        }

        /* Focus states for accessibility */
        .login-card:focus-within {
          outline: 2px solid var(--cds-focus);
          outline-offset: 2px;
        }

        /* Loading state */
        .login-form:has(button:disabled) {
          opacity: 0.7;
          pointer-events: none;
        }

        /* Error state styling */
        .login-form:has(.cds--inline-notification--error) {
          margin-top: var(--cds-spacing-05);
        }

        /* High contrast mode support */
        @media (prefers-contrast: high) {
          .login-card {
            border-width: 2px;
          }
          
          .login-title {
            font-weight: 700;
          }
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          .background-pattern {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
};