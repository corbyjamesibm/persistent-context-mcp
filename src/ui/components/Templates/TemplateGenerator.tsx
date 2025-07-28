/**
 * Template Generator Component (US-4530)
 * Provides UI for generating and managing context templates
 */

import React, { useState, useEffect } from 'react';
import {
  Button,
  Tile,
  Tag,
  Loading,
  Modal,
  TextInput,
  TextArea,
  Dropdown,
  FormGroup,
  DataTable,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Checkbox,
  ProgressBar,
  InlineNotification,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
} from '@carbon/react';
import {
  Add,
  Magic,
  Template,
  CheckmarkFilled,
  WarningFilled,
  Information,
  View,
  Edit,
  TrashCan,
} from '@carbon/react/icons';

interface TemplateCandidate {
  contextId: string;
  title: string;
  type: string;
  confidence: number;
  successMetrics: {
    tokenEfficiency: number;
    resolutionTime: number;
    userSatisfaction: number;
    reusabilityScore: number;
    complexityLevel: 'simple' | 'moderate' | 'complex';
  };
  patternCount: number;
  variableCount: number;
  selected?: boolean;
}

interface GeneratedTemplate {
  id: string;
  title: string;
  description: string;
  type: string;
  variableCount: number;
  confidence: number;
  usageCount: number;
  tags: string[];
  createdAt: string;
}

interface TemplateGeneratorProps {
  onTemplateGenerated?: (templateId: string) => void;
  onTemplateApplied?: (contextId: string) => void;
}

export const TemplateGenerator: React.FC<TemplateGeneratorProps> = ({
  onTemplateGenerated,
  onTemplateApplied,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [candidates, setCandidates] = useState<TemplateCandidate[]>([]);
  const [templates, setTemplates] = useState<GeneratedTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [notification, setNotification] = useState<{
    kind: 'success' | 'error' | 'info' | 'warning';
    title: string;
    subtitle?: string;
  } | null>(null);

  // Modal states
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<GeneratedTemplate | null>(null);

  // Form states
  const [generateForm, setGenerateForm] = useState({
    title: '',
    description: '',
    type: 'general',
  });

  const [applyForm, setApplyForm] = useState({
    title: '',
    sessionId: '',
    variableValues: {} as Record<string, any>,
  });

  useEffect(() => {
    fetchTemplateCandidates();
    fetchAvailableTemplates();
  }, []);

  const fetchTemplateCandidates = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/templates/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: {
            minSuccessScore: 0.7,
            contextTypes: ['planning', 'analysis', 'development'],
          },
        }),
      });

      const data = await response.json();
      if (data.success) {
        setCandidates(data.candidates.map((c: TemplateCandidate) => ({ ...c, selected: false })));
      } else {
        showNotification('error', 'Failed to load candidates', data.error);
      }
    } catch (error) {
      showNotification('error', 'Network error', 'Failed to fetch template candidates');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableTemplates = async () => {
    try {
      const response = await fetch('/api/v1/templates');
      const data = await response.json();
      if (data.success) {
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  };

  const handleCandidateSelection = (contextId: string, selected: boolean) => {
    setCandidates(prev => 
      prev.map(c => 
        c.contextId === contextId ? { ...c, selected } : c
      )
    );
  };

  const handleGenerateTemplate = async () => {
    const selectedCandidates = candidates.filter(c => c.selected);
    if (selectedCandidates.length === 0) {
      showNotification('warning', 'No candidates selected', 'Select at least one candidate to generate a template');
      return;
    }

    setLoading(true);
    setGenerationProgress(0);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => Math.min(prev + 20, 90));
      }, 500);

      const response = await fetch('/api/v1/templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateContextIds: selectedCandidates.map(c => c.contextId),
          templateConfig: {
            title: generateForm.title,
            description: generateForm.description,
            type: generateForm.type,
          },
        }),
      });

      clearInterval(progressInterval);
      setGenerationProgress(100);

      const data = await response.json();
      if (data.success) {
        showNotification('success', 'Template generated!', `Template "${data.template.title}" created successfully`);
        setGenerateModalOpen(false);
        setGenerateForm({ title: '', description: '', type: 'general' });
        fetchAvailableTemplates();
        onTemplateGenerated?.(data.templateId);
      } else {
        showNotification('error', 'Generation failed', data.error);
      }
    } catch (error) {
      showNotification('error', 'Network error', 'Failed to generate template');
    } finally {
      setLoading(false);
      setGenerationProgress(0);
    }
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      const response = await fetch('/api/v1/templates/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          variableValues: applyForm.variableValues,
          contextConfig: {
            title: applyForm.title,
            sessionId: applyForm.sessionId || `session_${Date.now()}`,
            tags: ['from-template'],
          },
        }),
      });

      const data = await response.json();
      if (data.success) {
        showNotification('success', 'Template applied!', `Context "${data.contextTitle}" created successfully`);
        setApplyModalOpen(false);
        setApplyForm({ title: '', sessionId: '', variableValues: {} });
        setSelectedTemplate(null);
        onTemplateApplied?.(data.contextId);
      } else {
        showNotification('error', 'Application failed', data.error);
      }
    } catch (error) {
      showNotification('error', 'Network error', 'Failed to apply template');
    }
  };

  const showNotification = (kind: 'success' | 'error' | 'info' | 'warning', title: string, subtitle?: string) => {
    setNotification({ kind, title, subtitle });
    setTimeout(() => setNotification(null), 5000);
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'green';
    if (confidence >= 0.6) return 'cyan';
    if (confidence >= 0.4) return 'yellow';
    return 'red';
  };

  const candidateHeaders = [
    { key: 'select', header: '' },
    { key: 'title', header: 'Context Title' },
    { key: 'type', header: 'Type' },
    { key: 'confidence', header: 'Confidence' },
    { key: 'complexity', header: 'Complexity' },
    { key: 'patterns', header: 'Patterns' },
    { key: 'variables', header: 'Variables' },
  ];

  const templateHeaders = [
    { key: 'title', header: 'Template Name' },
    { key: 'type', header: 'Type' },
    { key: 'confidence', header: 'Confidence' },
    { key: 'usage', header: 'Usage Count' },
    { key: 'variables', header: 'Variables' },
    { key: 'actions', header: 'Actions' },
  ];

  return (
    <div className="template-generator">
      {notification && (
        <InlineNotification
          kind={notification.kind}
          title={notification.title}
          subtitle={notification.subtitle}
          onCloseButtonClick={() => setNotification(null)}
          style={{ marginBottom: '1rem' }}
        />
      )}

      <Tabs selectedIndex={activeTab} onChange={({ selectedIndex }) => setActiveTab(selectedIndex)}>
        <TabList aria-label="Template Generator Tabs">
          <Tab>Generate Templates</Tab>
          <Tab>Available Templates</Tab>
        </TabList>
        
        <TabPanels>
          {/* Generate Templates Tab */}
          <TabPanel>
            <div className="tab-content">
              <div className="tab-header">
                <h3>Template Candidates</h3>
                <div className="header-actions">
                  <Button
                    kind="secondary"
                    size="sm"
                    renderIcon={Magic}
                    onClick={fetchTemplateCandidates}
                    disabled={loading}
                  >
                    Refresh Candidates
                  </Button>
                  <Button
                    kind="primary"
                    size="sm"
                    renderIcon={Add}
                    onClick={() => setGenerateModalOpen(true)}
                    disabled={candidates.filter(c => c.selected).length === 0}
                  >
                    Generate Template ({candidates.filter(c => c.selected).length})
                  </Button>
                </div>
              </div>

              {loading ? (
                <div className="loading-container">
                  <Loading description="Loading template candidates..." />
                  {generationProgress > 0 && (
                    <div style={{ marginTop: '1rem', width: '300px' }}>
                      <ProgressBar
                        label="Generating template..."
                        value={generationProgress}
                        max={100}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <DataTable rows={candidates} headers={candidateHeaders}>
                  {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
                    <TableContainer>
                      <Table {...getTableProps()}>
                        <TableHead>
                          <TableRow>
                            {headers.map((header) => (
                              <TableHeader {...getHeaderProps({ header })}>
                                {header.header}
                              </TableHeader>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {rows.map((row) => {
                            const candidate = candidates.find(c => c.contextId === row.id);
                            return (
                              <TableRow {...getRowProps({ row })}>
                                <TableCell>
                                  <Checkbox
                                    id={`select-${row.id}`}
                                    checked={candidate?.selected || false}
                                    onChange={(checked) => handleCandidateSelection(row.id, checked)}
                                  />
                                </TableCell>
                                <TableCell>{candidate?.title}</TableCell>
                                <TableCell>
                                  <Tag type="outline" size="sm">
                                    {candidate?.type}
                                  </Tag>
                                </TableCell>
                                <TableCell>
                                  <Tag type={getConfidenceColor(candidate?.confidence || 0)} size="sm">
                                    {((candidate?.confidence || 0) * 100).toFixed(0)}%
                                  </Tag>
                                </TableCell>
                                <TableCell>
                                  <Tag 
                                    type={candidate?.successMetrics.complexityLevel === 'simple' ? 'green' : 
                                          candidate?.successMetrics.complexityLevel === 'moderate' ? 'cyan' : 'purple'} 
                                    size="sm"
                                  >
                                    {candidate?.successMetrics.complexityLevel}
                                  </Tag>
                                </TableCell>
                                <TableCell>{candidate?.patternCount}</TableCell>
                                <TableCell>{candidate?.variableCount}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </DataTable>
              )}
            </div>
          </TabPanel>

          {/* Available Templates Tab */}
          <TabPanel>
            <div className="tab-content">
              <div className="tab-header">
                <h3>Available Templates</h3>
                <Button
                  kind="secondary"
                  size="sm"
                  renderIcon={Magic}
                  onClick={fetchAvailableTemplates}
                >
                  Refresh Templates
                </Button>
              </div>

              {templates.length === 0 ? (
                <div className="empty-state">
                  <Template size={48} />
                  <h4>No templates available</h4>
                  <p>Generate your first template from successful contexts</p>
                </div>
              ) : (
                <div className="template-grid">
                  {templates.map((template) => (
                    <Tile key={template.id} className="template-card">
                      <div className="template-header">
                        <h5>{template.title}</h5>
                        <Tag type={getConfidenceColor(template.confidence)} size="sm">
                          {(template.confidence * 100).toFixed(0)}% confidence
                        </Tag>
                      </div>
                      
                      <p className="template-description">{template.description}</p>
                      
                      <div className="template-meta">
                        <div className="meta-item">
                          <span>{template.variableCount} variables</span>
                        </div>
                        <div className="meta-item">
                          <span>{template.usageCount} uses</span>
                        </div>
                        <div className="meta-item">
                          <Tag type="outline" size="sm">{template.type}</Tag>
                        </div>
                      </div>

                      <div className="template-tags">
                        {template.tags.slice(0, 3).map((tag) => (
                          <Tag key={tag} type="outline" size="sm">
                            {tag}
                          </Tag>
                        ))}
                        {template.tags.length > 3 && (
                          <span className="more-tags">+{template.tags.length - 3}</span>
                        )}
                      </div>

                      <div className="template-actions">
                        <Button
                          size="sm"
                          kind="primary"
                          onClick={() => {
                            setSelectedTemplate(template);
                            setApplyModalOpen(true);
                          }}
                        >
                          Apply Template
                        </Button>
                        <Button
                          size="sm"
                          kind="ghost"
                          renderIcon={View}
                          hasIconOnly
                          iconDescription="View details"
                        />
                      </div>
                    </Tile>
                  ))}
                </div>
              )}
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Generate Template Modal */}
      <Modal
        open={generateModalOpen}
        onRequestClose={() => setGenerateModalOpen(false)}
        modalHeading="Generate Template"
        primaryButtonText="Generate"
        secondaryButtonText="Cancel"
        onRequestSubmit={handleGenerateTemplate}
        primaryButtonDisabled={!generateForm.title || !generateForm.description}
      >
        <FormGroup legendText="">
          <TextInput
            id="generate-title"
            labelText="Template Title"
            value={generateForm.title}
            onChange={(e) => setGenerateForm({ ...generateForm, title: e.target.value })}
            placeholder="Enter template title"
          />
          <Dropdown
            id="generate-type"
            titleText="Template Type"
            items={[
              { id: 'general', text: 'General' },
              { id: 'planning', text: 'Planning' },
              { id: 'analysis', text: 'Analysis' },
              { id: 'development', text: 'Development' },
              { id: 'bmad_workflow', text: 'BMad Workflow' },
            ]}
            selectedItem={{ id: generateForm.type, text: generateForm.type }}
            onChange={({ selectedItem }) =>
              setGenerateForm({ ...generateForm, type: selectedItem?.id || 'general' })
            }
          />
          <TextArea
            id="generate-description"
            labelText="Description"
            value={generateForm.description}
            onChange={(e) => setGenerateForm({ ...generateForm, description: e.target.value })}
            placeholder="Describe when this template should be used"
            rows={4}
          />
        </FormGroup>
      </Modal>

      {/* Apply Template Modal */}
      <Modal
        open={applyModalOpen}
        onRequestClose={() => setApplyModalOpen(false)}
        modalHeading={`Apply Template: ${selectedTemplate?.title}`}
        primaryButtonText="Create Context"
        secondaryButtonText="Cancel"
        onRequestSubmit={handleApplyTemplate}
        primaryButtonDisabled={!applyForm.title}
      >
        <FormGroup legendText="">
          <TextInput
            id="apply-title"
            labelText="Context Title"
            value={applyForm.title}
            onChange={(e) => setApplyForm({ ...applyForm, title: e.target.value })}
            placeholder="Enter title for new context"
          />
          <TextInput
            id="apply-session"
            labelText="Session ID (optional)"
            value={applyForm.sessionId}
            onChange={(e) => setApplyForm({ ...applyForm, sessionId: e.target.value })}
            placeholder="Current session ID"
          />
          {/* Template variables would be rendered here dynamically */}
        </FormGroup>
      </Modal>
    </div>
  );
};