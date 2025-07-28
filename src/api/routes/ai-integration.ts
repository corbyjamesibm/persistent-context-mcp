import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AIIntegrationService, AIGenerationRequest, AIAnalysisRequest } from '../../core/services/ai-integration.service.js';
import { authenticateLLM } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { Logger } from '../../core/logger.js';

const router = Router();

// Input validation schemas
const GenerateContentSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  contextIds: z.array(z.string()).optional(),
  maxTokens: z.number().min(1).max(4000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  provider: z.string().optional(),
  systemPrompt: z.string().optional(),
});

const AnalyzeContextsSchema = z.object({
  contextIds: z.array(z.string()).min(1, 'At least one context ID is required'),
  analysisType: z.enum(['summary', 'insights', 'patterns', 'sentiment', 'classification']),
  provider: z.string().optional(),
});

const EnhanceContextSchema = z.object({
  contextId: z.string().min(1, 'Context ID is required'),
  provider: z.string().optional(),
});

const GenerateSuggestionsSchema = z.object({
  contextIds: z.array(z.string()).min(1, 'At least one context ID is required'),
  userQuery: z.string().optional(),
  provider: z.string().optional(),
});

/**
 * GET /api/ai/providers
 * Get available AI providers and their status
 */
router.get('/providers', authenticateLLM, async (req: Request, res: Response) => {
  try {
    const aiService = req.app.get('aiIntegrationService') as AIIntegrationService;
    const providers = aiService.getProviders();
    
    res.json({
      success: true,
      data: {
        providers,
        stats: aiService.getUsageStats(),
      },
    });
  } catch (error) {
    const logger = req.app.get('logger') as Logger;
    logger.error('Failed to get AI providers', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve AI providers',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/ai/providers/:providerId/test
 * Test connectivity to a specific AI provider
 */
router.post('/providers/:providerId/test', authenticateLLM, async (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    const aiService = req.app.get('aiIntegrationService') as AIIntegrationService;
    
    const isConnected = await aiService.testProvider(providerId);
    
    res.json({
      success: true,
      data: {
        providerId,
        connected: isConnected,
        testedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const logger = req.app.get('logger') as Logger;
    logger.error(`Failed to test AI provider ${req.params.providerId}`, error);
    
    res.status(500).json({
      success: false,
      message: 'Provider test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/ai/generate
 * Generate content using AI
 */
router.post('/generate', 
  authenticateLLM, 
  validateRequest(GenerateContentSchema), 
  async (req: Request, res: Response) => {
    try {
      const aiService = req.app.get('aiIntegrationService') as AIIntegrationService;
      const contextStore = req.app.get('contextStore');
      const logger = req.app.get('logger') as Logger;

      const { prompt, contextIds, maxTokens, temperature, provider, systemPrompt } = req.body;

      // Fetch contexts if provided
      let contexts = [];
      if (contextIds && contextIds.length > 0) {
        for (const contextId of contextIds) {
          try {
            const context = await contextStore.getContext(contextId);
            if (context) {
              contexts.push(context);
            }
          } catch (error) {
            logger.warn(`Failed to fetch context ${contextId}`, error);
          }
        }
      }

      const request: AIGenerationRequest = {
        prompt,
        context: contexts,
        maxTokens,
        temperature,
        provider,
        systemPrompt,
      };

      const response = await aiService.generateContent(request);

      res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      const logger = req.app.get('logger') as Logger;
      logger.error('AI content generation failed', error);
      
      res.status(500).json({
        success: false,
        message: 'Content generation failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /api/ai/analyze
 * Analyze contexts using AI
 */
router.post('/analyze', 
  authenticateLLM, 
  validateRequest(AnalyzeContextsSchema), 
  async (req: Request, res: Response) => {
    try {
      const aiService = req.app.get('aiIntegrationService') as AIIntegrationService;
      const contextStore = req.app.get('contextStore');
      const logger = req.app.get('logger') as Logger;

      const { contextIds, analysisType, provider } = req.body;

      // Fetch contexts
      const contexts = [];
      for (const contextId of contextIds) {
        try {
          const context = await contextStore.getContext(contextId);
          if (context) {
            contexts.push(context);
          }
        } catch (error) {
          logger.warn(`Failed to fetch context ${contextId}`, error);
        }
      }

      if (contexts.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid contexts found for analysis',
        });
      }

      const request: AIAnalysisRequest = {
        contexts,
        analysisType,
        provider,
      };

      const response = await aiService.analyzeContexts(request);

      res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      const logger = req.app.get('logger') as Logger;
      logger.error('AI context analysis failed', error);
      
      res.status(500).json({
        success: false,
        message: 'Context analysis failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /api/ai/enhance
 * Enhance a context with AI-generated metadata
 */
router.post('/enhance', 
  authenticateLLM, 
  validateRequest(EnhanceContextSchema), 
  async (req: Request, res: Response) => {
    try {
      const aiService = req.app.get('aiIntegrationService') as AIIntegrationService;
      const contextStore = req.app.get('contextStore');
      const logger = req.app.get('logger') as Logger;

      const { contextId, provider } = req.body;

      // Fetch the context
      const context = await contextStore.getContext(contextId);
      if (!context) {
        return res.status(404).json({
          success: false,
          message: 'Context not found',
        });
      }

      // Generate enhanced metadata
      const enhancedMetadata = await aiService.enhanceContext(context);

      // Update the context with enhanced metadata
      const updatedContext = await contextStore.updateContext(contextId, {
        metadata: {
          ...context.metadata,
          ...enhancedMetadata,
        },
      });

      res.json({
        success: true,
        data: {
          contextId,
          enhancedMetadata,
          updatedContext,
        },
      });
    } catch (error) {
      const logger = req.app.get('logger') as Logger;
      logger.error('Context enhancement failed', error);
      
      res.status(500).json({
        success: false,
        message: 'Context enhancement failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /api/ai/suggestions
 * Generate contextual suggestions
 */
router.post('/suggestions', 
  authenticateLLM, 
  validateRequest(GenerateSuggestionsSchema), 
  async (req: Request, res: Response) => {
    try {
      const aiService = req.app.get('aiIntegrationService') as AIIntegrationService;
      const contextStore = req.app.get('contextStore');
      const logger = req.app.get('logger') as Logger;

      const { contextIds, userQuery, provider } = req.body;

      // Fetch contexts
      const contexts = [];
      for (const contextId of contextIds) {
        try {
          const context = await contextStore.getContext(contextId);
          if (context) {
            contexts.push(context);
          }
        } catch (error) {
          logger.warn(`Failed to fetch context ${contextId}`, error);
        }
      }

      if (contexts.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid contexts found for suggestions',
        });
      }

      const suggestions = await aiService.generateSuggestions(contexts, userQuery);

      res.json({
        success: true,
        data: {
          suggestions,
          contextCount: contexts.length,
          userQuery,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      const logger = req.app.get('logger') as Logger;
      logger.error('Suggestion generation failed', error);
      
      res.status(500).json({
        success: false,
        message: 'Suggestion generation failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/ai/usage
 * Get AI usage statistics
 */
router.get('/usage', authenticateLLM, async (req: Request, res: Response) => {
  try {
    const aiService = req.app.get('aiIntegrationService') as AIIntegrationService;
    const stats = aiService.getUsageStats();
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    const logger = req.app.get('logger') as Logger;
    logger.error('Failed to get AI usage statistics', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve usage statistics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/ai/batch-enhance
 * Enhance multiple contexts with AI-generated metadata
 */
router.post('/batch-enhance', authenticateLLM, async (req: Request, res: Response) => {
  try {
    const aiService = req.app.get('aiIntegrationService') as AIIntegrationService;
    const contextStore = req.app.get('contextStore');
    const logger = req.app.get('logger') as Logger;

    const { contextIds, provider } = req.body;

    if (!Array.isArray(contextIds) || contextIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Context IDs array is required',
      });
    }

    const results = [];
    const errors = [];

    for (const contextId of contextIds) {
      try {
        const context = await contextStore.getContext(contextId);
        if (!context) {
          errors.push({ contextId, error: 'Context not found' });
          continue;
        }

        const enhancedMetadata = await aiService.enhanceContext(context);
        
        const updatedContext = await contextStore.updateContext(contextId, {
          metadata: {
            ...context.metadata,
            ...enhancedMetadata,
          },
        });

        results.push({
          contextId,
          enhancedMetadata,
          success: true,
        });

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        logger.error(`Failed to enhance context ${contextId}`, error);
        errors.push({
          contextId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    res.json({
      success: true,
      data: {
        results,
        errors,
        summary: {
          total: contextIds.length,
          successful: results.length,
          failed: errors.length,
        },
      },
    });
  } catch (error) {
    const logger = req.app.get('logger') as Logger;
    logger.error('Batch enhancement failed', error);
    
    res.status(500).json({
      success: false,
      message: 'Batch enhancement failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;