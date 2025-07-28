/**
 * Header component for the Persistent Context Store
 * Uses IBM Carbon Design System
 */

import React from 'react';
import {
  Header as CarbonHeader,
  HeaderName,
  HeaderNavigation,
  HeaderMenuItem,
  HeaderGlobalBar,
  HeaderGlobalAction,
  SkipToContent,
} from '@carbon/react';
import { Search, Settings, UserAvatar } from '@carbon/react/icons';

export const Header: React.FC = () => {
  return (
    <CarbonHeader aria-label="Persistent Context Store">
      <SkipToContent />
      <HeaderName href="/" prefix="AI">
        Context Store
      </HeaderName>
      <HeaderNavigation aria-label="Main Navigation">
        <HeaderMenuItem href="/">Dashboard</HeaderMenuItem>
        <HeaderMenuItem href="/contexts">Contexts</HeaderMenuItem>
        <HeaderMenuItem href="/templates">Templates</HeaderMenuItem>
        <HeaderMenuItem href="/graph">Graph View</HeaderMenuItem>
        <HeaderMenuItem href="/analytics">Analytics</HeaderMenuItem>
      </HeaderNavigation>
      <HeaderGlobalBar>
        <HeaderGlobalAction aria-label="Search" tooltipAlignment="end">
          <Search size={20} />
        </HeaderGlobalAction>
        <HeaderGlobalAction aria-label="Settings" tooltipAlignment="end">
          <Settings size={20} />
        </HeaderGlobalAction>
        <HeaderGlobalAction aria-label="User Profile" tooltipAlignment="end">
          <UserAvatar size={20} />
        </HeaderGlobalAction>
      </HeaderGlobalBar>
    </CarbonHeader>
  );
};