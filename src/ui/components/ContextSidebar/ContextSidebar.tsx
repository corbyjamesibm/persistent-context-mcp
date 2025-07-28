/**
 * Context Sidebar Integration (US-4531)
 * Provides context panel integrated into main interface for seamless context management
 */

import React, { useState, useEffect } from 'react';
import {
  SideNav,
  SideNavItems,
  Button,
  Search,
  Tile,
  Tag,
  Loading,
  OverflowMenu,
  OverflowMenuItem,
  Modal,
  TextInput,
  TextArea,
  Dropdown,
  FormGroup,
} from '@carbon/react';
import {
  ChevronLeft,
  ChevronRight,
  Add,
  Play,
  Search as SearchIcon,
  OverflowMenuVertical,
  Time,
  Document,
} from '@carbon/react/icons';

interface ContextItem {
  id: string;
  title: string;
  type: string;
  updatedAt: string;
  tokenCount: number;
  tags: string[];
  status: 'active' | 'archived' | 'draft';
}

interface SessionInfo {
  sessionId: string;
  lastActivity: Date;
  contextCount: number;
  hasPendingChanges: boolean;
  lastContextId?: string;
}

interface ContextSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  currentSessionId?: string;
  onResumeContext: (contextId: string) => void;
  onCreateContext: () => void;
  className?: string;
}

export const ContextSidebar: React.FC<ContextSidebarProps> = ({
  isOpen,
  onToggle,
  currentSessionId,
  onResumeContext,
  onCreateContext,
  className = '',
}) => {
  const [contexts, setContexts] = useState<ContextItem[]>([]);
  const [recentSessions, setRecentSessions] = useState<SessionInfo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedContext, setSelectedContext] = useState<ContextItem | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [filteredContexts, setFilteredContexts] = useState<ContextItem[]>([]);

  // Form state for quick context creation
  const [quickCreateForm, setQuickCreateForm] = useState({
    title: '',
    content: '',
    type: 'general',
    tags: '',
  });

  useEffect(() => {
    if (isOpen) {
      fetchRecentContexts();
      fetchRecentSessions();
    }
  }, [isOpen, currentSessionId]);

  useEffect(() => {
    filterContexts();
  }, [contexts, searchTerm]);

  const fetchRecentContexts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/contexts?limit=20&sort=updatedAt');
      const data = await response.json();
      setContexts(data.data || []);
    } catch (error) {
      console.error('Failed to fetch contexts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentSessions = async () => {
    try {
      const response = await fetch('/api/v1/sessions/recent?limit=10');
      const data = await response.json();
      setRecentSessions(data.data || []);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    }
  };

  const filterContexts = () => {
    if (!searchTerm.trim()) {
      setFilteredContexts(contexts);
      return;
    }

    const filtered = contexts.filter(context => 
      context.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      context.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredContexts(filtered);
  };

  const handleResumeContext = async (contextId: string) => {
    try {
      const response = await fetch(`/api/v1/contexts/${contextId}`);
      const data = await response.json();
      
      if (data.data) {
        onResumeContext(contextId);
        setSelectedContext(data.data);
      }
    } catch (error) {
      console.error('Failed to resume context:', error);
    }
  };

  const handleQuickCreate = async () => {
    try {
      const contextData = {
        ...quickCreateForm,
        sessionId: currentSessionId || `session_${Date.now()}`,
        tags: quickCreateForm.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      };

      const response = await fetch('/api/v1/contexts/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contextData),
      });

      const result = await response.json();
      if (result.data?.contextId) {
        setQuickCreateForm({ title: '', content: '', type: 'general', tags: '' });
        setCreateModalOpen(false);
        fetchRecentContexts();
        onResumeContext(result.data.contextId);
      }
    } catch (error) {
      console.error('Failed to create context:', error);
    }
  };

  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getTypeColor = (type: string): string => {
    const colors: { [key: string]: string } = {
      'planning': 'blue',
      'analysis': 'purple',
      'development': 'green',
      'bmad_workflow': 'cyan',
      'general': 'gray',
    };
    return colors[type] || 'gray';
  };

  if (!isOpen) {
    return (
      <div className="context-sidebar-collapsed">
        <Button
          kind="ghost"
          size="sm"
          renderIcon={ChevronRight}
          iconDescription="Open context sidebar"
          hasIconOnly
          onClick={onToggle}
          className="sidebar-toggle"
        />
      </div>
    );
  }

  return (
    <div className={`context-sidebar ${className}`}>
      <div className="sidebar-header">
        <div className="header-actions">
          <h4 className="sidebar-title">Contexts</h4>
          <div className="header-buttons">
            <Button
              kind="ghost"
              size="sm"
              renderIcon={Add}
              iconDescription="Create context"
              hasIconOnly
              onClick={() => setCreateModalOpen(true)}
            />
            <Button
              kind="ghost"
              size="sm"
              renderIcon={ChevronLeft}
              iconDescription="Close sidebar"
              hasIconOnly
              onClick={onToggle}
            />
          </div>
        </div>

        <div className="search-section">
          <Search
            size="sm"
            labelText="Search contexts"
            placeholder="Search contexts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClear={() => setSearchTerm('')}
          />
        </div>
      </div>

      <div className="sidebar-content">
        {/* Recent Sessions Section */}
        {recentSessions.length > 0 && (
          <div className="section">
            <h5 className="section-title">Recent Sessions</h5>
            <div className="session-list">
              {recentSessions.slice(0, 3).map((session) => (
                <Tile key={session.sessionId} className="session-item">
                  <div className="session-info">
                    <div className="session-title">
                      Session {session.sessionId.slice(-8)}
                    </div>
                    <div className="session-meta">
                      <Time size={12} />
                      <span>{formatRelativeTime(session.lastActivity.toString())}</span>
                      <span>•</span>
                      <span>{session.contextCount} contexts</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    kind="ghost"
                    renderIcon={Play}
                    iconDescription="Resume session"
                    hasIconOnly
                    onClick={() => {
                      if (session.lastContextId) {
                        handleResumeContext(session.lastContextId);
                      }
                    }}
                  />
                </Tile>
              ))}
            </div>
          </div>
        )}

        {/* Contexts List */}
        <div className="section">
          <h5 className="section-title">
            Recent Contexts {filteredContexts.length > 0 && `(${filteredContexts.length})`}
          </h5>
          
          {loading ? (
            <div className="loading-container">
              <Loading small description="Loading contexts..." />
            </div>
          ) : (
            <div className="context-list">
              {filteredContexts.length === 0 ? (
                <div className="empty-state">
                  <Document size={32} />
                  <p>No contexts found</p>
                  <Button size="sm" kind="primary" onClick={() => setCreateModalOpen(true)}>
                    Create First Context
                  </Button>
                </div>
              ) : (
                filteredContexts.map((context) => (
                  <Tile key={context.id} className="context-item">
                    <div className="context-header">
                      <div className="context-title">{context.title}</div>
                      <OverflowMenu flipped size="sm">
                        <OverflowMenuItem
                          itemText="Resume"
                          onClick={() => handleResumeContext(context.id)}
                        />
                        <OverflowMenuItem
                          itemText="Edit"
                          onClick={() => console.log('Edit context', context.id)}
                        />
                        <OverflowMenuItem
                          itemText="Archive"
                          onClick={() => console.log('Archive context', context.id)}
                        />
                      </OverflowMenu>
                    </div>
                    
                    <div className="context-meta">
                      <Tag type={getTypeColor(context.type) as "blue" | "purple" | "green" | "cyan" | "gray" | "red" | "magenta" | "teal" | "cool-gray" | "warm-gray" | "high-contrast" | "outline"} size="sm">
                        {context.type}
                      </Tag>
                      <span className="token-count">{context.tokenCount} tokens</span>
                      <span className="updated-time">{formatRelativeTime(context.updatedAt)}</span>
                    </div>

                    {context.tags.length > 0 && (
                      <div className="context-tags">
                        {context.tags.slice(0, 3).map((tag) => (
                          <Tag key={tag} type="outline" size="sm">
                            {tag}
                          </Tag>
                        ))}
                        {context.tags.length > 3 && (
                          <span className="more-tags">+{context.tags.length - 3}</span>
                        )}
                      </div>
                    )}

                    <Button
                      size="sm"
                      kind="primary"
                      className="resume-button"
                      onClick={() => handleResumeContext(context.id)}
                    >
                      Resume
                    </Button>
                  </Tile>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Create Modal */}
      <Modal
        open={createModalOpen}
        onRequestClose={() => setCreateModalOpen(false)}
        modalHeading="Quick Create Context"
        primaryButtonText="Create"
        secondaryButtonText="Cancel"
        onRequestSubmit={handleQuickCreate}
      >
        <FormGroup legendText="">
          <TextInput
            id="quick-title"
            labelText="Title"
            value={quickCreateForm.title}
            onChange={(e) => setQuickCreateForm({ ...quickCreateForm, title: e.target.value })}
            placeholder="Enter context title"
          />
          <Dropdown
            id="quick-type"
            label="Type"
            titleText="Type"
            items={[
              { id: 'general', text: 'General' },
              { id: 'planning', text: 'Planning' },
              { id: 'analysis', text: 'Analysis' },
              { id: 'development', text: 'Development' },
              { id: 'bmad_workflow', text: 'BMad Workflow' },
            ]}
            selectedItem={{ id: quickCreateForm.type, text: quickCreateForm.type }}
            onChange={({ selectedItem }) =>
              setQuickCreateForm({ ...quickCreateForm, type: selectedItem?.id || 'general' })
            }
          />
          <TextArea
            id="quick-content"
            labelText="Content"
            value={quickCreateForm.content}
            onChange={(e) => setQuickCreateForm({ ...quickCreateForm, content: e.target.value })}
            placeholder="Enter initial context content"
            rows={4}
          />
          <TextInput
            id="quick-tags"
            labelText="Tags (comma-separated)"
            value={quickCreateForm.tags}
            onChange={(e) => setQuickCreateForm({ ...quickCreateForm, tags: e.target.value })}
            placeholder="tag1, tag2, tag3"
          />
        </FormGroup>
      </Modal>
    </div>
  );
};