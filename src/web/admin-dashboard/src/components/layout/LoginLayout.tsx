import React, { ReactNode } from 'react';
import { Grid, Column, Theme } from '@carbon/react';
import { useTheme } from '../../hooks/useTheme';

interface LoginLayoutProps {
  children: ReactNode;
}

export const LoginLayout: React.FC<LoginLayoutProps> = ({ children }) => {
  const { theme } = useTheme();

  return (
    <Theme theme={theme}>
      <div className="login-layout">
        <Grid className="login-grid">
          <Column lg={16} md={8} sm={4} className="login-column">
            <div className="login-container">
              {children}
            </div>
          </Column>
        </Grid>
        
        <style jsx>{`
          .login-layout {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }

          .login-grid {
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
          }

          .login-column {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 80vh;
          }

          .login-container {
            width: 100%;
            max-width: 400px;
            padding: 3rem;
            background: var(--cds-layer-01);
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
            border: 1px solid var(--cds-border-subtle-01);
          }

          @media (max-width: 768px) {
            .login-grid {
              padding: 1rem;
            }

            .login-container {
              padding: 2rem;
              margin: 1rem;
            }
          }
        `}</style>
      </div>
    </Theme>
  );
};