/**
 * Authentication middleware for LLM access to context store
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../../utils/logger.js';

export interface AuthenticatedRequest extends Request {
  llmClient?: {
    id: string;
    name: string;
    permissions: string[];
    rateLimit: {
      requests: number;
      windowMs: number;
    };
  };
}

export interface LLMClient {
  id: string;
  name: string;
  apiKey: string;
  apiKeyHash: string;
  permissions: string[];
  rateLimit: {
    requests: number;
    windowMs: number;
  };
  active: boolean;
  createdAt: Date;
  lastUsed?: Date;
}

/**
 * In-memory client store (in production, this would be a database)
 */
class LLMClientStore {
  private clients: Map<string, LLMClient> = new Map();
  private requestCounts: Map<string, { count: number; resetTime: number }> = new Map();

  constructor() {
    this.initializeDefaultClients();
  }

  private initializeDefaultClients() {
    // Default Claude client for development
    const claudeApiKey = process.env.CLAUDE_API_KEY || this.generateApiKey();
    this.addClient({
      id: 'claude-default',
      name: 'Claude Assistant',
      apiKey: claudeApiKey,
      permissions: ['read', 'write', 'search', 'manage_sessions'],
      rateLimit: {
        requests: 1000,
        windowMs: 60000, // 1 minute
      },
    });

    // General LLM client for other AI systems
    const generalApiKey = process.env.LLM_API_KEY || this.generateApiKey();
    this.addClient({
      id: 'llm-general',
      name: 'General LLM Client',
      apiKey: generalApiKey,
      permissions: ['read', 'search'],
      rateLimit: {
        requests: 500,
        windowMs: 60000,
      },
    });

    logger.info('LLM clients initialized', {
      clientCount: this.clients.size,
      claudeKey: claudeApiKey.substring(0, 8) + '...',
      generalKey: generalApiKey.substring(0, 8) + '...',
    });
  }

  private generateApiKey(): string {
    return 'llm_' + crypto.randomBytes(32).toString('hex');
  }

  private hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  addClient(config: {
    id: string;
    name: string;
    apiKey: string;
    permissions: string[];
    rateLimit: { requests: number; windowMs: number };
  }): LLMClient {
    const client: LLMClient = {
      id: config.id,
      name: config.name,
      apiKey: config.apiKey,
      apiKeyHash: this.hashApiKey(config.apiKey),
      permissions: config.permissions,
      rateLimit: config.rateLimit,
      active: true,
      createdAt: new Date(),
    };

    this.clients.set(client.id, client);
    logger.info(`LLM client added: ${client.name} (${client.id})`);
    return client;
  }

  authenticateClient(apiKey: string): LLMClient | null {
    const hash = this.hashApiKey(apiKey);
    
    for (const client of this.clients.values()) {
      if (client.apiKeyHash === hash && client.active) {
        client.lastUsed = new Date();
        return client;
      }
    }
    
    return null;
  }

  checkRateLimit(clientId: string, rateLimit: { requests: number; windowMs: number }): boolean {
    const now = Date.now();
    const current = this.requestCounts.get(clientId);

    if (!current || now > current.resetTime) {
      // Reset window
      this.requestCounts.set(clientId, {
        count: 1,
        resetTime: now + rateLimit.windowMs,
      });
      return true;
    }

    if (current.count >= rateLimit.requests) {
      return false; // Rate limit exceeded
    }

    current.count++;
    return true;
  }

  getClient(id: string): LLMClient | undefined {
    return this.clients.get(id);
  }

  getAllClients(): LLMClient[] {
    return Array.from(this.clients.values());
  }

  deactivateClient(id: string): boolean {
    const client = this.clients.get(id);
    if (client) {
      client.active = false;
      logger.info(`LLM client deactivated: ${client.name} (${id})`);
      return true;
    }
    return false;
  }
}

// Global client store instance
export const llmClientStore = new LLMClientStore();

/**
 * Authentication middleware for LLM API access
 */
export function authenticateLLM(requiredPermissions: string[] = []) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide API key in Authorization header as "Bearer <api-key>"',
      });
    }

    const apiKey = authHeader.substring(7);
    const client = llmClientStore.authenticateClient(apiKey);

    if (!client) {
      logger.warn('Invalid API key used', { 
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
      });
      
      return res.status(401).json({
        error: 'Invalid API key',
        message: 'The provided API key is not valid or has been deactivated',
      });
    }

    // Check rate limits
    if (!llmClientStore.checkRateLimit(client.id, client.rateLimit)) {
      logger.warn('Rate limit exceeded', {
        clientId: client.id,
        clientName: client.name,
        ip: req.ip,
      });
      
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Rate limit of ${client.rateLimit.requests} requests per ${client.rateLimit.windowMs}ms exceeded`,
        retryAfter: Math.ceil(client.rateLimit.windowMs / 1000),
      });
    }

    // Check permissions
    const hasRequiredPermissions = requiredPermissions.every(permission => 
      client.permissions.includes(permission)
    );

    if (!hasRequiredPermissions) {
      logger.warn('Insufficient permissions', {
        clientId: client.id,
        clientName: client.name,
        requiredPermissions,
        clientPermissions: client.permissions,
      });
      
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: `Required permissions: ${requiredPermissions.join(', ')}`,
        clientPermissions: client.permissions,
      });
    }

    // Attach client info to request
    req.llmClient = {
      id: client.id,
      name: client.name,
      permissions: client.permissions,
      rateLimit: client.rateLimit,
    };

    logger.debug('LLM client authenticated', {
      clientId: client.id,
      clientName: client.name,
      path: req.path,
      method: req.method,
    });

    next();
  };
}

/**
 * Middleware to require specific permissions
 */
export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.llmClient) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Client not authenticated',
      });
    }

    if (!req.llmClient.permissions.includes(permission)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: `Permission '${permission}' required`,
        clientPermissions: req.llmClient.permissions,
      });
    }

    next();
  };
}

/**
 * Middleware to add CORS headers for LLM access
 */
export function llmCors() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Allow LLM access from any origin for development
    // In production, restrict to specific LLM service domains
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Max-Age', '86400'); // 24 hours

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    next();
  };
}

/**
 * Error handler for authentication errors
 */
export function authErrorHandler() {
  return (error: any, req: Request, res: Response, next: NextFunction) => {
    if (error.name === 'UnauthorizedError') {
      return res.status(401).json({
        error: 'Authentication failed',
        message: error.message,
      });
    }

    next(error);
  };
}