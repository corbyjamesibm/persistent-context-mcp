/**
 * Express.js server setup for the persistent context store API
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { Neo4jContextStore } from '../core/storage/neo4j-store.js';
import { ContextManagerService } from '../core/services/context-manager.service.js';
import { logger } from '../utils/logger.js';

export function createServer(
  contextStore: Neo4jContextStore,
  contextManager?: ContextManagerService
): express.Application {
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }));

  // CORS configuration
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  }));

  // Compression and parsing middleware
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging middleware
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    next();
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      service: 'persistent-context-store'
    });
  });

  // API routes
  const apiRouter = express.Router();

  // Context routes
  apiRouter.get('/contexts', async (req, res) => {
    try {
      const { q, type } = req.query;
      const contexts = await contextStore.searchContexts(
        q as string, 
        { type: type as any }
      );
      res.json({ data: contexts });
    } catch (error) {
      logger.error('Error fetching contexts:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  apiRouter.post('/contexts', async (req, res) => {
    try {
      const contextData = req.body;
      const contextId = await contextStore.saveContext(contextData);
      const savedContext = await contextStore.getContext(contextId);
      res.status(201).json({ data: savedContext });
    } catch (error) {
      logger.error('Error creating context:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  apiRouter.get('/contexts/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const context = await contextStore.getContext(id);
      if (!context) {
        return res.status(404).json({ error: 'Context not found' });
      }
      res.json({ data: context });
    } catch (error) {
      logger.error('Error fetching context:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  apiRouter.put('/contexts/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const updatedContext = await contextStore.updateContext(id, updates);
      if (!updatedContext) {
        return res.status(404).json({ error: 'Context not found' });
      }
      res.json({ data: updatedContext });
    } catch (error) {
      logger.error('Error updating context:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Auto-save and session management routes (if context manager is available)
  if (contextManager) {
    // Immediate save endpoint
    apiRouter.post('/contexts/save', async (req, res) => {
      try {
        const { sessionId, ...contextData } = req.body;
        if (!sessionId) {
          return res.status(400).json({ error: 'sessionId is required' });
        }

        const result = await contextManager.saveContextImmediate(sessionId, contextData);
        if (result.success) {
          res.status(201).json({ 
            data: { contextId: result.contextId }, 
            message: 'Context saved successfully' 
          });
        } else {
          res.status(500).json({ error: result.error });
        }
      } catch (error) {
        logger.error('Error in immediate save:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Session management endpoints
    apiRouter.get('/sessions/recent', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit as string) || 10;
        const sessions = await contextManager.getRecentSessions(limit);
        res.json({ data: sessions });
      } catch (error) {
        logger.error('Error fetching recent sessions:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    apiRouter.post('/sessions/:sessionId/resume', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const context = await contextManager.resumeSession(sessionId);
        if (context) {
          res.json({ data: context, message: 'Session resumed successfully' });
        } else {
          res.status(404).json({ error: 'Session not found or no recent context available' });
        }
      } catch (error) {
        logger.error('Error resuming session:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    apiRouter.get('/sessions/:sessionId/contexts', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const limit = parseInt(req.query.limit as string) || 20;
        const contexts = await contextManager.getSessionContexts(sessionId, limit);
        res.json({ data: contexts });
      } catch (error) {
        logger.error('Error fetching session contexts:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // System status endpoint
    apiRouter.get('/system/status', (req, res) => {
      try {
        const status = contextManager.getSystemStatus();
        res.json({ data: status });
      } catch (error) {
        logger.error('Error fetching system status:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // MCP tool endpoint for save_context
    apiRouter.post('/mcp/save-context', async (req, res) => {
      try {
        const saveContextTool = contextManager.getSaveContextTool();
        const result = await saveContextTool.execute(req.body);
        res.json(result);
      } catch (error) {
        logger.error('Error in MCP save-context tool:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Internal server error',
          sessionId: req.body.sessionId || 'unknown',
          message: 'Tool execution failed',
          metadata: {
            savedAt: new Date().toISOString(),
            autoSave: false,
            pendingChanges: false,
          }
        });
      }
    });
  }

  // Mount API routes
  app.use('/api/v1', apiRouter);

  // Error handling middleware
  app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}