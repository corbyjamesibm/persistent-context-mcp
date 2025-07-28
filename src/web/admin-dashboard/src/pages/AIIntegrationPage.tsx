import React, { useState, useEffect } from 'react';
import {
  Grid,
  Column,
  Tile,
  Button,
  TextArea,
  TextInput,
  Dropdown,
  Modal,
  DataTable,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Tag,
  ProgressBar,
  InlineNotification,
  Toggle,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  CodeSnippet,
} from '@carbon/react';
import {
  Bot,
  Generate,
  Analytics,
  Settings,
  CheckmarkFilled,
  Warning,
  ErrorFilled,
  Watson,
} from '@carbon/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useNotification } from '../hooks/useNotification';

interface AIProvider {
  name: string;
  id: string;
  enabled: boolean;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

interface GenerationRequest {
  prompt: string;
  contextIds: string[];
  maxTokens: number;
  temperature: number;
  provider: string;
  systemPrompt: string;
}

interface AnalysisRequest {
  contextIds: string[];
  analysisType: 'summary' | 'insights' | 'patterns' | 'sentiment' | 'classification';
  provider: string;
}

export const AIIntegrationPage: React.FC = () => {
  const [generationRequest, setGenerationRequest] = useState<GenerationRequest>({
    prompt: '',
    contextIds: [],
    maxTokens: 2048,
    temperature: 0.7,
    provider: 'openai',
    systemPrompt: '',
  });

  const [analysisRequest, setAnalysisRequest] = useState<AnalysisRequest>({
    contextIds: [],
    analysisType: 'summary',
    provider: 'anthropic',
  });

  const [isGenerationModalOpen, setIsGenerationModalOpen] = useState(false);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const { showSuccess, showError } = useNotification();
  const queryClient = useQueryClient();

  // Fetch AI providers
  const {
    data: providersData,
    isLoading: providersLoading,
    error: providersError,
  } = useQuery({
    queryKey: ['ai-providers'],
    queryFn: async () => {
      const response = await api.get('/ai/providers');
      return response.data;
    },
  });

  // Fetch usage statistics
  const {
    data: usageData,
    isLoading: usageLoading,
  } = useQuery({
    queryKey: ['ai-usage'],
    queryFn: async () => {
      const response = await api.get('/ai/usage');
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Content generation mutation
  const generateContentMutation = useMutation({
    mutationFn: async (request: GenerationRequest) => {
      const response = await api.post('/ai/generate', request);
      return response.data;
    },
    onSuccess: (data) => {
      setGeneratedContent(data.data.content);
      showSuccess('Content Generated', 'AI content has been generated successfully');
      queryClient.invalidateQueries({ queryKey: ['ai-usage'] });
    },
    onError: (error: any) => {
      showError('Generation Failed', error.message || 'Failed to generate content');
    },
  });

  // Context analysis mutation
  const analyzeContextsMutation = useMutation({
    mutationFn: async (request: AnalysisRequest) => {
      const response = await api.post('/ai/analyze', request);
      return response.data;
    },
    onSuccess: (data) => {
      setAnalysisResult(data.data);
      showSuccess('Analysis Complete', 'Context analysis has been completed');
      queryClient.invalidateQueries({ queryKey: ['ai-usage'] });
    },
    onError: (error: any) => {
      showError('Analysis Failed', error.message || 'Failed to analyze contexts');
    },
  });

  // Provider test mutation
  const testProviderMutation = useMutation({
    mutationFn: async (providerId: string) => {
      const response = await api.post(`/ai/providers/${providerId}/test`);
      return response.data;
    },
    onSuccess: (data) => {
      showSuccess('Connection Test', `${data.data.providerId} connection successful`);
    },
    onError: (error: any) => {
      showError('Connection Test Failed', error.message || 'Provider connection failed');
    },
  });

  const handleGenerateContent = () => {
    if (!generationRequest.prompt.trim()) {
      showError('Validation Error', 'Prompt is required');
      return;
    }
    generateContentMutation.mutate(generationRequest);
  };

  const handleAnalyzeContexts = () => {
    if (analysisRequest.contextIds.length === 0) {
      showError('Validation Error', 'At least one context must be selected');
      return;
    }
    analyzeContextsMutation.mutate(analysisRequest);
  };

  const getProviderStatus = (provider: AIProvider) => {
    if (provider.enabled) {
      return <Tag type="green" renderIcon={CheckmarkFilled}>Active</Tag>;
    }
    return <Tag type="red" renderIcon={ErrorFilled}>Inactive</Tag>;
  };

  const analysisTypeOptions = [
    { id: 'summary', text: 'Summary' },
    { id: 'insights', text: 'Insights' },
    { id: 'patterns', text: 'Patterns' },
    { id: 'sentiment', text: 'Sentiment' },
    { id: 'classification', text: 'Classification' },
  ];

  const providerOptions = providersData?.data?.providers?.map((provider: AIProvider) => ({
    id: provider.id,
    text: provider.name,
  })) || [];

  if (providersLoading || usageLoading) {
    return <LoadingSpinner size="lg" description="Loading AI integration..." />;
  }

  if (providersError) {
    return (
      <InlineNotification
        kind="error"
        title="Loading Error"
        subtitle="Failed to load AI integration data"
      />
    );
  }

  const providers = providersData?.data?.providers || [];
  const stats = usageData?.data || {};

  return (
    <div className="ai-integration-page">
      <Grid>
        {/* Header */}
        <Column lg={16} md={8} sm={4} className="page-header">
          <div className="header-content">
            <div className="header-text">
              <h1 className="page-title">
                <Bot size={32} />
                AI Integration
              </h1>
              <p className="page-subtitle">
                Integrate with external AI services for content generation and analysis
              </p>
            </div>
            <div className="header-actions">
              <Button
                kind="secondary"
                renderIcon={Generate}
                onClick={() => setIsGenerationModalOpen(true)}
              >
                Generate Content
              </Button>
              <Button
                kind="primary"
                renderIcon={Analytics}
                onClick={() => setIsAnalysisModalOpen(true)}
              >
                Analyze Contexts
              </Button>
            </div>
          </div>
        </Column>

        {/* Usage Statistics */}
        <Column lg={4} md={2} sm={1}>
          <Tile className="metric-tile">
            <div className="metric-content">
              <div className="metric-icon">
                <Generate size={24} />
              </div>
              <div className="metric-text">
                <h3>{stats.requestCount || 0}</h3>
                <p>Total Requests</p>
              </div>
            </div>
          </Tile>
        </Column>

        <Column lg={4} md={2} sm={1}>
          <Tile className="metric-tile">
            <div className="metric-content">
              <div className="metric-icon">
                <Watson size={24} />
              </div>
              <div className="metric-text">
                <h3>{stats.totalTokensUsed?.toLocaleString() || 0}</h3>
                <p>Tokens Used</p>
              </div>
            </div>
          </Tile>
        </Column>

        <Column lg={4} md={2} sm={1}>
          <Tile className="metric-tile">
            <div className="metric-content">
              <div className="metric-icon">
                <Settings size={24} />
              </div>
              <div className="metric-text">
                <h3>{stats.providersEnabled || 0}</h3>
                <p>Active Providers</p>
              </div>
            </div>
          </Tile>
        </Column>

        <Column lg={4} md={2} sm={1}>
          <Tile className="metric-tile">
            <div className="metric-content">
              <div className="metric-icon">
                <CheckmarkFilled size={24} />
              </div>
              <div className="metric-text">
                <h3>{providers.length}</h3>
                <p>Total Providers</p>
              </div>
            </div>
          </Tile>
        </Column>

        {/* AI Providers */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="providers-tile">
            <h4>AI Providers</h4>
            
            <DataTable
              rows={providers.map((provider: AIProvider) => ({
                id: provider.id,
                name: provider.name,
                status: getProviderStatus(provider),
                model: provider.model || 'N/A',
                maxTokens: provider.maxTokens || 'N/A',
                temperature: provider.temperature || 'N/A',
                actions: (
                  <Button
                    kind="ghost"
                    size="sm"
                    onClick={() => testProviderMutation.mutate(provider.id)}
                    disabled={!provider.enabled || testProviderMutation.isPending}
                  >
                    {testProviderMutation.isPending ? 'Testing...' : 'Test Connection'}
                  </Button>
                ),
              }))}
              headers={[
                { key: 'name', header: 'Provider' },
                { key: 'status', header: 'Status' },
                { key: 'model', header: 'Model' },
                { key: 'maxTokens', header: 'Max Tokens' },
                { key: 'temperature', header: 'Temperature' },
                { key: 'actions', header: 'Actions' },
              ]}
              size="md"
            >
              {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
                <TableContainer>
                  <Table {...getTableProps()}>
                    <TableHead>
                      <TableRow>
                        {headers.map((header) => (
                          <TableHeader {...getHeaderProps({ header })} key={header.key}>
                            {header.header}
                          </TableHeader>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow {...getRowProps({ row })} key={row.id}>
                          {row.cells.map((cell) => (
                            <TableCell key={cell.id}>{cell.value}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DataTable>
          </Tile>
        </Column>

        {/* Quick Actions */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="quick-actions-tile">
            <h4>Quick Actions</h4>
            <div className="quick-actions">
              <Button
                kind="primary"
                renderIcon={Generate}
                onClick={() => setIsGenerationModalOpen(true)}
              >
                Generate Content
              </Button>
              <Button
                kind="secondary"
                renderIcon={Analytics}
                onClick={() => setIsAnalysisModalOpen(true)}
              >
                Analyze Contexts
              </Button>
              <Button
                kind="tertiary"
                renderIcon={Settings}
              >
                Enhance Contexts
              </Button>
            </div>
          </Tile>
        </Column>
      </Grid>

      {/* Content Generation Modal */}
      <Modal
        open={isGenerationModalOpen}
        onRequestClose={() => setIsGenerationModalOpen(false)}
        modalHeading="Generate Content with AI"
        primaryButtonText="Generate"
        secondaryButtonText="Cancel"
        onRequestSubmit={handleGenerateContent}
        primaryButtonDisabled={generateContentMutation.isPending}
        size="lg"
      >
        <div className="modal-content">
          <Dropdown
            id="generation-provider"
            titleText="AI Provider"
            label="Select provider"
            items={providerOptions}
            selectedItem={providerOptions.find(p => p.id === generationRequest.provider)}
            onChange={({ selectedItem }) =>
              setGenerationRequest(prev => ({ ...prev, provider: selectedItem?.id || 'openai' }))
            }
          />

          <TextArea
            id="generation-prompt"
            labelText="Prompt"
            placeholder="Enter your prompt here..."
            value={generationRequest.prompt}
            onChange={(e) => setGenerationRequest(prev => ({ ...prev, prompt: e.target.value }))}
            rows={4}
            required
          />

          <TextInput
            id="generation-system-prompt"
            labelText="System Prompt (Optional)"
            placeholder="Optional system prompt to guide the AI..."
            value={generationRequest.systemPrompt}
            onChange={(e) => setGenerationRequest(prev => ({ ...prev, systemPrompt: e.target.value }))}
          />

          <div className="modal-settings">
            <TextInput
              id="generation-max-tokens"
              labelText="Max Tokens"
              type="number"
              value={generationRequest.maxTokens.toString()}
              onChange={(e) => setGenerationRequest(prev => ({ 
                ...prev, 
                maxTokens: parseInt(e.target.value) || 2048 
              }))}
              min={1}
              max={4000}
            />

            <TextInput
              id="generation-temperature"
              labelText="Temperature"
              type="number"
              value={generationRequest.temperature.toString()}
              onChange={(e) => setGenerationRequest(prev => ({ 
                ...prev, 
                temperature: parseFloat(e.target.value) || 0.7 
              }))}
              min={0}
              max={2}
              step={0.1}
            />
          </div>

          {generateContentMutation.isPending && (
            <div className="generation-progress">
              <ProgressBar label="Generating content..." />
            </div>
          )}

          {generatedContent && (
            <div className="generated-content">
              <h5>Generated Content:</h5>
              <CodeSnippet type="multi" feedback="Copied to clipboard">
                {generatedContent}
              </CodeSnippet>
            </div>
          )}
        </div>
      </Modal>

      {/* Context Analysis Modal */}
      <Modal
        open={isAnalysisModalOpen}
        onRequestClose={() => setIsAnalysisModalOpen(false)}
        modalHeading="Analyze Contexts with AI"
        primaryButtonText="Analyze"
        secondaryButtonText="Cancel"
        onRequestSubmit={handleAnalyzeContexts}
        primaryButtonDisabled={analyzeContextsMutation.isPending}
        size="lg"
      >
        <div className="modal-content">
          <Dropdown
            id="analysis-provider"
            titleText="AI Provider"
            label="Select provider"
            items={providerOptions}
            selectedItem={providerOptions.find(p => p.id === analysisRequest.provider)}
            onChange={({ selectedItem }) =>
              setAnalysisRequest(prev => ({ ...prev, provider: selectedItem?.id || 'anthropic' }))
            }
          />

          <Dropdown
            id="analysis-type"
            titleText="Analysis Type"
            label="Select analysis type"
            items={analysisTypeOptions}
            selectedItem={analysisTypeOptions.find(t => t.id === analysisRequest.analysisType)}
            onChange={({ selectedItem }) =>
              setAnalysisRequest(prev => ({ ...prev, analysisType: selectedItem?.id as any || 'summary' }))
            }
          />

          {analyzeContextsMutation.isPending && (
            <div className="analysis-progress">
              <ProgressBar label="Analyzing contexts..." />
            </div>
          )}

          {analysisResult && (
            <div className="analysis-result">
              <h5>Analysis Result:</h5>
              <CodeSnippet type="multi" feedback="Copied to clipboard">
                {analysisResult.analysis}
              </CodeSnippet>
              
              {analysisResult.insights && analysisResult.insights.length > 0 && (
                <div className="insights">
                  <h6>Key Insights:</h6>
                  <ul>
                    {analysisResult.insights.map((insight: string, index: number) => (
                      <li key={index}>{insight}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      <style jsx>{`
        .ai-integration-page {
          padding: var(--cds-spacing-06);
        }

        .page-header {
          margin-bottom: var(--cds-spacing-06);
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--cds-spacing-06);
        }

        .page-title {
          display: flex;
          align-items: center;
          gap: var(--cds-spacing-03);
          font-size: 2rem;
          font-weight: 600;
          margin-bottom: var(--cds-spacing-02);
          color: var(--cds-text-primary);
        }

        .page-subtitle {
          color: var(--cds-text-secondary);
          font-size: 1.125rem;
          margin: 0;
        }

        .header-actions {
          display: flex;
          gap: var(--cds-spacing-03);
        }

        .metric-tile,
        .providers-tile,
        .quick-actions-tile {
          margin-bottom: var(--cds-spacing-05);
          padding: var(--cds-spacing-05);
        }

        .metric-content {
          display: flex;
          align-items: center;
          gap: var(--cds-spacing-04);
        }

        .metric-icon {
          color: var(--cds-icon-primary);
        }

        .metric-text h3 {
          font-size: 1.75rem;
          font-weight: 600;
          margin: 0;
          color: var(--cds-text-primary);
        }

        .metric-text p {
          margin: 0;
          color: var(--cds-text-secondary);
          font-size: 0.875rem;
        }

        .providers-tile h4,
        .quick-actions-tile h4 {
          margin: 0 0 var(--cds-spacing-04) 0;
          color: var(--cds-text-primary);
          font-size: 1.125rem;
          font-weight: 600;
        }

        .quick-actions {
          display: flex;
          gap: var(--cds-spacing-03);
          flex-wrap: wrap;
        }

        .modal-content {
          display: flex;
          flex-direction: column;
          gap: var(--cds-spacing-05);
        }

        .modal-settings {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--cds-spacing-05);
        }

        .generation-progress,
        .analysis-progress {
          margin: var(--cds-spacing-04) 0;
        }

        .generated-content,
        .analysis-result {
          margin-top: var(--cds-spacing-05);
          padding-top: var(--cds-spacing-05);
          border-top: 1px solid var(--cds-border-subtle-01);
        }

        .generated-content h5,
        .analysis-result h5,
        .insights h6 {
          margin: 0 0 var(--cds-spacing-03) 0;
          color: var(--cds-text-primary);
        }

        .insights {
          margin-top: var(--cds-spacing-04);
        }

        .insights ul {
          margin: var(--cds-spacing-02) 0;
          padding-left: var(--cds-spacing-05);
        }

        .insights li {
          margin-bottom: var(--cds-spacing-02);
          color: var(--cds-text-primary);
        }

        @media (max-width: 768px) {
          .ai-integration-page {
            padding: var(--cds-spacing-04);
          }

          .header-content {
            flex-direction: column;
            align-items: stretch;
          }

          .page-title {
            font-size: 1.5rem;
          }

          .modal-settings {
            grid-template-columns: 1fr;
          }

          .quick-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};