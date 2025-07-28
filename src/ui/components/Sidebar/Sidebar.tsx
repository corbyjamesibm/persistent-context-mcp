/**
 * Sidebar component for navigation
 * Uses IBM Carbon Design System
 */

import React from 'react';
import { useLocation } from 'react-router-dom';
import {
  SideNav,
  SideNavItems,
  SideNavLink,
  SideNavMenu,
  SideNavMenuItem,
} from '@carbon/react';
import {
  Dashboard,
  Document,
  Template,
  Network_3,
  Analytics,
  Settings,
  Search,
  Add,
} from '@carbon/react/icons';

export const Sidebar: React.FC = () => {
  const location = useLocation();

  return (
    <SideNav
      isFixedNav
      expanded
      isChildOfHeader={false}
      aria-label="Side navigation"
    >
      <SideNavItems>
        <SideNavLink
          renderIcon={Dashboard}
          href="/"
          isActive={location.pathname === '/'}
        >
          Dashboard
        </SideNavLink>
        
        <SideNavMenu renderIcon={Document} title="Contexts" isActive={location.pathname.startsWith('/contexts')}>
          <SideNavMenuItem href="/contexts">All Contexts</SideNavMenuItem>
          <SideNavMenuItem href="/contexts/new">Create New</SideNavMenuItem>
          <SideNavMenuItem href="/contexts/search">Search</SideNavMenuItem>
        </SideNavMenu>

        <SideNavMenu renderIcon={Template} title="Templates" isActive={location.pathname.startsWith('/templates')}>
          <SideNavMenuItem href="/templates">Browse Templates</SideNavMenuItem>
          <SideNavMenuItem href="/templates/new">Create Template</SideNavMenuItem>
        </SideNavMenu>

        <SideNavLink
          renderIcon={Network_3}
          href="/graph"
          isActive={location.pathname === '/graph'}
        >
          Graph View
        </SideNavLink>

        <SideNavLink
          renderIcon={Analytics}
          href="/analytics"
          isActive={location.pathname === '/analytics'}
        >
          Analytics
        </SideNavLink>

        <SideNavLink
          renderIcon={Settings}
          href="/settings"
          isActive={location.pathname === '/settings'}
        >
          Settings
        </SideNavLink>
      </SideNavItems>
    </SideNav>
  );
};