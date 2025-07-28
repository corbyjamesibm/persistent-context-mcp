/**
 * Main Layout Component with Integrated Context Sidebar
 * Provides responsive layout with context management integration
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Content, Theme } from '@carbon/react';
import { Header } from '../Header/Header';
import { ContextSidebar } from '../ContextSidebar/ContextSidebar';
import './MainLayout.scss';

interface MainLayoutProps {
  children?: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>();
  const [isMobile, setIsMobile] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check if we're on mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
      // Auto-close sidebar on mobile
      if (window.innerWidth <= 768) {
        setSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // Generate or retrieve session ID
    let sessionId = sessionStorage.getItem('currentSessionId');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('currentSessionId', sessionId);
    }
    setCurrentSessionId(sessionId);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev);
    
    // Store preference in localStorage
    localStorage.setItem('sidebarOpen', (!sidebarOpen).toString());
  }, [sidebarOpen]);

  const handleResumeContext = useCallback(async (contextId: string) => {
    try {
      // Fetch the context details
      const response = await fetch(`/api/v1/contexts/${contextId}`);
      const data = await response.json();
      
      if (data.data) {
        // Navigate to context view or update current page
        if (location.pathname !== '/contexts') {
          navigate(`/contexts/${contextId}`);
        }
        
        // Update session storage with current context
        sessionStorage.setItem('currentContextId', contextId);
        
        // Emit custom event for other components to listen
        window.dispatchEvent(new CustomEvent('contextResumed', {
          detail: { contextId, context: data.data }
        }));

        // Close sidebar on mobile after selection
        if (isMobile) {
          setSidebarOpen(false);
        }
      }
    } catch (error) {
      console.error('Failed to resume context:', error);
    }
  }, [navigate, location.pathname, isMobile]);

  const handleCreateContext = useCallback(() => {
    // Navigate to create context page or open create modal
    navigate('/contexts/new');
    
    // Close sidebar on mobile
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [navigate, isMobile]);

  // Close sidebar when clicking outside on mobile
  const handleContentClick = useCallback(() => {
    if (isMobile && sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [isMobile, sidebarOpen]);

  return (
    <Theme theme="g100">
      <div className="main-layout">
        <Header 
          onToggleSidebar={handleToggleSidebar}
          sidebarOpen={sidebarOpen}
        />
        
        <div className="layout-content">
          <ContextSidebar
            isOpen={sidebarOpen}
            onToggle={handleToggleSidebar}
            currentSessionId={currentSessionId}
            onResumeContext={handleResumeContext}
            onCreateContext={handleCreateContext}
            className={isMobile ? 'mobile-sidebar' : ''}
          />
          
          <Content 
            className={`main-content ${sidebarOpen ? 'with-sidebar' : 'full-width'}`}
            onClick={handleContentClick}
          >
            {children || <Outlet />}
          </Content>
        </div>

        {/* Mobile Overlay */}
        {isMobile && sidebarOpen && (
          <div 
            className="mobile-overlay"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>
    </Theme>
  );
};