import { EventEmitter } from 'events';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { Context, ContextMetadata } from '../../types/entities/context.js';
import { ContextStore } from '../context-store.js';
import { Logger } from '../logger.js';

export interface AIProvider {
  name: string;
  id: string;
  enabled: boolean;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIGenerationRequest {
  prompt: string;
  context?: Context[];
  maxTokens?: number;
  temperature?: number;
  provider?: string;
  systemPrompt?: string;
}

export interface AIGenerationResponse {
  content: string;
  provider: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata: {
    generatedAt: Date;
    requestId: string;
    processingTime: number;
  };
}

export interface AIAnalysisRequest {
  contexts: Context[];
  analysisType: 'summary' | 'insights' | 'patterns' | 'sentiment' | 'classification';
  provider?: string;
}

export interface AIAnalysisResponse {
  analysis: string;
  insights: string[];
  confidence: number;
  categories?: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
  provider: string;
  model: string;
}

export class AIIntegrationService extends EventEmitter {
  private contextStore: ContextStore;
  private logger: Logger;
  private providers: Map<string, AIProvider>;
  private openaiClient?: OpenAI;
  private anthropicClient?: Anthropic;
  private requestCount: number = 0;
  private totalTokensUsed: number = 0;

  constructor(contextStore: ContextStore, logger: Logger) {
    super();
    this.contextStore = contextStore;
    this.logger = logger;
    this.providers = new Map();
    
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Initialize OpenAI provider
    const openaiConfig: AIProvider = {
      name: 'OpenAI',
      id: 'openai',
      enabled: !!process.env.OPENAI_API_KEY,
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4',
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2048'),
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
    };

    if (openaiConfig.enabled && openaiConfig.apiKey) {
      this.openaiClient = new OpenAI({
        apiKey: openaiConfig.apiKey,
      });
      this.providers.set('openai', openaiConfig);
      this.logger.info('OpenAI provider initialized');
    }

    // Initialize Anthropic provider
    const anthropicConfig: AIProvider = {
      name: 'Anthropic',
      id: 'anthropic',
      enabled: !!process.env.ANTHROPIC_API_KEY,
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229',
      maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '2048'),
      temperature: parseFloat(process.env.ANTHROPIC_TEMPERATURE || '0.7'),
    };

    if (anthropicConfig.enabled && anthropicConfig.apiKey) {
      this.anthropicClient = new Anthropic({
        apiKey: anthropicConfig.apiKey,
      });
      this.providers.set('anthropic', anthropicConfig);
      this.logger.info('Anthropic provider initialized');
    }

    if (this.providers.size === 0) {
      this.logger.warn('No AI providers configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variables.');
    }
  }

  /**
   * Get available AI providers
   */
  getProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get a specific provider by ID
   */
  getProvider(providerId: string): AIProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Generate content using AI
   */
  async generateContent(request: AIGenerationRequest): Promise<AIGenerationResponse> {
    const startTime = Date.now();
    const requestId = `ai-gen-${++this.requestCount}-${Date.now()}`;

    this.logger.info(`AI generation request ${requestId}`, { 
      provider: request.provider,
      promptLength: request.prompt.length,
      contextCount: request.context?.length || 0
    });

    try {
      const provider = this.selectProvider(request.provider);
      let response: AIGenerationResponse;

      switch (provider.id) {
        case 'openai':
          response = await this.generateWithOpenAI(request, provider, requestId);
          break;
        case 'anthropic':
          response = await this.generateWithAnthropic(request, provider, requestId);
          break;
        default:
          throw new Error(`Unsupported AI provider: ${provider.id}`);
      }

      response.metadata.processingTime = Date.now() - startTime;
      this.totalTokensUsed += response.usage.totalTokens;

      // Store the generated content as a context
      await this.storeGeneratedContent(request, response);

      this.emit('contentGenerated', response);
      return response;

    } catch (error) {
      this.logger.error(`AI generation failed for request ${requestId}`, error);
      throw error;
    }
  }

  /**
   * Analyze contexts using AI
   */
  async analyzeContexts(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    const requestId = `ai-analysis-${++this.requestCount}-${Date.now()}`;
    
    this.logger.info(`AI analysis request ${requestId}`, {
      provider: request.provider,
      analysisType: request.analysisType,
      contextCount: request.contexts.length
    });

    try {
      const provider = this.selectProvider(request.provider);
      const analysisPrompt = this.buildAnalysisPrompt(request);

      const generationRequest: AIGenerationRequest = {
        prompt: analysisPrompt,
        context: request.contexts,
        provider: provider.id,
        systemPrompt: this.getSystemPromptForAnalysis(request.analysisType),
      };

      const response = await this.generateContent(generationRequest);
      
      // Parse the analysis response
      const analysisResponse = this.parseAnalysisResponse(response, request.analysisType);
      
      this.emit('analysisCompleted', analysisResponse);
      return analysisResponse;

    } catch (error) {
      this.logger.error(`AI analysis failed for request ${requestId}`, error);
      throw error;
    }
  }

  /**
   * Generate contextual suggestions based on current contexts
   */
  async generateSuggestions(contexts: Context[], userQuery?: string): Promise<string[]> {
    const contextSummaries = contexts.map(ctx => 
      `Title: ${ctx.title}\nType: ${ctx.type}\nContent: ${ctx.content.substring(0, 500)}...`
    ).join('\n\n');

    const prompt = userQuery 
      ? `Based on these contexts and the user query "${userQuery}", suggest 5 relevant follow-up questions or actions:\n\n${contextSummaries}`
      : `Based on these contexts, suggest 5 relevant insights or follow-up questions:\n\n${contextSummaries}`;

    const response = await this.generateContent({
      prompt,
      maxTokens: 500,
      temperature: 0.8,
      systemPrompt: 'You are a helpful assistant that generates relevant suggestions and insights. Return suggestions as a numbered list.',
    });

    // Parse suggestions from the response
    const suggestions = response.content
      .split('\n')
      .filter(line => line.match(/^\d+\./))
      .map(line => line.replace(/^\d+\.\s*/, ''))
      .slice(0, 5);

    return suggestions;
  }

  /**
   * Enhance context content with AI-generated metadata
   */
  async enhanceContext(context: Context): Promise<Partial<ContextMetadata>> {
    const prompt = `Analyze this context and provide metadata:

Title: ${context.title}
Type: ${context.type}
Content: ${context.content}

Please provide:
1. A brief summary (max 100 words)
2. Key topics/tags (max 5)
3. Importance level (low/medium/high/critical)
4. Sentiment (positive/negative/neutral)
5. Suggested categories

Format as JSON with keys: summary, tags, importance, sentiment, categories`;

    const response = await this.generateContent({
      prompt,
      maxTokens: 400,
      temperature: 0.3,
      systemPrompt: 'You are a metadata extraction assistant. Always respond with valid JSON.',
    });

    try {
      const metadata = JSON.parse(response.content);
      return {
        summary: metadata.summary,
        tags: metadata.tags || [],
        importance: metadata.importance || 'medium',
        aiGenerated: true,
        source: response.provider,
      };
    } catch (error) {
      this.logger.error('Failed to parse AI-generated metadata', error);
      return {
        aiGenerated: true,
        source: response.provider,
      };
    }
  }

  private async generateWithOpenAI(
    request: AIGenerationRequest, 
    provider: AIProvider, 
    requestId: string
  ): Promise<AIGenerationResponse> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }

    const messages: any[] = [];
    
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    if (request.context && request.context.length > 0) {
      const contextContent = request.context
        .map(ctx => `Title: ${ctx.title}\nContent: ${ctx.content}`)
        .join('\n\n');
      messages.push({ role: 'user', content: `Context:\n${contextContent}\n\nQuery: ${request.prompt}` });
    } else {
      messages.push({ role: 'user', content: request.prompt });
    }

    const completion = await this.openaiClient.chat.completions.create({
      model: provider.model || 'gpt-4',
      messages,
      max_tokens: request.maxTokens || provider.maxTokens,
      temperature: request.temperature || provider.temperature,
    });

    const choice = completion.choices[0];
    if (!choice?.message?.content) {
      throw new Error('No content received from OpenAI');
    }

    return {
      content: choice.message.content,
      provider: provider.name,
      model: completion.model,
      usage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
      },
      metadata: {
        generatedAt: new Date(),
        requestId,
        processingTime: 0, // Will be set by caller
      },
    };
  }

  private async generateWithAnthropic(
    request: AIGenerationRequest, 
    provider: AIProvider, 
    requestId: string
  ): Promise<AIGenerationResponse> {
    if (!this.anthropicClient) {
      throw new Error('Anthropic client not initialized');
    }

    let prompt = request.prompt;
    
    if (request.context && request.context.length > 0) {
      const contextContent = request.context
        .map(ctx => `Title: ${ctx.title}\nContent: ${ctx.content}`)
        .join('\n\n');
      prompt = `Context:\n${contextContent}\n\nQuery: ${request.prompt}`;
    }

    const message = await this.anthropicClient.messages.create({
      model: provider.model || 'claude-3-sonnet-20240229',
      max_tokens: request.maxTokens || provider.maxTokens || 2048,
      temperature: request.temperature || provider.temperature,
      system: request.systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Anthropic');
    }

    return {
      content: content.text,
      provider: provider.name,
      model: message.model,
      usage: {
        promptTokens: message.usage.input_tokens,
        completionTokens: message.usage.output_tokens,
        totalTokens: message.usage.input_tokens + message.usage.output_tokens,
      },
      metadata: {
        generatedAt: new Date(),
        requestId,
        processingTime: 0, // Will be set by caller
      },
    };
  }

  private selectProvider(preferredProvider?: string): AIProvider {
    if (preferredProvider) {
      const provider = this.providers.get(preferredProvider);
      if (provider && provider.enabled) {
        return provider;
      }
      this.logger.warn(`Preferred provider ${preferredProvider} not available, falling back to default`);
    }

    // Return first available provider
    for (const provider of this.providers.values()) {
      if (provider.enabled) {
        return provider;
      }
    }

    throw new Error('No AI providers available');
  }

  private buildAnalysisPrompt(request: AIAnalysisRequest): string {
    const contextContent = request.contexts
      .map((ctx, index) => `Context ${index + 1}:\nTitle: ${ctx.title}\nType: ${ctx.type}\nContent: ${ctx.content}`)
      .join('\n\n');

    switch (request.analysisType) {
      case 'summary':
        return `Provide a comprehensive summary of these contexts:\n\n${contextContent}`;
      
      case 'insights':
        return `Analyze these contexts and provide key insights and patterns:\n\n${contextContent}`;
      
      case 'patterns':
        return `Identify patterns, themes, and relationships across these contexts:\n\n${contextContent}`;
      
      case 'sentiment':
        return `Analyze the sentiment and emotional tone of these contexts:\n\n${contextContent}`;
      
      case 'classification':
        return `Classify and categorize these contexts by topic, importance, and type:\n\n${contextContent}`;
      
      default:
        return `Analyze these contexts:\n\n${contextContent}`;
    }
  }

  private getSystemPromptForAnalysis(analysisType: string): string {
    const basePrompt = 'You are an expert analyst specializing in content analysis and pattern recognition.';
    
    switch (analysisType) {
      case 'summary':
        return `${basePrompt} Provide clear, concise summaries that capture the key points and main themes.`;
      
      case 'insights':
        return `${basePrompt} Focus on extracting actionable insights, trends, and meaningful observations.`;
      
      case 'patterns':
        return `${basePrompt} Identify recurring themes, relationships, and structural patterns in the content.`;
      
      case 'sentiment':
        return `${basePrompt} Analyze emotional tone, sentiment, and attitudinal indicators in the content.`;
      
      case 'classification':
        return `${basePrompt} Categorize content systematically and suggest appropriate classification schemes.`;
      
      default:
        return basePrompt;
    }
  }

  private parseAnalysisResponse(response: AIGenerationResponse, analysisType: string): AIAnalysisResponse {
    // Basic parsing - in a real implementation, this would be more sophisticated
    const content = response.content;
    const lines = content.split('\n').filter(line => line.trim());
    
    return {
      analysis: content,
      insights: lines.filter(line => line.includes('insight') || line.includes('pattern')).slice(0, 5),
      confidence: 0.85, // Would be calculated based on response quality
      provider: response.provider,
      model: response.model,
      sentiment: analysisType === 'sentiment' ? this.extractSentiment(content) : undefined,
      categories: analysisType === 'classification' ? this.extractCategories(content) : undefined,
    };
  }

  private extractSentiment(content: string): 'positive' | 'negative' | 'neutral' {
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes('positive') || lowerContent.includes('optimistic')) return 'positive';
    if (lowerContent.includes('negative') || lowerContent.includes('pessimistic')) return 'negative';
    return 'neutral';
  }

  private extractCategories(content: string): string[] {
    // Simple category extraction - would be more sophisticated in practice
    const categories: string[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.includes('category') || line.includes('type') || line.includes('class')) {
        const match = line.match(/["']([^"']+)["']/);
        if (match) {
          categories.push(match[1]);
        }
      }
    }
    
    return categories.slice(0, 5);
  }

  private async storeGeneratedContent(request: AIGenerationRequest, response: AIGenerationResponse): Promise<void> {
    try {
      const context = await this.contextStore.createContext({
        title: `AI Generated Content - ${new Date().toISOString()}`,
        content: response.content,
        type: 'ai-generated',
        tags: ['ai-generated', response.provider.toLowerCase()],
        sessionId: `ai-session-${Date.now()}`,
        metadata: {
          aiGenerated: true,
          source: response.provider,
          model: response.model,
          originalPrompt: request.prompt,
          tokenUsage: response.usage,
          generatedAt: response.metadata.generatedAt,
          requestId: response.metadata.requestId,
        },
      });

      this.logger.info(`Stored AI-generated content as context ${context.id}`);
    } catch (error) {
      this.logger.error('Failed to store AI-generated content', error);
    }
  }

  /**
   * Get usage statistics
   */
  getUsageStats(): {
    requestCount: number;
    totalTokensUsed: number;
    providersEnabled: number;
    providers: AIProvider[];
  } {
    return {
      requestCount: this.requestCount,
      totalTokensUsed: this.totalTokensUsed,
      providersEnabled: Array.from(this.providers.values()).filter(p => p.enabled).length,
      providers: this.getProviders(),
    };
  }

  /**
   * Test provider connectivity
   */
  async testProvider(providerId: string): Promise<boolean> {
    try {
      const testResponse = await this.generateContent({
        prompt: 'Hello, this is a connectivity test. Please respond with "Connection successful."',
        provider: providerId,
        maxTokens: 50,
      });

      return testResponse.content.toLowerCase().includes('connection successful');
    } catch (error) {
      this.logger.error(`Provider test failed for ${providerId}`, error);
      return false;
    }
  }
}