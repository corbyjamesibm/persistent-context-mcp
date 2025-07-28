import React, { ReactNode } from 'react';
import {
  Header,
  HeaderContainer,
  HeaderName,
  HeaderNavigation,
  HeaderMenu,
  HeaderMenuItem,
  HeaderGlobalBar,
  HeaderGlobalAction,
  SideNav,
  SideNavItems,
  SideNavLink,
  SideNavMenu,
  SideNavMenuItem,
  Content,
  Theme,
} from '@carbon/react';
import {
  Dashboard,
  Folder,
  User,
  Settings,
  Logout,
  Notification,
  UserAvatar,
  Light,
  Moon,
  Analytics,
} from '@carbon/icons-react';

import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useNotification } from '../../hooks/useNotification';

interface DashboardLayoutProps {
  children: ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const { isConnected, connectionStatus } = useWebSocket();
  const { showInfo } = useNotification();

  const handleLogout = async () => {
    try {
      await logout();
      showInfo('Logged out', 'You have been successfully logged out');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Notification size={20} style={{ color: '#42be65' }} />;
      case 'connecting':
        return <Notification size={20} style={{ color: '#f1c21b' }} />;
      case 'error':
        return <Notification size={20} style={{ color: '#da1e28' }} />;
      default:
        return <Notification size={20} style={{ color: '#525252' }} />;
    }
  };

  return (
    <Theme theme={theme}>
      <div className="dashboard-layout">
        <HeaderContainer
          render={({ isSideNavExpanded, onClickSideNavExpand }) => (
            <>
              <Header aria-label="Context Store Admin Dashboard">
                <HeaderName href="/" prefix="Context Store">
                  Admin Dashboard
                </HeaderName>
                <HeaderNavigation aria-label="Main Navigation">
                  <HeaderMenu aria-label="System" menuLinkName="System">
                    <HeaderMenuItem href="/system/health">Health Monitor</HeaderMenuItem>
                    <HeaderMenuItem href="/system/performance">Performance</HeaderMenuItem>
                  </HeaderMenu>
                  <HeaderMenu aria-label="Data" menuLinkName="Data">
                    <HeaderMenuItem href="/contexts">Context Management</HeaderMenuItem>
                    <HeaderMenuItem href="/data/migration">Data Migration</HeaderMenuItem>
                  </HeaderMenu>
                  <HeaderMenu aria-label="Users" menuLinkName="Users">
                    <HeaderMenuItem href="/users">User Management</HeaderMenuItem>
                    <HeaderMenuItem href="/collaboration">Collaboration</HeaderMenuItem>
                  </HeaderMenu>
                </HeaderNavigation>
                <HeaderGlobalBar>
                  <HeaderGlobalAction
                    aria-label="Connection Status"
                    tooltipAlignment="end"
                    onClick={() => {
                      showInfo(
                        'Connection Status',
                        `Real-time connection is ${connectionStatus}`
                      );
                    }}
                  >
                    {getConnectionStatusIcon()}
                  </HeaderGlobalAction>
                  <HeaderGlobalAction
                    aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                    tooltipAlignment="end"
                    onClick={toggleTheme}
                  >
                    {isDark ? <Light size={20} /> : <Moon size={20} />}
                  </HeaderGlobalAction>
                  <HeaderGlobalAction
                    aria-label="User Profile"
                    tooltipAlignment="end"
                  >
                    <UserAvatar size={20} />
                  </HeaderGlobalAction>
                  <HeaderGlobalAction
                    aria-label="Logout"
                    tooltipAlignment="end"
                    onClick={handleLogout}
                  >
                    <Logout size={20} />
                  </HeaderGlobalAction>
                </HeaderGlobalBar>
                <SideNav
                  aria-label="Side navigation"
                  expanded={isSideNavExpanded}
                  onToggle={onClickSideNavExpand}
                  isPersistent={false}
                >
                  <SideNavItems>
                    <SideNavLink
                      renderIcon={Dashboard}
                      href="/"
                      isActive={window.location.pathname === '/'}
                    >
                      Dashboard
                    </SideNavLink>
                    
                    <SideNavMenu renderIcon={Analytics} title="System">
                      <SideNavMenuItem href="/system/health">
                        Health Monitor
                      </SideNavMenuItem>
                      <SideNavMenuItem href="/system/performance">
                        Performance
                      </SideNavMenuItem>
                    </SideNavMenu>

                    <SideNavMenu renderIcon={Folder} title="Data Management">
                      <SideNavMenuItem href="/contexts">
                        Context Management
                      </SideNavMenuItem>
                      <SideNavMenuItem href="/data/migration">
                        Data Migration
                      </SideNavMenuItem>
                    </SideNavMenu>

                    <SideNavMenu renderIcon={User} title="User Management">
                      <SideNavMenuItem href="/users">
                        Users
                      </SideNavMenuItem>
                      <SideNavMenuItem href="/collaboration">
                        Collaboration
                      </SideNavMenuItem>
                    </SideNavMenu>

                    <SideNavLink
                      renderIcon={Settings}
                      href="/settings"
                      isActive={window.location.pathname === '/settings'}
                    >
                      Settings
                    </SideNavLink>
                  </SideNavItems>
                </SideNav>
              </Header>
              <Content id="main-content">
                <div className="dashboard-content">
                  {children}
                </div>
              </Content>
            </>
          )}
        />
      </div>
    </Theme>
  );
};