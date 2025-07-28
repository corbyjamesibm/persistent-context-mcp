import { describe, test, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { EventEmitter } from 'events';
import { AIIntegrationService, AIGenerationRequest, AIAnalysisRequest } from '../../core/services/ai-integration.service.js';
import { ContextStore } from '../../core/context-store.js';
import { Logger } from '../../core/logger.js';

// Mock external dependencies
vi.mock('openai');
vi.mock('@anthropic-ai/sdk');

const mockContextStore = {
  createContext: vi.fn(),
  getContext: vi.fn(),
  updateContext: vi.fn(),
} as unknown as ContextStore;

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as Logger;

describe('AIIntegrationService', () => {
  let aiService: AIIntegrationService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Store original environment variables
    originalEnv = { ...process.env };
    
    // Set up test environment variables
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    process.env.OPENAI_MODEL = 'gpt-4';
    process.env.ANTHROPIC_MODEL = 'claude-3-sonnet-20240229';

    // Clear all mocks
    vi.clearAllMocks();
    
    // Create service instance
    aiService = new AIIntegrationService(mockContextStore, mockLogger);
  });

  afterEach(() => {
    // Restore original environment variables
    process.env = originalEnv;
  });

  describe('Provider Management', () => {
    test('should initialize providers with environment variables', () => {
      const providers = aiService.getProviders();
      
      expect(providers).toHaveLength(2);
      expect(providers.find(p => p.id === 'openai')).toBeDefined();
      expect(providers.find(p => p.id === 'anthropic')).toBeDefined();
    });

    test('should return provider by ID', () => {
      const openaiProvider = aiService.getProvider('openai');
      
      expect(openaiProvider).toBeDefined();
      expect(openaiProvider?.name).toBe('OpenAI');
      expect(openaiProvider?.enabled).toBe(true);
    });

    test('should return undefined for non-existent provider', () => {
      const provider = aiService.getProvider('non-existent');
      
      expect(provider).toBeUndefined();
    });

    test('should disable providers when API keys are missing', () => {
      // Clear API keys
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      
      // Create new service instance
      const serviceWithoutKeys = new AIIntegrationService(mockContextStore, mockLogger);
      const providers = serviceWithoutKeys.getProviders();
      
      expect(providers).toHaveLength(0);
    });
  });

  describe('Content Generation', () => {
    test('should generate content with OpenAI', async () => {
      // Mock OpenAI response
      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [{ message: { content: 'Generated content' } }],
              model: 'gpt-4',
              usage: {
                prompt_tokens: 100,
                completion_tokens: 50,
                total_tokens: 150,
              },
            }),
          },
        },
      };

      // Mock the OpenAI client
      const { default: OpenAI } = await import('openai');
      (OpenAI as any).mockImplementation(() => mockOpenAI);

      const request: AIGenerationRequest = {
        prompt: 'Generate a test response',
        provider: 'openai',
      };

      const response = await aiService.generateContent(request);

      expect(response.content).toBe('Generated content');
      expect(response.provider).toBe('OpenAI');
      expect(response.model).toBe('gpt-4');
      expect(response.usage.totalTokens).toBe(150);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Generate a test response' }],
        max_tokens: undefined,
        temperature: undefined,
      });
    });

    test('should generate content with context', async () => {
      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [{ message: { content: 'Generated with context' } }],
              model: 'gpt-4',
              usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
            }),
          },
        },
      };

      const { default: OpenAI } = await import('openai');
      (OpenAI as any).mockImplementation(() => mockOpenAI);

      const contexts = [
        {
          id: '1',
          title: 'Test Context',
          content: 'This is test context content',
          type: 'test',
          tags: [],
          sessionId: 'session-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {},
        },
      ];

      const request: AIGenerationRequest = {
        prompt: 'Analyze this context',
        context: contexts,
        provider: 'openai',
      };

      const response = await aiService.generateContent(request);

      expect(response.content).toBe('Generated with context');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: [{
          role: 'user',
          content: 'Context:\nTitle: Test Context\nContent: This is test context content\n\nQuery: Analyze this context'
        }],
        max_tokens: undefined,
        temperature: undefined,
      });
    });

    test('should generate content with Anthropic', async () => {
      const mockAnthropic = {
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'Anthropic generated content' }],
            model: 'claude-3-sonnet-20240229',
            usage: {
              input_tokens: 100,
              output_tokens: 50,
            },
          }),
        },
      };

      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      (Anthropic as any).mockImplementation(() => mockAnthropic);

      const request: AIGenerationRequest = {
        prompt: 'Generate a test response',
        provider: 'anthropic',
      };

      const response = await aiService.generateContent(request);

      expect(response.content).toBe('Anthropic generated content');
      expect(response.provider).toBe('Anthropic');
      expect(response.model).toBe('claude-3-sonnet-20240229');
      expect(response.usage.totalTokens).toBe(150);
    });

    test('should store generated content as context', async () => {
      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [{ message: { content: 'Generated content' } }],
              model: 'gpt-4',
              usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
            }),
          },
        },
      };

      const { default: OpenAI } = await import('openai');
      (OpenAI as any).mockImplementation(() => mockOpenAI);

      mockContextStore.createContext = vi.fn().mockResolvedValue({
        id: 'generated-context-1',
      });

      const request: AIGenerationRequest = {
        prompt: 'Generate a test response',
        provider: 'openai',
      };

      await aiService.generateContent(request);

      expect(mockContextStore.createContext).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('AI Generated Content'),
          content: 'Generated content',
          type: 'ai-generated',
          tags: ['ai-generated', 'openai'],
          metadata: expect.objectContaining({
            aiGenerated: true,
            source: 'OpenAI',
            model: 'gpt-4',
            originalPrompt: 'Generate a test response',
          }),
        })
      );
    });

    test('should handle generation errors', async () => {
      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockRejectedValue(new Error('API Error')),
          },
        },
      };

      const { default: OpenAI } = await import('openai');
      (OpenAI as any).mockImplementation(() => mockOpenAI);

      const request: AIGenerationRequest = {
        prompt: 'Generate a test response',
        provider: 'openai',
      };

      await expect(aiService.generateContent(request)).rejects.toThrow('API Error');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Context Analysis', () => {
    test('should analyze contexts', async () => {
      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [{ message: { content: 'Analysis result with insights' } }],
              model: 'gpt-4',
              usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
            }),
          },
        },
      };

      const { default: OpenAI } = await import('openai');
      (OpenAI as any).mockImplementation(() => mockOpenAI);

      const contexts = [
        {
          id: '1',
          title: 'Test Context',
          content: 'This is test context content',
          type: 'test',
          tags: [],
          sessionId: 'session-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {},
        },
      ];

      const request: AIAnalysisRequest = {
        contexts,
        analysisType: 'summary',
        provider: 'openai',
      };

      const response = await aiService.analyzeContexts(request);

      expect(response.analysis).toBe('Analysis result with insights');
      expect(response.provider).toBe('OpenAI');
      expect(response.model).toBe('gpt-4');
      expect(response.confidence).toBe(0.85);
    });

    test('should build appropriate prompts for different analysis types', async () => {
      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [{ message: { content: 'Analysis result' } }],
              model: 'gpt-4',
              usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
            }),
          },
        },
      };

      const { default: OpenAI } = await import('openai');
      (OpenAI as any).mockImplementation(() => mockOpenAI);

      const contexts = [
        {
          id: '1',
          title: 'Test Context',
          content: 'This is test context content',
          type: 'test',
          tags: [],
          sessionId: 'session-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {},
        },
      ];

      // Test different analysis types
      const analysisTypes: Array<'summary' | 'insights' | 'patterns' | 'sentiment' | 'classification'> = [
        'summary', 'insights', 'patterns', 'sentiment', 'classification'
      ];

      for (const analysisType of analysisTypes) {
        const request: AIAnalysisRequest = {
          contexts,
          analysisType,
          provider: 'openai',
        };

        await aiService.analyzeContexts(request);

        const call = mockOpenAI.chat.completions.create.mock.calls.find(call => 
          call[0].messages[0].content.includes(analysisType)
        );
        expect(call).toBeDefined();
      }
    });
  });

  describe('Context Enhancement', () => {
    test('should enhance context with metadata', async () => {
      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [{ 
                message: { 
                  content: JSON.stringify({
                    summary: 'Test summary',
                    tags: ['test', 'example'],
                    importance: 'medium',
                    sentiment: 'neutral',
                    categories: ['testing']
                  })
                } 
              }],
              model: 'gpt-4',
              usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
            }),
          },
        },
      };

      const { default: OpenAI } = await import('openai');
      (OpenAI as any).mockImplementation(() => mockOpenAI);

      const context = {
        id: '1',
        title: 'Test Context',
        content: 'This is test context content',
        type: 'test',
        tags: [],
        sessionId: 'session-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      };

      const enhancement = await aiService.enhanceContext(context);

      expect(enhancement.summary).toBe('Test summary');
      expect(enhancement.tags).toEqual(['test', 'example']);
      expect(enhancement.importance).toBe('medium');
      expect(enhancement.aiGenerated).toBe(true);
      expect(enhancement.source).toBe('OpenAI');
    });

    test('should handle invalid JSON in enhancement response', async () => {
      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [{ message: { content: 'Invalid JSON response' } }],
              model: 'gpt-4',
              usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
            }),
          },
        },
      };

      const { default: OpenAI } = await import('openai');
      (OpenAI as any).mockImplementation(() => mockOpenAI);

      const context = {
        id: '1',
        title: 'Test Context',
        content: 'This is test context content',
        type: 'test',
        tags: [],
        sessionId: 'session-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      };

      const enhancement = await aiService.enhanceContext(context);

      expect(enhancement.aiGenerated).toBe(true);
      expect(enhancement.source).toBe('OpenAI');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to parse AI-generated metadata',
        expect.any(Error)
      );
    });
  });

  describe('Suggestions Generation', () => {
    test('should generate suggestions based on contexts', async () => {
      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [{ 
                message: { 
                  content: '1. First suggestion\n2. Second suggestion\n3. Third suggestion'
                } 
              }],
              model: 'gpt-4',
              usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
            }),
          },
        },
      };

      const { default: OpenAI } = await import('openai');
      (OpenAI as any).mockImplementation(() => mockOpenAI);

      const contexts = [
        {
          id: '1',
          title: 'Test Context',
          content: 'This is test context content',
          type: 'test',
          tags: [],
          sessionId: 'session-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {},
        },
      ];

      const suggestions = await aiService.generateSuggestions(contexts);

      expect(suggestions).toHaveLength(3);
      expect(suggestions[0]).toBe('First suggestion');
      expect(suggestions[1]).toBe('Second suggestion');  
      expect(suggestions[2]).toBe('Third suggestion');
    });

    test('should generate suggestions with user query', async () => {
      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [{ 
                message: { 
                  content: '1. Query-based suggestion\n2. Another suggestion'
                } 
              }],
              model: 'gpt-4',
              usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
            }),
          },
        },
      };

      const { default: OpenAI } = await import('openai');
      (OpenAI as any).mockImplementation(() => mockOpenAI);

      const contexts = [
        {
          id: '1',
          title: 'Test Context',
          content: 'This is test context content',
          type: 'test',
          tags: [],
          sessionId: 'session-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {},
        },
      ];

      const suggestions = await aiService.generateSuggestions(contexts, 'What should I do next?');

      expect(suggestions).toHaveLength(2);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ 
            role: 'user', 
            content: expect.stringContaining('What should I do next?')
          }]
        })
      );
    });
  });

  describe('Usage Statistics', () => {
    test('should track usage statistics', async () => {
      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [{ message: { content: 'Generated content' } }],
              model: 'gpt-4',
              usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
            }),
          },
        },
      };

      const { default: OpenAI } = await import('openai');
      (OpenAI as any).mockImplementation(() => mockOpenAI);

      const initialStats = aiService.getUsageStats();
      expect(initialStats.requestCount).toBe(0);
      expect(initialStats.totalTokensUsed).toBe(0);

      const request: AIGenerationRequest = {
        prompt: 'Generate a test response',
        provider: 'openai',
      };

      await aiService.generateContent(request);

      const updatedStats = aiService.getUsageStats();
      expect(updatedStats.requestCount).toBe(1);
      expect(updatedStats.totalTokensUsed).toBe(150);
      expect(updatedStats.providersEnabled).toBe(2);
    });
  });

  describe('Provider Testing', () => {
    test('should test provider connectivity', async () => {
      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [{ message: { content: 'Connection successful.' } }],
              model: 'gpt-4',
              usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
            }),
          },
        },
      };

      const { default: OpenAI } = await import('openai');
      (OpenAI as any).mockImplementation(() => mockOpenAI);

      const isConnected = await aiService.testProvider('openai');

      expect(isConnected).toBe(true);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ 
            role: 'user', 
            content: 'Hello, this is a connectivity test. Please respond with "Connection successful."'
          }]
        })
      );
    });

    test('should return false for failed provider test', async () => {
      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockRejectedValue(new Error('Connection failed')),
          },
        },
      };

      const { default: OpenAI } = await import('openai');
      (OpenAI as any).mockImplementation(() => mockOpenAI);

      const isConnected = await aiService.testProvider('openai');

      expect(isConnected).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Provider test failed for openai',
        expect.any(Error)
      );
    });
  });

  describe('Event Emission', () => {
    test('should emit contentGenerated event', async () => {
      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [{ message: { content: 'Generated content' } }],
              model: 'gpt-4',
              usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
            }),
          },
        },
      };

      const { default: OpenAI } = await import('openai');
      (OpenAI as any).mockImplementation(() => mockOpenAI);

      const eventSpy = vi.fn();
      aiService.on('contentGenerated', eventSpy);

      const request: AIGenerationRequest = {
        prompt: 'Generate a test response',
        provider: 'openai',
      };

      await aiService.generateContent(request);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Generated content',
          provider: 'OpenAI',
        })
      );
    });

    test('should emit analysisCompleted event', async () => {
      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [{ message: { content: 'Analysis complete' } }],
              model: 'gpt-4',
              usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
            }),
          },
        },
      };

      const { default: OpenAI } = await import('openai');
      (OpenAI as any).mockImplementation(() => mockOpenAI);

      const eventSpy = vi.fn();
      aiService.on('analysisCompleted', eventSpy);

      const contexts = [{
        id: '1',
        title: 'Test Context',
        content: 'This is test context content',
        type: 'test',
        tags: [],
        sessionId: 'session-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      }];

      const request: AIAnalysisRequest = {
        contexts,
        analysisType: 'summary',
        provider: 'openai',
      };

      await aiService.analyzeContexts(request);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          analysis: 'Analysis complete',
          provider: 'OpenAI',
        })
      );
    });
  });
});